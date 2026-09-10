import "server-only";

import {
  and,
  desc,
  eq,
} from "drizzle-orm";

import {
  consumeWorkflowRunAllowance,
  WorkflowUsageLimitError,
} from "@/features/billing/usage";
import {
  inngest,
  workflowRunRequested,
} from "@/inngest/client";
import { db } from "@/lib/db";
import {
  workflow,
  workflowVersion,
} from "@/lib/db/schema/workflow";
import {
  workflowLog,
  workflowRun,
  workflowRunStep,
} from "@/lib/db/schema/workflow-execution";
import {
  workflowWebhookRequest,
} from "@/lib/db/schema/workflow-webhook";

import {
  createExecutionPlan,
} from "./execution-plan";

export type WorkflowRunTriggerType =
  | "MANUAL"
  | "WEBHOOK"
  | "SCHEDULE";

type WebhookRequestOptions = {
  webhookId: string;
  idempotencyKey: string;
  payloadHash: string;
};

type QueueWorkflowRunOptions = {
  workflowId: string;
  triggerType: WorkflowRunTriggerType;
  input: Record<string, unknown>;
  triggeredBy?: string | null;
  webhookRequest?: WebhookRequestOptions;
};

type FailWorkflowRunOptions = {
  runId: string;
  message: string;
  triggerType: WorkflowRunTriggerType;
  source: string;
  metadata?: Record<
    string,
    unknown
  >;
};

export class WorkflowRunQueueError
  extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "WorkflowRunQueueError";
  }
}

export class DuplicateWebhookRequestError
  extends Error {
  constructor() {
    super(
      "A webhook request with this idempotency key already exists."
    );

    this.name =
      "DuplicateWebhookRequestError";
  }
}

async function failWorkflowRun({
  runId,
  message,
  triggerType,
  source,
  metadata = {},
}: FailWorkflowRunOptions) {
  await db.transaction(
    async (transaction) => {
      const completedAt = new Date();

      await transaction
        .update(workflowRun)
        .set({
          status: "FAILED",
          error: message,
          completedAt,
        })
        .where(
          eq(
            workflowRun.id,
            runId
          )
        );

      await transaction
        .update(workflowRunStep)
        .set({
          status: "SKIPPED",
          completedAt,
        })
        .where(
          and(
            eq(
              workflowRunStep.runId,
              runId
            ),
            eq(
              workflowRunStep.status,
              "PENDING"
            )
          )
        );

      await transaction
        .insert(workflowLog)
        .values({
          id: crypto.randomUUID(),
          runId,
          level: "ERROR",
          message,
          metadata: {
            source,
            triggerType,
            ...metadata,
          },
        });
    }
  );
}

export async function queueWorkflowRun({
  workflowId,
  triggerType,
  input,
  triggeredBy = null,
  webhookRequest,
}: QueueWorkflowRunOptions): Promise<{
  id: string;
  status: "PENDING";
}> {
  const [existingWorkflow] =
    await db
      .select({
        id: workflow.id,
        workspaceId:
          workflow.workspaceId,
        status: workflow.status,
      })
      .from(workflow)
      .where(
        eq(
          workflow.id,
          workflowId
        )
      )
      .limit(1);

  if (!existingWorkflow) {
    throw new WorkflowRunQueueError(
      "Workflow not found."
    );
  }

  if (
    existingWorkflow.status !==
    "ACTIVE"
  ) {
    throw new WorkflowRunQueueError(
      "Only active workflows can be executed."
    );
  }

  const [publishedVersion] =
    await db
      .select()
      .from(workflowVersion)
      .where(
        and(
          eq(
            workflowVersion.workflowId,
            workflowId
          ),
          eq(
            workflowVersion.status,
            "PUBLISHED"
          )
        )
      )
      .orderBy(
        desc(
          workflowVersion.version
        )
      )
      .limit(1);

  if (!publishedVersion) {
    throw new WorkflowRunQueueError(
      "The workflow has no published version."
    );
  }

  const executionPlan =
    createExecutionPlan(
      workflowId,
      publishedVersion.definition
    );

  const runId = crypto.randomUUID();

  const stepValues =
    executionPlan.actions.map(
      (action) => ({
        id: crypto.randomUUID(),
        runId,
        nodeId: action.id,
        nodeType: action.type,
        status: "PENDING" as const,
        input: {},
      })
    );

  await db.transaction(
    async (transaction) => {
      await transaction
        .insert(workflowRun)
        .values({
          id: runId,
          workflowId,
          workflowVersionId:
            publishedVersion.id,
          status: "PENDING",
          triggerType,
          input,
          triggeredBy,
        });

      if (webhookRequest) {
        const [createdRequest] =
          await transaction
            .insert(
              workflowWebhookRequest
            )
            .values({
              id: crypto.randomUUID(),
              webhookId:
                webhookRequest.webhookId,
              idempotencyKey:
                webhookRequest
                  .idempotencyKey,
              payloadHash:
                webhookRequest.payloadHash,
              runId,
            })
            .onConflictDoNothing({
              target: [
                workflowWebhookRequest
                  .webhookId,
                workflowWebhookRequest
                  .idempotencyKey,
              ],
            })
            .returning({
              id:
                workflowWebhookRequest.id,
            });

        if (!createdRequest) {
          throw new DuplicateWebhookRequestError();
        }
      }

      await transaction
        .insert(workflowRunStep)
        .values(stepValues);
    }
  );

  let usage: Awaited<
    ReturnType<
      typeof consumeWorkflowRunAllowance
    >
  >;

  try {
    usage =
      await consumeWorkflowRunAllowance(
        existingWorkflow.workspaceId
      );
  } catch (error) {
    const isLimitError =
      error instanceof
      WorkflowUsageLimitError;

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Workflow usage could not be recorded.";

    await failWorkflowRun({
      runId,
      message: errorMessage,
      triggerType,
      source: isLimitError
        ? "usage-limit"
        : "usage-metering",
      metadata: isLimitError
        ? {
            plan: error.plan,
            limit: error.limit,
          }
        : {},
    });

    throw new WorkflowRunQueueError(
      errorMessage
    );
  }

  try {
    await db
      .insert(workflowLog)
      .values({
        id: crypto.randomUUID(),
        runId,
        level: "INFO",
        message:
          "Workflow execution queued.",
        metadata: {
          version:
            publishedVersion.version,
          engine: "inngest",
          triggerType,
          plan: usage.plan,
          monthlyWorkflowRuns:
            usage.workflowRuns,
          monthlyWorkflowRunLimit:
            usage.limit,
        },
      });

    const event =
      workflowRunRequested.create({
        runId,
      });

    await inngest.send({
      ...event,
      id: runId,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to queue workflow execution.";

    await failWorkflowRun({
      runId,
      message: errorMessage,
      triggerType,
      source: "event-dispatch",
    });

    throw new WorkflowRunQueueError(
      errorMessage
    );
  }

  return {
    id: runId,
    status: "PENDING",
  };
}
import "server-only";

import {
  and,
  eq,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
  workspaceSubscription,
  workspaceUsage,
} from "@/lib/db/schema";

import {
  getEffectivePlan,
  getPlanLimits,
  type BillingPlan,
} from "./plans";

export class WorkflowUsageLimitError extends Error {
  readonly plan: BillingPlan;
  readonly limit: number;

  constructor({
    plan,
    limit,
  }: {
    plan: BillingPlan;
    limit: number;
  }) {
    super(
      `${plan} workspaces can execute up to ${limit} workflow runs per month.`
    );

    this.name =
      "WorkflowUsageLimitError";

    this.plan = plan;
    this.limit = limit;
  }
}

export class ActionExecutionUsageLimitError extends Error {
  readonly plan: BillingPlan;
  readonly limit: number;

  constructor({
    plan,
    limit,
  }: {
    plan: BillingPlan;
    limit: number;
  }) {
    super(
      `${plan} workspaces can execute up to ${limit} actions per month.`
    );

    this.name =
      "ActionExecutionUsageLimitError";

    this.plan = plan;
    this.limit = limit;
  }
}

export class AiTokenUsageLimitError extends Error {
  readonly plan: BillingPlan;
  readonly limit: number;

  constructor({
    plan,
    limit,
  }: {
    plan: BillingPlan;
    limit: number;
  }) {
    super(
      `${plan} workspaces can use up to ${limit} AI tokens per month.`
    );

    this.name =
      "AiTokenUsageLimitError";

    this.plan = plan;
    this.limit = limit;
  }
}

export function getUsagePeriodStart(
  date = new Date()
): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1
    )
  );
}

export async function getWorkspaceUsage(
  workspaceId: string
) {
  const periodStart =
    getUsagePeriodStart();

  const [
    subscriptionRows,
    usageRows,
  ] = await Promise.all([
    db
      .select({
        plan:
          workspaceSubscription.plan,
        status:
          workspaceSubscription.status,
        currentPeriodEnd:
          workspaceSubscription
            .currentPeriodEnd,
        cancelAtPeriodEnd:
          workspaceSubscription
            .cancelAtPeriodEnd,
      })
      .from(workspaceSubscription)
      .where(
        eq(
          workspaceSubscription
            .workspaceId,
          workspaceId
        )
      )
      .limit(1),

    db
      .select({
        workflowRuns:
          workspaceUsage.workflowRuns,
        actionExecutions:
          workspaceUsage
            .actionExecutions,
        aiInputTokens:
          workspaceUsage.aiInputTokens,
        aiOutputTokens:
          workspaceUsage.aiOutputTokens,
        aiOtherTokens:
          workspaceUsage.aiOtherTokens,
      })
      .from(workspaceUsage)
      .where(
        and(
          eq(
            workspaceUsage.workspaceId,
            workspaceId
          ),
          eq(
            workspaceUsage.periodStart,
            periodStart
          )
        )
      )
      .limit(1),
  ]);

  const subscription =
    subscriptionRows[0];

  const usage = usageRows[0] ?? {
    workflowRuns: 0,
    actionExecutions: 0,
    aiInputTokens: 0,
    aiOutputTokens: 0,
    aiOtherTokens: 0,
  };

  const plan = getEffectivePlan({
    plan: subscription?.plan,
    status: subscription?.status,
  });

  return {
    plan,
    limits: getPlanLimits(plan),
    usage: {
      ...usage,
      aiTokens:
        usage.aiInputTokens +
        usage.aiOutputTokens +
        usage.aiOtherTokens,
    },
    subscription: subscription
      ? {
          status:
            subscription.status,
          currentPeriodEnd:
            subscription.currentPeriodEnd,
          cancelAtPeriodEnd:
            subscription.cancelAtPeriodEnd,
        }
      : null,
    periodStart,
  };
}

export async function consumeWorkflowRunAllowance(
  workspaceId: string
) {
  const periodStart =
    getUsagePeriodStart();

  return db.transaction(
    async (transaction) => {
      const [subscription] =
        await transaction
          .select({
            plan:
              workspaceSubscription.plan,
            status:
              workspaceSubscription.status,
          })
          .from(
            workspaceSubscription
          )
          .where(
            eq(
              workspaceSubscription
                .workspaceId,
              workspaceId
            )
          )
          .limit(1);

      const plan = getEffectivePlan({
        plan: subscription?.plan,
        status: subscription?.status,
      });

      const limits =
        getPlanLimits(plan);

      const [updatedUsage] =
        await transaction
          .insert(workspaceUsage)
          .values({
            id: crypto.randomUUID(),
            workspaceId,
            periodStart,
            workflowRuns: 1,
          })
          .onConflictDoUpdate({
            target: [
              workspaceUsage.workspaceId,
              workspaceUsage.periodStart,
            ],
            set: {
              workflowRuns: sql`
                ${workspaceUsage.workflowRuns} + 1
              `,
              updatedAt: new Date(),
            },
          })
          .returning({
            workflowRuns:
              workspaceUsage.workflowRuns,
          });

      if (!updatedUsage) {
        throw new Error(
          "Workflow usage could not be recorded."
        );
      }

      if (
        updatedUsage.workflowRuns >
        limits.workflowRunsPerMonth
      ) {
        throw new WorkflowUsageLimitError({
          plan,
          limit:
            limits.workflowRunsPerMonth,
        });
      }

      return {
        plan,
        workflowRuns:
          updatedUsage.workflowRuns,
        limit:
          limits.workflowRunsPerMonth,
        periodStart,
      };
    }
  );
}

export async function consumeActionExecutionAllowance(
  workspaceId: string
) {
  const periodStart =
    getUsagePeriodStart();

  return db.transaction(
    async (transaction) => {
      const [subscription] =
        await transaction
          .select({
            plan:
              workspaceSubscription.plan,
            status:
              workspaceSubscription.status,
          })
          .from(
            workspaceSubscription
          )
          .where(
            eq(
              workspaceSubscription
                .workspaceId,
              workspaceId
            )
          )
          .limit(1);

      const plan = getEffectivePlan({
        plan: subscription?.plan,
        status: subscription?.status,
      });

      const limits =
        getPlanLimits(plan);

      const [updatedUsage] =
        await transaction
          .insert(workspaceUsage)
          .values({
            id: crypto.randomUUID(),
            workspaceId,
            periodStart,
            actionExecutions: 1,
          })
          .onConflictDoUpdate({
            target: [
              workspaceUsage.workspaceId,
              workspaceUsage.periodStart,
            ],
            set: {
              actionExecutions: sql`
                ${workspaceUsage.actionExecutions} + 1
              `,
              updatedAt: new Date(),
            },
          })
          .returning({
            actionExecutions:
              workspaceUsage
                .actionExecutions,
          });

      if (!updatedUsage) {
        throw new Error(
          "Action execution usage could not be recorded."
        );
      }

      if (
        updatedUsage.actionExecutions >
        limits.actionExecutionsPerMonth
      ) {
        throw new ActionExecutionUsageLimitError({
          plan,
          limit:
            limits.actionExecutionsPerMonth,
        });
      }

      return {
        plan,
        actionExecutions:
          updatedUsage.actionExecutions,
        limit:
          limits.actionExecutionsPerMonth,
        periodStart,
      };
    }
  );
}

export async function assertAiTokenAllowance(
  workspaceId: string
) {
  const usage =
    await getWorkspaceUsage(
      workspaceId
    );

  if (
    usage.usage.aiTokens >=
    usage.limits.aiTokensPerMonth
  ) {
    throw new AiTokenUsageLimitError({
      plan: usage.plan,
      limit:
        usage.limits
          .aiTokensPerMonth,
    });
  }

  return {
    plan: usage.plan,
    aiTokens:
      usage.usage.aiTokens,
    limit:
      usage.limits
        .aiTokensPerMonth,
  };
}

export async function recordAiTokenUsage({
  workspaceId,
  inputTokens,
  outputTokens,
  totalTokens,
}: {
  workspaceId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number | null;
}) {
  if (
    !Number.isSafeInteger(
      inputTokens
    ) ||
    inputTokens < 0
  ) {
    throw new Error(
      "AI input token usage must be a non-negative integer."
    );
  }

  if (
    !Number.isSafeInteger(
      outputTokens
    ) ||
    outputTokens < 0
  ) {
    throw new Error(
      "AI output token usage must be a non-negative integer."
    );
  }

  if (
    totalTokens != null &&
    (
      !Number.isSafeInteger(
        totalTokens
      ) ||
      totalTokens < 0
    )
  ) {
    throw new Error(
      "Total AI token usage must be a non-negative integer."
    );
  }

  const knownTokens =
    inputTokens + outputTokens;

  const normalizedTotalTokens =
    totalTokens == null
      ? knownTokens
      : Math.max(
          totalTokens,
          knownTokens
        );

  const otherTokens =
    normalizedTotalTokens -
    knownTokens;

  const periodStart =
    getUsagePeriodStart();

  const [updatedUsage] = await db
    .insert(workspaceUsage)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      periodStart,
      aiInputTokens: inputTokens,
      aiOutputTokens:
        outputTokens,
      aiOtherTokens:
        otherTokens,
    })
    .onConflictDoUpdate({
      target: [
        workspaceUsage.workspaceId,
        workspaceUsage.periodStart,
      ],
      set: {
        aiInputTokens: sql`
          ${workspaceUsage.aiInputTokens}
          + ${inputTokens}
        `,
        aiOutputTokens: sql`
          ${workspaceUsage.aiOutputTokens}
          + ${outputTokens}
        `,
        aiOtherTokens: sql`
          ${workspaceUsage.aiOtherTokens}
          + ${otherTokens}
        `,
        updatedAt: new Date(),
      },
    })
    .returning({
      aiInputTokens:
        workspaceUsage.aiInputTokens,
      aiOutputTokens:
        workspaceUsage.aiOutputTokens,
      aiOtherTokens:
        workspaceUsage.aiOtherTokens,
    });

  if (!updatedUsage) {
    throw new Error(
      "AI token usage could not be recorded."
    );
  }

  return {
    inputTokens:
      updatedUsage.aiInputTokens,
    outputTokens:
      updatedUsage.aiOutputTokens,
    otherTokens:
      updatedUsage.aiOtherTokens,
    totalTokens:
      updatedUsage.aiInputTokens +
      updatedUsage.aiOutputTokens +
      updatedUsage.aiOtherTokens,
    periodStart,
  };
}

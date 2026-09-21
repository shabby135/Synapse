import {
  and,
  desc,
  eq,
  isNull,
  lt,
  lte,
  notInArray,
  or,
} from "drizzle-orm";

import {
  getIntegrationTriggerHandler,
} from "@/features/workflow/integration-trigger-registry";
import {
  createPayloadHash,
  failureRetryDate,
  nextPollDate,
  stableConfigurationHash,
  TRIGGER_LEASE_MS,
} from "@/features/workflow/integration-trigger-runtime";
import {
  DuplicateIntegrationTriggerEventError,
  queueWorkflowRun,
} from "@/features/workflow/queue-workflow-run";
import {
  saveWorkflowDefinitionSchema,
} from "@/features/workflow/validator";
import { db } from "@/lib/db";
import {
  workflow,
  workflowIntegrationTrigger,
  workflowVersion,
} from "@/lib/db/schema";

import { inngest } from "../client";

const MAX_TRIGGERS_PER_TICK = 50;

async function synchronizePublishedTriggers() {
  const rows = await db
    .select({
      workflowId: workflow.id,
      versionId: workflowVersion.id,
      version: workflowVersion.version,
      definition:
        workflowVersion.definition,
    })
    .from(workflow)
    .innerJoin(
      workflowVersion,
      eq(
        workflowVersion.workflowId,
        workflow.id
      )
    )
    .where(
      and(
        eq(
          workflow.status,
          "ACTIVE"
        ),
        eq(
          workflowVersion.status,
          "PUBLISHED"
        )
      )
    )
    .orderBy(
      workflow.id,
      desc(
        workflowVersion.version
      )
    );

  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.workflowId)) {
      continue;
    }

    seen.add(row.workflowId);

    const parsed =
      saveWorkflowDefinitionSchema.safeParse(
        {
          id: row.workflowId,
          nodes:
            row.definition.nodes,
          edges:
            row.definition.edges,
        }
      );

    if (!parsed.success) {
      await db
        .delete(
          workflowIntegrationTrigger
        )
        .where(
          eq(
            workflowIntegrationTrigger
              .workflowId,
            row.workflowId
          )
        );

      continue;
    }

    const trigger =
      parsed.data.nodes.find(
        (node) =>
          node.type === "trigger"
      );

    const configuration =
      trigger?.data.configuration ??
      {};

    const triggerType =
      typeof configuration.triggerType ===
      "string"
        ? configuration.triggerType
        : "";

    const handler =
      getIntegrationTriggerHandler(
        triggerType
      );

    if (!trigger || !handler) {
      await db
        .delete(
          workflowIntegrationTrigger
        )
        .where(
          eq(
            workflowIntegrationTrigger
              .workflowId,
            row.workflowId
          )
        );

      continue;
    }

    const configurationHash =
      stableConfigurationHash(
        configuration
      );

    const [existing] = await db
      .select({
        id:
          workflowIntegrationTrigger.id,
        workflowVersionId:
          workflowIntegrationTrigger
            .workflowVersionId,
        configurationHash:
          workflowIntegrationTrigger
            .configurationHash,
      })
      .from(
        workflowIntegrationTrigger
      )
      .where(
        eq(
          workflowIntegrationTrigger
            .workflowId,
          row.workflowId
        )
      )
      .limit(1);

    if (!existing) {
      await db
        .insert(
          workflowIntegrationTrigger
        )
        .values({
          id: crypto.randomUUID(),
          workflowId: row.workflowId,
          workflowVersionId:
            row.versionId,
          nodeId: trigger.id,
          triggerType,
          configurationHash,
          nextPollAt: new Date(),
        });

      continue;
    }

    if (
      existing.workflowVersionId !==
        row.versionId ||
      existing.configurationHash !==
        configurationHash
    ) {
      await db
        .update(
          workflowIntegrationTrigger
        )
        .set({
          workflowVersionId:
            row.versionId,
          nodeId: trigger.id,
          triggerType,
          configurationHash,
          cursor: null,
          consecutiveFailures: 0,
          lastError: null,
          leaseExpiresAt: null,
          nextPollAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          eq(
            workflowIntegrationTrigger.id,
            existing.id
          )
        );
    }
  }

  if (seen.size === 0) {
    await db.delete(
      workflowIntegrationTrigger
    );
  } else {
    await db
      .delete(
        workflowIntegrationTrigger
      )
      .where(
        notInArray(
          workflowIntegrationTrigger
            .workflowId,
          [...seen]
        )
      );
  }

  return seen.size;
}

export const pollIntegrationTriggers =
  inngest.createFunction(
    {
      id:
        "poll-integration-triggers",
      name:
        "Poll integration triggers",
      triggers: [
        {
          cron: "* * * * *",
        },
      ],
      retries: 0,
    },
    async ({ step }) => {
      const synchronized =
        await step.run(
          "synchronize-triggers",
          synchronizePublishedTriggers
        );

      const dueTriggers =
        await step.run(
          "load-due-triggers",
          () =>
            db
              .select()
              .from(
                workflowIntegrationTrigger
              )
              .where(
                and(
                  lte(
                    workflowIntegrationTrigger
                      .nextPollAt,
                    new Date()
                  ),
                  or(
                    isNull(
                      workflowIntegrationTrigger
                        .leaseExpiresAt
                    ),
                    lt(
                      workflowIntegrationTrigger
                        .leaseExpiresAt,
                      new Date()
                    )
                  )
                )
              )
              .limit(
                MAX_TRIGGERS_PER_TICK
              )
        );

      for (const due of dueTriggers) {
        await step.run(
          `poll-${due.id}`,
          async () => {
            const now = new Date();

            const [claimed] =
              await db
                .update(
                  workflowIntegrationTrigger
                )
                .set({
                  leaseExpiresAt:
                    new Date(
                      now.getTime() +
                        TRIGGER_LEASE_MS
                    ),
                })
                .where(
                  and(
                    eq(
                      workflowIntegrationTrigger.id,
                      due.id
                    ),
                    or(
                      isNull(
                        workflowIntegrationTrigger
                          .leaseExpiresAt
                      ),
                      lt(
                        workflowIntegrationTrigger
                          .leaseExpiresAt,
                        now
                      )
                    )
                  )
                )
                .returning();

            if (!claimed) {
              return;
            }

            try {
              const [version] =
                await db
                  .select({
                    definition:
                      workflowVersion.definition,
                  })
                  .from(
                    workflowVersion
                  )
                  .where(
                    eq(
                      workflowVersion.id,
                      claimed.workflowVersionId
                    )
                  )
                  .limit(1);

              if (!version) {
                throw new Error(
                  "Published workflow version no longer exists."
                );
              }

              const parsed =
                saveWorkflowDefinitionSchema.parse(
                  {
                    id:
                      claimed.workflowId,
                    nodes:
                      version.definition
                        .nodes,
                    edges:
                      version.definition
                        .edges,
                  }
                );

              const node =
                parsed.nodes.find(
                  (item) =>
                    item.id ===
                    claimed.nodeId
                );

              if (!node) {
                throw new Error(
                  "Published trigger node no longer exists."
                );
              }

              const handler =
                getIntegrationTriggerHandler(
                  claimed.triggerType
                );

              if (!handler) {
                throw new Error(
                  `Trigger ${claimed.triggerType} is not registered.`
                );
              }

              const result =
                await handler.poll({
                  workflowId:
                    claimed.workflowId,
                  nodeId:
                    claimed.nodeId,
                  configuration:
                    node.data
                      .configuration ??
                    {},
                  cursor:
                    claimed.cursor,
                });

              for (
                const event of
                result.events
              ) {
                try {
                  await queueWorkflowRun({
                    workflowId:
                      claimed.workflowId,
                    triggerType:
                      "INTEGRATION",
                    input: event.input,
                    integrationEvent: {
                      triggerId:
                        claimed.id,
                      eventKey:
                        event.key,
                      payloadHash:
                        createPayloadHash(
                          event.input
                        ),
                    },
                  });
                } catch (error) {
                  if (
                    !(
                      error instanceof
                      DuplicateIntegrationTriggerEventError
                    )
                  ) {
                    throw error;
                  }
                }
              }

              await db
                .update(
                  workflowIntegrationTrigger
                )
                .set({
                  cursor:
                    result.cursor,
                  lastPolledAt:
                    new Date(),
                  nextPollAt:
                    nextPollDate(
                      result.pollIntervalMinutes
                    ),
                  leaseExpiresAt:
                    null,
                  consecutiveFailures:
                    0,
                  lastError: null,
                  updatedAt:
                    new Date(),
                })
                .where(
                  eq(
                    workflowIntegrationTrigger.id,
                    claimed.id
                  )
                );
            } catch (error) {
              const failures =
                claimed
                  .consecutiveFailures +
                1;

              await db
                .update(
                  workflowIntegrationTrigger
                )
                .set({
                  leaseExpiresAt:
                    null,
                  consecutiveFailures:
                    failures,
                  lastError:
                    error instanceof
                    Error
                      ? error.message.slice(
                          0,
                          2_000
                        )
                      : "Trigger polling failed.",
                  nextPollAt:
                    failureRetryDate(
                      failures
                    ),
                  updatedAt:
                    new Date(),
                })
                .where(
                  eq(
                    workflowIntegrationTrigger.id,
                    claimed.id
                  )
                );
            }
          }
        );
      }

      return {
        synchronized,
        polled:
          dueTriggers.length,
      };
    }
  );
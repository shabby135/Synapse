import {
  and,
  eq,
  ne,
} from "drizzle-orm";
import {
  assertAiTokenAllowance,
  consumeActionExecutionAllowance,
  recordAiTokenUsage,
} from "@/features/billing/usage";

import { executeAction } from "@/features/workflow/execute-action";
import { createExecutionPlan } from "@/features/workflow/execution-plan";
import { db } from "@/lib/db";
import {
  workflow,
  workflowLog,
  workflowRun,
  workflowRunStep,
  workflowVersion,
} from "@/lib/db/schema";

import {
  inngest,
  workflowRunRequested,
} from "../client";

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : "Unknown workflow execution error.";
}

function getAiTokenUsage(
  output: Record<string, unknown>
): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number | null;
} | null {
  const usage = output.usage;

  if (
    !usage ||
    typeof usage !== "object" ||
    Array.isArray(usage)
  ) {
    return null;
  }

  const usageRecord =
    usage as Record<
      string,
      unknown
    >;

  const inputTokens =
    usageRecord.inputTokens;

  const outputTokens =
    usageRecord.outputTokens;

  const reportedTotalTokens =
    usageRecord.totalTokens;

  if (
    typeof inputTokens !==
      "number" ||
    !Number.isSafeInteger(
      inputTokens
    ) ||
    inputTokens < 0
  ) {
    return null;
  }

  if (
    typeof outputTokens !==
      "number" ||
    !Number.isSafeInteger(
      outputTokens
    ) ||
    outputTokens < 0
  ) {
    return null;
  }

  const totalTokens =
    typeof reportedTotalTokens ===
      "number" &&
    Number.isSafeInteger(
      reportedTotalTokens
    ) &&
    reportedTotalTokens >= 0
      ? reportedTotalTokens
      : null;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

export const executeWorkflow =
  inngest.createFunction(
    {
      id: "execute-workflow",
      name: "Execute workflow",
      triggers: [
        workflowRunRequested,
      ],
      retries: 3,

      idempotency:
        "event.data.runId",

      timeouts: {
        start: "5m",
        finish: "15m",
      },

      onFailure: async ({
        event,
        error,
      }) => {
        const runId =
          event.data.event.data.runId;

        if (
          typeof runId !== "string"
        ) {
          return;
        }

        const [existingRun] =
          await db
            .select({
              id: workflowRun.id,
              status:
                workflowRun.status,
            })
            .from(workflowRun)
            .where(
              eq(
                workflowRun.id,
                runId
              )
            )
            .limit(1);

        if (
          !existingRun ||
          existingRun.status ===
            "SUCCESS" ||
          existingRun.status ===
            "CANCELLED"
        ) {
          return;
        }

        const errorMessage =
          getErrorMessage(error);

        await db.transaction(
          async (transaction) => {
            await transaction
              .update(
                workflowRunStep
              )
              .set({
                status: "FAILED",
                error: errorMessage,
                completedAt:
                  new Date(),
              })
              .where(
                and(
                  eq(
                    workflowRunStep.runId,
                    runId
                  ),
                  eq(
                    workflowRunStep.status,
                    "RUNNING"
                  )
                )
              );

            await transaction
              .update(
                workflowRunStep
              )
              .set({
                status: "SKIPPED",
                completedAt:
                  new Date(),
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
              .update(workflowRun)
              .set({
                status: "FAILED",
                error: errorMessage,
                completedAt:
                  new Date(),
              })
              .where(
                and(
                  eq(
                    workflowRun.id,
                    runId
                  ),
                  ne(
                    workflowRun.status,
                    "SUCCESS"
                  )
                )
              );

            await transaction
              .insert(workflowLog)
              .values({
                id: crypto.randomUUID(),
                runId,
                level: "ERROR",
                message:
                  errorMessage,
                metadata: {
                  source:
                    "inngest-failure-handler",
                },
              });
          }
        );
      },
    },

    async ({ event, step }) => {
      const runId =
        event.data.runId;

      const executionData =
        await step.run(
          "load-execution-data",
          async () => {
            const [run] =
              await db
                .select()
                .from(workflowRun)
                .where(
                  eq(
                    workflowRun.id,
                    runId
                  )
                )
                .limit(1);

            if (!run) {
              throw new Error(
                "Workflow run not found."
              );
            }

            const [version] =
              await db
                .select()
                .from(
                  workflowVersion
                )
                .where(
                  eq(
                    workflowVersion.id,
                    run.workflowVersionId
                  )
                )
                .limit(1);

            if (!version) {
              throw new Error(
                "Published workflow version not found."
              );
            }

            if (
              version.status !==
              "PUBLISHED"
            ) {
              throw new Error(
                "Workflow run must use a published version."
              );
            }

            const [
              existingWorkflow,
            ] = await db
              .select({
                workspaceId:
                  workflow.workspaceId,
              })
              .from(workflow)
              .where(
                eq(
                  workflow.id,
                  run.workflowId
                )
              )
              .limit(1);

            if (!existingWorkflow) {
              throw new Error(
                "Workflow not found."
              );
            }

            return {
              workflowId:
                run.workflowId,
              workspaceId:
                existingWorkflow.workspaceId,
              input: run.input,
              definition:
                version.definition,
            };
          }
        );

      const plan =
        createExecutionPlan(
          executionData.workflowId,
          executionData.definition
        );

      await step.run(
        "mark-run-running",
        async () => {
          await db
            .update(workflowRun)
            .set({
              status: "RUNNING",
              startedAt: new Date(),
              error: null,
            })
            .where(
              and(
                eq(
                  workflowRun.id,
                  runId
                ),
                eq(
                  workflowRun.status,
                  "PENDING"
                )
              )
            );

          await db
            .insert(workflowLog)
            .values({
              id: `${runId}:started`,
              runId,
              level: "INFO",
              message:
                "Background workflow execution started.",
              metadata: {
                engine: "inngest",
              },
            })
            .onConflictDoNothing();

          return {
            status:
              "RUNNING" as const,
          };
        }
      );

      const outputByNode = new Map<
        string,
        Record<string, unknown>
      >();

      outputByNode.set(
        plan.trigger.id,
        executionData.input
      );

      for (
        const action of plan.actions
      ) {
        const incomingEdges =
          plan.edges.filter(
            (edge) =>
              edge.target ===
              action.id
          );

        const onlyIncomingEdge =
          incomingEdges[0];

        let actionInput: Record<
          string,
          unknown
        > = executionData.input;

        if (
          incomingEdges.length === 1 &&
          onlyIncomingEdge
        ) {
          actionInput =
            outputByNode.get(
              onlyIncomingEdge.source
            ) ??
            executionData.input;
        }

        if (
          incomingEdges.length > 1
        ) {
          actionInput = {
            dependencies:
              Object.fromEntries(
                incomingEdges.map(
                  (edge) => [
                    edge.source,

                    outputByNode.get(
                      edge.source
                    ) ?? {},
                  ]
                )
              ),
          };
        }

        const output =
          await step.run(
            `execute-${action.id}`,
            async () => {
              const [runStep] =
                await db
                  .select({
                    id: workflowRunStep.id,
                    status:
                      workflowRunStep.status,
                  })
                  .from(
                    workflowRunStep
                  )
                  .where(
                    and(
                      eq(
                        workflowRunStep.runId,
                        runId
                      ),
                      eq(
                        workflowRunStep.nodeId,
                        action.id
                      )
                    )
                  )
                  .limit(1);

              if (!runStep) {
                throw new Error(
                  `Execution step for node ${action.id} is missing.`
                );
              }

              const actionType =
                action.data
                  .configuration
                  ?.actionType;

              if (
                actionType ===
                "AI_PROMPT"
              ) {
                await assertAiTokenAllowance(
                  executionData.workspaceId
                );
              }

              if (
                runStep.status ===
                "PENDING"
              ) {
                await consumeActionExecutionAllowance(
                  executionData.workspaceId
                );
              }

              await db
                .update(
                  workflowRunStep
                )
                .set({
                  status: "RUNNING",
                  input: actionInput,
                  startedAt:
                    new Date(),
                  error: null,
                })
                .where(
                  eq(
                    workflowRunStep.id,
                    runStep.id
                  )
                );

              await db
                .insert(workflowLog)
                .values({
                  id: `${runId}:${action.id}:started`,
                  runId,
                  nodeId: action.id,
                  level: "INFO",
                  message: `Executing ${action.data.label}.`,
                  metadata: {
                    actionType:
                      action.data
                        .configuration
                        ?.actionType ??
                      "UNKNOWN",
                  },
                })
                .onConflictDoNothing();

              const actionOutput =
                await executeAction({
                  runId,
                  workflowId:
                    executionData.workflowId,
                  nodeId: action.id,
                  data: action.data,
                  input: actionInput,
                });

              await db.transaction(
                async (
                  transaction
                ) => {
                  await transaction
                    .update(
                      workflowRunStep
                    )
                    .set({
                      status:
                        "SUCCESS",
                      output:
                        actionOutput,
                      completedAt:
                        new Date(),
                      error: null,
                    })
                    .where(
                      eq(
                        workflowRunStep.id,
                        runStep.id
                      )
                    );

                  await transaction
                    .insert(
                      workflowLog
                    )
                    .values({
                      id: `${runId}:${action.id}:completed`,
                      runId,
                      nodeId:
                        action.id,
                      level: "INFO",
                      message: `${action.data.label} completed successfully.`,
                      metadata: {},
                    })
                    .onConflictDoNothing();
                }
              );

              return actionOutput;
            }
          );

        const actionType =
          action.data.configuration
            ?.actionType;

        if (
          actionType === "AI_PROMPT"
        ) {
          await step.run(
            `record-ai-usage-${action.id}`,
            async () => {
              const tokenUsage =
                getAiTokenUsage(
                  output
                );

              if (!tokenUsage) {
                await db
                  .insert(workflowLog)
                  .values({
                    id: `${runId}:${action.id}:ai-usage-missing`,
                    runId,
                    nodeId:
                      action.id,
                    level: "WARN",
                    message:
                      "AI token usage was not returned by the provider.",
                    metadata: {
                      actionType,
                    },
                  })
                  .onConflictDoNothing();

                return {
                  recorded: false,
                };
              }

              const recordedUsage =
                await recordAiTokenUsage(
                  {
                    workspaceId:
                      executionData.workspaceId,
                    inputTokens:
                      tokenUsage.inputTokens,
                    outputTokens:
                      tokenUsage.outputTokens,
                    totalTokens:
                      tokenUsage.totalTokens,
                  }
                );

              await db
                .insert(workflowLog)
                .values({
                  id: `${runId}:${action.id}:ai-usage-recorded`,
                  runId,
                  nodeId: action.id,
                  level: "INFO",
                  message:
                    "AI token usage recorded.",
                  metadata: {
                    inputTokens:
                      tokenUsage.inputTokens,
                    outputTokens:
                      tokenUsage.outputTokens,
                    totalTokens:
                      tokenUsage.totalTokens ??
                      (
                        tokenUsage.inputTokens +
                        tokenUsage.outputTokens
                      ),
                  },
                })
                .onConflictDoNothing();

              return {
                recorded: true,
                inputTokens:
                  tokenUsage.inputTokens,
                outputTokens:
                  tokenUsage.outputTokens,
                cumulativeTotalTokens:
                  recordedUsage.totalTokens,
              };
            }
          );
        }

        outputByNode.set(
          action.id,
          output
        );
      }

      const terminalActions =
        plan.actions.filter(
          (action) =>
            !plan.edges.some(
              (edge) =>
                edge.source ===
                action.id
            )
        );

      const onlyTerminalAction =
        terminalActions[0];

      const runOutput =
        terminalActions.length === 1 &&
        onlyTerminalAction
          ? outputByNode.get(
              onlyTerminalAction.id
            ) ?? {}
          : {
              branches:
                Object.fromEntries(
                  terminalActions.map(
                    (action) => [
                      action.id,

                      outputByNode.get(
                        action.id
                      ) ?? {},
                    ]
                  )
                ),
            };

      await step.run(
        "complete-run",
        async () => {
          await db.transaction(
            async (transaction) => {
              await transaction
                .update(workflowRun)
                .set({
                  status: "SUCCESS",
                  output: runOutput,
                  error: null,
                  completedAt:
                    new Date(),
                })
                .where(
                  eq(
                    workflowRun.id,
                    runId
                  )
                );

              await transaction
                .insert(workflowLog)
                .values({
                  id: `${runId}:completed`,
                  runId,
                  level: "INFO",
                  message:
                    "Workflow completed successfully.",
                  metadata: {
                    engine:
                      "inngest",
                  },
                })
                .onConflictDoNothing();
            }
          );

          return runOutput;
        }
      );

      return {
        runId,
        status:
          "SUCCESS" as const,
        output: runOutput,
      };
    }
  );

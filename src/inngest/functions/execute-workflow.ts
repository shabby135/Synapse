import {
  and,
  eq,
  ne,
} from "drizzle-orm";

import { executeAction } from "@/features/workflow/execute-action";
import { createExecutionPlan } from "@/features/workflow/execution-plan";
import { db } from "@/lib/db";
import {
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

if (typeof runId !== "string") {
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

            return {
              workflowId:
                run.workflowId,
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
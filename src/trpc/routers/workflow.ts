import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  ne,
} from "drizzle-orm";

import { executeAction } from "@/features/workflow/execute-action";
import { createExecutionPlan } from "@/features/workflow/execution-plan";
import { validateWorkflowForPublish } from "@/features/workflow/validate-publish";
import {
  archiveWorkflowSchema,
  createWorkflowSchema,
  deleteWorkflowSchema,
  executeWorkflowSchema,
  listWorkflowRunsSchema,
  listWorkflowsSchema,
  saveWorkflowDefinitionSchema,
  updateWorkflowSchema,
  workflowIdSchema,
  workflowRunIdSchema,
} from "@/features/workflow/validator";
import { requireWorkspacePermission } from "@/features/workspace/authorization";
import {
  workflow,
  workflowLog,
  workflowRun,
  workflowRunStep,
  workflowVersion,
} from "@/lib/db/schema";

import {
  protectedProcedure,
  router,
} from "../init";

export const workflowRouter = router({
  list: protectedProcedure
    .input(listWorkflowsSchema)
    .query(async ({ ctx, input }) => {
      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          input.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:read",
      });

      return ctx.db
        .select({
          id: workflow.id,
          workspaceId:
            workflow.workspaceId,
          name: workflow.name,
          description:
            workflow.description,
          status: workflow.status,
          createdBy:
            workflow.createdBy,
          createdAt:
            workflow.createdAt,
          updatedAt:
            workflow.updatedAt,
        })
        .from(workflow)
        .where(
          input.includeArchived
            ? eq(
                workflow.workspaceId,
                input.workspaceId
              )
            : and(
                eq(
                  workflow.workspaceId,
                  input.workspaceId
                ),
                ne(
                  workflow.status,
                  "ARCHIVED"
                )
              )
        )
        .orderBy(
          desc(workflow.updatedAt)
        );
    }),

  getById: protectedProcedure
    .input(workflowIdSchema)
    .query(async ({ ctx, input }) => {
      const [existingWorkflow] =
        await ctx.db
          .select()
          .from(workflow)
          .where(
            eq(workflow.id, input.id)
          )
          .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:read",
      });

      const versions =
        await ctx.db
          .select({
            id: workflowVersion.id,
            version:
              workflowVersion.version,
            status:
              workflowVersion.status,
            definition:
              workflowVersion.definition,
            createdBy:
              workflowVersion.createdBy,
            createdAt:
              workflowVersion.createdAt,
            updatedAt:
              workflowVersion.updatedAt,
          })
          .from(workflowVersion)
          .where(
            eq(
              workflowVersion.workflowId,
              existingWorkflow.id
            )
          )
          .orderBy(
            desc(
              workflowVersion.version
            )
          );

      return {
        ...existingWorkflow,
        versions,
      };
    }),

  create: protectedProcedure
    .input(createWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          input.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:create",
      });

      const workflowId =
        crypto.randomUUID();

      const versionId =
        crypto.randomUUID();

      return ctx.db.transaction(
        async (transaction) => {
          const [createdWorkflow] =
            await transaction
              .insert(workflow)
              .values({
                id: workflowId,
                workspaceId:
                  input.workspaceId,
                name: input.name,
                description:
                  input.description ||
                  null,
                status: "DRAFT",
                createdBy:
                  ctx.session.user.id,
              })
              .returning();

          const [initialVersion] =
            await transaction
              .insert(workflowVersion)
              .values({
                id: versionId,
                workflowId,
                version: 1,
                status: "DRAFT",
                definition: {
                  nodes: [],
                  edges: [],
                },
                createdBy:
                  ctx.session.user.id,
              })
              .returning();

          if (
            !createdWorkflow ||
            !initialVersion
          ) {
            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",
              message:
                "Failed to create workflow.",
            });
          }

          return {
            ...createdWorkflow,
            version:
              initialVersion,
          };
        }
      );
    }),

  update: protectedProcedure
    .input(updateWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] =
        await ctx.db
          .select()
          .from(workflow)
          .where(
            eq(workflow.id, input.id)
          )
          .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workflow not found.",
        });
      }

      if (
        existingWorkflow.status ===
        "ARCHIVED"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Archived workflows cannot be edited.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:update",
      });

      const changes: Partial<
        typeof workflow.$inferInsert
      > = {
        updatedAt: new Date(),
      };

      if (
        input.name !== undefined
      ) {
        changes.name = input.name;
      }

      if (
        input.description !== undefined
      ) {
        changes.description =
          input.description;
      }

      const [updatedWorkflow] =
        await ctx.db
          .update(workflow)
          .set(changes)
          .where(
            eq(workflow.id, input.id)
          )
          .returning();

      if (!updatedWorkflow) {
        throw new TRPCError({
          code:
            "INTERNAL_SERVER_ERROR",
          message:
            "Failed to update workflow.",
        });
      }

      return updatedWorkflow;
    }),

  saveDefinition: protectedProcedure
    .input(
      saveWorkflowDefinitionSchema
    )
    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] =
        await ctx.db
          .select()
          .from(workflow)
          .where(
            eq(workflow.id, input.id)
          )
          .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workflow not found.",
        });
      }

      if (
        existingWorkflow.status ===
        "ARCHIVED"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Archived workflows cannot be edited.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:update",
      });

      return ctx.db.transaction(
        async (transaction) => {
          const [latestVersion] =
            await transaction
              .select()
              .from(workflowVersion)
              .where(
                eq(
                  workflowVersion.workflowId,
                  input.id
                )
              )
              .orderBy(
                desc(
                  workflowVersion.version
                )
              )
              .limit(1);

          const definition = {
            nodes: input.nodes,
            edges: input.edges,
            variables:
              latestVersion
                ?.definition.variables ??
              {},
          };

          const [savedVersion] =
            latestVersion?.status ===
            "DRAFT"
              ? await transaction
                  .update(
                    workflowVersion
                  )
                  .set({
                    definition,
                    updatedAt:
                      new Date(),
                  })
                  .where(
                    eq(
                      workflowVersion.id,
                      latestVersion.id
                    )
                  )
                  .returning()
              : await transaction
                  .insert(
                    workflowVersion
                  )
                  .values({
                    id: crypto.randomUUID(),
                    workflowId:
                      input.id,
                    version:
                      (latestVersion
                        ?.version ?? 0) +
                      1,
                    status: "DRAFT",
                    definition,
                    createdBy:
                      ctx.session.user.id,
                  })
                  .returning();

          if (!savedVersion) {
            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",
              message:
                "Failed to save workflow definition.",
            });
          }

          await transaction
            .update(workflow)
            .set({
              updatedAt: new Date(),
            })
            .where(
              eq(
                workflow.id,
                input.id
              )
            );

          return savedVersion;
        }
      );
    }),

  publish: protectedProcedure
    .input(workflowIdSchema)
    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] =
        await ctx.db
          .select()
          .from(workflow)
          .where(
            eq(workflow.id, input.id)
          )
          .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workflow not found.",
        });
      }

      if (
        existingWorkflow.status ===
        "ARCHIVED"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Archived workflows cannot be published.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:update",
      });

      return ctx.db.transaction(
        async (transaction) => {
          const [latestDraft] =
            await transaction
              .select()
              .from(workflowVersion)
              .where(
                and(
                  eq(
                    workflowVersion.workflowId,
                    input.id
                  ),
                  eq(
                    workflowVersion.status,
                    "DRAFT"
                  )
                )
              )
              .orderBy(
                desc(
                  workflowVersion.version
                )
              )
              .limit(1);

          if (!latestDraft) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "This workflow has no draft version to publish.",
            });
          }

          const validation =
            validateWorkflowForPublish(
              input.id,
              latestDraft.definition
            );

          if (!validation.valid) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                validation.message,
            });
          }

          const [publishedVersion] =
            await transaction
              .update(
                workflowVersion
              )
              .set({
                status: "PUBLISHED",
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(
                    workflowVersion.id,
                    latestDraft.id
                  ),
                  eq(
                    workflowVersion.status,
                    "DRAFT"
                  )
                )
              )
              .returning();

          if (!publishedVersion) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "The draft changed while it was being published.",
            });
          }

          const [activeWorkflow] =
            await transaction
              .update(workflow)
              .set({
                status: "ACTIVE",
                updatedAt: new Date(),
              })
              .where(
                eq(
                  workflow.id,
                  input.id
                )
              )
              .returning();

          if (!activeWorkflow) {
            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",
              message:
                "Failed to activate the workflow.",
            });
          }

          return {
            workflow:
              activeWorkflow,
            version:
              publishedVersion,
          };
        }
      );
    }),

  executeManual: protectedProcedure
    .input(executeWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] =
        await ctx.db
          .select()
          .from(workflow)
          .where(
            eq(workflow.id, input.id)
          )
          .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workflow not found.",
        });
      }

      if (
        existingWorkflow.status !==
        "ACTIVE"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Only active workflows can be executed.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission:
          "workflow:execute",
      });

      const [publishedVersion] =
        await ctx.db
          .select()
          .from(workflowVersion)
          .where(
            and(
              eq(
                workflowVersion.workflowId,
                input.id
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "The workflow has no published version.",
        });
      }

      const plan = createExecutionPlan(
        input.id,
        publishedVersion.definition
      );

      const runId =
        crypto.randomUUID();

      const stepIds = new Map(
        plan.actions.map((action) => [
          action.id,
          crypto.randomUUID(),
        ])
      );

      await ctx.db.transaction(
        async (transaction) => {
          await transaction
            .insert(workflowRun)
            .values({
              id: runId,
              workflowId: input.id,
              workflowVersionId:
                publishedVersion.id,
              status: "PENDING",
              triggerType: "MANUAL",
              input: input.input,
              triggeredBy:
                ctx.session.user.id,
            });

         await transaction
  .insert(workflowRunStep)
  .values(
    plan.actions.map(
      (action) => ({
        id: stepIds.get(
          action.id
        )!,
        runId,
        nodeId: action.id,
        nodeType:
          action.type,
      })
    )
  );

          await transaction
            .insert(workflowLog)
            .values({
              id: crypto.randomUUID(),
              runId,
              level: "INFO",
              message:
                "Manual workflow execution queued.",
              metadata: {
                version:
                  publishedVersion.version,
              },
            });
        }
      );

      await ctx.db
        .update(workflowRun)
        .set({
          status: "RUNNING",
          startedAt: new Date(),
        })
        .where(
          eq(workflowRun.id, runId)
        );

      const outputByNode = new Map<
        string,
        Record<string, unknown>
      >();

      outputByNode.set(
        plan.trigger.id,
        input.input
      );

      for (
        const action of plan.actions
      ) {
        const stepId =
          stepIds.get(action.id);

        if (!stepId) {
          throw new TRPCError({
            code:
              "INTERNAL_SERVER_ERROR",
            message:
              "Execution step is missing.",
          });
        }

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
        > = input.input;

        if (
          incomingEdges.length === 1 &&
          onlyIncomingEdge
        ) {
          actionInput =
            outputByNode.get(
              onlyIncomingEdge.source
            ) ?? input.input;
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

        await ctx.db
          .update(workflowRunStep)
          .set({
            status: "RUNNING",
            input: actionInput,
            startedAt: new Date(),
          })
          .where(
            eq(
              workflowRunStep.id,
              stepId
            )
          );

        const actionType =
          action.data.configuration
            ?.actionType;

        await ctx.db
          .insert(workflowLog)
          .values({
            id: crypto.randomUUID(),
            runId,
            nodeId: action.id,
            level: "INFO",
            message: `Executing ${action.data.label}.`,
            metadata:
              typeof actionType ===
              "string"
                ? {
                    actionType,
                  }
                : {},
          });

        try {
          const output =
            await executeAction({
              runId,
              workflowId:
                input.id,
              nodeId: action.id,
              data: action.data,
              input: actionInput,
            });

          outputByNode.set(
            action.id,
            output
          );

          await ctx.db
            .update(workflowRunStep)
            .set({
              status: "SUCCESS",
              output,
              completedAt:
                new Date(),
            })
            .where(
              eq(
                workflowRunStep.id,
                stepId
              )
            );

          await ctx.db
            .insert(workflowLog)
            .values({
              id: crypto.randomUUID(),
              runId,
              nodeId: action.id,
              level: "INFO",
              message: `${action.data.label} completed successfully.`,
              metadata: {},
            });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Unknown execution error.";

          await ctx.db.transaction(
            async (transaction) => {
              await transaction
                .update(
                  workflowRunStep
                )
                .set({
                  status: "FAILED",
                  error:
                    errorMessage,
                  completedAt:
                    new Date(),
                })
                .where(
                  eq(
                    workflowRunStep.id,
                    stepId
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
                  error:
                    errorMessage,
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
                  id: crypto.randomUUID(),
                  runId,
                  nodeId:
                    action.id,
                  level: "ERROR",
                  message:
                    errorMessage,
                  metadata: {},
                });
            }
          );

          throw new TRPCError({
            code:
              "INTERNAL_SERVER_ERROR",
            message:
              errorMessage,
          });
        }
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

      await ctx.db.transaction(
        async (transaction) => {
          await transaction
            .update(workflowRun)
            .set({
              status: "SUCCESS",
              output: runOutput,
              completedAt: new Date(),
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
              id: crypto.randomUUID(),
              runId,
              level: "INFO",
              message:
                "Workflow completed successfully.",
              metadata: {},
            });
        }
      );

      return {
        id: runId,
        status:
          "SUCCESS" as const,
        output: runOutput,
      };
    }),

  listRuns: protectedProcedure
    .input(listWorkflowRunsSchema)
    .query(async ({ ctx, input }) => {
      const [existingWorkflow] =
        await ctx.db
          .select({
            id: workflow.id,
            workspaceId:
              workflow.workspaceId,
          })
          .from(workflow)
          .where(
            eq(
              workflow.id,
              input.workflowId
            )
          )
          .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:read",
      });

      return ctx.db
        .select({
          id: workflowRun.id,
          workflowId:
            workflowRun.workflowId,
          workflowVersionId:
            workflowRun.workflowVersionId,
          status: workflowRun.status,
          triggerType:
            workflowRun.triggerType,
          input: workflowRun.input,
          output: workflowRun.output,
          error: workflowRun.error,
          triggeredBy:
            workflowRun.triggeredBy,
          startedAt:
            workflowRun.startedAt,
          completedAt:
            workflowRun.completedAt,
          createdAt:
            workflowRun.createdAt,
        })
        .from(workflowRun)
        .where(
          eq(
            workflowRun.workflowId,
            input.workflowId
          )
        )
        .orderBy(
          desc(workflowRun.createdAt)
        )
        .limit(input.limit);
    }),

  getRunById: protectedProcedure
    .input(workflowRunIdSchema)
    .query(async ({ ctx, input }) => {
      const [run] = await ctx.db
        .select()
        .from(workflowRun)
        .where(
          eq(workflowRun.id, input.id)
        )
        .limit(1);

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workflow run not found.",
        });
      }

      const [existingWorkflow] =
        await ctx.db
          .select({
            id: workflow.id,
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:read",
      });

      const [steps, logs] =
        await Promise.all([
          ctx.db
            .select()
            .from(workflowRunStep)
            .where(
              eq(
                workflowRunStep.runId,
                run.id
              )
            )
            .orderBy(
              asc(
                workflowRunStep.createdAt
              )
            ),

          ctx.db
            .select()
            .from(workflowLog)
            .where(
              eq(
                workflowLog.runId,
                run.id
              )
            )
            .orderBy(
              asc(workflowLog.createdAt)
            ),
        ]);

      return {
        ...run,
        steps,
        logs,
      };
    }),

  archive: protectedProcedure
    .input(archiveWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] =
        await ctx.db
          .select()
          .from(workflow)
          .where(
            eq(workflow.id, input.id)
          )
          .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission:
          "workflow:delete",
      });

      const [archivedWorkflow] =
        await ctx.db
          .update(workflow)
          .set({
            status: "ARCHIVED",
            updatedAt: new Date(),
          })
          .where(
            eq(workflow.id, input.id)
          )
          .returning();

      if (!archivedWorkflow) {
        throw new TRPCError({
          code:
            "INTERNAL_SERVER_ERROR",
          message:
            "Failed to archive workflow.",
        });
      }

      return archivedWorkflow;
    }),

  delete: protectedProcedure
    .input(deleteWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] =
        await ctx.db
          .select()
          .from(workflow)
          .where(
            eq(workflow.id, input.id)
          )
          .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission:
          "workflow:delete",
      });

      await ctx.db
        .delete(workflow)
        .where(
          eq(
            workflow.id,
            input.id
          )
        );

      return {
        success: true,
        id: input.id,
      };
    }),
});

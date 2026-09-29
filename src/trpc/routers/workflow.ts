import { TRPCError } from "@trpc/server";

import { and, asc, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";

import {
  queueWorkflowRun,
  WorkflowRunQueueError,
} from "@/features/workflow/queue-workflow-run";

import { generateWorkflowDraft } from "@/features/workflow/generate-workflow-draft";

import { validateWorkflowForPublish } from "@/features/workflow/validate-publish";

import {
  archiveWorkflowSchema,
  createAssistantWorkflowSchema,
  createWorkflowSchema,
  deleteWorkflowSchema,
  executeWorkflowSchema,
  generateWorkflowDraftSchema,
  listAllWorkflowsSchema,
  listWorkflowRunsSchema,
  listWorkflowsSchema,
  saveWorkflowDefinitionSchema,
  updateWorkflowSchema,
  workflowIdSchema,
  workflowRunIdSchema,
} from "@/features/workflow/validator";

import { requireWorkspacePermission } from "@/features/workspace/authorization";

import {
  workspace,
  workspaceMember,
  workflow,
  workflowLog,
  workflowRun,
  workflowRunStep,
  workflowVersion,
} from "@/lib/db/schema";

import { protectedProcedure, router } from "../init";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function createNodeLabelMap(nodes: unknown[]): Map<string, string> {
  const labels = new Map<string, string>();

  for (const node of nodes) {
    const parsedNode = record(node);

    if (!parsedNode) {
      continue;
    }

    const id = typeof parsedNode.id === "string" ? parsedNode.id : "";

    const data = record(parsedNode.data);

    const label = typeof data?.label === "string" ? data.label.trim() : "";

    if (id && label) {
      labels.set(id, label);
    }
  }

  return labels;
}

export const workflowRouter = router({
  list: protectedProcedure

    .input(listWorkflowsSchema)

    .query(async ({ ctx, input }) => {
      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: input.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:read",
      });

      const workflowRows = await ctx.db

        .select({
          id: workflow.id,

          workspaceId: workflow.workspaceId,

          name: workflow.name,

          description: workflow.description,

          status: workflow.status,

          createdBy: workflow.createdBy,

          createdAt: workflow.createdAt,

          updatedAt: workflow.updatedAt,
        })

        .from(workflow)

        .where(
          input.includeArchived
            ? eq(
                workflow.workspaceId,

                input.workspaceId,
              )
            : and(
                eq(
                  workflow.workspaceId,

                  input.workspaceId,
                ),

                ne(
                  workflow.status,

                  "ARCHIVED",
                ),
              ),
        )

        .orderBy(desc(workflow.updatedAt));

      if (workflowRows.length === 0) {
        return [];
      }

      const rankedRuns = ctx.db

        .select({
          id: workflowRun.id,

          workflowId: workflowRun.workflowId,

          status: workflowRun.status,

          triggerType: workflowRun.triggerType,

          startedAt: workflowRun.startedAt,

          completedAt: workflowRun.completedAt,

          createdAt: workflowRun.createdAt,

          rank: sql<number>`

            row_number() over (

              partition by ${workflowRun.workflowId}

              order by ${workflowRun.createdAt} desc

            )

          `.as("run_rank"),
        })

        .from(workflowRun)

        .where(
          inArray(
            workflowRun.workflowId,

            workflowRows.map((item) => item.id),
          ),
        )

        .as("ranked_runs");

      const recentRunRows = await ctx.db

        .select({
          id: rankedRuns.id,

          workflowId: rankedRuns.workflowId,

          status: rankedRuns.status,

          triggerType: rankedRuns.triggerType,

          startedAt: rankedRuns.startedAt,

          completedAt: rankedRuns.completedAt,

          createdAt: rankedRuns.createdAt,
        })

        .from(rankedRuns)

        .where(lte(rankedRuns.rank, 5))

        .orderBy(desc(rankedRuns.createdAt));

      const runsByWorkflow = new Map<string, typeof recentRunRows>();

      for (const run of recentRunRows) {
        const current = runsByWorkflow.get(run.workflowId) ?? [];

        current.push(run);

        runsByWorkflow.set(
          run.workflowId,

          current,
        );
      }

      return workflowRows.map((workflowItem) => {
        const recentRuns = runsByWorkflow.get(workflowItem.id) ?? [];

        return {
          ...workflowItem,

          latestRun: recentRuns[0] ?? null,

          recentRuns,
        };
      });
    }),

  listAll: protectedProcedure

    .input(listAllWorkflowsSchema)

    .query(async ({ ctx, input }) => {
      const workflowRows = await ctx.db

        .select({
          id: workflow.id,

          workspaceId: workflow.workspaceId,

          workspaceName: workspace.name,

          workspaceRole: workspaceMember.role,

          name: workflow.name,

          description: workflow.description,

          status: workflow.status,

          createdBy: workflow.createdBy,

          createdAt: workflow.createdAt,

          updatedAt: workflow.updatedAt,
        })

        .from(workflow)

        .innerJoin(
          workspaceMember,

          eq(
            workspaceMember.workspaceId,

            workflow.workspaceId,
          ),
        )

        .innerJoin(
          workspace,

          eq(
            workspace.id,

            workflow.workspaceId,
          ),
        )

        .where(
          input.includeArchived
            ? eq(
                workspaceMember.userId,

                ctx.session.user.id,
              )
            : and(
                eq(
                  workspaceMember.userId,

                  ctx.session.user.id,
                ),

                ne(
                  workflow.status,

                  "ARCHIVED",
                ),
              ),
        )

        .orderBy(desc(workflow.updatedAt));

      if (workflowRows.length === 0) {
        return [];
      }

      const rankedRuns = ctx.db

        .select({
          id: workflowRun.id,

          workflowId: workflowRun.workflowId,

          status: workflowRun.status,

          triggerType: workflowRun.triggerType,

          startedAt: workflowRun.startedAt,

          completedAt: workflowRun.completedAt,

          createdAt: workflowRun.createdAt,

          rank: sql<number>`

            row_number() over (

              partition by ${workflowRun.workflowId}

              order by ${workflowRun.createdAt} desc

            )

          `.as("run_rank"),
        })

        .from(workflowRun)

        .where(
          inArray(
            workflowRun.workflowId,

            workflowRows.map((item) => item.id),
          ),
        )

        .as("ranked_runs");

      const recentRunRows = await ctx.db

        .select({
          id: rankedRuns.id,

          workflowId: rankedRuns.workflowId,

          status: rankedRuns.status,

          triggerType: rankedRuns.triggerType,

          startedAt: rankedRuns.startedAt,

          completedAt: rankedRuns.completedAt,

          createdAt: rankedRuns.createdAt,
        })

        .from(rankedRuns)

        .where(lte(rankedRuns.rank, 5))

        .orderBy(desc(rankedRuns.createdAt));

      const runsByWorkflow = new Map<string, typeof recentRunRows>();

      for (const run of recentRunRows) {
        const current = runsByWorkflow.get(run.workflowId) ?? [];

        current.push(run);

        runsByWorkflow.set(
          run.workflowId,

          current,
        );
      }

      return workflowRows.map((workflowItem) => {
        const recentRuns = runsByWorkflow.get(workflowItem.id) ?? [];

        return {
          ...workflowItem,

          latestRun: recentRuns[0] ?? null,

          recentRuns,
        };
      });
    }),

  getById: protectedProcedure

    .input(workflowIdSchema)

    .query(async ({ ctx, input }) => {
      const [existingWorkflow] = await ctx.db

        .select()

        .from(workflow)

        .where(
          eq(
            workflow.id,

            input.id,
          ),
        )

        .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",

          message: "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: existingWorkflow.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:read",
      });

      const versions = await ctx.db

        .select({
          id: workflowVersion.id,

          version: workflowVersion.version,

          status: workflowVersion.status,

          definition: workflowVersion.definition,

          createdBy: workflowVersion.createdBy,

          createdAt: workflowVersion.createdAt,

          updatedAt: workflowVersion.updatedAt,
        })

        .from(workflowVersion)

        .where(
          eq(
            workflowVersion.workflowId,

            existingWorkflow.id,
          ),
        )

        .orderBy(desc(workflowVersion.version));

      return {
        ...existingWorkflow,

        versions,
      };
    }),

  generateAssistantDraft: protectedProcedure

    .input(generateWorkflowDraftSchema)

    .mutation(async ({ ctx, input }) => {
      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: input.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:create",
      });

      try {
        return await generateWorkflowDraft(input.prompt);
      } catch (error) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",

          message:
            error instanceof Error
              ? error.message
              : "Unable to generate the workflow draft.",
        });
      }
    }),

  createAssistantDraft: protectedProcedure

    .input(createAssistantWorkflowSchema)

    .mutation(async ({ ctx, input }) => {
      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: input.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:create",
      });

      const workflowId = crypto.randomUUID();

      const versionId = crypto.randomUUID();

      const parsedDefinition = saveWorkflowDefinitionSchema.safeParse({
        id: workflowId,

        nodes: input.definition.nodes,

        edges: input.definition.edges,
      });

      if (!parsedDefinition.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",

          message:
            parsedDefinition.error.issues[0]?.message ??
            "The generated workflow definition is invalid.",
        });
      }

      return ctx.db.transaction(async (transaction) => {
        const [createdWorkflow] = await transaction

          .insert(workflow)

          .values({
            id: workflowId,

            workspaceId: input.workspaceId,

            name: input.name,

            description: input.description || null,

            status: "DRAFT",

            createdBy: ctx.session.user.id,
          })

          .returning();

        const [initialVersion] = await transaction

          .insert(workflowVersion)

          .values({
            id: versionId,

            workflowId,

            version: 1,

            status: "DRAFT",

            definition: {
              nodes: parsedDefinition.data.nodes,

              edges: parsedDefinition.data.edges,
            },

            createdBy: ctx.session.user.id,
          })

          .returning();

        if (!createdWorkflow || !initialVersion) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",

            message: "Failed to create the generated workflow.",
          });
        }

        return {
          ...createdWorkflow,

          version: initialVersion,
        };
      });
    }),

  create: protectedProcedure

    .input(createWorkflowSchema)

    .mutation(async ({ ctx, input }) => {
      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: input.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:create",
      });

      const workflowId = crypto.randomUUID();

      const versionId = crypto.randomUUID();

      return ctx.db.transaction(async (transaction) => {
        const [createdWorkflow] = await transaction

          .insert(workflow)

          .values({
            id: workflowId,

            workspaceId: input.workspaceId,

            name: input.name,

            description: input.description || null,

            status: "DRAFT",

            createdBy: ctx.session.user.id,
          })

          .returning();

        const [initialVersion] = await transaction

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

            createdBy: ctx.session.user.id,
          })

          .returning();

        if (!createdWorkflow || !initialVersion) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",

            message: "Failed to create workflow.",
          });
        }

        return {
          ...createdWorkflow,

          version: initialVersion,
        };
      });
    }),

  update: protectedProcedure

    .input(updateWorkflowSchema)

    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] = await ctx.db

        .select()

        .from(workflow)

        .where(
          eq(
            workflow.id,

            input.id,
          ),
        )

        .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",

          message: "Workflow not found.",
        });
      }

      if (existingWorkflow.status === "ARCHIVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",

          message: "Archived workflows cannot be edited.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: existingWorkflow.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:update",
      });

      const changes: Partial<typeof workflow.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) {
        changes.name = input.name;
      }

      if (input.description !== undefined) {
        changes.description = input.description;
      }

      const [updatedWorkflow] = await ctx.db

        .update(workflow)

        .set(changes)

        .where(
          eq(
            workflow.id,

            input.id,
          ),
        )

        .returning();

      if (!updatedWorkflow) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",

          message: "Failed to update workflow.",
        });
      }

      return updatedWorkflow;
    }),

  saveDefinition: protectedProcedure

    .input(saveWorkflowDefinitionSchema)

    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] = await ctx.db

        .select()

        .from(workflow)

        .where(
          eq(
            workflow.id,

            input.id,
          ),
        )

        .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",

          message: "Workflow not found.",
        });
      }

      if (existingWorkflow.status === "ARCHIVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",

          message: "Archived workflows cannot be edited.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: existingWorkflow.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:update",
      });

      return ctx.db.transaction(async (transaction) => {
        const [latestVersion] = await transaction

          .select()

          .from(workflowVersion)

          .where(
            eq(
              workflowVersion.workflowId,

              input.id,
            ),
          )

          .orderBy(desc(workflowVersion.version))

          .limit(1);

        const definition = {
          nodes: input.nodes,

          edges: input.edges,

          variables: latestVersion?.definition.variables ?? {},
        };

        const [savedVersion] =
          latestVersion?.status === "DRAFT"
            ? await transaction

                .update(workflowVersion)

                .set({
                  definition,

                  updatedAt: new Date(),
                })

                .where(
                  eq(
                    workflowVersion.id,

                    latestVersion.id,
                  ),
                )

                .returning()
            : await transaction

                .insert(workflowVersion)

                .values({
                  id: crypto.randomUUID(),

                  workflowId: input.id,

                  version: (latestVersion?.version ?? 0) + 1,

                  status: "DRAFT",

                  definition,

                  createdBy: ctx.session.user.id,
                })

                .returning();

        if (!savedVersion) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",

            message: "Failed to save workflow definition.",
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

              input.id,
            ),
          );

        return savedVersion;
      });
    }),

  publish: protectedProcedure

    .input(workflowIdSchema)

    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] = await ctx.db

        .select()

        .from(workflow)

        .where(
          eq(
            workflow.id,

            input.id,
          ),
        )

        .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",

          message: "Workflow not found.",
        });
      }

      if (existingWorkflow.status === "ARCHIVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",

          message: "Archived workflows cannot be published.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: existingWorkflow.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:update",
      });

      return ctx.db.transaction(async (transaction) => {
        const [latestDraft] = await transaction

          .select()

          .from(workflowVersion)

          .where(
            and(
              eq(
                workflowVersion.workflowId,

                input.id,
              ),

              eq(
                workflowVersion.status,

                "DRAFT",
              ),
            ),
          )

          .orderBy(desc(workflowVersion.version))

          .limit(1);

        if (!latestDraft) {
          throw new TRPCError({
            code: "BAD_REQUEST",

            message: "This workflow has no draft version to publish.",
          });
        }

        const validation = validateWorkflowForPublish(
          input.id,

          latestDraft.definition,
        );

        if (!validation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",

            message: validation.message,
          });
        }

        const [publishedVersion] = await transaction

          .update(workflowVersion)

          .set({
            status: "PUBLISHED",

            updatedAt: new Date(),
          })

          .where(
            and(
              eq(
                workflowVersion.id,

                latestDraft.id,
              ),

              eq(
                workflowVersion.status,

                "DRAFT",
              ),
            ),
          )

          .returning();

        if (!publishedVersion) {
          throw new TRPCError({
            code: "CONFLICT",

            message: "The draft changed while it was being published.",
          });
        }

        const [activeWorkflow] = await transaction

          .update(workflow)

          .set({
            status: "ACTIVE",

            updatedAt: new Date(),
          })

          .where(
            eq(
              workflow.id,

              input.id,
            ),
          )

          .returning();

        if (!activeWorkflow) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",

            message: "Failed to activate the workflow.",
          });
        }

        return {
          workflow: activeWorkflow,

          version: publishedVersion,
        };
      });
    }),

  executeManual: protectedProcedure

    .input(executeWorkflowSchema)

    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] = await ctx.db

        .select({
          id: workflow.id,

          workspaceId: workflow.workspaceId,

          status: workflow.status,
        })

        .from(workflow)

        .where(
          eq(
            workflow.id,

            input.id,
          ),
        )

        .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",

          message: "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: existingWorkflow.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:execute",
      });

      if (existingWorkflow.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",

          message: "Only active workflows can be executed.",
        });
      }

      try {
        return await queueWorkflowRun({
          workflowId: existingWorkflow.id,

          triggerType: "MANUAL",

          input: input.input,

          triggeredBy: ctx.session.user.id,
        });
      } catch (error) {
        if (error instanceof WorkflowRunQueueError) {
          if (error.message === "Workflow not found.") {
            throw new TRPCError({
              code: "NOT_FOUND",

              message: error.message,

              cause: error,
            });
          }

          const isExecutionStateError =
            error.message === "Only active workflows can be executed." ||
            error.message === "The workflow has no published version.";

          throw new TRPCError({
            code: isExecutionStateError
              ? "BAD_REQUEST"
              : "INTERNAL_SERVER_ERROR",

            message: isExecutionStateError
              ? error.message
              : "Failed to queue workflow execution. Check the server logs and run history.",

            cause: error,
          });
        }

        throw error;
      }
    }),

  listRuns: protectedProcedure

    .input(listWorkflowRunsSchema)

    .query(async ({ ctx, input }) => {
      const [existingWorkflow] = await ctx.db

        .select({
          id: workflow.id,

          workspaceId: workflow.workspaceId,
        })

        .from(workflow)

        .where(
          eq(
            workflow.id,

            input.workflowId,
          ),
        )

        .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",

          message: "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: existingWorkflow.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:read",
      });

      return ctx.db

        .select({
          id: workflowRun.id,

          workflowId: workflowRun.workflowId,

          workflowVersionId: workflowRun.workflowVersionId,

          status: workflowRun.status,

          triggerType: workflowRun.triggerType,

          input: workflowRun.input,

          output: workflowRun.output,

          error: workflowRun.error,

          triggeredBy: workflowRun.triggeredBy,

          startedAt: workflowRun.startedAt,

          completedAt: workflowRun.completedAt,

          createdAt: workflowRun.createdAt,
        })

        .from(workflowRun)

        .where(
          eq(
            workflowRun.workflowId,

            input.workflowId,
          ),
        )

        .orderBy(desc(workflowRun.createdAt))

        .limit(input.limit);
    }),

  getRunById: protectedProcedure

    .input(workflowRunIdSchema)

    .query(async ({ ctx, input }) => {
      const [run] = await ctx.db

        .select()

        .from(workflowRun)

        .where(
          eq(
            workflowRun.id,

            input.id,
          ),
        )

        .limit(1);

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",

          message: "Workflow run not found.",
        });
      }

      const [existingWorkflow] = await ctx.db

        .select({
          id: workflow.id,

          workspaceId: workflow.workspaceId,
        })

        .from(workflow)

        .where(
          eq(
            workflow.id,

            run.workflowId,
          ),
        )

        .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",

          message: "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: existingWorkflow.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:read",
      });

      const [versionRows, steps, logs] = await Promise.all([
        ctx.db

          .select({
            id: workflowVersion.id,

            version: workflowVersion.version,

            definition: workflowVersion.definition,
          })

          .from(workflowVersion)

          .where(
            eq(
              workflowVersion.id,

              run.workflowVersionId,
            ),
          )

          .limit(1),

        ctx.db

          .select()

          .from(workflowRunStep)

          .where(
            eq(
              workflowRunStep.runId,

              run.id,
            ),
          )

          .orderBy(asc(workflowRunStep.createdAt)),

        ctx.db

          .select()

          .from(workflowLog)

          .where(
            eq(
              workflowLog.runId,

              run.id,
            ),
          )

          .orderBy(asc(workflowLog.createdAt)),
      ]);

      const version = versionRows[0] ?? null;

      const nodeLabels = createNodeLabelMap(version?.definition.nodes ?? []);

      return {
        ...run,

        workflowVersionNumber: version?.version ?? null,

        steps: steps.map((step) => ({
          ...step,

          nodeLabel: nodeLabels.get(step.nodeId) ?? step.nodeId,
        })),

        logs,
      };
    }),

  archive: protectedProcedure

    .input(archiveWorkflowSchema)

    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] = await ctx.db

        .select()

        .from(workflow)

        .where(
          eq(
            workflow.id,

            input.id,
          ),
        )

        .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",

          message: "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: existingWorkflow.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:delete",
      });

      const [archivedWorkflow] = await ctx.db

        .update(workflow)

        .set({
          status: "ARCHIVED",

          updatedAt: new Date(),
        })

        .where(
          eq(
            workflow.id,

            input.id,
          ),
        )

        .returning();

      if (!archivedWorkflow) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",

          message: "Failed to archive workflow.",
        });
      }

      return archivedWorkflow;
    }),

  delete: protectedProcedure

    .input(deleteWorkflowSchema)

    .mutation(async ({ ctx, input }) => {
      const [existingWorkflow] = await ctx.db

        .select()

        .from(workflow)

        .where(
          eq(
            workflow.id,

            input.id,
          ),
        )

        .limit(1);

      if (!existingWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",

          message: "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,

        workspaceId: existingWorkflow.workspaceId,

        userId: ctx.session.user.id,

        permission: "workflow:delete",
      });

      await ctx.db

        .delete(workflow)

        .where(
          eq(
            workflow.id,

            input.id,
          ),
        );

      return {
        success: true,

        id: input.id,
      };
    }),
});

import "server-only";

import {
  randomUUID,
} from "node:crypto";
import {
  TRPCError,
} from "@trpc/server";
import {
  and,
  asc,
  eq,
  ne,
  sql,
} from "drizzle-orm";

import {
  createWorkflowFolderSchema,
  deleteWorkflowFolderSchema,
  listWorkflowFoldersSchema,
  moveWorkflowToFolderSchema,
  renameWorkflowFolderSchema,
} from "@/features/workflow/workflow-folder-validator";
import {
  requireWorkspacePermission,
} from "@/features/workspace/authorization";
import {
  workflow,
  workflowFolder,
  workspace,
  workspaceMember,
} from "@/lib/db/schema";

import {
  protectedProcedure,
  router,
} from "../init";

function isUniqueViolation(
  error: unknown
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const candidate =
    error as {
      code?: unknown;
      cause?: unknown;
    };

  if (
    candidate.code === "23505"
  ) {
    return true;
  }

  if (
    typeof candidate.cause !==
      "object" ||
    candidate.cause === null
  ) {
    return false;
  }

  return (
    (
      candidate.cause as {
        code?: unknown;
      }
    ).code === "23505"
  );
}

export const workflowFolderRouter =
  router({
    listAll: protectedProcedure
      .query(
        async ({
          ctx,
        }) => {
          return ctx.db
            .select({
              id:
                workflowFolder.id,

              workspaceId:
                workflowFolder
                  .workspaceId,

              workspaceName:
                workspace.name,

              workspaceRole:
                workspaceMember.role,

              name:
                workflowFolder.name,

              createdBy:
                workflowFolder
                  .createdBy,

              createdAt:
                workflowFolder
                  .createdAt,

              updatedAt:
                workflowFolder
                  .updatedAt,

              workflowCount:
                sql<number>`
                  count(${workflow.id})::int
                `.as(
                  "workflow_count"
                ),
            })
            .from(workflowFolder)
            .innerJoin(
              workspaceMember,
              eq(
                workspaceMember
                  .workspaceId,
                workflowFolder
                  .workspaceId
              )
            )
            .innerJoin(
              workspace,
              eq(
                workspace.id,
                workflowFolder
                  .workspaceId
              )
            )
            .leftJoin(
              workflow,
              eq(
                workflow.folderId,
                workflowFolder.id
              )
            )
            .where(
              eq(
                workspaceMember.userId,
                ctx.session.user.id
              )
            )
            .groupBy(
              workflowFolder.id,
              workflowFolder
                .workspaceId,
              workspace.name,
              workspaceMember.role,
              workflowFolder.name,
              workflowFolder
                .createdBy,
              workflowFolder
                .createdAt,
              workflowFolder
                .updatedAt
            )
            .orderBy(
              asc(workspace.name),
              asc(
                workflowFolder.name
              )
            );
        }
      ),

    list: protectedProcedure
      .input(
        listWorkflowFoldersSchema
      )
      .query(
        async ({
          ctx,
          input,
        }) => {
          await requireWorkspacePermission(
            {
              database: ctx.db,

              workspaceId:
                input.workspaceId,

              userId:
                ctx.session.user.id,

              permission:
                "workflow:read",
            }
          );

          return ctx.db
            .select({
              id:
                workflowFolder.id,

              workspaceId:
                workflowFolder
                  .workspaceId,

              name:
                workflowFolder.name,

              createdBy:
                workflowFolder
                  .createdBy,

              createdAt:
                workflowFolder
                  .createdAt,

              updatedAt:
                workflowFolder
                  .updatedAt,

              workflowCount:
                sql<number>`
                  count(${workflow.id})::int
                `.as(
                  "workflow_count"
                ),
            })
            .from(workflowFolder)
            .leftJoin(
              workflow,
              eq(
                workflow.folderId,
                workflowFolder.id
              )
            )
            .where(
              eq(
                workflowFolder
                  .workspaceId,
                input.workspaceId
              )
            )
            .groupBy(
              workflowFolder.id,
              workflowFolder
                .workspaceId,
              workflowFolder.name,
              workflowFolder
                .createdBy,
              workflowFolder
                .createdAt,
              workflowFolder
                .updatedAt
            )
            .orderBy(
              asc(
                workflowFolder.name
              )
            );
        }
      ),

    create: protectedProcedure
      .input(
        createWorkflowFolderSchema
      )
      .mutation(
        async ({
          ctx,
          input,
        }) => {
          await requireWorkspacePermission(
            {
              database: ctx.db,

              workspaceId:
                input.workspaceId,

              userId:
                ctx.session.user.id,

              permission:
                "workflow:create",
            }
          );

          const [
            existingFolder,
          ] = await ctx.db
            .select({
              id:
                workflowFolder.id,
            })
            .from(workflowFolder)
            .where(
              and(
                eq(
                  workflowFolder
                    .workspaceId,
                  input.workspaceId
                ),

                sql`
                  lower(${workflowFolder.name})
                  =
                  lower(${input.name})
                `
              )
            )
            .limit(1);

          if (existingFolder) {
            throw new TRPCError({
              code: "CONFLICT",

              message:
                "A folder with this name already exists in the workspace.",
            });
          }

          try {
            const [
              createdFolder,
            ] = await ctx.db
              .insert(
                workflowFolder
              )
              .values({
                id: randomUUID(),

                workspaceId:
                  input.workspaceId,

                name: input.name,

                createdBy:
                  ctx.session.user.id,
              })
              .returning();

            if (!createdFolder) {
              throw new TRPCError({
                code:
                  "INTERNAL_SERVER_ERROR",

                message:
                  "Unable to create the folder.",
              });
            }

            return {
              ...createdFolder,

              workflowCount: 0,
            };
          } catch (error) {
            if (
              error instanceof
              TRPCError
            ) {
              throw error;
            }

            if (
              isUniqueViolation(
                error
              )
            ) {
              throw new TRPCError({
                code: "CONFLICT",

                message:
                  "A folder with this name already exists in the workspace.",
              });
            }

            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",

              message:
                "Unable to create the folder.",

              cause: error,
            });
          }
        }
      ),

    rename: protectedProcedure
      .input(
        renameWorkflowFolderSchema
      )
      .mutation(
        async ({
          ctx,
          input,
        }) => {
          const [
            existingFolder,
          ] = await ctx.db
            .select({
              id:
                workflowFolder.id,

              workspaceId:
                workflowFolder
                  .workspaceId,
            })
            .from(workflowFolder)
            .where(
              eq(
                workflowFolder.id,
                input.id
              )
            )
            .limit(1);

          if (!existingFolder) {
            throw new TRPCError({
              code: "NOT_FOUND",

              message:
                "Folder not found.",
            });
          }

          await requireWorkspacePermission(
            {
              database: ctx.db,

              workspaceId:
                existingFolder
                  .workspaceId,

              userId:
                ctx.session.user.id,

              permission:
                "workflow:update",
            }
          );

          const [
            conflictingFolder,
          ] = await ctx.db
            .select({
              id:
                workflowFolder.id,
            })
            .from(workflowFolder)
            .where(
              and(
                eq(
                  workflowFolder
                    .workspaceId,
                  existingFolder
                    .workspaceId
                ),

                ne(
                  workflowFolder.id,
                  existingFolder.id
                ),

                sql`
                  lower(${workflowFolder.name})
                  =
                  lower(${input.name})
                `
              )
            )
            .limit(1);

          if (
            conflictingFolder
          ) {
            throw new TRPCError({
              code: "CONFLICT",

              message:
                "A folder with this name already exists in the workspace.",
            });
          }

          try {
            const [
              updatedFolder,
            ] = await ctx.db
              .update(
                workflowFolder
              )
              .set({
                name: input.name,

                updatedAt:
                  new Date(),
              })
              .where(
                eq(
                  workflowFolder.id,
                  existingFolder.id
                )
              )
              .returning();

            if (!updatedFolder) {
              throw new TRPCError({
                code:
                  "INTERNAL_SERVER_ERROR",

                message:
                  "Unable to rename the folder.",
              });
            }

            return updatedFolder;
          } catch (error) {
            if (
              error instanceof
              TRPCError
            ) {
              throw error;
            }

            if (
              isUniqueViolation(
                error
              )
            ) {
              throw new TRPCError({
                code: "CONFLICT",

                message:
                  "A folder with this name already exists in the workspace.",
              });
            }

            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",

              message:
                "Unable to rename the folder.",

              cause: error,
            });
          }
        }
      ),

    delete: protectedProcedure
      .input(
        deleteWorkflowFolderSchema
      )
      .mutation(
        async ({
          ctx,
          input,
        }) => {
          const [
            existingFolder,
          ] = await ctx.db
            .select({
              id:
                workflowFolder.id,

              workspaceId:
                workflowFolder
                  .workspaceId,
            })
            .from(workflowFolder)
            .where(
              eq(
                workflowFolder.id,
                input.id
              )
            )
            .limit(1);

          if (!existingFolder) {
            throw new TRPCError({
              code: "NOT_FOUND",

              message:
                "Folder not found.",
            });
          }

          await requireWorkspacePermission(
            {
              database: ctx.db,

              workspaceId:
                existingFolder
                  .workspaceId,

              userId:
                ctx.session.user.id,

              permission:
                "workflow:update",
            }
          );

          await ctx.db
            .delete(
              workflowFolder
            )
            .where(
              eq(
                workflowFolder.id,
                existingFolder.id
              )
            );

          return {
            success: true,

            id:
              existingFolder.id,

            workspaceId:
              existingFolder
                .workspaceId,
          };
        }
      ),

    moveWorkflow:
      protectedProcedure
        .input(
          moveWorkflowToFolderSchema
        )
        .mutation(
          async ({
            ctx,
            input,
          }) => {
            const [
              existingWorkflow,
            ] = await ctx.db
              .select({
                id:
                  workflow.id,

                workspaceId:
                  workflow.workspaceId,

                folderId:
                  workflow.folderId,
              })
              .from(workflow)
              .where(
                eq(
                  workflow.id,
                  input.workflowId
                )
              )
              .limit(1);

            if (
              !existingWorkflow
            ) {
              throw new TRPCError({
                code: "NOT_FOUND",

                message:
                  "Workflow not found.",
              });
            }

            await requireWorkspacePermission(
              {
                database: ctx.db,

                workspaceId:
                  existingWorkflow
                    .workspaceId,

                userId:
                  ctx.session.user.id,

                permission:
                  "workflow:update",
              }
            );

            if (input.folderId) {
              const [
                targetFolder,
              ] = await ctx.db
                .select({
                  id:
                    workflowFolder.id,

                  workspaceId:
                    workflowFolder
                      .workspaceId,
                })
                .from(
                  workflowFolder
                )
                .where(
                  eq(
                    workflowFolder.id,
                    input.folderId
                  )
                )
                .limit(1);

              if (!targetFolder) {
                throw new TRPCError({
                  code:
                    "NOT_FOUND",

                  message:
                    "Target folder not found.",
                });
              }

              if (
                targetFolder
                  .workspaceId !==
                existingWorkflow
                  .workspaceId
              ) {
                throw new TRPCError({
                  code:
                    "BAD_REQUEST",

                  message:
                    "A workflow cannot be moved to a folder in another workspace.",
                });
              }
            }

            const [
              updatedWorkflow,
            ] = await ctx.db
              .update(workflow)
              .set({
                folderId:
                  input.folderId,

                updatedAt:
                  new Date(),
              })
              .where(
                eq(
                  workflow.id,
                  existingWorkflow.id
                )
              )
              .returning({
                id:
                  workflow.id,

                workspaceId:
                  workflow.workspaceId,

                folderId:
                  workflow.folderId,

                updatedAt:
                  workflow.updatedAt,
              });

            if (
              !updatedWorkflow
            ) {
              throw new TRPCError({
                code:
                  "INTERNAL_SERVER_ERROR",

                message:
                  "Unable to move the workflow.",
              });
            }

            return updatedWorkflow;
          }
        ),
  });
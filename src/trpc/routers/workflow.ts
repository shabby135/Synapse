import { TRPCError } from "@trpc/server";

import {
  and,
  desc,
  eq,
  ne,
} from "drizzle-orm";

import {
  workflow,
  workflowVersion,
} from "@/lib/db/schema";

import { requireWorkspacePermission } from "@/features/workspace/authorization";

import {
  archiveWorkflowSchema,
  createWorkflowSchema,
  deleteWorkflowSchema,
  listWorkflowsSchema,
  updateWorkflowSchema,
  workflowIdSchema,
} from "@/features/workflow/validator";

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
        workspaceId: input.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:read",
      });

      return ctx.db
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
        .orderBy(desc(workflow.updatedAt));
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
          message: "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:read",
      });

      const versions = await ctx.db
        .select({
          id: workflowVersion.id,
          version: workflowVersion.version,
          status: workflowVersion.status,
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
          desc(workflowVersion.version)
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
        workspaceId: input.workspaceId,
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
                  input.description || null,
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

          return {
            ...createdWorkflow,
            version: initialVersion,
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
          message: "Workflow not found.",
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

      if (input.name !== undefined) {
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

      return updatedWorkflow;
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
          message: "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:delete",
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
          message: "Workflow not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existingWorkflow.workspaceId,
        userId: ctx.session.user.id,
        permission: "workflow:delete",
      });

      await ctx.db
        .delete(workflow)
        .where(
          eq(workflow.id, input.id)
        );

      return {
        success: true,
        id: input.id,
      };
    }),
});
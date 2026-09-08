import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import {
  generateWebhookSecret,
  hashWebhookSecret,
} from "@/features/workflow/webhook-secret";
import {
  setWorkflowWebhookEnabledSchema,
  workflowWebhookByWorkflowSchema,
} from "@/features/workflow/webhook-validator";
import { requireWorkspacePermission } from "@/features/workspace/authorization";
import {
  workflow,
  workflowWebhook,
} from "@/lib/db/schema";

import {
  protectedProcedure,
  router,
} from "../init";

export const workflowWebhookRouter =
  router({
    get: protectedProcedure
      .input(
        workflowWebhookByWorkflowSchema
      )
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

        const [webhook] =
          await ctx.db
            .select({
              id: workflowWebhook.id,
              workflowId:
                workflowWebhook
                  .workflowId,
              enabled:
                workflowWebhook.enabled,
              createdAt:
                workflowWebhook
                  .createdAt,
              updatedAt:
                workflowWebhook
                  .updatedAt,
            })
            .from(workflowWebhook)
            .where(
              eq(
                workflowWebhook
                  .workflowId,
                input.workflowId
              )
            )
            .limit(1);

        return webhook ?? null;
      }),

    create: protectedProcedure
      .input(
        workflowWebhookByWorkflowSchema
      )
      .mutation(
        async ({ ctx, input }) => {
          const [existingWorkflow] =
            await ctx.db
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
              existingWorkflow
                .workspaceId,
            userId:
              ctx.session.user.id,
            permission:
              "workflow:update",
          });

          if (
            existingWorkflow.status !==
            "ACTIVE"
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Publish the workflow before creating a webhook.",
            });
          }

          const secret =
            generateWebhookSecret();

          const [createdWebhook] =
            await ctx.db
              .insert(workflowWebhook)
              .values({
                id: crypto.randomUUID(),
                workflowId:
                  existingWorkflow.id,
                secretHash:
                  hashWebhookSecret(
                    secret
                  ),
                enabled: true,
              })
              .onConflictDoNothing({
                target:
                  workflowWebhook
                    .workflowId,
              })
              .returning({
                id: workflowWebhook.id,
                workflowId:
                  workflowWebhook
                    .workflowId,
                enabled:
                  workflowWebhook.enabled,
                createdAt:
                  workflowWebhook
                    .createdAt,
                updatedAt:
                  workflowWebhook
                    .updatedAt,
              });

          if (!createdWebhook) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "This workflow already has a webhook. Rotate its secret instead.",
            });
          }

          return {
            ...createdWebhook,
            secret,
            path: `/api/webhooks/${createdWebhook.workflowId}/${secret}`,
          };
        }
      ),

    rotate: protectedProcedure
      .input(
        workflowWebhookByWorkflowSchema
      )
      .mutation(
        async ({ ctx, input }) => {
          const [existingWebhook] =
            await ctx.db
              .select({
                id: workflowWebhook.id,
                workflowId:
                  workflowWebhook
                    .workflowId,
                workspaceId:
                  workflow.workspaceId,
                workflowStatus:
                  workflow.status,
              })
              .from(workflowWebhook)
              .innerJoin(
                workflow,
                eq(
                  workflow.id,
                  workflowWebhook
                    .workflowId
                )
              )
              .where(
                eq(
                  workflowWebhook
                    .workflowId,
                  input.workflowId
                )
              )
              .limit(1);

          if (!existingWebhook) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "Workflow webhook not found.",
            });
          }

          await requireWorkspacePermission({
            database: ctx.db,
            workspaceId:
              existingWebhook
                .workspaceId,
            userId:
              ctx.session.user.id,
            permission:
              "workflow:update",
          });

          if (
            existingWebhook
              .workflowStatus ===
            "ARCHIVED"
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Archived workflow webhooks cannot be rotated.",
            });
          }

          const secret =
            generateWebhookSecret();

          const [updatedWebhook] =
            await ctx.db
              .update(workflowWebhook)
              .set({
                secretHash:
                  hashWebhookSecret(
                    secret
                  ),
                updatedAt: new Date(),
              })
              .where(
                eq(
                  workflowWebhook.id,
                  existingWebhook.id
                )
              )
              .returning({
                id: workflowWebhook.id,
                workflowId:
                  workflowWebhook
                    .workflowId,
                enabled:
                  workflowWebhook.enabled,
                createdAt:
                  workflowWebhook
                    .createdAt,
                updatedAt:
                  workflowWebhook
                    .updatedAt,
              });

          if (!updatedWebhook) {
            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",
              message:
                "Failed to rotate the webhook secret.",
            });
          }

          return {
            ...updatedWebhook,
            secret,
            path: `/api/webhooks/${updatedWebhook.workflowId}/${secret}`,
          };
        }
      ),

    setEnabled: protectedProcedure
      .input(
        setWorkflowWebhookEnabledSchema
      )
      .mutation(
        async ({ ctx, input }) => {
          const [existingWebhook] =
            await ctx.db
              .select({
                id: workflowWebhook.id,
                workspaceId:
                  workflow.workspaceId,
                workflowStatus:
                  workflow.status,
              })
              .from(workflowWebhook)
              .innerJoin(
                workflow,
                eq(
                  workflow.id,
                  workflowWebhook
                    .workflowId
                )
              )
              .where(
                eq(
                  workflowWebhook
                    .workflowId,
                  input.workflowId
                )
              )
              .limit(1);

          if (!existingWebhook) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "Workflow webhook not found.",
            });
          }

          await requireWorkspacePermission({
            database: ctx.db,
            workspaceId:
              existingWebhook
                .workspaceId,
            userId:
              ctx.session.user.id,
            permission:
              "workflow:update",
          });

          if (
            input.enabled &&
            existingWebhook
              .workflowStatus !==
              "ACTIVE"
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Only active workflows can enable webhook execution.",
            });
          }

          const [updatedWebhook] =
            await ctx.db
              .update(workflowWebhook)
              .set({
                enabled:
                  input.enabled,
                updatedAt: new Date(),
              })
              .where(
                eq(
                  workflowWebhook.id,
                  existingWebhook.id
                )
              )
              .returning({
                id: workflowWebhook.id,
                workflowId:
                  workflowWebhook
                    .workflowId,
                enabled:
                  workflowWebhook.enabled,
                createdAt:
                  workflowWebhook
                    .createdAt,
                updatedAt:
                  workflowWebhook
                    .updatedAt,
              });

          if (!updatedWebhook) {
            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",
              message:
                "Failed to update the webhook.",
            });
          }

          return updatedWebhook;
        }
      ),
  });
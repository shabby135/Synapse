import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  eq,
} from "drizzle-orm";

import {
  createIntegrationSecretContext,
  encryptIntegrationSecret,
} from "@/features/integration/encryption";
import {
  createIntegrationSchema,
  deleteIntegrationSchema,
  listIntegrationsSchema,
  updateIntegrationSchema,
} from "@/features/integration/validator";
import { requireWorkspacePermission } from "@/features/workspace/authorization";
import {
  workspaceIntegration,
} from "@/lib/db/schema";

import {
  protectedProcedure,
  router,
} from "../init";

function isUniqueViolation(
  error: unknown
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export const integrationRouter =
  router({
    list: protectedProcedure
      .input(listIntegrationsSchema)
      .query(async ({ ctx, input }) => {
        await requireWorkspacePermission({
          database: ctx.db,
          workspaceId:
            input.workspaceId,
          userId:
            ctx.session.user.id,
          permission:
            "integration:read",
        });

        return ctx.db
          .select({
            id: workspaceIntegration.id,
            workspaceId:
              workspaceIntegration
                .workspaceId,
            provider:
              workspaceIntegration
                .provider,
            name:
              workspaceIntegration.name,
            status:
              workspaceIntegration.status,
            lastTestedAt:
              workspaceIntegration
                .lastTestedAt,
            lastError:
              workspaceIntegration
                .lastError,
            createdAt:
              workspaceIntegration
                .createdAt,
            updatedAt:
              workspaceIntegration
                .updatedAt,
          })
          .from(workspaceIntegration)
          .where(
            input.provider
              ? and(
                  eq(
                    workspaceIntegration
                      .workspaceId,
                    input.workspaceId
                  ),
                  eq(
                    workspaceIntegration
                      .provider,
                    input.provider
                  )
                )
              : eq(
                  workspaceIntegration
                    .workspaceId,
                  input.workspaceId
                )
          )
          .orderBy(
            asc(
              workspaceIntegration.provider
            ),
            asc(
              workspaceIntegration.name
            )
          );
      }),

    create: protectedProcedure
      .input(createIntegrationSchema)
      .mutation(
        async ({ ctx, input }) => {
          await requireWorkspacePermission({
            database: ctx.db,
            workspaceId:
              input.workspaceId,
            userId:
              ctx.session.user.id,
            permission:
              "integration:manage",
          });

          const integrationId =
            crypto.randomUUID();

          const context =
            createIntegrationSecretContext({
              workspaceId:
                input.workspaceId,
              provider:
                input.provider,
              integrationId,
            });

          const encrypted =
            encryptIntegrationSecret({
              value: input.webhookUrl,
              context,
            });

          try {
            const [createdIntegration] =
              await ctx.db
                .insert(
                  workspaceIntegration
                )
                .values({
                  id: integrationId,
                  workspaceId:
                    input.workspaceId,
                  provider:
                    input.provider,
                  name: input.name,
                  encryptedValue:
                    encrypted.encryptedValue,
                  initializationVector:
                    encrypted
                      .initializationVector,
                  authenticationTag:
                    encrypted
                      .authenticationTag,
                  keyVersion:
                    encrypted.keyVersion,
                  createdBy:
                    ctx.session.user.id,
                })
                .returning({
                  id:
                    workspaceIntegration.id,
                  workspaceId:
                    workspaceIntegration
                      .workspaceId,
                  provider:
                    workspaceIntegration
                      .provider,
                  name:
                    workspaceIntegration
                      .name,
                  status:
                    workspaceIntegration
                      .status,
                  lastTestedAt:
                    workspaceIntegration
                      .lastTestedAt,
                  lastError:
                    workspaceIntegration
                      .lastError,
                  createdAt:
                    workspaceIntegration
                      .createdAt,
                  updatedAt:
                    workspaceIntegration
                      .updatedAt,
                });

            return createdIntegration;
          } catch (error) {
            if (
              isUniqueViolation(error)
            ) {
              throw new TRPCError({
                code: "CONFLICT",
                message:
                  "An integration with this provider and name already exists.",
              });
            }

            throw error;
          }
        }
      ),

    update: protectedProcedure
      .input(updateIntegrationSchema)
      .mutation(
        async ({ ctx, input }) => {
          const [existingIntegration] =
            await ctx.db
              .select()
              .from(
                workspaceIntegration
              )
              .where(
                eq(
                  workspaceIntegration.id,
                  input.id
                )
              )
              .limit(1);

          if (!existingIntegration) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "Integration not found.",
            });
          }

          await requireWorkspacePermission({
            database: ctx.db,
            workspaceId:
              existingIntegration
                .workspaceId,
            userId:
              ctx.session.user.id,
            permission:
              "integration:manage",
          });

          const changes: Partial<
            typeof workspaceIntegration.$inferInsert
          > = {
            updatedAt: new Date(),
          };

          if (
            input.name !== undefined
          ) {
            changes.name = input.name;
          }

          if (
            input.webhookUrl !==
            undefined
          ) {
            const validated =
              createIntegrationSchema.safeParse(
                {
                  workspaceId:
                    existingIntegration
                      .workspaceId,
                  provider:
                    existingIntegration
                      .provider,
                  name:
                    input.name ??
                    existingIntegration
                      .name,
                  webhookUrl:
                    input.webhookUrl,
                }
              );

            if (!validated.success) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                  validated.error
                    .issues[0]
                    ?.message ??
                  "Invalid webhook URL.",
              });
            }

            const context =
              createIntegrationSecretContext({
                workspaceId:
                  existingIntegration
                    .workspaceId,
                provider:
                  existingIntegration
                    .provider,
                integrationId:
                  existingIntegration.id,
              });

            const encrypted =
              encryptIntegrationSecret({
                value:
                  validated.data
                    .webhookUrl,
                context,
              });

            changes.encryptedValue =
              encrypted.encryptedValue;

            changes.initializationVector =
              encrypted.initializationVector;

            changes.authenticationTag =
              encrypted.authenticationTag;

            changes.keyVersion =
              encrypted.keyVersion;
          }

          try {
            const [updatedIntegration] =
              await ctx.db
                .update(
                  workspaceIntegration
                )
                .set(changes)
                .where(
                  eq(
                    workspaceIntegration.id,
                    input.id
                  )
                )
                .returning({
                  id:
                    workspaceIntegration.id,
                  workspaceId:
                    workspaceIntegration
                      .workspaceId,
                  provider:
                    workspaceIntegration
                      .provider,
                  name:
                    workspaceIntegration
                      .name,
                  status:
                    workspaceIntegration
                      .status,
                  lastTestedAt:
                    workspaceIntegration
                      .lastTestedAt,
                  lastError:
                    workspaceIntegration
                      .lastError,
                  createdAt:
                    workspaceIntegration
                      .createdAt,
                  updatedAt:
                    workspaceIntegration
                      .updatedAt,
                });

            return updatedIntegration;
          } catch (error) {
            if (
              isUniqueViolation(error)
            ) {
              throw new TRPCError({
                code: "CONFLICT",
                message:
                  "An integration with this provider and name already exists.",
              });
            }

            throw error;
          }
        }
      ),

    delete: protectedProcedure
      .input(deleteIntegrationSchema)
      .mutation(
        async ({ ctx, input }) => {
          const [existingIntegration] =
            await ctx.db
              .select({
                id:
                  workspaceIntegration.id,
                workspaceId:
                  workspaceIntegration
                    .workspaceId,
              })
              .from(
                workspaceIntegration
              )
              .where(
                eq(
                  workspaceIntegration.id,
                  input.id
                )
              )
              .limit(1);

          if (!existingIntegration) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "Integration not found.",
            });
          }

          await requireWorkspacePermission({
            database: ctx.db,
            workspaceId:
              existingIntegration
                .workspaceId,
            userId:
              ctx.session.user.id,
            permission:
              "integration:manage",
          });

          await ctx.db
            .delete(
              workspaceIntegration
            )
            .where(
              eq(
                workspaceIntegration.id,
                input.id
              )
            );

          return {
            success: true,
            id: input.id,
          };
        }
      ),
  });

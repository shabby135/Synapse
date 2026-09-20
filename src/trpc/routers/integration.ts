import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  eq,
} from "drizzle-orm";

import {
  canTestConnection,
  testIntegrationConnection,
} from "@/features/integration/connection-testers";
import {
  createCredentialPreview,
  readCredentialPreview,
  validateProviderCredentials,
} from "@/features/integration/credential-definition";
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from "@/features/integration/credential-store";
import {
  createIntegrationSecretContext,
} from "@/features/integration/encryption";
import {
  getIntegrationProvider,
  type IntegrationProvider,
} from "@/features/integration/provider-registry";
import {
  createIntegrationSchema,
  deleteIntegrationSchema,
  listIntegrationsSchema,
  reconnectIntegrationSchema,
  testIntegrationSchema,
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

function invalidCredentials(
  error: unknown
): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message:
      error instanceof Error
        ? error.message
        : "Integration credentials are invalid.",
  });
}

function statusForTestResult(
  provider: IntegrationProvider,
  status:
    | "CONNECTED"
    | "INVALID_CREDENTIALS"
    | "PROVIDER_UNAVAILABLE"
):
  | "ACTIVE"
  | "NEEDS_REAUTH"
  | "ERROR" {
  if (status === "CONNECTED") {
    return "ACTIVE";
  }

  if (
    status === "INVALID_CREDENTIALS" &&
    getIntegrationProvider(provider)
      .authStrategy === "OAUTH2"
  ) {
    return "NEEDS_REAUTH";
  }

  return "ERROR";
}

function createSafeMetadata({
  provider,
  credentials,
  providerMetadata,
}: {
  provider: IntegrationProvider;
  credentials: Readonly<
    Record<string, string>
  >;
  providerMetadata?: Record<
    string,
    unknown
  >;
}): Record<string, unknown> {
  return {
    credentialPreview:
      createCredentialPreview(
        provider,
        credentials
      ),
    provider:
      providerMetadata ?? {},
  };
}

export const integrationRouter = router({
  list: protectedProcedure
    .input(listIntegrationsSchema)
    .query(async ({ ctx, input }) => {
      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId: input.workspaceId,
        userId: ctx.session.user.id,
        permission: "integration:read",
      });

      const rows = await ctx.db
        .select({
          id: workspaceIntegration.id,
          workspaceId:
            workspaceIntegration
              .workspaceId,
          provider:
            workspaceIntegration.provider,
          name: workspaceIntegration.name,
          status:
            workspaceIntegration.status,
          metadata:
            workspaceIntegration.metadata,
          externalAccountName:
            workspaceIntegration
              .externalAccountName,
          lastTestedAt:
            workspaceIntegration
              .lastTestedAt,
          lastError:
            workspaceIntegration.lastError,
          createdAt:
            workspaceIntegration.createdAt,
          updatedAt:
            workspaceIntegration.updatedAt,
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
          asc(workspaceIntegration.name)
        );

      return rows.map(
        ({ metadata, ...row }) => ({
          ...row,
          credentialPreview:
            readCredentialPreview(
              metadata
            ),
          canTest: canTestConnection(
            row.provider
          ),
        })
      );
    }),

  create: protectedProcedure
    .input(createIntegrationSchema)
    .mutation(async ({ ctx, input }) => {
      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId: input.workspaceId,
        userId: ctx.session.user.id,
        permission:
          "integration:manage",
      });

      const definition =
        getIntegrationProvider(
          input.provider
        );

      if (
        definition.availability !==
          "ACTIVE" ||
        !canTestConnection(
          input.provider
        )
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${definition.label} connections are not available yet.`,
        });
      }

      let credentials: Readonly<
        Record<string, string>
      >;

      try {
        credentials =
          validateProviderCredentials(
            input.provider,
            input.credentials
          );
      } catch (error) {
        invalidCredentials(error);
      }

      const testResult =
        await testIntegrationConnection({
          provider: input.provider,
          credentials,
        });

      if (
        testResult.status !==
        "CONNECTED"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            testResult.message ??
            "Connection test failed.",
        });
      }

      const integrationId =
        crypto.randomUUID();
      const context =
        createIntegrationSecretContext({
          workspaceId:
            input.workspaceId,
          provider: input.provider,
          integrationId,
        });
      const encrypted =
        encryptIntegrationCredentials({
          credentials,
          context,
        });

      try {
        const [created] = await ctx.db
          .insert(workspaceIntegration)
          .values({
            id: integrationId,
            workspaceId:
              input.workspaceId,
            provider: input.provider,
            name: input.name,
            status: "ACTIVE",
            encryptedValue:
              encrypted.encryptedValue,
            initializationVector:
              encrypted
                .initializationVector,
            authenticationTag:
              encrypted.authenticationTag,
            keyVersion:
              encrypted.keyVersion,
            credentialFormatVersion:
              encrypted
                .credentialFormatVersion,
            metadata: createSafeMetadata({
              provider: input.provider,
              credentials,
              providerMetadata:
                testResult.metadata,
            }),
            externalAccountId:
              testResult.externalAccountId,
            externalAccountName:
              testResult.externalAccountName,
            lastTestedAt: new Date(),
            lastError: null,
            createdBy:
              ctx.session.user.id,
          })
          .returning({
            id: workspaceIntegration.id,
          });

        return created;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "An integration with this provider and name already exists.",
          });
        }

        throw error;
      }
    }),

  update: protectedProcedure
    .input(updateIntegrationSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          id: workspaceIntegration.id,
          workspaceId:
            workspaceIntegration
              .workspaceId,
        })
        .from(workspaceIntegration)
        .where(
          eq(
            workspaceIntegration.id,
            input.id
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existing.workspaceId,
        userId: ctx.session.user.id,
        permission:
          "integration:manage",
      });

      try {
        await ctx.db
          .update(workspaceIntegration)
          .set({
            name: input.name,
            updatedAt: new Date(),
          })
          .where(
            eq(
              workspaceIntegration.id,
              input.id
            )
          );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "An integration with this provider and name already exists.",
          });
        }

        throw error;
      }

      return {
        success: true,
        id: input.id,
      };
    }),

  reconnect: protectedProcedure
    .input(reconnectIntegrationSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(workspaceIntegration)
        .where(
          eq(
            workspaceIntegration.id,
            input.id
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existing.workspaceId,
        userId: ctx.session.user.id,
        permission:
          "integration:manage",
      });

      let credentials: Readonly<
        Record<string, string>
      >;

      try {
        credentials =
          validateProviderCredentials(
            existing.provider,
            input.credentials
          );
      } catch (error) {
        invalidCredentials(error);
      }

      const testResult =
        await testIntegrationConnection({
          provider: existing.provider,
          credentials,
        });

      if (
        testResult.status !==
        "CONNECTED"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            testResult.message ??
            "Connection test failed.",
        });
      }

      const context =
        createIntegrationSecretContext({
          workspaceId:
            existing.workspaceId,
          provider:
            existing.provider,
          integrationId: existing.id,
        });
      const encrypted =
        encryptIntegrationCredentials({
          credentials,
          context,
        });

      await ctx.db
        .update(workspaceIntegration)
        .set({
          status: "ACTIVE",
          encryptedValue:
            encrypted.encryptedValue,
          initializationVector:
            encrypted.initializationVector,
          authenticationTag:
            encrypted.authenticationTag,
          keyVersion:
            encrypted.keyVersion,
          credentialFormatVersion:
            encrypted
              .credentialFormatVersion,
          metadata: createSafeMetadata({
            provider: existing.provider,
            credentials,
            providerMetadata:
              testResult.metadata,
          }),
          externalAccountId:
            testResult.externalAccountId,
          externalAccountName:
            testResult.externalAccountName,
          lastTestedAt: new Date(),
          lastError: null,
          disabledAt: null,
          updatedAt: new Date(),
        })
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
    }),

  test: protectedProcedure
    .input(testIntegrationSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(workspaceIntegration)
        .where(
          eq(
            workspaceIntegration.id,
            input.id
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existing.workspaceId,
        userId: ctx.session.user.id,
        permission:
          "integration:manage",
      });

      const context =
        createIntegrationSecretContext({
          workspaceId:
            existing.workspaceId,
          provider:
            existing.provider,
          integrationId: existing.id,
        });

      let credentials: Readonly<
        Record<string, string>
      >;

      try {
        credentials =
          validateProviderCredentials(
            existing.provider,
            decryptIntegrationCredentials({
              provider:
                existing.provider,
              credentialFormatVersion:
                existing
                  .credentialFormatVersion,
              encryptedValue:
                existing.encryptedValue,
              initializationVector:
                existing
                  .initializationVector,
              authenticationTag:
                existing
                  .authenticationTag,
              keyVersion:
                existing.keyVersion,
              context,
            })
          );
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "The stored credential could not be opened.",
        });
      }

      const result =
        await testIntegrationConnection({
          provider: existing.provider,
          credentials,
        });
      const status = statusForTestResult(
        existing.provider,
        result.status
      );

      await ctx.db
        .update(workspaceIntegration)
        .set({
          status,
          lastTestedAt: new Date(),
          lastError:
            result.status ===
            "CONNECTED"
              ? null
              : result.message ??
                "Connection test failed.",
          updatedAt: new Date(),
        })
        .where(
          eq(
            workspaceIntegration.id,
            input.id
          )
        );

      return {
        status: result.status,
        message:
          result.message ?? null,
      };
    }),

  delete: protectedProcedure
    .input(deleteIntegrationSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          id: workspaceIntegration.id,
          workspaceId:
            workspaceIntegration
              .workspaceId,
        })
        .from(workspaceIntegration)
        .where(
          eq(
            workspaceIntegration.id,
            input.id
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found.",
        });
      }

      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          existing.workspaceId,
        userId: ctx.session.user.id,
        permission:
          "integration:manage",
      });

      await ctx.db
        .delete(workspaceIntegration)
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
    }),
});

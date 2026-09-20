import "server-only";

import {
  and,
  eq,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
  workspaceIntegration,
} from "@/lib/db/schema/workspace-integration";
import {
  workflow,
} from "@/lib/db/schema/workflow";

import type {
  IntegrationCredentials,
} from "./credential-codec";
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from "./credential-store";
import {
  validateProviderCredentials,
} from "./credential-definition";
import {
  createIntegrationSecretContext,
} from "./encryption";
import {
  isOAuthProvider,
} from "./oauth-provider";
import {
  refreshOAuthCredentials,
} from "./oauth-service";
import type {
  IntegrationProvider,
} from "./validator";

const OAUTH_REFRESH_WINDOW_MS =
  5 * 60 * 1_000;

type ResolveWorkflowIntegrationOptions = {
  workflowId: string;
  integrationId: string;
  provider: IntegrationProvider;
};

type StoredCredentialFields = {
  id: string;
  workspaceId: string;
  provider: IntegrationProvider;
  encryptedValue: string;
  initializationVector: string;
  authenticationTag: string;
  keyVersion: number;
  credentialFormatVersion: number;
};

type RefreshResult =
  | {
      success: true;
      credentials: IntegrationCredentials;
    }
  | {
      success: false;
      message: string;
    };

export type ResolvedWorkflowIntegration = {
  id: string;
  workspaceId: string;
  provider: IntegrationProvider;
  name: string;
  credentials: Readonly<
    Record<string, string>
  >;
};

export type ResolvedWebhookWorkflowIntegration =
  ResolvedWorkflowIntegration & {
    webhookUrl: string;
  };

export class WorkflowIntegrationError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "WorkflowIntegrationError";
  }
}

function integrationLabel(
  provider: IntegrationProvider
): string {
  return provider
    .toLowerCase()
    .replaceAll("_", " ");
}

function createCredentialContext(
  integration: {
    id: string;
    workspaceId: string;
    provider: IntegrationProvider;
  }
): string {
  return createIntegrationSecretContext({
    workspaceId:
      integration.workspaceId,
    provider:
      integration.provider,
    integrationId:
      integration.id,
  });
}

function decryptAndValidateCredentials(
  integration: StoredCredentialFields
): IntegrationCredentials {
  return validateProviderCredentials(
    integration.provider,
    decryptIntegrationCredentials({
      provider:
        integration.provider,
      credentialFormatVersion:
        integration
          .credentialFormatVersion,
      encryptedValue:
        integration.encryptedValue,
      initializationVector:
        integration
          .initializationVector,
      authenticationTag:
        integration.authenticationTag,
      keyVersion:
        integration.keyVersion,
      context:
        createCredentialContext(
          integration
        ),
    })
  );
}

function shouldRefreshOAuthToken(
  expiresAt: Date | null
): boolean {
  if (!expiresAt) {
    return false;
  }

  return (
    expiresAt.getTime() <=
    Date.now() +
      OAUTH_REFRESH_WINDOW_MS
  );
}

async function refreshIntegrationCredentials({
  integrationId,
  workspaceId,
  provider,
}: {
  integrationId: string;
  workspaceId: string;
  provider: IntegrationProvider;
}): Promise<IntegrationCredentials> {
  if (!isOAuthProvider(provider)) {
    throw new WorkflowIntegrationError(
      `The ${integrationLabel(provider)} integration does not support OAuth refresh.`
    );
  }

  let result: RefreshResult;

  try {
    result = await db.transaction(
      async (transaction) => {
        /*
         * Lock the connection while refreshing.
         * This prevents concurrent workflow runs
         * from using the same rotating refresh
         * token at the same time.
         */
        const [locked] =
          await transaction
            .select({
              id:
                workspaceIntegration.id,
              workspaceId:
                workspaceIntegration
                  .workspaceId,
              provider:
                workspaceIntegration
                  .provider,
              encryptedValue:
                workspaceIntegration
                  .encryptedValue,
              initializationVector:
                workspaceIntegration
                  .initializationVector,
              authenticationTag:
                workspaceIntegration
                  .authenticationTag,
              keyVersion:
                workspaceIntegration
                  .keyVersion,
              credentialFormatVersion:
                workspaceIntegration
                  .credentialFormatVersion,
              status:
                workspaceIntegration.status,
              expiresAt:
                workspaceIntegration
                  .expiresAt,
            })
            .from(workspaceIntegration)
            .where(
              and(
                eq(
                  workspaceIntegration.id,
                  integrationId
                ),
                eq(
                  workspaceIntegration
                    .workspaceId,
                  workspaceId
                ),
                eq(
                  workspaceIntegration
                    .provider,
                  provider
                )
              )
            )
            .limit(1)
            .for("update");

        if (!locked) {
          return {
            success: false,
            message:
              "The OAuth connection no longer exists.",
          };
        }

        if (
          locked.status !== "ACTIVE"
        ) {
          return {
            success: false,
            message:
              "The OAuth connection is not active.",
          };
        }

        let currentCredentials:
          IntegrationCredentials;

        try {
          currentCredentials =
            decryptAndValidateCredentials(
              locked
            );
        } catch {
          await transaction
            .update(workspaceIntegration)
            .set({
              status: "ERROR",
              lastError:
                "The stored OAuth credential could not be decrypted.",
              updatedAt: new Date(),
            })
            .where(
              eq(
                workspaceIntegration.id,
                locked.id
              )
            );

          return {
            success: false,
            message:
              "The OAuth credential could not be decrypted.",
          };
        }

        /*
         * Another workflow run may have
         * refreshed the token while this run
         * was waiting for the row lock.
         */
        if (
          !shouldRefreshOAuthToken(
            locked.expiresAt
          )
        ) {
          return {
            success: true,
            credentials:
              currentCredentials,
          };
        }

        if (
          !currentCredentials.refreshToken
        ) {
          await transaction
            .update(workspaceIntegration)
            .set({
              status: "NEEDS_REAUTH",
              lastError:
                "The OAuth connection has expired and has no refresh token.",
              updatedAt: new Date(),
            })
            .where(
              eq(
                workspaceIntegration.id,
                locked.id
              )
            );

          return {
            success: false,
            message:
              "The OAuth connection must be reconnected.",
          };
        }

        try {
          const refreshed =
            await refreshOAuthCredentials({
              provider,
              credentials:
                currentCredentials,
            });

          const refreshedCredentials =
            validateProviderCredentials(
              provider,
              refreshed.credentials
            );

          const encrypted =
            encryptIntegrationCredentials({
              credentials:
                refreshedCredentials,
              context:
                createCredentialContext(
                  locked
                ),
            });

          await transaction
            .update(workspaceIntegration)
            .set({
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
              credentialFormatVersion:
                encrypted
                  .credentialFormatVersion,
              expiresAt:
                refreshed.expiresAt,
              status: "ACTIVE",
              lastError: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(
                  workspaceIntegration.id,
                  locked.id
                ),
                eq(
                  workspaceIntegration
                    .workspaceId,
                  locked.workspaceId
                ),
                eq(
                  workspaceIntegration
                    .provider,
                  provider
                )
              )
            );

          return {
            success: true,
            credentials:
              refreshedCredentials,
          };
        } catch (error) {
          /*
           * The refresh endpoint currently does
           * not distinguish invalid_grant from
           * temporary provider failures. Mark
           * this as ERROR rather than incorrectly
           * requiring reauthorization.
           */
          await transaction
            .update(workspaceIntegration)
            .set({
              status: "ERROR",
              lastError:
                "The OAuth access token could not be refreshed.",
              updatedAt: new Date(),
            })
            .where(
              eq(
                workspaceIntegration.id,
                locked.id
              )
            );

          console.error(
            "OAuth token refresh failed.",
            {
              provider,
              workspaceId,
              integrationId,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown OAuth refresh error",
            }
          );

          return {
            success: false,
            message:
              "The OAuth access token could not be refreshed.",
          };
        }
      }
    );
  } catch (error) {
    console.error(
      "OAuth refresh transaction failed.",
      {
        provider,
        workspaceId,
        integrationId,
        error:
          error instanceof Error
            ? error.message
            : "Unknown refresh transaction error",
      }
    );

    throw new WorkflowIntegrationError(
      `The ${integrationLabel(provider)} integration could not be refreshed.`
    );
  }

  if (!result.success) {
    throw new WorkflowIntegrationError(
      result.message
    );
  }

  return result.credentials;
}

export async function resolveWorkflowIntegration({
  workflowId,
  integrationId,
  provider,
}: ResolveWorkflowIntegrationOptions): Promise<ResolvedWorkflowIntegration> {
  const rows = await db
    .select({
      id: workspaceIntegration.id,
      workspaceId:
        workspaceIntegration.workspaceId,
      provider:
        workspaceIntegration.provider,
      name: workspaceIntegration.name,
      encryptedValue:
        workspaceIntegration.encryptedValue,
      initializationVector:
        workspaceIntegration
          .initializationVector,
      authenticationTag:
        workspaceIntegration
          .authenticationTag,
      keyVersion:
        workspaceIntegration.keyVersion,
      credentialFormatVersion:
        workspaceIntegration
          .credentialFormatVersion,
      status:
        workspaceIntegration.status,
      expiresAt:
        workspaceIntegration.expiresAt,
    })
    .from(workspaceIntegration)
    .innerJoin(
      workflow,
      eq(
        workflow.workspaceId,
        workspaceIntegration.workspaceId
      )
    )
    .where(
      and(
        eq(
          workflow.id,
          workflowId
        ),
        eq(
          workspaceIntegration.id,
          integrationId
        ),
        eq(
          workspaceIntegration.provider,
          provider
        )
      )
    )
    .limit(1);

  const integration = rows[0];

  if (!integration) {
    throw new WorkflowIntegrationError(
      `The selected ${integrationLabel(provider)} integration does not exist in this workspace.`
    );
  }

  if (
    integration.status !== "ACTIVE"
  ) {
    throw new WorkflowIntegrationError(
      `The selected ${integrationLabel(provider)} integration is not active.`
    );
  }

  let credentials:
    IntegrationCredentials;

  try {
    credentials =
      decryptAndValidateCredentials(
        integration
      );
  } catch {
    throw new WorkflowIntegrationError(
      `The ${integrationLabel(provider)} integration credential could not be decrypted.`
    );
  }

  if (
    isOAuthProvider(
      integration.provider
    ) &&
    shouldRefreshOAuthToken(
      integration.expiresAt
    )
  ) {
    credentials =
      await refreshIntegrationCredentials({
        integrationId:
          integration.id,
        workspaceId:
          integration.workspaceId,
        provider:
          integration.provider,
      });
  }

  return {
    id: integration.id,
    workspaceId:
      integration.workspaceId,
    provider:
      integration.provider,
    name: integration.name,
    credentials,
  };
}

export async function resolveWorkflowWebhookIntegration(
  options: ResolveWorkflowIntegrationOptions
): Promise<ResolvedWebhookWorkflowIntegration> {
  const integration =
    await resolveWorkflowIntegration(
      options
    );

  const webhookUrl =
    integration.credentials.webhookUrl;

  if (!webhookUrl) {
    throw new WorkflowIntegrationError(
      `The ${integrationLabel(options.provider)} integration does not contain a webhook URL.`
    );
  }

  return {
    ...integration,
    webhookUrl,
  };
}
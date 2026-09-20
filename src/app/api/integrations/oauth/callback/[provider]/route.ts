import {
  and,
  eq,
  gt,
} from "drizzle-orm";
import {
  NextResponse,
} from "next/server";

import {
  createCredentialPreview,
  validateProviderCredentials,
} from "@/features/integration/credential-definition";
import {
  encryptIntegrationCredentials,
} from "@/features/integration/credential-store";
import {
  createIntegrationSecretContext,
  decryptIntegrationSecret,
} from "@/features/integration/encryption";
import {
  createOAuthStateContext,
  hashOAuthState,
  isOAuthProvider,
} from "@/features/integration/oauth-provider";
import {
  exchangeOAuthCode,
  fetchOAuthAccount,
  getApplicationOrigin,
} from "@/features/integration/oauth-service";
import { db } from "@/lib/db";
import {
  integrationOAuthState,
  workspaceIntegration,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

function workspaceRedirect({
  workspaceId,
  result,
}: {
  workspaceId: string;
  result: "connected" | "failed";
}) {
  const url = new URL(
    `/workspaces/${workspaceId}`,
    getApplicationOrigin()
  );

  url.searchParams.set(
    "integration",
    result
  );
  url.hash = "connections";

  return NextResponse.redirect(url, 302);
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  const { provider: providerValue } =
    await context.params;

  const requestUrl = new URL(
    request.url
  );

  const state =
    requestUrl.searchParams.get(
      "state"
    ) ?? "";

  const code =
    requestUrl.searchParams.get(
      "code"
    ) ?? "";

  if (
    !isOAuthProvider(providerValue) ||
    !state ||
    state.length > 200
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid OAuth callback.",
      },
      { status: 400 }
    );
  }

  const provider = providerValue;
  const now = new Date();

  /*
   * Consume the state atomically. Binding the
   * provider and expiration check to the delete
   * prevents a callback using the wrong provider
   * path from consuming a valid OAuth state.
   */
  const [storedState] = await db
    .delete(integrationOAuthState)
    .where(
      and(
        eq(
          integrationOAuthState
            .stateHash,
          hashOAuthState(state)
        ),
        eq(
          integrationOAuthState.provider,
          provider
        ),
        gt(
          integrationOAuthState.expiresAt,
          now
        )
      )
    )
    .returning();

  if (!storedState) {
    return NextResponse.json(
      {
        error:
          "OAuth state is invalid or expired.",
      },
      { status: 400 }
    );
  }

  if (
    requestUrl.searchParams.has(
      "error"
    ) ||
    !code
  ) {
    return workspaceRedirect({
      workspaceId:
        storedState.workspaceId,
      result: "failed",
    });
  }

  try {
    const codeVerifier =
      decryptIntegrationSecret({
        encryptedValue:
          storedState
            .encryptedCodeVerifier,
        initializationVector:
          storedState
            .initializationVector,
        authenticationTag:
          storedState
            .authenticationTag,
        keyVersion:
          storedState.keyVersion,
        context:
          createOAuthStateContext({
            stateId: storedState.id,
            workspaceId:
              storedState.workspaceId,
            provider,
          }),
      });

    const token = await exchangeOAuthCode({
      provider,
      code,
      codeVerifier,
      redirectUri:
        storedState.redirectUri,
    });

    const credentials =
      validateProviderCredentials(
        provider,
        {
          accessToken:
            token.accessToken,
          ...(token.refreshToken
            ? {
                refreshToken:
                  token.refreshToken,
              }
            : {}),
        }
      );

    const account =
      await fetchOAuthAccount({
        provider,
        accessToken:
          token.accessToken,
      });

    const integrationId =
      storedState.integrationId ??
      crypto.randomUUID();

    const encrypted =
      encryptIntegrationCredentials({
        credentials,
        context:
          createIntegrationSecretContext({
            workspaceId:
              storedState.workspaceId,
            provider,
            integrationId,
          }),
      });

    const values = {
      status: "ACTIVE" as const,
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
      metadata: {
        credentialPreview:
          createCredentialPreview(
            provider,
            credentials
          ),
        provider: {
          scope:
            token.scope ?? null,
        },
      },
      externalAccountId:
        account.id,
      externalAccountName:
        account.name,
      expiresAt:
        token.expiresAt,
      lastTestedAt: new Date(),
      lastError: null,
      disabledAt: null,
      updatedAt: new Date(),
    };

    if (storedState.integrationId) {
      const [updated] = await db
        .update(workspaceIntegration)
        .set(values)
        .where(
          and(
            eq(
              workspaceIntegration.id,
              storedState.integrationId
            ),
            eq(
              workspaceIntegration
                .workspaceId,
              storedState.workspaceId
            ),
            eq(
              workspaceIntegration
                .provider,
              provider
            )
          )
        )
        .returning({
          id: workspaceIntegration.id,
        });

      if (!updated) {
        throw new Error(
          "OAuth connection no longer exists."
        );
      }
    } else {
      await db
        .insert(workspaceIntegration)
        .values({
          id: integrationId,
          workspaceId:
            storedState.workspaceId,
          provider,
          name:
            storedState.connectionName,
          createdBy:
            storedState.userId,
          ...values,
        });
    }

    return workspaceRedirect({
      workspaceId:
        storedState.workspaceId,
      result: "connected",
    });
  } catch (error) {
    /*
     * Never log the authorization code,
     * OAuth state, access token, refresh
     * token or encrypted credentials.
     */
    console.error(
      "OAuth callback failed.",
      {
        provider,
        workspaceId:
          storedState.workspaceId,
        integrationId:
          storedState.integrationId,
        error:
          error instanceof Error
            ? error.message
            : "Unknown OAuth error",
      }
    );

    return workspaceRedirect({
      workspaceId:
        storedState.workspaceId,
      result: "failed",
    });
  }
}
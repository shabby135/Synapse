import {
  and,
  eq,
  lt,
} from "drizzle-orm";
import {
  NextResponse,
} from "next/server";

import {
  encryptIntegrationSecret,
} from "@/features/integration/encryption";
import {
  createOAuthAuthorizationUrl,
  createOAuthState,
  createOAuthStateContext,
  createPkcePair,
  hashOAuthState,
  isOAuthProvider,
} from "@/features/integration/oauth-provider";
import {
  getOAuthClientConfig,
  getOAuthRedirectUri,
} from "@/features/integration/oauth-service";
import {
  requireWorkspacePermission,
} from "@/features/workspace/authorization";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  integrationOAuthState,
  workspaceIntegration,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_LIFETIME_MS =
  10 * 60 * 1_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function isTrustedNavigation(
  request: Request
): boolean {
  const fetchSite =
    request.headers.get(
      "sec-fetch-site"
    );

  /*
   * Browsers send "same-origin" when the
   * request begins inside Synapse and "none"
   * for direct user navigation.
   *
   * Requests without this header remain
   * supported for tests and non-browser
   * clients. Authentication and workspace
   * authorization are still required.
   */
  return (
    fetchSite === null ||
    fetchSite === "same-origin" ||
    fetchSite === "none"
  );
}

function authorizationRedirect(
  authorizationUrl: string
) {
  const response =
    NextResponse.redirect(
      authorizationUrl,
      302
    );

  response.headers.set(
    "Cache-Control",
    "no-store"
  );
  response.headers.set(
    "Referrer-Policy",
    "no-referrer"
  );

  return response;
}

export async function GET(
  request: Request
) {
  if (!isTrustedNavigation(request)) {
    return errorResponse(
      "Cross-site OAuth initiation is not allowed.",
      403
    );
  }

  const session =
    await auth.api.getSession({
      headers: request.headers,
    });

  if (!session) {
    return errorResponse(
      "You must be signed in.",
      401
    );
  }

  const url = new URL(request.url);

  const workspaceId =
    url.searchParams.get(
      "workspaceId"
    ) ?? "";

  const providerValue =
    url.searchParams.get(
      "provider"
    ) ?? "";

  const requestedName =
    url.searchParams
      .get("name")
      ?.trim() ?? "";

  const integrationId =
    url.searchParams.get(
      "integrationId"
    );

  if (
    !UUID_PATTERN.test(workspaceId) ||
    !isOAuthProvider(providerValue)
  ) {
    return errorResponse(
      "Invalid OAuth connection request.",
      400
    );
  }

  const provider = providerValue;

  try {
    await requireWorkspacePermission({
      database: db,
      workspaceId,
      userId: session.user.id,
      permission:
        "integration:manage",
    });
  } catch {
    return errorResponse(
      "Workspace not found or access denied.",
      403
    );
  }

  let connectionName = requestedName;

  if (integrationId) {
    if (!UUID_PATTERN.test(integrationId)) {
      return errorResponse(
        "Invalid integration ID.",
        400
      );
    }

    const [existing] = await db
      .select({
        name: workspaceIntegration.name,
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
      .limit(1);

    if (!existing) {
      return errorResponse(
        "OAuth connection not found.",
        404
      );
    }

    connectionName = existing.name;
  }

  if (
    connectionName.length < 2 ||
    connectionName.length > 50
  ) {
    return errorResponse(
      "Connection name must contain between 2 and 50 characters.",
      400
    );
  }

  try {
    const now = new Date();
    const state =
      createOAuthState();
    const stateId =
      crypto.randomUUID();

    const {
      verifier,
      challenge,
    } = createPkcePair();

    const redirectUri =
      getOAuthRedirectUri(provider);

    const encrypted =
      encryptIntegrationSecret({
        value: verifier,
        context:
          createOAuthStateContext({
            stateId,
            workspaceId,
            provider,
          }),
      });

    /*
     * Remove expired OAuth attempts before
     * storing the new single-use state.
     */
    await db
      .delete(integrationOAuthState)
      .where(
        lt(
          integrationOAuthState
            .expiresAt,
          now
        )
      );

    await db
      .insert(integrationOAuthState)
      .values({
        id: stateId,
        stateHash:
          hashOAuthState(state),
        workspaceId,
        provider,
        connectionName,
        integrationId,
        userId: session.user.id,
        redirectUri,
        encryptedCodeVerifier:
          encrypted.encryptedValue,
        initializationVector:
          encrypted
            .initializationVector,
        authenticationTag:
          encrypted.authenticationTag,
        keyVersion:
          encrypted.keyVersion,
        expiresAt: new Date(
          now.getTime() +
            STATE_LIFETIME_MS
        ),
      });

    const { clientId } =
      getOAuthClientConfig(provider);

    const authorizationUrl =
      createOAuthAuthorizationUrl({
        provider,
        clientId,
        redirectUri,
        state,
        codeChallenge: challenge,
      });

    return authorizationRedirect(
      authorizationUrl
    );
  } catch (error) {
    /*
     * Log only operational context. Never
     * log OAuth state, authorization codes,
     * PKCE verifiers, tokens or secrets.
     */
    console.error(
      "OAuth initiation failed.",
      {
        provider,
        workspaceId,
        integrationId,
        error:
          error instanceof Error
            ? error.message
            : "Unknown OAuth error",
      }
    );

    return errorResponse(
      "OAuth connection is temporarily unavailable.",
      503
    );
  }
}
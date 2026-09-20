import {
  lt,
} from "drizzle-orm";
import {
  NextResponse,
} from "next/server";

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
  encryptIntegrationSecret,
} from "@/features/integration/encryption";
import { requireWorkspacePermission } from "@/features/workspace/authorization";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  integrationOAuthState,
  workspaceIntegration,
} from "@/lib/db/schema";
import {
  and,
  eq,
} from "drizzle-orm";

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

export async function GET(
  request: Request
) {
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
    const state = createOAuthState();
    const stateId = crypto.randomUUID();
    const { verifier, challenge } =
      createPkcePair();
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

    await db
      .delete(integrationOAuthState)
      .where(
        lt(
          integrationOAuthState
            .expiresAt,
          new Date()
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
          Date.now() +
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

    return NextResponse.redirect(
      authorizationUrl,
      302
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "OAuth could not be started.",
      503
    );
  }
}

import "server-only";

import type {
  IntegrationCredentials,
} from "./credential-codec";
import {
  mergeRefreshedCredentials,
  oauthProviderRegistry,
  type OAuthProvider,
} from "./oauth-provider";

const OAUTH_TIMEOUT_MS = 15_000;

type OAuthTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date | null;
  scope?: string;
};

export type OAuthAccount = {
  id: string;
  name: string;
};

function requiredEnvironmentVariable(
  name: string
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured.`
    );
  }

  return value;
}

export function getOAuthClientConfig(
  provider: OAuthProvider
): {
  clientId: string;
  clientSecret: string;
} {
  const definition =
    oauthProviderRegistry[provider];

  return {
    clientId:
      requiredEnvironmentVariable(
        definition
          .clientIdEnvironmentVariable
      ),
    clientSecret:
      requiredEnvironmentVariable(
        definition
          .clientSecretEnvironmentVariable
      ),
  };
}

export function getApplicationOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL;

  if (!configured) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL or BETTER_AUTH_URL must be configured."
    );
  }

  const url = new URL(configured);

  if (
    url.protocol !== "https:" &&
    ![
      "localhost",
      "127.0.0.1",
    ].includes(url.hostname)
  ) {
    throw new Error(
      "The application URL must use HTTPS outside local development."
    );
  }

  return url.origin;
}

export function getOAuthRedirectUri(
  provider: OAuthProvider
): string {
  return `${getApplicationOrigin()}/api/integrations/oauth/callback/${provider}`;
}

function readString(
  value: unknown
): string | undefined {
  return typeof value === "string" &&
    value
    ? value
    : undefined;
}

function parseTokenResponse(
  payload: unknown
): OAuthTokenResponse {
  if (
    typeof payload !== "object" ||
    payload === null
  ) {
    throw new Error(
      "The OAuth provider returned an invalid token response."
    );
  }

  const record = payload as Record<
    string,
    unknown
  >;
  const accessToken = readString(
    record.access_token
  );

  if (!accessToken) {
    throw new Error(
      "The OAuth provider did not return an access token."
    );
  }

  const expiresIn =
    typeof record.expires_in ===
      "number" &&
    Number.isFinite(record.expires_in) &&
    record.expires_in > 0
      ? record.expires_in
      : null;

  return {
    accessToken,
    refreshToken: readString(
      record.refresh_token
    ),
    expiresAt: expiresIn
      ? new Date(
          Date.now() +
            expiresIn * 1_000
        )
      : null,
    scope: readString(record.scope),
  };
}

async function requestToken({
  provider,
  parameters,
  signal,
}: {
  provider: OAuthProvider;
  parameters: URLSearchParams;
  signal?: AbortSignal;
}): Promise<OAuthTokenResponse> {
  const definition =
    oauthProviderRegistry[provider];
  const controller =
    new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    OAUTH_TIMEOUT_MS
  );

  if (signal) {
    signal.addEventListener(
      "abort",
      () => controller.abort(),
      { once: true }
    );
  }

  try {
    const response = await fetch(
      definition.tokenUrl,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type":
            "application/x-www-form-urlencoded",
          "User-Agent":
            "Synapse-OAuth/1.0",
        },
        body: parameters,
        redirect: "error",
        cache: "no-store",
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      await response.body
        ?.cancel()
        .catch(() => undefined);
      throw new Error(
        "The OAuth provider rejected the token request."
      );
    }

    return parseTokenResponse(
      await response.json()
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function exchangeOAuthCode({
  provider,
  code,
  codeVerifier,
  redirectUri,
}: {
  provider: OAuthProvider;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OAuthTokenResponse> {
  const { clientId, clientSecret } =
    getOAuthClientConfig(provider);

  return requestToken({
    provider,
    parameters: new URLSearchParams({
      grant_type:
        "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });
}

export async function refreshOAuthCredentials({
  provider,
  credentials,
  signal,
}: {
  provider: OAuthProvider;
  credentials: IntegrationCredentials;
  signal?: AbortSignal;
}): Promise<{
  credentials: IntegrationCredentials;
  expiresAt: Date | null;
}> {
  const refreshToken =
    credentials.refreshToken;

  if (!refreshToken) {
    throw new Error(
      "This OAuth connection has no refresh token."
    );
  }

  const { clientId, clientSecret } =
    getOAuthClientConfig(provider);
  const refreshed = await requestToken({
    provider,
    parameters: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal,
  });

  return {
    credentials:
      mergeRefreshedCredentials({
        current: credentials,
        accessToken:
          refreshed.accessToken,
        refreshToken:
          refreshed.refreshToken,
      }),
    expiresAt: refreshed.expiresAt,
  };
}

export async function fetchOAuthAccount({
  provider,
  accessToken,
}: {
  provider: OAuthProvider;
  accessToken: string;
}): Promise<OAuthAccount> {
  const definition =
    oauthProviderRegistry[provider];
  const response = await fetch(
    definition.accountUrl,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent":
          "Synapse-OAuth/1.0",
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(
        OAUTH_TIMEOUT_MS
      ),
    }
  );

  if (!response.ok) {
    await response.body
      ?.cancel()
      .catch(() => undefined);
    throw new Error(
      "The OAuth account could not be verified."
    );
  }

  const payload =
    (await response.json()) as Record<
      string,
      unknown
    >;

  if (provider === "GITHUB") {
    const id = payload.id;
    const login = readString(
      payload.login
    );

    if (
      (typeof id !== "number" &&
        typeof id !== "string") ||
      !login
    ) {
      throw new Error(
        "GitHub returned an invalid account."
      );
    }

    return {
      id: String(id),
      name:
        readString(payload.name) ??
        login,
    };
  }

  const id = readString(payload.sub);
  const email = readString(
    payload.email
  );

  if (!id || !email) {
    throw new Error(
      "Google returned an invalid account."
    );
  }

  return {
    id,
    name:
      readString(payload.name) ??
      email,
  };
}

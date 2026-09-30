import "server-only";

import type {
  IntegrationCredentials,
} from "./credential-codec";

import {
  mergeRefreshedCredentials,
  oauthProviderRegistry,
  type OAuthProvider,
} from "./oauth-provider";

import {
  createOAuthTokenRequestError,
  OAuthTokenRequestError,
} from "./oauth-token-error";

const OAUTH_TIMEOUT_MS =
  15_000;

const MAX_PROVIDER_RESPONSE_BYTES =
  128 * 1024;

const MAX_ERROR_RESPONSE_LENGTH =
  32_768;

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
  const value =
    process.env[name];

  if (
    !value ||
    !value.trim()
  ) {
    throw new Error(
      `${name} is not configured.`
    );
  }

  return value;
}

function assertTrustedProviderUrl(
  value: string,
  label: string
): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `${label} is invalid.`
    );
  }

  if (
    url.protocol !== "https:"
  ) {
    throw new Error(
      `${label} must use HTTPS.`
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new Error(
      `${label} cannot contain embedded credentials.`
    );
  }

  return url;
}

export function getOAuthClientConfig(
  provider: OAuthProvider
): {
  clientId: string;
  clientSecret: string;
} {
  const definition =
    oauthProviderRegistry[
      provider
    ];

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

export function getApplicationOrigin():
  string {
  const configured =
    process.env
      .NEXT_PUBLIC_APP_URL ??
    process.env
      .BETTER_AUTH_URL;

  if (!configured) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL or BETTER_AUTH_URL must be configured."
    );
  }

  const url =
    new URL(configured);

  const localDevelopment =
    [
      "localhost",
      "127.0.0.1",
      "::1",
    ].includes(
      url.hostname
    );

  if (
    url.protocol !==
      "https:" &&
    !localDevelopment
  ) {
    throw new Error(
      "The application URL must use HTTPS outside local development."
    );
  }

  /*
   * Avoid allowing application config
   * such as:
   *
   * https://example.com/path
   */
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "The application URL must contain only an origin."
    );
  }

  return url.origin;
}

export function getOAuthRedirectUri(
  provider: OAuthProvider
): string {
  return (
    `${getApplicationOrigin()}` +
    `/api/integrations/oauth/callback/${provider}`
  );
}

function readString(
  value: unknown
): string | undefined {
  return (
    typeof value ===
      "string" &&
    value.length > 0
  )
    ? value
    : undefined;
}

function parseTokenResponse(
  payload: unknown
): OAuthTokenResponse {
  if (
    typeof payload !==
      "object" ||
    payload === null ||
    Array.isArray(
      payload
    )
  ) {
    throw new Error(
      "The OAuth provider returned an invalid token response."
    );
  }

  const record =
    payload as Record<
      string,
      unknown
    >;

  const accessToken =
    readString(
      record.access_token
    );

  if (!accessToken) {
    throw new Error(
      "The OAuth provider did not return an access token."
    );
  }

  const refreshToken =
    readString(
      record.refresh_token
    );

  const expiresIn =
    typeof record.expires_in ===
      "number" &&
    Number.isFinite(
      record.expires_in
    ) &&
    record.expires_in > 0
      ? record.expires_in
      : null;

  return {
    accessToken,

    refreshToken,

    expiresAt:
      expiresIn
        ? new Date(
            Date.now() +
              expiresIn *
                1_000
          )
        : null,

    scope:
      readString(
        record.scope
      ),
  };
}

async function readBoundedText(
  response: Response,
  maximumBytes:
    number
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const contentLength =
    response.headers.get(
      "content-length"
    );

  if (contentLength) {
    const parsed =
      Number(
        contentLength
      );

    if (
      Number.isFinite(
        parsed
      ) &&
      parsed >
        maximumBytes
    ) {
      await response.body
        .cancel()
        .catch(
          () => undefined
        );

      throw new Error(
        "OAuth provider response is too large."
      );
    }
  }

  const reader =
    response.body
      .getReader();

  const chunks:
    Uint8Array[] = [];

  let totalBytes = 0;

  try {
    while (true) {
      const {
        done,
        value,
      } =
        await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes +=
        value.byteLength;

      if (
        totalBytes >
        maximumBytes
      ) {
        throw new Error(
          "OAuth provider response is too large."
        );
      }

      chunks.push(
        value
      );
    }
  } finally {
    if (
      totalBytes >
      maximumBytes
    ) {
      await reader
        .cancel()
        .catch(
          () => undefined
        );
    }
  }

  const combined =
    new Uint8Array(
      totalBytes
    );

  let offset = 0;

  for (
    const chunk of chunks
  ) {
    combined.set(
      chunk,
      offset
    );

    offset +=
      chunk.byteLength;
  }

  return new TextDecoder()
    .decode(combined);
}

async function readProviderErrorPayload(
  response: Response
): Promise<unknown> {
  try {
    const body =
      await readBoundedText(
        response,
        MAX_ERROR_RESPONSE_LENGTH
      );

    if (!body) {
      return null;
    }

    return JSON.parse(
      body
    );
  } catch {
    return null;
  }
}

async function requestToken({
  provider,
  parameters,
  signal,
}: {
  provider: OAuthProvider;

  parameters:
    URLSearchParams;

  signal?: AbortSignal;
}): Promise<
  OAuthTokenResponse
> {
  const definition =
    oauthProviderRegistry[
      provider
    ];

  const tokenUrl =
    assertTrustedProviderUrl(
      definition.tokenUrl,
      `${provider} token URL`
    );

  const controller =
    new AbortController();

  const abortFromCaller =
    () => {
      controller.abort(
        signal?.reason
      );
    };

  if (
    signal?.aborted
  ) {
    abortFromCaller();
  } else {
    signal?.addEventListener(
      "abort",
      abortFromCaller,
      {
        once: true,
      }
    );
  }

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      OAUTH_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        tokenUrl,
        {
          method: "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/x-www-form-urlencoded",

            "User-Agent":
              "Synapse-OAuth/1.0",
          },

          body:
            parameters,

          redirect:
            "error",

          cache:
            "no-store",

          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      const payload =
        await readProviderErrorPayload(
          response
        );

      throw createOAuthTokenRequestError({
        status:
          response.status,

        payload,
      });
    }

    const raw =
      await readBoundedText(
        response,
        MAX_PROVIDER_RESPONSE_BYTES
      );

    let payload: unknown;

    try {
      payload =
        JSON.parse(raw);
    } catch {
      throw new Error(
        "The OAuth provider returned invalid JSON."
      );
    }

    return parseTokenResponse(
      payload
    );
  } catch (error) {
    if (
      error instanceof
      OAuthTokenRequestError
    ) {
      throw error;
    }

    const timedOutOrAborted =
      error instanceof Error &&
      (
        error.name ===
          "AbortError" ||
        error.name ===
          "TimeoutError"
      );

    throw new OAuthTokenRequestError({
      kind: "TEMPORARY",

      status: null,

      message:
        timedOutOrAborted
          ? "The OAuth token request timed out or was cancelled."
          : "The OAuth provider could not be reached.",
    });
  } finally {
    clearTimeout(
      timeout
    );

    signal
      ?.removeEventListener(
        "abort",
        abortFromCaller
      );
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
}): Promise<
  OAuthTokenResponse
> {
  /*
   * Do not allow callers to exchange
   * against an arbitrary redirect URI.
   */
  const expectedRedirectUri =
    getOAuthRedirectUri(
      provider
    );

  if (
    redirectUri !==
    expectedRedirectUri
  ) {
    throw new Error(
      "The OAuth redirect URI is invalid."
    );
  }

  const {
    clientId,
    clientSecret,
  } =
    getOAuthClientConfig(
      provider
    );

  return requestToken({
    provider,

    parameters:
      new URLSearchParams({
        grant_type:
          "authorization_code",

        client_id:
          clientId,

        client_secret:
          clientSecret,

        code,

        code_verifier:
          codeVerifier,

        redirect_uri:
          expectedRedirectUri,
      }),
  });
}

export async function refreshOAuthCredentials({
  provider,
  credentials,
  signal,
}: {
  provider: OAuthProvider;

  credentials:
    IntegrationCredentials;

  signal?:
    AbortSignal;
}): Promise<{
  credentials:
    IntegrationCredentials;

  expiresAt:
    Date | null;
}> {
  const refreshToken =
    credentials.refreshToken;

  if (!refreshToken) {
    throw new OAuthTokenRequestError({
      kind:
        "REAUTH_REQUIRED",

      status: null,

      message:
        "This OAuth connection has no refresh token.",
    });
  }

  const {
    clientId,
    clientSecret,
  } =
    getOAuthClientConfig(
      provider
    );

  const refreshed =
    await requestToken({
      provider,

      parameters:
        new URLSearchParams({
          grant_type:
            "refresh_token",

          refresh_token:
            refreshToken,

          client_id:
            clientId,

          client_secret:
            clientSecret,
        }),

      signal,
    });

  return {
    credentials:
      mergeRefreshedCredentials({
        current:
          credentials,

        accessToken:
          refreshed
            .accessToken,

        refreshToken:
          refreshed
            .refreshToken,
      }),

    expiresAt:
      refreshed
        .expiresAt,
  };
}

export async function fetchOAuthAccount({
  provider,
  accessToken,
}: {
  provider:
    OAuthProvider;

  accessToken:
    string;
}): Promise<
  OAuthAccount
> {
  const definition =
    oauthProviderRegistry[
      provider
    ];

  const accountUrl =
    assertTrustedProviderUrl(
      definition.accountUrl,
      `${provider} account URL`
    );

  let response: Response;

  try {
    response =
      await fetch(
        accountUrl,
        {
          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${accessToken}`,

            "User-Agent":
              "Synapse-OAuth/1.0",
          },

          redirect:
            "error",

          cache:
            "no-store",

          signal:
            AbortSignal.timeout(
              OAUTH_TIMEOUT_MS
            ),
        }
      );
  } catch (error) {
    const timedOutOrAborted =
      error instanceof Error &&
      (
        error.name ===
          "AbortError" ||
        error.name ===
          "TimeoutError"
      );

    throw new Error(
      timedOutOrAborted
        ? "The OAuth account verification timed out."
        : "The OAuth provider could not be reached."
    );
  }

  if (!response.ok) {
    await response.body
      ?.cancel()
      .catch(
        () => undefined
      );

    throw new Error(
      "The OAuth account could not be verified."
    );
  }

  const raw =
    await readBoundedText(
      response,
      MAX_PROVIDER_RESPONSE_BYTES
    );

  let payload: Record<
    string,
    unknown
  >;

  try {
    const parsed =
      JSON.parse(raw);

    if (
      typeof parsed !==
        "object" ||
      parsed === null ||
      Array.isArray(
        parsed
      )
    ) {
      throw new Error();
    }

    payload =
      parsed as Record<
        string,
        unknown
      >;
  } catch {
    throw new Error(
      "The OAuth provider returned an invalid account."
    );
  }

  if (
    provider ===
    "GITHUB"
  ) {
    const id =
      payload.id;

    const login =
      readString(
        payload.login
      );

    if (
      (
        typeof id !==
          "number" &&
        typeof id !==
          "string"
      ) ||
      !login
    ) {
      throw new Error(
        "GitHub returned an invalid account."
      );
    }

    return {
      id:
        String(id),

      name:
        readString(
          payload.name
        ) ??
        login,
    };
  }

  const id =
    readString(
      payload.sub
    );

  const email =
    readString(
      payload.email
    );

  if (
    !id ||
    !email
  ) {
    throw new Error(
      "Google returned an invalid account."
    );
  }

  return {
    id,

    name:
      readString(
        payload.name
      ) ??
      email,
  };
}
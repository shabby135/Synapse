import {
  createHash,
  randomBytes,
} from "node:crypto";

import type {
  IntegrationCredentials,
} from "./credential-codec";
import type {
  IntegrationProvider,
} from "./provider-registry";

export const oauthProviderValues = [
  "GMAIL",
  "GOOGLE_SHEETS",
  "GOOGLE_FORMS",
  "GOOGLE_CALENDAR",
  "GITHUB",
] as const satisfies readonly IntegrationProvider[];

export type OAuthProvider =
  (typeof oauthProviderValues)[number];

type OAuthProviderDefinition = {
  provider: OAuthProvider;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: readonly string[];
  clientIdEnvironmentVariable:
    | "GOOGLE_CLIENT_ID"
    | "GITHUB_CLIENT_ID";
  clientSecretEnvironmentVariable:
    | "GOOGLE_CLIENT_SECRET"
    | "GITHUB_CLIENT_SECRET";
  accountUrl: string;
};

const googleAuthorizationUrl =
  "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenUrl =
  "https://oauth2.googleapis.com/token";
const googleAccountUrl =
  "https://openidconnect.googleapis.com/v1/userinfo";

const googleIdentityScopes = [
  "openid",
  "email",
  "profile",
] as const;

export const oauthProviderRegistry = {
  GMAIL: {
    provider: "GMAIL",
    authorizationUrl:
      googleAuthorizationUrl,
    tokenUrl: googleTokenUrl,
    scopes: [
      ...googleIdentityScopes,
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
    clientIdEnvironmentVariable:
      "GOOGLE_CLIENT_ID",
    clientSecretEnvironmentVariable:
      "GOOGLE_CLIENT_SECRET",
    accountUrl: googleAccountUrl,
  },
  GOOGLE_SHEETS: {
    provider: "GOOGLE_SHEETS",
    authorizationUrl:
      googleAuthorizationUrl,
    tokenUrl: googleTokenUrl,
    scopes: [
      ...googleIdentityScopes,
      "https://www.googleapis.com/auth/spreadsheets",
    ],
    clientIdEnvironmentVariable:
      "GOOGLE_CLIENT_ID",
    clientSecretEnvironmentVariable:
      "GOOGLE_CLIENT_SECRET",
    accountUrl: googleAccountUrl,
  },
  GOOGLE_FORMS: {
    provider: "GOOGLE_FORMS",
    authorizationUrl:
      googleAuthorizationUrl,
    tokenUrl: googleTokenUrl,
    scopes: [
      ...googleIdentityScopes,
      "https://www.googleapis.com/auth/forms.body.readonly",
      "https://www.googleapis.com/auth/forms.responses.readonly",
    ],
    clientIdEnvironmentVariable:
      "GOOGLE_CLIENT_ID",
    clientSecretEnvironmentVariable:
      "GOOGLE_CLIENT_SECRET",
    accountUrl: googleAccountUrl,
  },
  GOOGLE_CALENDAR: {
    provider: "GOOGLE_CALENDAR",
    authorizationUrl:
      googleAuthorizationUrl,
    tokenUrl: googleTokenUrl,
    scopes: [
      ...googleIdentityScopes,
      "https://www.googleapis.com/auth/calendar.events",
    ],
    clientIdEnvironmentVariable:
      "GOOGLE_CLIENT_ID",
    clientSecretEnvironmentVariable:
      "GOOGLE_CLIENT_SECRET",
    accountUrl: googleAccountUrl,
  },
  GITHUB: {
    provider: "GITHUB",
    authorizationUrl:
      "https://github.com/login/oauth/authorize",
    tokenUrl:
      "https://github.com/login/oauth/access_token",
    scopes: [
      "read:user",
      "user:email",
      "repo",
    ],
    clientIdEnvironmentVariable:
      "GITHUB_CLIENT_ID",
    clientSecretEnvironmentVariable:
      "GITHUB_CLIENT_SECRET",
    accountUrl:
      "https://api.github.com/user",
  },
} as const satisfies Record<
  OAuthProvider,
  OAuthProviderDefinition
>;

export function isOAuthProvider(
  provider: string
): provider is OAuthProvider {
  return (
    oauthProviderValues as readonly string[]
  ).includes(provider);
}

function base64Url(
  value: Buffer
): string {
  return value.toString("base64url");
}

export function createOAuthState(): string {
  return base64Url(randomBytes(32));
}

export function hashOAuthState(
  state: string
): string {
  return createHash("sha256")
    .update(state, "utf8")
    .digest("hex");
}

export function createPkcePair(): {
  verifier: string;
  challenge: string;
} {
  const verifier = base64Url(
    randomBytes(32)
  );

  const challenge = base64Url(
    createHash("sha256")
      .update(verifier, "utf8")
      .digest()
  );

  return {
    verifier,
    challenge,
  };
}

export function createOAuthAuthorizationUrl({
  provider,
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: {
  provider: OAuthProvider;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const definition =
    oauthProviderRegistry[provider];

  const url = new URL(
    definition.authorizationUrl
  );

  url.searchParams.set(
    "client_id",
    clientId
  );

  url.searchParams.set(
    "redirect_uri",
    redirectUri
  );

  url.searchParams.set(
    "response_type",
    "code"
  );

  url.searchParams.set(
    "scope",
    definition.scopes.join(" ")
  );

  url.searchParams.set(
    "state",
    state
  );

  url.searchParams.set(
    "code_challenge",
    codeChallenge
  );

  url.searchParams.set(
    "code_challenge_method",
    "S256"
  );

  if (provider !== "GITHUB") {
    url.searchParams.set(
      "access_type",
      "offline"
    );

    url.searchParams.set(
      "prompt",
      "consent"
    );
  }

  return url.toString();
}

export function createOAuthStateContext({
  stateId,
  workspaceId,
  provider,
}: {
  stateId: string;
  workspaceId: string;
  provider: OAuthProvider;
}): string {
  return [
    "oauth",
    stateId,
    workspaceId,
    provider,
  ].join(":");
}

export function mergeRefreshedCredentials({
  current,
  accessToken,
  refreshToken,
}: {
  current: IntegrationCredentials;
  accessToken: string;
  refreshToken?: string;
}): IntegrationCredentials {
  return {
    accessToken,
    refreshToken:
      refreshToken ??
      current.refreshToken ??
      "",
  };
}
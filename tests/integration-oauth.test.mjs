import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  createOAuthAuthorizationUrl,
  createOAuthState,
  createOAuthStateContext,
  createPkcePair,
  hashOAuthState,
  isOAuthProvider,
  mergeRefreshedCredentials,
  oauthProviderRegistry,
  oauthProviderValues,
} from "../src/features/integration/oauth-provider.ts";

test("registers the five OAuth providers exactly once", () => {
  assert.deepEqual(
    Object.keys(oauthProviderRegistry),
    [...oauthProviderValues]
  );

  assert.equal(
    new Set(oauthProviderValues).size,
    5
  );

  for (const provider of oauthProviderValues) {
    assert.equal(
      isOAuthProvider(provider),
      true
    );
  }

  assert.equal(
    isOAuthProvider("OPENAI"),
    false
  );
});

test("creates random state and stores only its stable hash", () => {
  const first = createOAuthState();
  const second = createOAuthState();

  assert.notEqual(first, second);

  assert.match(
    first,
    /^[A-Za-z0-9_-]{43}$/
  );

  assert.equal(
    hashOAuthState(first),
    createHash("sha256")
      .update(first, "utf8")
      .digest("hex")
  );

  assert.notEqual(
    hashOAuthState(first),
    first
  );
});

test("creates an S256 PKCE verifier and challenge", () => {
  const { verifier, challenge } =
    createPkcePair();

  const expected = createHash("sha256")
    .update(verifier, "utf8")
    .digest("base64url");

  assert.match(
    verifier,
    /^[A-Za-z0-9_-]{43}$/
  );

  assert.equal(challenge, expected);
  assert.notEqual(challenge, verifier);
});

test("builds Google authorization with offline consent and PKCE", () => {
  const authorization = new URL(
    createOAuthAuthorizationUrl({
      provider: "GMAIL",
      clientId: "google-client",
      redirectUri:
        "https://synapse.example/api/integrations/oauth/callback/GMAIL",
      state: "opaque-state",
      codeChallenge:
        "pkce-challenge",
    })
  );

  assert.equal(
    authorization.origin,
    "https://accounts.google.com"
  );

  assert.equal(
    authorization.searchParams.get(
      "client_id"
    ),
    "google-client"
  );

  assert.equal(
    authorization.searchParams.get(
      "redirect_uri"
    ),
    "https://synapse.example/api/integrations/oauth/callback/GMAIL"
  );

  assert.equal(
    authorization.searchParams.get(
      "response_type"
    ),
    "code"
  );

  assert.equal(
    authorization.searchParams.get(
      "state"
    ),
    "opaque-state"
  );

  assert.equal(
    authorization.searchParams.get(
      "code_challenge"
    ),
    "pkce-challenge"
  );

  assert.equal(
    authorization.searchParams.get(
      "code_challenge_method"
    ),
    "S256"
  );

  assert.equal(
    authorization.searchParams.get(
      "access_type"
    ),
    "offline"
  );

  assert.equal(
    authorization.searchParams.get(
      "prompt"
    ),
    "consent"
  );

  const scopes = new Set(
    (
      authorization.searchParams.get(
        "scope"
      ) ?? ""
    ).split(" ")
  );

  assert.equal(
    scopes.has(
      "https://www.googleapis.com/auth/gmail.send"
    ),
    true
  );
});

test("builds Google Forms authorization with response scopes", () => {
  const authorization = new URL(
    createOAuthAuthorizationUrl({
      provider: "GOOGLE_FORMS",
      clientId: "google-client",
      redirectUri:
        "https://synapse.example/api/integrations/oauth/callback/GOOGLE_FORMS",
      state: "forms-state",
      codeChallenge:
        "forms-pkce-challenge",
    })
  );

  assert.equal(
    authorization.origin,
    "https://accounts.google.com"
  );

  assert.equal(
    authorization.searchParams.get(
      "redirect_uri"
    ),
    "https://synapse.example/api/integrations/oauth/callback/GOOGLE_FORMS"
  );

  assert.equal(
    authorization.searchParams.get(
      "access_type"
    ),
    "offline"
  );

  assert.equal(
    authorization.searchParams.get(
      "prompt"
    ),
    "consent"
  );

  const scopes = new Set(
    (
      authorization.searchParams.get(
        "scope"
      ) ?? ""
    ).split(" ")
  );

  assert.equal(
    scopes.has("openid"),
    true
  );

  assert.equal(
    scopes.has("email"),
    true
  );

  assert.equal(
    scopes.has("profile"),
    true
  );

  assert.equal(
    scopes.has(
      "https://www.googleapis.com/auth/forms.body.readonly"
    ),
    true
  );

  assert.equal(
    scopes.has(
      "https://www.googleapis.com/auth/forms.responses.readonly"
    ),
    true
  );

  assert.equal(
    scopes.has(
      "https://www.googleapis.com/auth/spreadsheets"
    ),
    false
  );
});

test("builds GitHub authorization without Google-only parameters", () => {
  const authorization = new URL(
    createOAuthAuthorizationUrl({
      provider: "GITHUB",
      clientId: "github-client",
      redirectUri:
        "https://synapse.example/api/integrations/oauth/callback/GITHUB",
      state: "opaque-state",
      codeChallenge:
        "pkce-challenge",
    })
  );

  assert.equal(
    authorization.origin,
    "https://github.com"
  );

  assert.equal(
    authorization.searchParams.has(
      "access_type"
    ),
    false
  );

  assert.equal(
    authorization.searchParams.has(
      "prompt"
    ),
    false
  );

  const scopes = new Set(
    (
      authorization.searchParams.get(
        "scope"
      ) ?? ""
    ).split(" ")
  );

  assert.equal(
    scopes.has("repo"),
    true
  );
});

test("preserves a refresh token when rotation omits a replacement", () => {
  assert.deepEqual(
    mergeRefreshedCredentials({
      current: {
        accessToken: "old-access",
        refreshToken: "old-refresh",
      },
      accessToken: "new-access",
    }),
    {
      accessToken: "new-access",
      refreshToken: "old-refresh",
    }
  );

  assert.equal(
    createOAuthStateContext({
      stateId: "state-id",
      workspaceId: "workspace-id",
      provider: "GITHUB",
    }),
    "oauth:state-id:workspace-id:GITHUB"
  );
});
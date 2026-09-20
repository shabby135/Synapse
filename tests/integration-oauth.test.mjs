import assert from "node:assert/strict";
import {
  createHash,
} from "node:crypto";
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

test("registers the four OAuth providers exactly once", () => {
  assert.deepEqual(
    Object.keys(oauthProviderRegistry),
    [...oauthProviderValues]
  );
  assert.equal(
    new Set(oauthProviderValues).size,
    4
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
      "state"
    ),
    "opaque-state"
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
  assert.match(
    authorization.searchParams.get(
      "scope"
    ) ?? "",
    /gmail\.send/
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
  assert.match(
    authorization.searchParams.get(
      "scope"
    ) ?? "",
    /repo/
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


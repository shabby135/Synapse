import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyOAuthTokenFailure,
  createOAuthTokenRequestError,
  OAuthTokenRequestError,
  parseOAuthProviderError,
} from "../src/features/integration/oauth-token-error.ts";

test("parses and normalizes OAuth provider errors", () => {
  assert.deepEqual(
    parseOAuthProviderError({
      error: " INVALID_GRANT ",
      error_description:
        " Refresh token revoked. ",
    }),
    {
      code: "invalid_grant",
      description:
        "Refresh token revoked.",
    }
  );

  assert.deepEqual(
    parseOAuthProviderError({
      error: "invalid_client",
      message:
        "Client credentials were rejected.",
    }),
    {
      code: "invalid_client",
      description:
        "Client credentials were rejected.",
    }
  );
});

test("safely handles malformed OAuth provider errors", () => {
  for (const payload of [
    null,
    undefined,
    "invalid_grant",
    [],
    123,
  ]) {
    assert.deepEqual(
      parseOAuthProviderError(
        payload
      ),
      {
        code: null,
        description: null,
      }
    );
  }

  assert.deepEqual(
    parseOAuthProviderError({
      error: {},
      error_description: [],
    }),
    {
      code: null,
      description: null,
    }
  );
});

test("bounds OAuth provider error fields", () => {
  const parsed =
    parseOAuthProviderError({
      error: ` ${"A".repeat(
        200
      )} `,
      error_description:
        ` ${"B".repeat(
          1_000
        )} `,
    });

  assert.equal(
    parsed.code?.length,
    128
  );

  assert.equal(
    parsed.code,
    "a".repeat(128)
  );

  assert.equal(
    parsed.description?.length,
    500
  );

  assert.equal(
    parsed.description,
    "B".repeat(500)
  );
});

test("classifies revoked and expired credentials as requiring reauthorization", () => {
  for (const providerCode of [
    "invalid_grant",
    "invalid_token",
    "bad_refresh_token",
    "expired_token",
    "revoked_token",
  ]) {
    assert.equal(
      classifyOAuthTokenFailure({
        status: 400,
        providerCode,
      }),
      "REAUTH_REQUIRED"
    );
  }

  assert.equal(
    classifyOAuthTokenFailure({
      status: 401,
      providerCode:
        "INVALID_TOKEN",
    }),
    "REAUTH_REQUIRED"
  );
});

test("classifies retryable provider and network failures as temporary", () => {
  for (const status of [
    null,
    408,
    425,
    429,
    500,
    502,
    503,
    504,
    599,
  ]) {
    assert.equal(
      classifyOAuthTokenFailure({
        status,
        providerCode: null,
      }),
      "TEMPORARY"
    );
  }
});

test("classifies OAuth client configuration failures", () => {
  for (const providerCode of [
    "invalid_client",
    "unauthorized_client",
    "unsupported_grant_type",
  ]) {
    assert.equal(
      classifyOAuthTokenFailure({
        status: 400,
        providerCode,
      }),
      "CONFIGURATION"
    );
  }
});

test("keeps unknown provider rejections separate from reconnect errors", () => {
  assert.equal(
    classifyOAuthTokenFailure({
      status: 400,
      providerCode:
        "invalid_request",
    }),
    "REJECTED"
  );

  assert.equal(
    classifyOAuthTokenFailure({
      status: 403,
      providerCode: null,
    }),
    "REJECTED"
  );
});

test("creates a structured reauthorization error", () => {
  const error =
    createOAuthTokenRequestError({
      status: 400,
      payload: {
        error:
          "invalid_grant",
        error_description:
          "The refresh token was revoked.",
      },
    });

  assert.equal(
    error instanceof
      OAuthTokenRequestError,
    true
  );

  assert.equal(
    error instanceof Error,
    true
  );

  assert.equal(
    error.name,
    "OAuthTokenRequestError"
  );

  assert.equal(
    error.kind,
    "REAUTH_REQUIRED"
  );

  assert.equal(
    error.status,
    400
  );

  assert.equal(
    error.providerCode,
    "invalid_grant"
  );

  assert.equal(
    error.providerDescription,
    "The refresh token was revoked."
  );

  assert.equal(
    error.message,
    "The OAuth connection is no longer authorized and must be reconnected."
  );
});

test("creates a structured temporary provider error", () => {
  const error =
    createOAuthTokenRequestError({
      status: 503,
      payload: {
        error:
          "temporarily_unavailable",
        error_description:
          "Please try again later.",
      },
    });

  assert.equal(
    error.kind,
    "TEMPORARY"
  );

  assert.equal(
    error.status,
    503
  );

  assert.equal(
    error.providerCode,
    "temporarily_unavailable"
  );

  assert.equal(
    error.providerDescription,
    "Please try again later."
  );

  assert.equal(
    error.message,
    "The OAuth provider is temporarily unavailable."
  );
});

test("creates a safe error when the provider body is malformed", () => {
  const error =
    createOAuthTokenRequestError({
      status: 400,
      payload:
        "<html>Provider error</html>",
    });

  assert.equal(
    error.kind,
    "REJECTED"
  );

  assert.equal(
    error.providerCode,
    null
  );

  assert.equal(
    error.providerDescription,
    null
  );

  assert.equal(
    error.message,
    "The OAuth provider rejected the token request."
  );
});
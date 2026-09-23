import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_CREDENTIAL_FORMAT_VERSION,
  IntegrationCredentialError,
  maskCredentialValue,
  parseIntegrationCredentials,
  serializeIntegrationCredentials,
} from "../src/features/integration/credential-codec.ts";
import {
  createCredentialPreview,
  validateProviderCredentials,
} from "../src/features/integration/credential-definition.ts";
import {
  defineConnectionTester,
} from "../src/features/integration/connection-test.ts";

test("round-trips versioned credential objects", () => {
  const credentials = {
    accessToken: "access-secret",
    refreshToken: "refresh-secret",
  };

  const serialized =
    serializeIntegrationCredentials(
      credentials
    );

  assert.deepEqual(
    parseIntegrationCredentials({
      serialized,
      formatVersion:
        CURRENT_CREDENTIAL_FORMAT_VERSION,
      provider: "GMAIL",
    }),
    credentials
  );
});

test("reads legacy Slack and Discord webhook credentials", () => {
  const webhookUrl =
    "https://hooks.slack.com/services/a/b/c";

  assert.deepEqual(
    parseIntegrationCredentials({
      serialized: webhookUrl,
      formatVersion: 1,
      provider: "SLACK",
    }),
    { webhookUrl }
  );

  assert.throws(
    () =>
      parseIntegrationCredentials({
        serialized: "secret",
        formatVersion: 1,
        provider: "OPENAI",
      }),
    IntegrationCredentialError
  );
});

test("rejects malformed, empty, oversized, and unknown credential fields", () => {
  assert.throws(
    () =>
      serializeIntegrationCredentials({}),
    IntegrationCredentialError
  );

  assert.throws(
    () =>
      serializeIntegrationCredentials({
        invalid_key: "secret",
      }),
    IntegrationCredentialError
  );

  assert.throws(
    () =>
      validateProviderCredentials(
        "OPENAI",
        {
          apiKey: "secret",
          extra: "not-allowed",
        }
      ),
    IntegrationCredentialError
  );
});

test("requires the provider credential fields and secure URLs", () => {
  assert.throws(
    () =>
      validateProviderCredentials(
        "GMAIL",
        { accessToken: "token" }
      ),
    /Refresh token is required/
  );

  assert.throws(
    () =>
      validateProviderCredentials(
        "SLACK",
        {
          webhookUrl:
            "http://hooks.slack.com/services/a/b/c",
        }
      ),
    /must use HTTPS/
  );

  assert.throws(
    () =>
      validateProviderCredentials(
        "TRELLO",
        {
          apiKey:
            "1234567890abcdef1234567890abcdef",
        }
      ),
    /API token is required/
  );

  assert.throws(
    () =>
      validateProviderCredentials(
        "TRELLO",
        {
          apiKey: "invalid key",
          apiToken:
            "1234567890abcdef1234567890abcdef",
        }
      ),
    /valid Trello API key/
  );
});

test("masks Trello API keys and tokens", () => {
  assert.deepEqual(
    createCredentialPreview(
      "TRELLO",
      {
        apiKey:
          "1234567890abcdef1234567890abcdef",
        apiToken:
          "abcdef1234567890abcdef1234567890",
      }
    ),
    [
      {
        key: "apiKey",
        label: "API key",
        configured: true,
        displayValue: "••••cdef",
      },
      {
        key: "apiToken",
        label: "API token",
        configured: true,
        displayValue: "••••7890",
      },
    ]
  );
});

test("masks secrets while retaining non-secret configuration", () => {
  assert.equal(
    maskCredentialValue(
      "sk-example-1234"
    ),
    "••••1234"
  );

  assert.deepEqual(
    createCredentialPreview(
      "CUSTOM_API",
      {
        baseUrl:
          "https://api.example.com",
        authHeader:
          "X-API-Key",
        token: "secret-token-9876",
      }
    ),
    [
      {
        key: "baseUrl",
        label: "Base URL",
        configured: true,
        displayValue:
          "https://api.example.com",
      },
      {
        key: "authHeader",
        label:
          "Authorization header",
        configured: true,
        displayValue: "X-API-Key",
      },
      {
        key: "token",
        label: "Token",
        configured: true,
        displayValue: "••••9876",
      },
    ]
  );
});

test("binds connection testers to one provider", async () => {
  const tester =
    defineConnectionTester(
      "OPENAI",
      async () => ({
        status: "CONNECTED",
      })
    );

  const signal =
    new AbortController().signal;

  await assert.rejects(
    tester({
      provider: "ANTHROPIC",
      credentials: {
        apiKey: "secret",
      },
      signal,
    }),
    /cannot test ANTHROPIC/
  );
});

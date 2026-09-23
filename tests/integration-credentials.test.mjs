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
        {
          accessToken: "token",
        }
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

  assert.throws(
    () =>
      validateProviderCredentials(
        "JIRA",
        {
          siteUrl:
            "https://synapse-test.atlassian.net",
          email:
            "owner@example.com",
        }
      ),
    /API token is required/
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

test("validates and masks Jira credentials", () => {
  const credentials = {
    siteUrl:
      "https://synapse-test.atlassian.net",
    email:
      "owner@example.com",
    apiToken:
      "jira-api-token-example-1234",
  };

  assert.deepEqual(
    validateProviderCredentials(
      "JIRA",
      credentials
    ),
    credentials
  );

  assert.deepEqual(
    createCredentialPreview(
      "JIRA",
      credentials
    ),
    [
      {
        key: "siteUrl",
        label: "Jira site URL",
        configured: true,
        displayValue:
          "https://synapse-test.atlassian.net",
      },
      {
        key: "email",
        label: "Atlassian email",
        configured: true,
        displayValue:
          "owner@example.com",
      },
      {
        key: "apiToken",
        label: "API token",
        configured: true,
        displayValue: "••••1234",
      },
    ]
  );

  assert.throws(
    () =>
      validateProviderCredentials(
        "JIRA",
        {
          ...credentials,
          siteUrl:
            "https://example.com",
        }
      ),
    /Jira Cloud site URL/
  );

  assert.throws(
    () =>
      validateProviderCredentials(
        "JIRA",
        {
          ...credentials,
          siteUrl:
            "http://synapse-test.atlassian.net",
        }
      ),
    /must use HTTPS/
  );

  assert.throws(
    () =>
      validateProviderCredentials(
        "JIRA",
        {
          ...credentials,
          siteUrl:
            "https://synapse-test.atlassian.net/jira",
        }
      ),
    /Jira Cloud site URL/
  );

  assert.throws(
    () =>
      validateProviderCredentials(
        "JIRA",
        {
          ...credentials,
          email: "invalid-email",
        }
      ),
    /valid Atlassian account email/
  );

  assert.throws(
    () =>
      validateProviderCredentials(
        "JIRA",
        {
          ...credentials,
          apiToken: "short",
        }
      ),
    /valid Jira API token/
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
        token:
          "secret-token-9876",
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
        displayValue:
          "X-API-Key",
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
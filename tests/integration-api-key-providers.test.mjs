import assert from "node:assert/strict";
import test from "node:test";

import {
  apiKeyProviderTestRegistry,
  apiKeyProviderValues,
  classifyApiKeyTestStatus,
  createApiKeyTestRequest,
  isApiKeyProvider,
} from "../src/features/integration/api-key-provider.ts";

test("registers each active AI API-key provider once", () => {
  assert.deepEqual(
    Object.keys(
      apiKeyProviderTestRegistry
    ),
    [...apiKeyProviderValues]
  );
  assert.equal(
    new Set(apiKeyProviderValues).size,
    6
  );

  for (const provider of apiKeyProviderValues) {
    assert.equal(
      isApiKeyProvider(provider),
      true
    );
  }

  assert.equal(
    isApiKeyProvider("SLACK"),
    false
  );
});

test("builds bearer-authenticated provider checks", () => {
  for (const provider of [
    "OPENAI",
    "GROQ",
    "DEEPSEEK",
    "OPENROUTER",
  ]) {
    const request =
      createApiKeyTestRequest({
        provider,
        apiKey: "test-secret",
      });
    const headers = new Headers(
      request.init.headers
    );

    assert.equal(
      request.init.method,
      "GET"
    );
    assert.equal(
      headers.get("authorization"),
      "Bearer test-secret"
    );
    assert.equal(
      request.url.includes(
        "test-secret"
      ),
      false
    );
  }
});

test("uses provider-specific Anthropic and Gemini headers", () => {
  const anthropic =
    createApiKeyTestRequest({
      provider: "ANTHROPIC",
      apiKey: "anthropic-secret",
    });
  const anthropicHeaders =
    new Headers(
      anthropic.init.headers
    );

  assert.equal(
    anthropicHeaders.get("x-api-key"),
    "anthropic-secret"
  );
  assert.equal(
    anthropicHeaders.get(
      "anthropic-version"
    ),
    "2023-06-01"
  );

  const gemini =
    createApiKeyTestRequest({
      provider: "GEMINI",
      apiKey: "gemini-secret",
    });
  const geminiHeaders = new Headers(
    gemini.init.headers
  );

  assert.equal(
    geminiHeaders.get(
      "x-goog-api-key"
    ),
    "gemini-secret"
  );
  assert.equal(
    gemini.url.includes(
      "gemini-secret"
    ),
    false
  );
});

test("classifies provider responses without exposing response bodies", () => {
  assert.deepEqual(
    classifyApiKeyTestStatus(200),
    {
      status: "CONNECTED",
      metadata: undefined,
    }
  );
  assert.deepEqual(
    classifyApiKeyTestStatus(429),
    {
      status: "CONNECTED",
      metadata: {
        verification:
          "RATE_LIMITED",
      },
    }
  );
  assert.equal(
    classifyApiKeyTestStatus(401)
      .status,
    "INVALID_CREDENTIALS"
  );
  assert.equal(
    classifyApiKeyTestStatus(503)
      .status,
    "PROVIDER_UNAVAILABLE"
  );
});

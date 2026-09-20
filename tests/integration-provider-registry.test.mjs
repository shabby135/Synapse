import assert from "node:assert/strict";
import test from "node:test";

import {
  getIntegrationProvider,
  integrationProviderRegistry,
  integrationProviderValues,
  providerSupportsCapability,
} from "../src/features/integration/provider-registry.ts";

test("registers every planned Synapse provider exactly once", () => {
  assert.equal(
    integrationProviderValues.length,
    18
  );

  assert.deepEqual(
    Object.keys(
      integrationProviderRegistry
    ),
    [...integrationProviderValues]
  );

  assert.equal(
    new Set(
      integrationProviderValues
    ).size,
    integrationProviderValues.length
  );
});

test("keeps existing webhook providers active", () => {
  for (const provider of [
    "SLACK",
    "DISCORD",
  ]) {
    const definition =
      getIntegrationProvider(provider);

    assert.equal(
      definition.authStrategy,
      "WEBHOOK"
    );
    assert.equal(
      definition.availability,
      "ACTIVE"
    );
    assert.equal(
      providerSupportsCapability(
        provider,
        "SEND_MESSAGE"
      ),
      true
    );
  }
});

test("describes the shared provider capabilities used by future nodes", () => {
  assert.equal(
    providerSupportsCapability(
      "OPENAI",
      "AI_EXTRACT"
    ),
    true
  );
  assert.equal(
    providerSupportsCapability(
      "GOOGLE_SHEETS",
      "APPEND_ROW"
    ),
    true
  );
  assert.equal(
    providerSupportsCapability(
      "STRIPE",
      "SEND_MESSAGE"
    ),
    false
  );
});

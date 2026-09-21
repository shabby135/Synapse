import assert from "node:assert/strict";
import test from "node:test";

import {
  failureRetryDate,
  nextPollDate,
  stableConfigurationHash,
} from "../src/features/workflow/integration-trigger-runtime.ts";

test(
  "hashes equivalent top-level trigger configurations consistently",
  () => {
    assert.equal(
      stableConfigurationHash({
        triggerType: "TEST",
        integrationId: "one",
      }),
      stableConfigurationHash({
        integrationId: "one",
        triggerType: "TEST",
      })
    );
  }
);

test(
  "bounds successful polling intervals",
  () => {
    const now = new Date(
      "2026-01-01T00:00:00Z"
    );

    assert.equal(
      nextPollDate(
        0,
        now
      ).toISOString(),
      "2026-01-01T00:01:00.000Z"
    );

    assert.equal(
      nextPollDate(
        90,
        now
      ).toISOString(),
      "2026-01-01T01:00:00.000Z"
    );
  }
);

test(
  "applies bounded exponential retry delays",
  () => {
    const now = new Date(
      "2026-01-01T00:00:00Z"
    );

    assert.equal(
      failureRetryDate(
        1,
        now
      ).toISOString(),
      "2026-01-01T00:01:00.000Z"
    );

    assert.equal(
      failureRetryDate(
        4,
        now
      ).toISOString(),
      "2026-01-01T00:08:00.000Z"
    );

    assert.equal(
      failureRetryDate(
        20,
        now
      ).toISOString(),
      "2026-01-01T01:00:00.000Z"
    );
  }
);
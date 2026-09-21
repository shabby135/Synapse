import assert from "node:assert/strict";
import test from "node:test";

import {
  configurationForPublish,
  DataMappingError,
  resolveActionConfiguration,
} from "../src/features/workflow/data-mapping.ts";
import {
  GmailActionError,
  parseGmailActionConfiguration,
} from "../src/features/workflow/gmail-action-configuration.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";

function createActionData(
  changes = {}
) {
  return {
    label: "Send email",
    configuration: {
      actionType:
        "GMAIL_SEND_EMAIL",
      integrationId,
      to: "person@example.com",
      cc: "",
      bcc: "",
      replyTo: "",
      subject:
        "Workflow complete",
      body: "Hello",
      contentType:
        "PLAIN_TEXT",
      ...changes,
    },
  };
}

test(
  "parses a valid Gmail action",
  () => {
    const result =
      parseGmailActionConfiguration(
        createActionData()
      );

    assert.deepEqual(
      result.to,
      ["person@example.com"]
    );

    assert.equal(
      result.contentType,
      "PLAIN_TEXT"
    );
  }
);

test(
  "deduplicates recipients across fields",
  () => {
    const result =
      parseGmailActionConfiguration(
        createActionData({
          to: "Person@example.com, person@example.com",
          cc: "PERSON@example.com, cc@example.com",
          bcc: "cc@example.com, hidden@example.com",
        })
      );

    assert.deepEqual(
      result.to,
      ["Person@example.com"]
    );

    assert.deepEqual(
      result.cc,
      ["cc@example.com"]
    );

    assert.deepEqual(
      result.bcc,
      ["hidden@example.com"]
    );
  }
);

test(
  "rejects invalid recipients and header injection",
  () => {
    assert.throws(
      () =>
        parseGmailActionConfiguration(
          createActionData({
            to: "bad",
          })
        ),
      GmailActionError
    );

    assert.throws(
      () =>
        parseGmailActionConfiguration(
          createActionData({
            subject:
              "Hello\r\nBcc: attacker@example.com",
          })
        ),
      GmailActionError
    );
  }
);

test(
  "maps Gmail message fields",
  () => {
    const configuration =
      resolveActionConfiguration(
        createActionData({
          to: "{{input.email}}",
          subject:
            "Hello {{input.name}}",
          body:
            "Score: {{input.score}}",
        }).configuration,
        {
          trigger: {},
          input: {
            email:
              "person@example.com",
            name: "Shubham",
            score: 42,
          },
          nodes: {},
        }
      );

    assert.equal(
      configuration.to,
      "person@example.com"
    );

    assert.equal(
      configuration.subject,
      "Hello Shubham"
    );

    assert.equal(
      configuration.body,
      "Score: 42"
    );
  }
);

test(
  "keeps Gmail integration and content type static",
  () => {
    assert.throws(
      () =>
        configurationForPublish(
          createActionData({
            integrationId:
              "{{input.id}}",
          }).configuration,
          new Set()
        ),
      DataMappingError
    );

    assert.throws(
      () =>
        configurationForPublish(
          createActionData({
            contentType:
              "{{input.type}}",
          }).configuration,
          new Set()
        ),
      DataMappingError
    );
  }
);

test(
  "validates mapped Gmail fields for publishing",
  () => {
    const configuration =
      configurationForPublish(
        createActionData({
          to: "{{input.email}}",
          subject:
            "{{input.subject}}",
          body:
            "{{input.body}}",
        }).configuration,
        new Set()
      );

    assert.doesNotThrow(() =>
      parseGmailActionConfiguration({
        label: "Send email",
        configuration,
      })
    );
  }
);
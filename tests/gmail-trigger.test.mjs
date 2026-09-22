import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  createGmailTriggerCursor,
  GmailTriggerError,
  gmailMessagesQuery,
  parseGmailMessageList,
  parseGmailTriggerConfiguration,
  processGmailMessagesPage,
} from "../src/features/workflow/gmail-trigger-configuration.ts";
import {
  validateWorkflowForPublish,
} from "../src/features/workflow/validate-publish.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";

const publishedAt = new Date(
  "2026-09-22T08:00:00.000Z"
);

function createConfiguration(
  changes = {}
) {
  return {
    triggerType:
      "GMAIL_NEW_EMAIL",
    integrationId,
    labelId: "INBOX",
    searchQuery: "",
    startMode: "FROM_NOW",
    pollIntervalMinutes: 1,
    ...changes,
  };
}

function encoded(value) {
  return Buffer.from(
    value,
    "utf8"
  ).toString("base64url");
}

function apiMessage(changes = {}) {
  return {
    id: "message-1",
    threadId: "thread-1",
    historyId: "1001",
    internalDate: String(
      Date.parse(
        "2026-09-22T08:01:00.000Z"
      )
    ),
    labelIds: [
      "INBOX",
      "UNREAD",
    ],
    snippet:
      "Hello from the message",
    payload: {
      mimeType:
        "multipart/alternative",
      headers: [
        {
          name: "From",
          value:
            "Sender <sender@example.com>",
        },
        {
          name: "To",
          value:
            "owner@example.com",
        },
        {
          name: "Subject",
          value: "New enquiry",
        },
        {
          name: "Date",
          value:
            "Tue, 22 Sep 2026 13:31:00 +0530",
        },
        {
          name: "Message-ID",
          value:
            "<message-1@example.com>",
        },
      ],
      parts: [
        {
          mimeType: "text/plain",
          body: {
            data: encoded(
              "Plain body"
            ),
          },
        },
        {
          mimeType: "text/html",
          body: {
            data: encoded(
              "<p>HTML body</p>"
            ),
          },
        },
      ],
    },
    ...changes,
  };
}

test(
  "parses a valid Gmail new-email trigger",
  () => {
    const result =
      parseGmailTriggerConfiguration(
        {
          label:
            "New support email",
          configuration:
            createConfiguration({
              searchQuery:
                "from:alerts@example.com",
            }),
        }
      );

    assert.equal(
      result.triggerType,
      "GMAIL_NEW_EMAIL"
    );

    assert.equal(
      result.labelId,
      "INBOX"
    );

    assert.equal(
      result.searchQuery,
      "from:alerts@example.com"
    );
  }
);

test(
  "rejects invalid and dynamic static Gmail settings",
  () => {
    assert.throws(
      () =>
        parseGmailTriggerConfiguration(
          {
            label: "New email",
            configuration:
              createConfiguration({
                integrationId:
                  "bad",
              }),
          }
        ),
      GmailTriggerError
    );

    assert.throws(
      () =>
        parseGmailTriggerConfiguration(
          {
            label: "New email",
            configuration:
              createConfiguration({
                searchQuery:
                  "from:{{input.sender}}",
              }),
          }
        ),
      GmailTriggerError
    );

    assert.throws(
      () =>
        parseGmailTriggerConfiguration(
          {
            label: "New email",
            configuration:
              createConfiguration({
                labelId: "SPAM",
              }),
          }
        ),
      GmailTriggerError
    );
  }
);

test(
  "starts at workflow activation without replaying older email",
  () => {
    const configuration =
      createConfiguration();

    const cursor =
      createGmailTriggerCursor(
        configuration,
        publishedAt
      );

    const window =
      gmailMessagesQuery({
        configuration,
        cursor,
        now: new Date(
          "2026-09-22T08:02:00.000Z"
        ),
      });

    const result =
      processGmailMessagesPage({
        page: {},
        messages: [
          apiMessage({
            id: "old-message",
            internalDate: String(
              Date.parse(
                "2026-09-22T07:59:59.000Z"
              )
            ),
          }),
          apiMessage(),
        ],
        windowStartMs:
          window.windowStartMs,
        windowEndMs:
          window.windowEndMs,
      });

    assert.deepEqual(
      result.events.map(
        (event) =>
          event.input.id
      ),
      ["message-1"]
    );

    assert.deepEqual(
      result.cursor,
      {
        phase: "READY",
        checkpointMs:
          Date.parse(
            "2026-09-22T08:02:00.000Z"
          ),
      }
    );
  }
);

test(
  "does not miss email received after publishing but before the first poll",
  () => {
    const configuration =
      createConfiguration();

    const cursor =
      createGmailTriggerCursor(
        configuration,
        publishedAt
      );

    const window =
      gmailMessagesQuery({
        configuration,
        cursor,
        now: new Date(
          "2026-09-22T08:02:00.000Z"
        ),
      });

    const result =
      processGmailMessagesPage({
        page: {},
        messages: [
          apiMessage(),
        ],
        windowStartMs:
          window.windowStartMs,
        windowEndMs:
          window.windowEndMs,
      });

    assert.equal(
      result.events.length,
      1
    );
  }
);

test(
  "can process existing matching email from the beginning",
  () => {
    const configuration =
      createConfiguration({
        startMode:
          "FROM_BEGINNING",
      });

    const cursor =
      createGmailTriggerCursor(
        configuration,
        publishedAt
      );

    const window =
      gmailMessagesQuery({
        configuration,
        cursor,
        now: publishedAt,
      });

    const result =
      processGmailMessagesPage({
        page: {},
        messages: [
          apiMessage({
            internalDate: String(
              Date.parse(
                "2025-01-01T00:00:00.000Z"
              )
            ),
          }),
        ],
        windowStartMs:
          window.windowStartMs,
        windowEndMs:
          window.windowEndMs,
      });

    assert.equal(
      window.windowStartMs,
      0
    );

    assert.equal(
      result.events.length,
      1
    );
  }
);

test(
  "builds bounded Gmail list queries with labels and search filters",
  () => {
    const configuration =
      createConfiguration({
        labelId: "UNREAD",
        searchQuery:
          "from:alerts@example.com",
      });

    const window =
      gmailMessagesQuery({
        configuration,
        cursor: {
          phase: "INITIAL",
          checkpointMs:
            publishedAt.getTime(),
        },
        now: new Date(
          "2026-09-22T08:02:00.000Z"
        ),
      });

    assert.equal(
      window.query.get(
        "maxResults"
      ),
      "25"
    );

    assert.equal(
      window.query.get(
        "labelIds"
      ),
      "UNREAD"
    );

    assert.match(
      window.query.get("q"),
      /from:alerts@example\.com/
    );

    assert.match(
      window.query.get("q"),
      /after:/
    );

    assert.match(
      window.query.get("q"),
      /before:/
    );
  }
);

test(
  "keeps a frozen polling window while Gmail results are paginated",
  () => {
    const result =
      processGmailMessagesPage({
        page: {
          nextPageToken:
            "page-2",
        },
        messages: [
          apiMessage(),
        ],
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs:
          Date.parse(
            "2026-09-22T08:02:00.000Z"
          ),
      });

    assert.deepEqual(
      result.cursor,
      {
        phase: "PAGING",
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs:
          Date.parse(
            "2026-09-22T08:02:00.000Z"
          ),
        pageToken: "page-2",
      }
    );

    const nextWindow =
      gmailMessagesQuery({
        configuration:
          createConfiguration(),
        cursor: result.cursor,
        now: new Date(
          "2026-09-22T08:10:00.000Z"
        ),
      });

    assert.equal(
      nextWindow.windowEndMs,
      Date.parse(
        "2026-09-22T08:02:00.000Z"
      )
    );

    assert.equal(
      nextWindow.query.get(
        "pageToken"
      ),
      "page-2"
    );
  }
);

test(
  "overlaps completed polling windows to tolerate delayed Gmail indexing",
  () => {
    const window =
      gmailMessagesQuery({
        configuration:
          createConfiguration(),
        cursor: {
          phase: "READY",
          checkpointMs:
            Date.parse(
              "2026-09-22T08:05:00.000Z"
            ),
        },
        now: new Date(
          "2026-09-22T08:06:00.000Z"
        ),
      });

    assert.equal(
      window.windowStartMs,
      Date.parse(
        "2026-09-22T08:04:00.000Z"
      )
    );
  }
);

test(
  "extracts useful headers and inline plain-text and HTML bodies",
  () => {
    const result =
      processGmailMessagesPage({
        page: {},
        messages: [
          apiMessage(),
        ],
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs:
          Date.parse(
            "2026-09-22T08:02:00.000Z"
          ),
      });

    const input =
      result.events[0].input;

    assert.equal(
      input.from,
      "Sender <sender@example.com>"
    );

    assert.equal(
      input.subject,
      "New enquiry"
    );

    assert.equal(
      input.textBody,
      "Plain body"
    );

    assert.equal(
      input.htmlBody,
      "<p>HTML body</p>"
    );
  }
);

test(
  "limits each Gmail list page to twenty-five message IDs",
  () => {
    const ids =
      parseGmailMessageList({
        messages: Array.from(
          {
            length: 30,
          },
          (_, index) => ({
            id:
              `message-${index + 1}`,
          })
        ),
      });

    assert.equal(
      ids.length,
      25
    );
  }
);

test(
  "validates a published Gmail trigger workflow",
  () => {
    const result =
      validateWorkflowForPublish(
        "550e8400-e29b-41d4-a716-446655440001",
        {
          nodes: [
            {
              id: "trigger-1",
              type: "trigger",
              position: {
                x: 0,
                y: 0,
              },
              data: {
                label:
                  "New support email",
                configuration:
                  createConfiguration(),
              },
            },
            {
              id: "action-1",
              type: "action",
              position: {
                x: 200,
                y: 0,
              },
              data: {
                label:
                  "Test action",
                configuration: {
                  actionType:
                    "NO_OP",
                },
              },
            },
          ],
          edges: [
            {
              id: "edge-1",
              source: "trigger-1",
              target: "action-1",
            },
          ],
        }
      );

    assert.deepEqual(
      result,
      {
        valid: true,
      }
    );
  }
);
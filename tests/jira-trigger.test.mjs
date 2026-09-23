import assert from "node:assert/strict";
import test from "node:test";

import {
  createJiraTriggerCursor,
  jiraIssueSearchRequest,
  JiraTriggerError,
  parseJiraIssueSearchPage,
  parseJiraTriggerConfiguration,
  processJiraIssuesPage,
} from "../src/features/workflow/jira-trigger-configuration.ts";
import {
  validateWorkflowForPublish,
} from "../src/features/workflow/validate-publish.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";

const publishedAt = new Date(
  "2026-09-23T08:00:00.000Z"
);

function createConfiguration(
  changes = {}
) {
  return {
    triggerType: "JIRA_NEW_ISSUE",
    integrationId,
    projectKey: "KAN",
    startMode: "FROM_NOW",
    pollIntervalMinutes: 1,
    ...changes,
  };
}

function parsedConfiguration(
  changes = {}
) {
  return parseJiraTriggerConfiguration({
    label: "Jira New Issue",
    configuration:
      createConfiguration(changes),
  });
}

function jiraIssue(
  changes = {}
) {
  return {
    id: "10042",
    key: "KAN-42",
    self:
      "https://example.atlassian.net/rest/api/3/issue/10042",
    fields: {
      summary:
        "Investigate failed workflow",
      description: {
        type: "doc",
        version: 1,
        content: [],
      },
      created:
        "2026-09-23T08:01:00.000Z",
      updated:
        "2026-09-23T08:01:30.000Z",
      labels: [
        "automation",
        "important",
      ],
      project: {
        id: "10000",
        key: "KAN",
        name: "Kanban project",
      },
      issuetype: {
        id: "10001",
        name: "Task",
      },
      status: {
        id: "10002",
        name: "To Do",
      },
      priority: {
        id: "3",
        name: "Medium",
      },
      reporter: {
        accountId:
          "reporter-account-id",
        displayName:
          "Reporter User",
        emailAddress:
          "reporter@example.com",
      },
      assignee: {
        accountId:
          "assignee-account-id",
        displayName:
          "Assignee User",
        emailAddress:
          "assignee@example.com",
      },
    },
    ...changes,
  };
}

test(
  "parses a valid Jira new-issue trigger",
  () => {
    const result =
      parsedConfiguration();

    assert.deepEqual(result, {
      triggerType:
        "JIRA_NEW_ISSUE",
      integrationId,
      projectKey: "KAN",
      startMode: "FROM_NOW",
      pollIntervalMinutes: 1,
    });
  }
);

test(
  "normalizes Jira project keys",
  () => {
    const result =
      parsedConfiguration({
        projectKey: "kan",
      });

    assert.equal(
      result.projectKey,
      "KAN"
    );
  }
);

test(
  "rejects invalid or dynamic Jira trigger settings",
  () => {
    assert.throws(
      () =>
        parsedConfiguration({
          integrationId: "invalid",
        }),
      JiraTriggerError
    );

    for (const projectKey of [
      "",
      "1KAN",
      "K",
      "KAN-PROJECT",
      "{{input.projectKey}}",
      "PROJECTKEY11",
    ]) {
      assert.throws(
        () =>
          parsedConfiguration({
            projectKey,
          }),
        JiraTriggerError
      );
    }

    assert.throws(
      () =>
        parsedConfiguration({
          pollIntervalMinutes: 2,
        }),
      JiraTriggerError
    );

    assert.throws(
      () =>
        parsedConfiguration({
          startMode: "INVALID",
        }),
      JiraTriggerError
    );
  }
);

test(
  "starts at workflow activation without replaying older issues",
  () => {
    const configuration =
      parsedConfiguration();

    const cursor =
      createJiraTriggerCursor(
        configuration,
        publishedAt
      );

    const pollingWindow =
      jiraIssueSearchRequest({
        configuration,
        cursor,
        now: new Date(
          "2026-09-23T08:02:00.000Z"
        ),
      });

    const result =
      processJiraIssuesPage({
        issues: [
          jiraIssue({
            id: "10041",
            key: "KAN-41",
            fields: {
              ...jiraIssue().fields,
              created:
                "2026-09-23T07:59:59.000Z",
            },
          }),
          jiraIssue(),
        ],
        nextPageToken: null,
        configuration,
        windowStartMs:
          pollingWindow.windowStartMs,
        windowEndMs:
          pollingWindow.windowEndMs,
        page: pollingWindow.page,
      });

    assert.equal(
      result.events.length,
      1
    );

    assert.equal(
      result.events[0].key,
      "10042"
    );

    assert.deepEqual(
      result.cursor,
      {
        phase: "READY",
        checkpointMs:
          Date.parse(
            "2026-09-23T08:02:00.000Z"
          ),
      }
    );
  }
);

test(
  "does not miss an issue created after publishing but before the first poll",
  () => {
    const configuration =
      parsedConfiguration();

    const cursor =
      createJiraTriggerCursor(
        configuration,
        publishedAt
      );

    const pollingWindow =
      jiraIssueSearchRequest({
        configuration,
        cursor,
        now: new Date(
          "2026-09-23T08:02:00.000Z"
        ),
      });

    const result =
      processJiraIssuesPage({
        issues: [jiraIssue()],
        nextPageToken: null,
        configuration,
        windowStartMs:
          pollingWindow.windowStartMs,
        windowEndMs:
          pollingWindow.windowEndMs,
        page: pollingWindow.page,
      });

    assert.equal(
      result.events.length,
      1
    );
  }
);

test(
  "can process existing Jira issues from the beginning",
  () => {
    const configuration =
      parsedConfiguration({
        startMode:
          "FROM_BEGINNING",
      });

    const cursor =
      createJiraTriggerCursor(
        configuration,
        publishedAt
      );

    const pollingWindow =
      jiraIssueSearchRequest({
        configuration,
        cursor,
        now: publishedAt,
      });

    const result =
      processJiraIssuesPage({
        issues: [
          jiraIssue({
            fields: {
              ...jiraIssue().fields,
              created:
                "2025-01-01T00:00:00.000Z",
              updated:
                "2025-01-01T00:01:00.000Z",
            },
          }),
        ],
        nextPageToken: null,
        configuration,
        windowStartMs:
          pollingWindow.windowStartMs,
        windowEndMs:
          pollingWindow.windowEndMs,
        page: pollingWindow.page,
      });

    assert.equal(
      pollingWindow.windowStartMs,
      0
    );

    assert.equal(
      result.events.length,
      1
    );
  }
);

test(
  "builds a bounded Jira enhanced-search request",
  () => {
    const configuration =
      parsedConfiguration();

    const pollingWindow =
      jiraIssueSearchRequest({
        configuration,
        cursor: {
          phase: "INITIAL",
          checkpointMs:
            publishedAt.getTime(),
        },
        now: new Date(
          "2026-09-23T08:02:00.000Z"
        ),
      });

    assert.equal(
      pollingWindow.body.jql,
      'project = "KAN" ORDER BY created DESC, key DESC'
    );

    assert.equal(
      pollingWindow.body.maxResults,
      50
    );

    assert.equal(
      pollingWindow.body.fields.includes(
        "created"
      ),
      true
    );

    assert.equal(
      pollingWindow.body.fields.includes(
        "summary"
      ),
      true
    );

    assert.equal(
      "nextPageToken" in
        pollingWindow.body,
      false
    );
  }
);

test(
  "parses Jira enhanced-search responses",
  () => {
    const result =
      parseJiraIssueSearchPage(
        JSON.stringify({
          issues: [jiraIssue()],
          nextPageToken:
            "next-page-token",
        })
      );

    assert.equal(
      result.issues.length,
      1
    );

    assert.equal(
      result.nextPageToken,
      "next-page-token"
    );

    assert.throws(
      () =>
        parseJiraIssueSearchPage(
          "not-json"
        ),
      JiraTriggerError
    );

    assert.throws(
      () =>
        parseJiraIssueSearchPage(
          JSON.stringify({
            issues: {},
          })
        ),
      JiraTriggerError
    );

    assert.throws(
      () =>
        parseJiraIssueSearchPage(
          JSON.stringify({
            issues: [],
            nextPageToken:
              "invalid\u0000token",
          })
        ),
      JiraTriggerError
    );
  }
);

test(
  "keeps a frozen polling window while Jira issues are paginated",
  () => {
    const configuration =
      parsedConfiguration();

    const windowEndMs = Date.parse(
      "2026-09-23T08:02:00.000Z"
    );

    const result =
      processJiraIssuesPage({
        issues: [jiraIssue()],
        nextPageToken:
          "next-page-token",
        configuration,
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs,
        page: 0,
      });

    assert.deepEqual(
      result.cursor,
      {
        phase: "PAGING",
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs,
        nextPageToken:
          "next-page-token",
        page: 1,
      }
    );

    const nextWindow =
      jiraIssueSearchRequest({
        configuration,
        cursor: result.cursor,
        now: new Date(
          "2026-09-23T08:10:00.000Z"
        ),
      });

    assert.equal(
      nextWindow.windowStartMs,
      publishedAt.getTime()
    );

    assert.equal(
      nextWindow.windowEndMs,
      windowEndMs
    );

    assert.equal(
      nextWindow.page,
      1
    );

    assert.equal(
      nextWindow.body
        .nextPageToken,
      "next-page-token"
    );
  }
);

test(
  "stops Jira pagination after reaching issues older than the polling window",
  () => {
    const configuration =
      parsedConfiguration();

    const result =
      processJiraIssuesPage({
        issues: [
          jiraIssue({
            id: "10041",
            key: "KAN-41",
            fields: {
              ...jiraIssue().fields,
              created:
                "2026-09-23T07:59:00.000Z",
            },
          }),
        ],
        nextPageToken:
          "unused-next-page",
        configuration,
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs:
          Date.parse(
            "2026-09-23T08:02:00.000Z"
          ),
        page: 0,
      });

    assert.equal(
      result.events.length,
      0
    );

    assert.deepEqual(
      result.cursor,
      {
        phase: "READY",
        checkpointMs:
          Date.parse(
            "2026-09-23T08:02:00.000Z"
          ),
      }
    );
  }
);

test(
  "filters issues to the configured Jira project",
  () => {
    const configuration =
      parsedConfiguration();

    const result =
      processJiraIssuesPage({
        issues: [
          jiraIssue(),
          jiraIssue({
            id: "20042",
            key: "OTHER-42",
            fields: {
              ...jiraIssue().fields,
              project: {
                id: "20000",
                key: "OTHER",
                name:
                  "Another project",
              },
            },
          }),
        ],
        nextPageToken: null,
        configuration,
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs:
          Date.parse(
            "2026-09-23T08:02:00.000Z"
          ),
        page: 0,
      });

    assert.equal(
      result.events.length,
      1
    );

    assert.equal(
      result.events[0].input
        .issue.key,
      "KAN-42"
    );
  }
);

test(
  "maps Jira issue, project, status, priority, and account fields",
  () => {
    const result =
      processJiraIssuesPage({
        issues: [jiraIssue()],
        nextPageToken: null,
        configuration:
          parsedConfiguration(),
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs:
          Date.parse(
            "2026-09-23T08:02:00.000Z"
          ),
        page: 0,
      });

    const input =
      result.events[0].input;

    assert.equal(
      input.provider,
      "JIRA"
    );

    assert.equal(
      input.event,
      "NEW_ISSUE"
    );

    assert.equal(
      input.issue.summary,
      "Investigate failed workflow"
    );

    assert.equal(
      input.issue.project.key,
      "KAN"
    );

    assert.equal(
      input.issue.issueType.name,
      "Task"
    );

    assert.equal(
      input.issue.status.name,
      "To Do"
    );

    assert.equal(
      input.issue.priority.name,
      "Medium"
    );

    assert.equal(
      input.issue.reporter
        .displayName,
      "Reporter User"
    );

    assert.equal(
      input.issue.assignee
        .displayName,
      "Assignee User"
    );

    assert.deepEqual(
      input.issue.labels,
      [
        "automation",
        "important",
      ]
    );
  }
);

test(
  "overlaps completed Jira polling windows for delayed search indexing",
  () => {
    const configuration =
      parsedConfiguration();

    const pollingWindow =
      jiraIssueSearchRequest({
        configuration,
        cursor: {
          phase: "READY",
          checkpointMs:
            Date.parse(
              "2026-09-23T08:10:00.000Z"
            ),
        },
        now: new Date(
          "2026-09-23T08:11:00.000Z"
        ),
      });

    assert.equal(
      pollingWindow.windowStartMs,
      Date.parse(
        "2026-09-23T08:05:00.000Z"
      )
    );

    assert.equal(
      pollingWindow.windowEndMs,
      Date.parse(
        "2026-09-23T08:11:00.000Z"
      )
    );
  }
);

test(
  "validates a published Jira trigger workflow",
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
                  "Jira New Issue",
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

    assert.deepEqual(result, {
      valid: true,
    });
  }
);
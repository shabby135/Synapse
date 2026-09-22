import assert from "node:assert/strict";
import test from "node:test";

import {
  createGitHubTriggerCursor,
  GitHubTriggerError,
  gitHubIssuesQuery,
  parseGitHubNextPage,
  parseGitHubTriggerConfiguration,
  processGitHubIssuesPage,
} from "../src/features/workflow/github-trigger-configuration.ts";
import {
  validateWorkflowForPublish,
} from "../src/features/workflow/validate-publish.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";
const publishedAt = new Date(
  "2026-09-23T08:00:00.000Z"
);

function createConfiguration(changes = {}) {
  return {
    triggerType: "GITHUB_NEW_ISSUE",
    integrationId,
    repository: "openai/synapse",
    labels: "bug, urgent",
    startMode: "FROM_NOW",
    pollIntervalMinutes: 1,
    ...changes,
  };
}

function apiIssue(changes = {}) {
  return {
    id: 1001,
    node_id: "I_kwDOExample",
    number: 42,
    title: "Workflow is not running",
    body: "Steps to reproduce",
    state: "open",
    state_reason: null,
    locked: false,
    html_url:
      "https://github.com/openai/synapse/issues/42",
    url:
      "https://api.github.com/repos/openai/synapse/issues/42",
    comments_url:
      "https://api.github.com/repos/openai/synapse/issues/42/comments",
    created_at:
      "2026-09-23T08:01:00.000Z",
    updated_at:
      "2026-09-23T08:01:00.000Z",
    closed_at: null,
    user: {
      id: 7,
      login: "octocat",
      type: "User",
      avatar_url:
        "https://avatars.githubusercontent.com/u/7",
      html_url:
        "https://github.com/octocat",
    },
    labels: [
      {
        id: 11,
        name: "bug",
        color: "d73a4a",
        description: "Something is broken",
      },
    ],
    assignees: [
      {
        id: 8,
        login: "maintainer",
        type: "User",
      },
    ],
    milestone: {
      id: 9,
      number: 2,
      title: "Version 1",
      description: "First release",
      state: "open",
      due_on:
        "2026-10-01T00:00:00Z",
    },
    ...changes,
  };
}

test(
  "parses a valid GitHub new-issue trigger",
  () => {
    const result =
      parseGitHubTriggerConfiguration({
        label: "New repository issue",
        configuration:
          createConfiguration(),
      });

    assert.equal(
      result.triggerType,
      "GITHUB_NEW_ISSUE"
    );
    assert.equal(
      result.repository,
      "openai/synapse"
    );
    assert.deepEqual(result.labels, [
      "bug",
      "urgent",
    ]);
  }
);

test(
  "rejects invalid or dynamic static GitHub settings",
  () => {
    assert.throws(
      () =>
        parseGitHubTriggerConfiguration({
          label: "New issue",
          configuration:
            createConfiguration({
              integrationId: "bad",
            }),
        }),
      GitHubTriggerError
    );

    for (const repository of [
      "missing-owner",
      "-owner/repository",
      "owner/{{input.repository}}",
    ]) {
      assert.throws(
        () =>
          parseGitHubTriggerConfiguration({
            label: "New issue",
            configuration:
              createConfiguration({
                repository,
              }),
          }),
        GitHubTriggerError
      );
    }

    assert.throws(
      () =>
        parseGitHubTriggerConfiguration({
          label: "New issue",
          configuration:
            createConfiguration({
              labels:
                "bug, {{input.label}}",
            }),
        }),
      GitHubTriggerError
    );
  }
);

test(
  "starts at workflow activation without replaying older issues",
  () => {
    const configuration =
      parseGitHubTriggerConfiguration({
        label: "New issue",
        configuration:
          createConfiguration(),
      });
    const cursor =
      createGitHubTriggerCursor(
        configuration,
        publishedAt
      );
    const window = gitHubIssuesQuery({
      configuration,
      cursor,
      now: new Date(
        "2026-09-23T08:02:00.000Z"
      ),
    });
    const result =
      processGitHubIssuesPage({
        issues: [
          apiIssue({
            id: 1000,
            number: 41,
            created_at:
              "2026-09-23T07:59:59.000Z",
          }),
          apiIssue(),
        ],
        repository:
          configuration.repository,
        windowStartMs:
          window.windowStartMs,
        windowEndMs:
          window.windowEndMs,
        page: window.page,
        hasNextPage: false,
      });

    assert.deepEqual(
      result.events.map(
        (event) => event.input.id
      ),
      [1001]
    );
    assert.deepEqual(result.cursor, {
      phase: "READY",
      checkpointMs: Date.parse(
        "2026-09-23T08:02:00.000Z"
      ),
    });
  }
);

test(
  "does not miss an issue created after publishing but before the first poll",
  () => {
    const configuration =
      parseGitHubTriggerConfiguration({
        label: "New issue",
        configuration:
          createConfiguration(),
      });
    const cursor =
      createGitHubTriggerCursor(
        configuration,
        publishedAt
      );
    const window = gitHubIssuesQuery({
      configuration,
      cursor,
      now: new Date(
        "2026-09-23T08:02:00.000Z"
      ),
    });
    const result =
      processGitHubIssuesPage({
        issues: [apiIssue()],
        repository:
          configuration.repository,
        windowStartMs:
          window.windowStartMs,
        windowEndMs:
          window.windowEndMs,
        page: window.page,
        hasNextPage: false,
      });

    assert.equal(result.events.length, 1);
  }
);

test(
  "can process existing issues from the beginning",
  () => {
    const configuration =
      parseGitHubTriggerConfiguration({
        label: "New issue",
        configuration:
          createConfiguration({
            startMode: "FROM_BEGINNING",
          }),
      });
    const cursor =
      createGitHubTriggerCursor(
        configuration,
        publishedAt
      );
    const window = gitHubIssuesQuery({
      configuration,
      cursor,
      now: publishedAt,
    });
    const result =
      processGitHubIssuesPage({
        issues: [
          apiIssue({
            created_at:
              "2025-01-01T00:00:00.000Z",
          }),
        ],
        repository:
          configuration.repository,
        windowStartMs:
          window.windowStartMs,
        windowEndMs:
          window.windowEndMs,
        page: window.page,
        hasNextPage: false,
      });

    assert.equal(window.windowStartMs, 0);
    assert.equal(
      window.query.has("since"),
      false
    );
    assert.equal(result.events.length, 1);
  }
);

test(
  "builds bounded GitHub issue queries with repository labels",
  () => {
    const configuration =
      parseGitHubTriggerConfiguration({
        label: "New issue",
        configuration:
          createConfiguration(),
      });
    const window = gitHubIssuesQuery({
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
      window.query.get("state"),
      "all"
    );
    assert.equal(
      window.query.get("sort"),
      "created"
    );
    assert.equal(
      window.query.get("per_page"),
      "100"
    );
    assert.equal(
      window.query.get("labels"),
      "bug,urgent"
    );
    assert.equal(
      window.query.get("since"),
      publishedAt.toISOString()
    );
  }
);

test(
  "keeps a frozen polling window while GitHub results are paginated",
  () => {
    const end = Date.parse(
      "2026-09-23T08:02:00.000Z"
    );
    const result =
      processGitHubIssuesPage({
        issues: [apiIssue()],
        repository: "openai/synapse",
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs: end,
        page: 1,
        hasNextPage: true,
      });

    assert.deepEqual(result.cursor, {
      phase: "PAGING",
      windowStartMs:
        publishedAt.getTime(),
      windowEndMs: end,
      page: 2,
    });

    const configuration =
      parseGitHubTriggerConfiguration({
        label: "New issue",
        configuration:
          createConfiguration(),
      });
    const nextWindow = gitHubIssuesQuery({
      configuration,
      cursor: result.cursor,
      now: new Date(
        "2026-09-23T08:10:00.000Z"
      ),
    });

    assert.equal(
      nextWindow.windowEndMs,
      end
    );
    assert.equal(
      nextWindow.query.get("page"),
      "2"
    );
  }
);

test(
  "recognizes GitHub Link pagination safely",
  () => {
    assert.equal(
      parseGitHubNextPage(
        '<https://api.github.com/repositories/1/issues?page=2>; rel="next", <https://api.github.com/repositories/1/issues?page=5>; rel="last"'
      ),
      true
    );
    assert.equal(
      parseGitHubNextPage(
        '<https://api.github.com/repositories/1/issues?page=1>; rel="prev"'
      ),
      false
    );
  }
);

test(
  "excludes pull requests and maps issue fields",
  () => {
    const result =
      processGitHubIssuesPage({
        issues: [
          apiIssue(),
          apiIssue({
            id: 1002,
            number: 43,
            pull_request: {
              url:
                "https://api.github.com/repos/openai/synapse/pulls/43",
            },
          }),
        ],
        repository: "openai/synapse",
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs: Date.parse(
          "2026-09-23T08:02:00.000Z"
        ),
        page: 1,
        hasNextPage: false,
      });

    assert.equal(result.events.length, 1);
    const input = result.events[0].input;

    assert.equal(input.number, 42);
    assert.equal(
      input.title,
      "Workflow is not running"
    );
    assert.equal(input.repository, "openai/synapse");
    assert.equal(input.author.login, "octocat");
    assert.deepEqual(
      input.labels.map((label) => label.name),
      ["bug"]
    );
    assert.deepEqual(
      input.assignees.map(
        (assignee) => assignee.login
      ),
      ["maintainer"]
    );
  }
);

test(
  "overlaps completed polling windows for delayed GitHub indexing",
  () => {
    const configuration =
      parseGitHubTriggerConfiguration({
        label: "New issue",
        configuration:
          createConfiguration(),
      });
    const window = gitHubIssuesQuery({
      configuration,
      cursor: {
        phase: "READY",
        checkpointMs: Date.parse(
          "2026-09-23T08:05:00.000Z"
        ),
      },
      now: new Date(
        "2026-09-23T08:06:00.000Z"
      ),
    });

    assert.equal(
      window.windowStartMs,
      Date.parse(
        "2026-09-23T08:03:00.000Z"
      )
    );
  }
);

test(
  "validates a published GitHub trigger workflow",
  () => {
    const result = validateWorkflowForPublish(
      "550e8400-e29b-41d4-a716-446655440001",
      {
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: {
              label: "New GitHub issue",
              configuration:
                createConfiguration(),
            },
          },
          {
            id: "action-1",
            type: "action",
            position: { x: 200, y: 0 },
            data: {
              label: "Test action",
              configuration: {
                actionType: "NO_OP",
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

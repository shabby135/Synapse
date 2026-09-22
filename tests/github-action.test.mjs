import assert from "node:assert/strict";
import test from "node:test";

import {
  configurationForPublish,
  DataMappingError,
  resolveActionConfiguration,
} from "../src/features/workflow/data-mapping.ts";
import {
  GitHubActionError,
  parseGitHubActionConfiguration,
} from "../src/features/workflow/github-action-configuration.ts";
import {
  validateWorkflowForPublish,
} from "../src/features/workflow/validate-publish.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";

function createData(changes = {}) {
  return {
    label: "Create GitHub issue",
    configuration: {
      actionType:
        "GITHUB_CREATE_ISSUE",
      integrationId,
      repository: "openai/synapse",
      title: "Workflow alert",
      body: "Created by Synapse",
      labels: "bug, automation",
      assignees: "octocat",
      ...changes,
    },
  };
}

test(
  "parses a valid GitHub create-issue action",
  () => {
    const result =
      parseGitHubActionConfiguration(
        createData()
      );

    assert.equal(
      result.repository,
      "openai/synapse"
    );
    assert.deepEqual(result.labels, [
      "bug",
      "automation",
    ]);
    assert.deepEqual(result.assignees, [
      "octocat",
    ]);
  }
);

test(
  "deduplicates labels and assignees case-insensitively",
  () => {
    const result =
      parseGitHubActionConfiguration(
        createData({
          labels:
            "Bug, bug, customer",
          assignees:
            "Octocat, octocat",
        })
      );

    assert.deepEqual(result.labels, [
      "Bug",
      "customer",
    ]);
    assert.deepEqual(result.assignees, [
      "Octocat",
    ]);
  }
);

test(
  "rejects invalid integrations and repositories",
  () => {
    assert.throws(
      () =>
        parseGitHubActionConfiguration(
          createData({
            integrationId: "invalid",
          })
        ),
      GitHubActionError
    );

    assert.throws(
      () =>
        parseGitHubActionConfiguration(
          createData({
            repository: "not-a-repo",
          })
        ),
      GitHubActionError
    );

    assert.throws(
      () =>
        parseGitHubActionConfiguration(
          createData({
            labels: ["bug", 42],
          })
        ),
      GitHubActionError
    );
  }
);

test(
  "rejects invalid titles, labels, and assignees",
  () => {
    assert.throws(
      () =>
        parseGitHubActionConfiguration(
          createData({
            title: "First\nSecond",
          })
        ),
      GitHubActionError
    );

    assert.throws(
      () =>
        parseGitHubActionConfiguration(
          createData({
            labels: "x".repeat(51),
          })
        ),
      GitHubActionError
    );

    assert.throws(
      () =>
        parseGitHubActionConfiguration(
          createData({
            assignees: "invalid--name",
          })
        ),
      GitHubActionError
    );
  }
);

test(
  "maps GitHub issue fields while preserving arrays",
  () => {
    const configuration =
      resolveActionConfiguration(
        createData({
          title:
            "Issue for {{input.customer}}",
          body: "Details: {{input.details}}",
          labels: "{{input.labels}}",
          assignees:
            "{{input.assignees}}",
        }).configuration,
        {
          trigger: {},
          input: {
            customer: "Acme",
            details: "Service failed",
            labels: ["bug", "urgent"],
            assignees: ["octocat"],
          },
          nodes: {},
        }
      );

    assert.equal(
      configuration.title,
      "Issue for Acme"
    );
    assert.equal(
      configuration.body,
      "Details: Service failed"
    );
    assert.deepEqual(
      configuration.labels,
      ["bug", "urgent"]
    );
    assert.deepEqual(
      configuration.assignees,
      ["octocat"]
    );
  }
);

test(
  "keeps GitHub integration and repository static",
  () => {
    assert.throws(
      () =>
        configurationForPublish(
          createData({
            integrationId:
              "{{input.integrationId}}",
          }).configuration,
          new Set()
        ),
      DataMappingError
    );

    assert.throws(
      () =>
        configurationForPublish(
          createData({
            repository:
              "{{input.repository}}",
          }).configuration,
          new Set()
        ),
      DataMappingError
    );
  }
);

test(
  "validates mapped GitHub issue fields for publishing",
  () => {
    const configuration =
      configurationForPublish(
        createData({
          title: "{{input.title}}",
          body: "{{input.body}}",
          labels: "{{input.labels}}",
          assignees:
            "{{input.assignees}}",
        }).configuration,
        new Set()
      );

    assert.doesNotThrow(() =>
      parseGitHubActionConfiguration({
        label: "Create GitHub issue",
        configuration,
      })
    );
  }
);

test(
  "validates a workflow with a GitHub create-issue action",
  () => {
    const result =
      validateWorkflowForPublish(
        "550e8400-e29b-41d4-a716-446655440001",
        {
          nodes: [
            {
              id: "trigger-1",
              type: "trigger",
              position: { x: 0, y: 0 },
              data: {
                label: "Manual trigger",
                configuration: {
                  triggerType: "MANUAL",
                },
              },
            },
            {
              id: "action-1",
              type: "action",
              position: {
                x: 200,
                y: 0,
              },
              data: createData(),
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

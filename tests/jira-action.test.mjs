import assert from "node:assert/strict";
import test from "node:test";

import {
  configurationForPublish,
  DataMappingError,
  resolveActionConfiguration,
} from "../src/features/workflow/data-mapping.ts";
import {
  JiraActionError,
  parseJiraActionConfiguration,
} from "../src/features/workflow/jira-action-configuration.ts";
import {
  validateWorkflowForPublish,
} from "../src/features/workflow/validate-publish.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";

const assigneeAccountId =
  "712020:51f1a50b-d745-4d92-b6f1-cce5a917d918";

function createData(changes = {}) {
  return {
    label: "Create Jira issue",
    configuration: {
      actionType:
        "JIRA_CREATE_ISSUE",
      integrationId,
      projectKey: "KAN",
      issueTypeId: "10003",
      summary: "Workflow alert",
      description:
        "Created automatically by Synapse",
      labels: "automation, synapse",
      priorityId: "3",
      assigneeAccountId,
      ...changes,
    },
  };
}

test(
  "parses a valid Jira create-issue action",
  () => {
    const result =
      parseJiraActionConfiguration(
        createData()
      );

    assert.equal(
      result.integrationId,
      integrationId
    );

    assert.equal(
      result.projectKey,
      "KAN"
    );

    assert.equal(
      result.issueTypeId,
      "10003"
    );

    assert.equal(
      result.summary,
      "Workflow alert"
    );

    assert.deepEqual(
      result.labels,
      ["automation", "synapse"]
    );

    assert.equal(
      result.priorityId,
      "3"
    );

    assert.equal(
      result.assigneeAccountId,
      assigneeAccountId
    );
  }
);

test(
  "normalizes project keys and deduplicates labels",
  () => {
    const result =
      parseJiraActionConfiguration(
        createData({
          projectKey: "kan",
          labels:
            "Automation, automation, backend",
        })
      );

    assert.equal(
      result.projectKey,
      "KAN"
    );

    assert.deepEqual(
      result.labels,
      ["Automation", "backend"]
    );
  }
);

test(
  "accepts empty optional Jira fields",
  () => {
    const result =
      parseJiraActionConfiguration(
        createData({
          description: "",
          labels: "",
          priorityId: "",
          assigneeAccountId: "",
        })
      );

    assert.equal(
      result.description,
      ""
    );

    assert.deepEqual(
      result.labels,
      []
    );

    assert.equal(
      result.priorityId,
      null
    );

    assert.equal(
      result.assigneeAccountId,
      null
    );
  }
);

test(
  "rejects invalid Jira integrations and static identifiers",
  () => {
    assert.throws(
      () =>
        parseJiraActionConfiguration(
          createData({
            integrationId: "invalid",
          })
        ),
      JiraActionError
    );

    assert.throws(
      () =>
        parseJiraActionConfiguration(
          createData({
            projectKey:
              "not a project",
          })
        ),
      JiraActionError
    );

    assert.throws(
      () =>
        parseJiraActionConfiguration(
          createData({
            issueTypeId: "Feature",
          })
        ),
      JiraActionError
    );
  }
);

test(
  "rejects invalid Jira issue content and optional fields",
  () => {
    assert.throws(
      () =>
        parseJiraActionConfiguration(
          createData({
            summary:
              "First line\nSecond line",
          })
        ),
      JiraActionError
    );

    assert.throws(
      () =>
        parseJiraActionConfiguration(
          createData({
            labels:
              "contains whitespace",
          })
        ),
      JiraActionError
    );

    assert.throws(
      () =>
        parseJiraActionConfiguration(
          createData({
            priorityId: "Medium",
          })
        ),
      JiraActionError
    );

    assert.throws(
      () =>
        parseJiraActionConfiguration(
          createData({
            assigneeAccountId:
              "invalid account id",
          })
        ),
      JiraActionError
    );
  }
);

test(
  "maps Jira issue fields while preserving label arrays",
  () => {
    const configuration =
      resolveActionConfiguration(
        createData({
          summary:
            "Issue for {{input.customer}}",
          description:
            "Details: {{input.details}}",
          labels: "{{input.labels}}",
          priorityId:
            "{{input.priorityId}}",
          assigneeAccountId:
            "{{input.assigneeAccountId}}",
        }).configuration,
        {
          trigger: {},
          input: {
            customer: "Acme",
            details:
              "The service is unavailable",
            labels: [
              "incident",
              "automation",
            ],
            priorityId: 3,
            assigneeAccountId,
          },
          nodes: {},
        }
      );

    assert.equal(
      configuration.summary,
      "Issue for Acme"
    );

    assert.equal(
      configuration.description,
      "Details: The service is unavailable"
    );

    assert.deepEqual(
      configuration.labels,
      ["incident", "automation"]
    );

    assert.equal(
      configuration.priorityId,
      "3"
    );

    assert.equal(
      configuration.assigneeAccountId,
      assigneeAccountId
    );
  }
);

test(
  "keeps Jira integration, project, and issue type static",
  () => {
    for (const changes of [
      {
        integrationId:
          "{{input.integrationId}}",
      },
      {
        projectKey:
          "{{input.projectKey}}",
      },
      {
        issueTypeId:
          "{{input.issueTypeId}}",
      },
    ]) {
      assert.throws(
        () =>
          configurationForPublish(
            createData(changes)
              .configuration,
            new Set()
          ),
        DataMappingError
      );
    }
  }
);

test(
  "validates mapped Jira issue fields for publishing",
  () => {
    const configuration =
      configurationForPublish(
        createData({
          summary:
            "{{input.summary}}",
          description:
            "{{input.description}}",
          labels:
            "{{input.labels}}",
          priorityId:
            "{{input.priorityId}}",
          assigneeAccountId:
            "{{input.assigneeAccountId}}",
        }).configuration,
        new Set()
      );

    assert.doesNotThrow(() =>
      parseJiraActionConfiguration({
        label: "Create Jira issue",
        configuration,
      })
    );
  }
);

test(
  "validates a workflow with a Jira create-issue action",
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
                  "Manual trigger",
                configuration: {
                  triggerType:
                    "MANUAL",
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
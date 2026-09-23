import assert from "node:assert/strict";
import test from "node:test";

import {
  configurationForPublish,
  DataMappingError,
  resolveActionConfiguration,
} from "../src/features/workflow/data-mapping.ts";
import {
  parseTrelloActionConfiguration,
  TrelloActionError,
} from "../src/features/workflow/trello-action-configuration.ts";
import {
  validateWorkflowForPublish,
} from "../src/features/workflow/validate-publish.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";
const listId =
  "64f1234567890abcdef12345";
const memberId =
  "64f1234567890abcdef12346";
const labelId =
  "64f1234567890abcdef12347";

function createData(changes = {}) {
  return {
    label: "Create Trello card",
    configuration: {
      actionType:
        "TRELLO_CREATE_CARD",
      integrationId,
      listId,
      name: "Workflow task",
      description: "Created by Synapse",
      position: "bottom",
      due: "2026-10-01T12:00:00Z",
      dueComplete: false,
      memberIds: memberId,
      labelIds: labelId,
      ...changes,
    },
  };
}

test(
  "parses a valid Trello create-card action",
  () => {
    const result =
      parseTrelloActionConfiguration(
        createData()
      );

    assert.equal(result.listId, listId);
    assert.equal(
      result.due,
      "2026-10-01T12:00:00.000Z"
    );
    assert.deepEqual(result.memberIds, [
      memberId,
    ]);
    assert.deepEqual(result.labelIds, [
      labelId,
    ]);
  }
);

test(
  "deduplicates Trello member and label IDs",
  () => {
    const result =
      parseTrelloActionConfiguration(
        createData({
          memberIds: `${memberId}, ${memberId.toUpperCase()}`,
          labelIds: [
            labelId,
            labelId.toUpperCase(),
          ],
        })
      );

    assert.deepEqual(result.memberIds, [
      memberId,
    ]);
    assert.deepEqual(result.labelIds, [
      labelId,
    ]);
  }
);

test(
  "accepts an empty optional due date and ID lists",
  () => {
    const result =
      parseTrelloActionConfiguration(
        createData({
          due: "",
          memberIds: "",
          labelIds: "",
        })
      );

    assert.equal(result.due, null);
    assert.deepEqual(result.memberIds, []);
    assert.deepEqual(result.labelIds, []);
  }
);

test(
  "rejects invalid Trello integrations and list IDs",
  () => {
    assert.throws(
      () =>
        parseTrelloActionConfiguration(
          createData({
            integrationId: "invalid",
          })
        ),
      TrelloActionError
    );

    assert.throws(
      () =>
        parseTrelloActionConfiguration(
          createData({
            listId: "not-a-list-id",
          })
        ),
      TrelloActionError
    );
  }
);

test(
  "rejects invalid card content and optional fields",
  () => {
    assert.throws(
      () =>
        parseTrelloActionConfiguration(
          createData({
            name: "First\nSecond",
          })
        ),
      TrelloActionError
    );

    assert.throws(
      () =>
        parseTrelloActionConfiguration(
          createData({
            due: "not-a-date",
          })
        ),
      TrelloActionError
    );

    assert.throws(
      () =>
        parseTrelloActionConfiguration(
          createData({
            memberIds: "invalid",
          })
        ),
      TrelloActionError
    );

    assert.throws(
      () =>
        parseTrelloActionConfiguration(
          createData({
            position: "middle",
          })
        ),
      TrelloActionError
    );
  }
);

test(
  "maps Trello card fields while preserving ID arrays",
  () => {
    const configuration =
      resolveActionConfiguration(
        createData({
          name:
            "Task for {{input.customer}}",
          description:
            "Details: {{input.details}}",
          due: "{{input.due}}",
          memberIds:
            "{{input.memberIds}}",
          labelIds:
            "{{input.labelIds}}",
        }).configuration,
        {
          trigger: {},
          input: {
            customer: "Acme",
            details: "Follow up",
            due:
              "2026-10-02T09:30:00Z",
            memberIds: [memberId],
            labelIds: [labelId],
          },
          nodes: {},
        }
      );

    assert.equal(
      configuration.name,
      "Task for Acme"
    );
    assert.equal(
      configuration.description,
      "Details: Follow up"
    );
    assert.equal(
      configuration.due,
      "2026-10-02T09:30:00Z"
    );
    assert.deepEqual(
      configuration.memberIds,
      [memberId]
    );
    assert.deepEqual(
      configuration.labelIds,
      [labelId]
    );
  }
);

test(
  "keeps Trello integration, list, position, and completion static",
  () => {
    for (const changes of [
      {
        integrationId:
          "{{input.integrationId}}",
      },
      {
        listId: "{{input.listId}}",
      },
      {
        position:
          "{{input.position}}",
      },
      {
        dueComplete:
          "{{input.dueComplete}}",
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
  "validates mapped Trello card fields for publishing",
  () => {
    const configuration =
      configurationForPublish(
        createData({
          name: "{{input.name}}",
          description:
            "{{input.description}}",
          due: "{{input.due}}",
          memberIds:
            "{{input.memberIds}}",
          labelIds:
            "{{input.labelIds}}",
        }).configuration,
        new Set()
      );

    assert.doesNotThrow(() =>
      parseTrelloActionConfiguration({
        label: "Create Trello card",
        configuration,
      })
    );
  }
);

test(
  "validates a workflow with a Trello create-card action",
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
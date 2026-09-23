import assert from "node:assert/strict";
import test from "node:test";

import {
  createTrelloTriggerCursor,
  parseTrelloTriggerConfiguration,
  processTrelloActionsPage,
  trelloActionsQuery,
  TrelloTriggerError,
} from "../src/features/workflow/trello-trigger-configuration.ts";
import {
  validateWorkflowForPublish,
} from "../src/features/workflow/validate-publish.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";
const boardId =
  "5abbe4b7ddc1b351ef961414";
const listId =
  "5abbe4b7ddc1b351ef961415";
const publishedAt = new Date(
  "2026-09-23T08:00:00.000Z"
);

function createConfiguration(changes = {}) {
  return {
    triggerType: "TRELLO_NEW_CARD",
    integrationId,
    boardId,
    listId: "",
    startMode: "FROM_NOW",
    pollIntervalMinutes: 1,
    ...changes,
  };
}

function apiAction(changes = {}) {
  return {
    id: "5abbe4b7ddc1b351ef961416",
    idMemberCreator:
      "5abbe4b7ddc1b351ef961417",
    type: "createCard",
    date: "2026-09-23T08:01:00.000Z",
    data: {
      card: {
        id: "5abbe4b7ddc1b351ef961418",
        name: "Investigate failed workflow",
        idShort: 42,
        shortLink: "AbCdEf12",
      },
      list: {
        id: listId,
        name: "To do",
      },
      board: {
        id: boardId,
        name: "Synapse Development",
        shortLink: "GhIjKl34",
      },
    },
    memberCreator: {
      id: "5abbe4b7ddc1b351ef961417",
      username: "octocat",
      fullName: "Octo Cat",
    },
    ...changes,
  };
}

function parsedConfiguration(changes = {}) {
  return parseTrelloTriggerConfiguration({
    label: "New Trello card",
    configuration:
      createConfiguration(changes),
  });
}

test(
  "parses a valid Trello new-card trigger",
  () => {
    const result =
      parsedConfiguration({ listId });

    assert.equal(
      result.triggerType,
      "TRELLO_NEW_CARD"
    );
    assert.equal(result.boardId, boardId);
    assert.equal(result.listId, listId);
  }
);

test(
  "rejects invalid or dynamic static Trello settings",
  () => {
    assert.throws(
      () =>
        parsedConfiguration({
          integrationId: "bad",
        }),
      TrelloTriggerError
    );

    for (const invalidBoardId of [
      "short-link",
      "{{input.boardId}}",
      "5abbe4b7ddc1b351ef96141z",
    ]) {
      assert.throws(
        () =>
          parsedConfiguration({
            boardId: invalidBoardId,
          }),
        TrelloTriggerError
      );
    }

    assert.throws(
      () =>
        parsedConfiguration({
          listId: "{{input.listId}}",
        }),
      TrelloTriggerError
    );
  }
);

test(
  "starts at workflow activation without replaying older cards",
  () => {
    const configuration =
      parsedConfiguration();
    const cursor =
      createTrelloTriggerCursor(
        configuration,
        publishedAt
      );
    const window = trelloActionsQuery({
      cursor,
      now: new Date(
        "2026-09-23T08:02:00.000Z"
      ),
    });
    const result =
      processTrelloActionsPage({
        actions: [
          apiAction({
            id:
              "5abbe4b7ddc1b351ef961419",
            date:
              "2026-09-23T07:59:59.000Z",
          }),
          apiAction(),
        ],
        configuration,
        windowStartMs:
          window.windowStartMs,
        windowEndMs:
          window.windowEndMs,
        page: window.page,
      });

    assert.equal(result.events.length, 1);
    assert.deepEqual(result.cursor, {
      phase: "READY",
      checkpointMs: Date.parse(
        "2026-09-23T08:02:00.000Z"
      ),
    });
  }
);

test(
  "does not miss a card created after publishing but before the first poll",
  () => {
    const configuration =
      parsedConfiguration();
    const cursor =
      createTrelloTriggerCursor(
        configuration,
        publishedAt
      );
    const window = trelloActionsQuery({
      cursor,
      now: new Date(
        "2026-09-23T08:02:00.000Z"
      ),
    });
    const result =
      processTrelloActionsPage({
        actions: [apiAction()],
        configuration,
        windowStartMs:
          window.windowStartMs,
        windowEndMs:
          window.windowEndMs,
        page: window.page,
      });

    assert.equal(result.events.length, 1);
  }
);

test(
  "can process existing cards from the beginning",
  () => {
    const configuration =
      parsedConfiguration({
        startMode: "FROM_BEGINNING",
      });
    const cursor =
      createTrelloTriggerCursor(
        configuration,
        publishedAt
      );
    const window = trelloActionsQuery({
      cursor,
      now: publishedAt,
    });
    const result =
      processTrelloActionsPage({
        actions: [
          apiAction({
            date:
              "2025-01-01T00:00:00.000Z",
          }),
        ],
        configuration,
        windowStartMs:
          window.windowStartMs,
        windowEndMs:
          window.windowEndMs,
        page: window.page,
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
  "builds bounded Trello action queries",
  () => {
    const window = trelloActionsQuery({
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
      window.query.get("filter"),
      "createCard"
    );
    assert.equal(
      window.query.get("limit"),
      "100"
    );
    assert.equal(
      window.query.get("page"),
      "0"
    );
    assert.equal(
      window.query.get("since"),
      publishedAt.toISOString()
    );
    assert.equal(
      window.query.get("before"),
      "2026-09-23T08:02:00.001Z"
    );
  }
);

test(
  "keeps a frozen polling window while Trello actions are paginated",
  () => {
    const configuration =
      parsedConfiguration();
    const end = Date.parse(
      "2026-09-23T08:02:00.000Z"
    );
    const actions = Array.from(
      { length: 100 },
      (_, index) =>
        apiAction({
          id: index
            .toString(16)
            .padStart(24, "0"),
        })
    );
    const result =
      processTrelloActionsPage({
        actions,
        configuration,
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs: end,
        page: 0,
      });

    assert.deepEqual(result.cursor, {
      phase: "PAGING",
      windowStartMs:
        publishedAt.getTime(),
      windowEndMs: end,
      page: 1,
    });

    const nextWindow =
      trelloActionsQuery({
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
      "1"
    );
  }
);

test(
  "filters cards to the configured Trello list",
  () => {
    const configuration =
      parsedConfiguration({ listId });
    const result =
      processTrelloActionsPage({
        actions: [
          apiAction(),
          apiAction({
            id:
              "5abbe4b7ddc1b351ef961420",
            data: {
              ...apiAction().data,
              list: {
                id:
                  "5abbe4b7ddc1b351ef961421",
                name: "Doing",
              },
            },
          }),
        ],
        configuration,
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs: Date.parse(
          "2026-09-23T08:02:00.000Z"
        ),
        page: 0,
      });

    assert.equal(result.events.length, 1);
    assert.equal(
      result.events[0].input.list.id,
      listId
    );
  }
);

test(
  "maps Trello card, board, list, and creator fields",
  () => {
    const result =
      processTrelloActionsPage({
        actions: [apiAction()],
        configuration:
          parsedConfiguration(),
        windowStartMs:
          publishedAt.getTime(),
        windowEndMs: Date.parse(
          "2026-09-23T08:02:00.000Z"
        ),
        page: 0,
      });
    const input = result.events[0].input;

    assert.equal(
      input.card.name,
      "Investigate failed workflow"
    );
    assert.equal(
      input.board.name,
      "Synapse Development"
    );
    assert.equal(input.list.name, "To do");
    assert.equal(
      input.memberCreator.username,
      "octocat"
    );
  }
);

test(
  "overlaps completed polling windows for delayed Trello actions",
  () => {
    const window = trelloActionsQuery({
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
  "validates a published Trello trigger workflow",
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
              label: "New Trello card",
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

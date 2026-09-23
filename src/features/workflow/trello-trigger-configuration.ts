import type {
  IntegrationTriggerCursor,
} from "@/lib/db/schema/workflow-integration-trigger";

import type {
  WorkflowNodeData,
} from "./types";

export type TrelloTriggerStartMode =
  | "FROM_NOW"
  | "FROM_BEGINNING";

export type TrelloTriggerConfiguration = {
  triggerType: "TRELLO_NEW_CARD";
  integrationId: string;
  boardId: string;
  listId: string | null;
  startMode: TrelloTriggerStartMode;
  pollIntervalMinutes: number;
};

export type TrelloTriggerCursor =
  | {
      phase: "INITIAL" | "READY";
      checkpointMs: number;
    }
  | {
      phase: "PAGING";
      windowStartMs: number;
      windowEndMs: number;
      page: number;
    };

export type TrelloApiAction = {
  id?: unknown;
  idMemberCreator?: unknown;
  type?: unknown;
  date?: unknown;
  data?: unknown;
  memberCreator?: unknown;
};

export type TrelloDetectedEvent = {
  key: string;
  input: Record<string, unknown>;
};

export type TrelloPollingWindow = {
  query: URLSearchParams;
  windowStartMs: number;
  windowEndMs: number;
  page: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRELLO_ID_PATTERN =
  /^[0-9a-f]{24}$/i;
const POLL_INTERVALS = new Set([
  1,
  5,
  15,
  30,
  60,
]);
const MAX_PAGE = 1_000;
const MAX_ACTIONS_PER_PAGE = 100;
const POLL_OVERLAP_MS = 2 * 60_000;

export class TrelloTriggerError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrelloTriggerError";
  }
}

function readText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function record(
  value: unknown
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validEpochMilliseconds(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function nonNegativeInteger(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function trelloId(
  value: unknown
): string | null {
  const parsed = readText(value);

  return TRELLO_ID_PATTERN.test(parsed)
    ? parsed
    : null;
}

export function parseTrelloTriggerConfiguration(
  data: WorkflowNodeData
): TrelloTriggerConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.triggerType !==
    "TRELLO_NEW_CARD"
  ) {
    throw new TrelloTriggerError(
      `${data.label} is not a Trello new-card trigger.`
    );
  }

  const integrationId = readText(
    configuration.integrationId
  );

  if (!UUID_PATTERN.test(integrationId)) {
    throw new TrelloTriggerError(
      `${data.label} requires a valid Trello integration.`
    );
  }

  const boardId = trelloId(
    configuration.boardId
  );

  if (
    !boardId ||
    readText(
      configuration.boardId
    ).includes("{{")
  ) {
    throw new TrelloTriggerError(
      "Board ID must be a static 24-character Trello ID."
    );
  }

  const rawListId = readText(
    configuration.listId
  );
  const listId = rawListId
    ? trelloId(rawListId)
    : null;

  if (
    rawListId &&
    (!listId || rawListId.includes("{{"))
  ) {
    throw new TrelloTriggerError(
      "List ID must be empty or a static 24-character Trello ID."
    );
  }

  const startMode =
    configuration.startMode ===
    "FROM_BEGINNING"
      ? "FROM_BEGINNING"
      : configuration.startMode ===
          "FROM_NOW"
        ? "FROM_NOW"
        : null;

  if (!startMode) {
    throw new TrelloTriggerError(
      "Select when the trigger should start reading cards."
    );
  }

  const pollIntervalMinutes =
    configuration.pollIntervalMinutes;

  if (
    typeof pollIntervalMinutes !==
      "number" ||
    !POLL_INTERVALS.has(
      pollIntervalMinutes
    )
  ) {
    throw new TrelloTriggerError(
      "Select a supported polling interval."
    );
  }

  return {
    triggerType: "TRELLO_NEW_CARD",
    integrationId,
    boardId,
    listId,
    startMode,
    pollIntervalMinutes,
  };
}

export function createTrelloTriggerCursor(
  configuration: TrelloTriggerConfiguration,
  activatedAt: Date
): TrelloTriggerCursor {
  const activatedAtMs =
    activatedAt.getTime();

  if (
    !Number.isSafeInteger(
      activatedAtMs
    ) ||
    activatedAtMs < 0
  ) {
    throw new TrelloTriggerError(
      "The workflow activation time is invalid."
    );
  }

  return {
    phase: "INITIAL",
    checkpointMs:
      configuration.startMode ===
      "FROM_BEGINNING"
        ? 0
        : activatedAtMs,
  };
}

export function parseTrelloTriggerCursor(
  cursor: IntegrationTriggerCursor | null
): TrelloTriggerCursor | null {
  if (!cursor) return null;

  if (
    cursor.phase === "INITIAL" ||
    cursor.phase === "READY"
  ) {
    return validEpochMilliseconds(
      cursor.checkpointMs
    )
      ? {
          phase: cursor.phase,
          checkpointMs:
            cursor.checkpointMs,
        }
      : null;
  }

  if (cursor.phase !== "PAGING") {
    return null;
  }

  if (
    !validEpochMilliseconds(
      cursor.windowStartMs
    ) ||
    !validEpochMilliseconds(
      cursor.windowEndMs
    ) ||
    cursor.windowEndMs <
      cursor.windowStartMs ||
    !nonNegativeInteger(cursor.page) ||
    cursor.page > MAX_PAGE
  ) {
    return null;
  }

  return {
    phase: "PAGING",
    windowStartMs:
      cursor.windowStartMs,
    windowEndMs: cursor.windowEndMs,
    page: cursor.page,
  };
}

export function trelloActionsQuery({
  cursor,
  now,
}: {
  cursor: TrelloTriggerCursor;
  now: Date;
}): TrelloPollingWindow {
  const nowMs = now.getTime();

  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0
  ) {
    throw new TrelloTriggerError(
      "The Trello polling time is invalid."
    );
  }

  const windowStartMs =
    cursor.phase === "PAGING"
      ? cursor.windowStartMs
      : cursor.phase === "INITIAL"
        ? cursor.checkpointMs
        : Math.max(
            0,
            cursor.checkpointMs -
              POLL_OVERLAP_MS
          );
  const windowEndMs =
    cursor.phase === "PAGING"
      ? cursor.windowEndMs
      : Math.max(nowMs, windowStartMs);
  const page =
    cursor.phase === "PAGING"
      ? cursor.page
      : 0;
  const query = new URLSearchParams({
    filter: "createCard",
    fields:
      "id,idMemberCreator,type,date,data",
    limit: String(
      MAX_ACTIONS_PER_PAGE
    ),
    page: String(page),
    member: "false",
    memberCreator: "true",
    memberCreator_fields:
      "id,username,fullName",
  });

  if (windowStartMs > 0) {
    query.set(
      "since",
      new Date(windowStartMs)
        .toISOString()
    );
  }

  query.set(
    "before",
    new Date(windowEndMs + 1)
      .toISOString()
  );

  return {
    query,
    windowStartMs,
    windowEndMs,
    page,
  };
}

function memberData(value: unknown) {
  const source = record(value);

  if (!source) return null;

  return {
    id: readText(source.id),
    username: readText(
      source.username
    ),
    fullName: readText(
      source.fullName
    ),
  };
}

function detectedCard(
  action: TrelloApiAction,
  configuration: TrelloTriggerConfiguration,
  windowStartMs: number,
  windowEndMs: number
): TrelloDetectedEvent | null {
  if (action.type !== "createCard") {
    return null;
  }

  const id = trelloId(action.id);
  const date = readText(action.date);
  const dateMs = Date.parse(date);
  const data = record(action.data);
  const card = record(data?.card);
  const list = record(data?.list);
  const board = record(data?.board);
  const cardId = trelloId(card?.id);
  const listId = trelloId(list?.id);
  const boardId = trelloId(board?.id);

  if (
    !id ||
    !Number.isFinite(dateMs) ||
    dateMs < windowStartMs ||
    dateMs > windowEndMs ||
    !cardId ||
    !listId ||
    !boardId ||
    boardId !== configuration.boardId ||
    (configuration.listId &&
      listId !== configuration.listId)
  ) {
    return null;
  }

  return {
    key: id,
    input: {
      provider: "TRELLO",
      event: "NEW_CARD",
      actionId: id,
      createdAt: date,
      board: {
        id: boardId,
        name: readText(board?.name),
        shortLink: readText(
          board?.shortLink
        ),
      },
      list: {
        id: listId,
        name: readText(list?.name),
      },
      card: {
        id: cardId,
        name: readText(card?.name),
        idShort:
          typeof card?.idShort ===
            "number" &&
          Number.isSafeInteger(
            card.idShort
          )
            ? card.idShort
            : null,
        shortLink: readText(
          card?.shortLink
        ),
      },
      memberCreator:
        memberData(
          action.memberCreator
        ) ?? {
          id: readText(
            action.idMemberCreator
          ),
          username: "",
          fullName: "",
        },
    },
  };
}

export function processTrelloActionsPage({
  actions,
  configuration,
  windowStartMs,
  windowEndMs,
  page,
}: {
  actions: TrelloApiAction[];
  configuration: TrelloTriggerConfiguration;
  windowStartMs: number;
  windowEndMs: number;
  page: number;
}): {
  events: TrelloDetectedEvent[];
  cursor: TrelloTriggerCursor;
} {
  if (
    !nonNegativeInteger(page) ||
    page > MAX_PAGE
  ) {
    throw new TrelloTriggerError(
      "Trello returned an invalid action page."
    );
  }

  if (
    actions.length >
    MAX_ACTIONS_PER_PAGE
  ) {
    throw new TrelloTriggerError(
      "Trello returned too many actions."
    );
  }

  const events = actions.flatMap(
    (action) => {
      const event = detectedCard(
        action,
        configuration,
        windowStartMs,
        windowEndMs
      );

      return event ? [event] : [];
    }
  );
  const hasNextPage =
    actions.length ===
    MAX_ACTIONS_PER_PAGE;

  if (hasNextPage) {
    if (page >= MAX_PAGE) {
      throw new TrelloTriggerError(
        "Trello action pagination exceeded the supported limit."
      );
    }

    return {
      events,
      cursor: {
        phase: "PAGING",
        windowStartMs,
        windowEndMs,
        page: page + 1,
      },
    };
  }

  return {
    events,
    cursor: {
      phase: "READY",
      checkpointMs: windowEndMs,
    },
  };
}

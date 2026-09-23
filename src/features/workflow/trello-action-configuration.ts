import type {
  WorkflowNodeData,
} from "./types";

export type TrelloCardPosition =
  | "top"
  | "bottom";

export type TrelloActionConfiguration = {
  actionType: "TRELLO_CREATE_CARD";
  integrationId: string;
  listId: string;
  name: string;
  description: string;
  position: TrelloCardPosition;
  due: string | null;
  dueComplete: boolean;
  memberIds: string[];
  labelIds: string[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRELLO_ID_PATTERN =
  /^[0-9a-f]{24}$/i;
const MAX_NAME_LENGTH = 512;
const MAX_DESCRIPTION_LENGTH = 16_384;
const MAX_IDS = 100;

export class TrelloActionError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrelloActionError";
  }
}

function text(value: unknown): string {
  return typeof value === "string"
    ? value
    : "";
}

function parseIds(
  value: unknown,
  label: string
): string[] {
  if (
    value !== undefined &&
    value !== null &&
    typeof value !== "string" &&
    !Array.isArray(value)
  ) {
    throw new TrelloActionError(
      `${label} must be text or a list of text values.`
    );
  }

  if (
    (typeof value === "string" &&
      value.length > 10_000) ||
    (Array.isArray(value) &&
      value.length > MAX_IDS)
  ) {
    throw new TrelloActionError(
      `${label} are too large.`
    );
  }

  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/u)
      : [];
  const result: string[] = [];
  const seen = new Set<string>();
  const itemLabel = label
    .toLowerCase()
    .replace(/ ids$/u, " ID");

  for (const item of source) {
    if (typeof item !== "string") {
      throw new TrelloActionError(
        `Each ${itemLabel} must be text.`
      );
    }

    const parsed = item.trim();

    if (!parsed) continue;

    if (!TRELLO_ID_PATTERN.test(parsed)) {
      throw new TrelloActionError(
        `Each ${itemLabel} must be a 24-character Trello ID.`
      );
    }

    const key = parsed.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      result.push(parsed);
    }
  }

  if (result.length > MAX_IDS) {
    throw new TrelloActionError(
      `Use at most ${MAX_IDS} ${label.toLowerCase()}.`
    );
  }

  return result;
}

export function parseTrelloActionConfiguration(
  data: WorkflowNodeData
): TrelloActionConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.actionType !==
    "TRELLO_CREATE_CARD"
  ) {
    throw new TrelloActionError(
      `${data.label} is not a Trello create-card action.`
    );
  }

  const integrationId = text(
    configuration.integrationId
  ).trim();

  if (!UUID_PATTERN.test(integrationId)) {
    throw new TrelloActionError(
      `${data.label} requires a valid Trello integration.`
    );
  }

  const listId = text(
    configuration.listId
  ).trim();

  if (
    !TRELLO_ID_PATTERN.test(listId) ||
    listId.includes("{{")
  ) {
    throw new TrelloActionError(
      "List ID must be a static 24-character Trello ID."
    );
  }

  const name = text(
    configuration.name
  ).trim();

  if (
    !name ||
    name.length > MAX_NAME_LENGTH ||
    /[\r\n]/u.test(name)
  ) {
    throw new TrelloActionError(
      `${data.label} requires a single-line card name of at most ${MAX_NAME_LENGTH} characters.`
    );
  }

  const description = text(
    configuration.description
  );

  if (
    description.length >
    MAX_DESCRIPTION_LENGTH
  ) {
    throw new TrelloActionError(
      `Card description cannot exceed ${MAX_DESCRIPTION_LENGTH.toLocaleString("en-US")} characters.`
    );
  }

  const position =
    configuration.position === "top" ||
    configuration.position === "bottom"
      ? configuration.position
      : null;

  if (!position) {
    throw new TrelloActionError(
      "Select whether the new card belongs at the top or bottom of the list."
    );
  }

  const rawDue = text(
    configuration.due
  ).trim();
  let due: string | null = null;

  if (rawDue) {
    const dueMs = Date.parse(rawDue);

    if (!Number.isFinite(dueMs)) {
      throw new TrelloActionError(
        "Due date must be empty or a valid date and time."
      );
    }

    due = new Date(dueMs).toISOString();
  }

  if (
    typeof configuration.dueComplete !==
    "boolean"
  ) {
    throw new TrelloActionError(
      "Due-date completion must be true or false."
    );
  }

  return {
    actionType: "TRELLO_CREATE_CARD",
    integrationId,
    listId,
    name,
    description,
    position,
    due,
    dueComplete:
      configuration.dueComplete,
    memberIds: parseIds(
      configuration.memberIds,
      "Member IDs"
    ),
    labelIds: parseIds(
      configuration.labelIds,
      "Label IDs"
    ),
  };
}

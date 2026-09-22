import type {
  IntegrationTriggerCursor,
} from "@/lib/db/schema/workflow-integration-trigger";

import type {
  WorkflowNodeData,
} from "./types";

export type GmailTriggerStartMode =
  | "FROM_NOW"
  | "FROM_BEGINNING";

export type GmailTriggerLabel =
  | "ALL"
  | "INBOX"
  | "UNREAD"
  | "STARRED"
  | "IMPORTANT";

export type GmailTriggerConfiguration = {
  triggerType: "GMAIL_NEW_EMAIL";
  integrationId: string;
  labelId: GmailTriggerLabel;
  searchQuery: string;
  startMode: GmailTriggerStartMode;
  pollIntervalMinutes: number;
};

export type GmailTriggerCursor =
  | {
      phase: "INITIAL" | "READY";
      checkpointMs: number;
    }
  | {
      phase: "PAGING";
      windowStartMs: number;
      windowEndMs: number;
      pageToken: string;
    };

export type GmailMessageListPage = {
  messages?: unknown;
  nextPageToken?: unknown;
};

export type GmailApiMessage = {
  id?: unknown;
  threadId?: unknown;
  labelIds?: unknown;
  snippet?: unknown;
  historyId?: unknown;
  internalDate?: unknown;
  payload?: unknown;
};

export type GmailDetectedEvent = {
  key: string;
  input: Record<string, unknown>;
};

export type GmailPollingWindow = {
  query: URLSearchParams;
  windowStartMs: number;
  windowEndMs: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const POLL_INTERVALS = new Set([
  1,
  5,
  15,
  30,
  60,
]);

const LABELS =
  new Set<GmailTriggerLabel>([
    "ALL",
    "INBOX",
    "UNREAD",
    "STARRED",
    "IMPORTANT",
  ]);

const MAX_SEARCH_QUERY_LENGTH = 500;
const MAX_PAGE_TOKEN_LENGTH = 4_096;
const MAX_MESSAGES_PER_POLL = 25;
const POLL_OVERLAP_MS = 60_000;
const MAX_BODY_CHARACTERS = 100_000;
const MAX_MIME_DEPTH = 20;
const MAX_MIME_PARTS = 200;

export class GmailTriggerError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailTriggerError";
  }
}

function readText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
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

function record(
  value: unknown
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalText(value: unknown) {
  return typeof value === "string"
    ? value
    : null;
}

export function parseGmailTriggerConfiguration(
  data: WorkflowNodeData
): GmailTriggerConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.triggerType !==
    "GMAIL_NEW_EMAIL"
  ) {
    throw new GmailTriggerError(
      `${data.label} is not a Gmail new-email trigger.`
    );
  }

  const integrationId = readText(
    configuration.integrationId
  );

  if (!UUID_PATTERN.test(integrationId)) {
    throw new GmailTriggerError(
      `${data.label} requires a valid Gmail integration.`
    );
  }

  const labelId =
    typeof configuration.labelId ===
      "string" &&
    LABELS.has(
      configuration.labelId as GmailTriggerLabel
    )
      ? (configuration.labelId as GmailTriggerLabel)
      : null;

  if (!labelId) {
    throw new GmailTriggerError(
      "Select a supported Gmail message category."
    );
  }

  const searchQuery = readText(
    configuration.searchQuery
  );

  if (
    searchQuery.length >
      MAX_SEARCH_QUERY_LENGTH ||
    searchQuery.includes("{{") ||
    /[\r\n\u0000-\u001f\u007f]/u.test(
      searchQuery
    )
  ) {
    throw new GmailTriggerError(
      "Gmail search must be a static single-line query of at most 500 characters."
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
    throw new GmailTriggerError(
      "Select when the trigger should start reading emails."
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
    throw new GmailTriggerError(
      "Select a supported polling interval."
    );
  }

  return {
    triggerType: "GMAIL_NEW_EMAIL",
    integrationId,
    labelId,
    searchQuery,
    startMode,
    pollIntervalMinutes,
  };
}

export function createGmailTriggerCursor(
  configuration: GmailTriggerConfiguration,
  activatedAt: Date
): GmailTriggerCursor {
  const activatedAtMs =
    activatedAt.getTime();

  if (
    !Number.isSafeInteger(
      activatedAtMs
    ) ||
    activatedAtMs < 0
  ) {
    throw new GmailTriggerError(
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

export function parseGmailTriggerCursor(
  cursor: IntegrationTriggerCursor | null
): GmailTriggerCursor | null {
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

  const pageToken = readText(
    cursor.pageToken
  );

  if (
    !validEpochMilliseconds(
      cursor.windowStartMs
    ) ||
    !validEpochMilliseconds(
      cursor.windowEndMs
    ) ||
    cursor.windowEndMs <
      cursor.windowStartMs ||
    !pageToken ||
    pageToken.length >
      MAX_PAGE_TOKEN_LENGTH
  ) {
    return null;
  }

  return {
    phase: "PAGING",
    windowStartMs:
      cursor.windowStartMs,
    windowEndMs: cursor.windowEndMs,
    pageToken,
  };
}

export function gmailMessagesQuery({
  configuration,
  cursor,
  now,
}: {
  configuration: GmailTriggerConfiguration;
  cursor: GmailTriggerCursor;
  now: Date;
}): GmailPollingWindow {
  const nowMs = now.getTime();

  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0
  ) {
    throw new GmailTriggerError(
      "The Gmail polling time is invalid."
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
      : Math.max(
          nowMs,
          windowStartMs
        );

  const terms: string[] = [];

  if (configuration.searchQuery) {
    terms.push(
      `(${configuration.searchQuery})`
    );
  }

  if (windowStartMs > 0) {
    terms.push(
      `after:${Math.max(
        0,
        Math.floor(
          windowStartMs / 1_000
        ) - 1
      )}`
    );
  }

  terms.push(
    `before:${
      Math.floor(
        windowEndMs / 1_000
      ) + 2
    }`
  );

  const query = new URLSearchParams({
    maxResults:
      String(MAX_MESSAGES_PER_POLL),
    includeSpamTrash: "false",
    q: terms.join(" "),
  });

  if (
    configuration.labelId !== "ALL"
  ) {
    query.append(
      "labelIds",
      configuration.labelId
    );
  }

  if (cursor.phase === "PAGING") {
    query.set(
      "pageToken",
      cursor.pageToken
    );
  }

  return {
    query,
    windowStartMs,
    windowEndMs,
  };
}

export function parseGmailMessageList(
  page: GmailMessageListPage
) {
  if (page.messages === undefined) {
    return [];
  }

  if (!Array.isArray(page.messages)) {
    throw new GmailTriggerError(
      "Gmail returned invalid message data."
    );
  }

  return page.messages
    .slice(0, MAX_MESSAGES_PER_POLL)
    .map((item) => {
      const source = record(item);
      const id = readText(source?.id);

      if (
        !id ||
        id.length > 1_024
      ) {
        throw new GmailTriggerError(
          "Gmail returned an invalid message ID."
        );
      }

      return id;
    });
}

function headerMap(payload: unknown) {
  const source = record(payload);
  const headers = source?.headers;
  const result =
    new Map<string, string>();

  if (!Array.isArray(headers)) {
    return result;
  }

  for (
    const item of headers.slice(0, 200)
  ) {
    const header = record(item);
    const name = readText(
      header?.name
    ).toLowerCase();
    const value = optionalText(
      header?.value
    );

    if (
      name &&
      value !== null &&
      !result.has(name)
    ) {
      result.set(name, value);
    }
  }

  return result;
}

function decodeBody(value: unknown) {
  if (
    typeof value !== "string" ||
    !value
  ) {
    return "";
  }

  try {
    const normalized = value
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(
        Math.ceil(
          value.length / 4
        ) * 4,
        "="
      );

    const binary = atob(normalized);

    const bytes = Uint8Array.from(
      binary,
      (character) =>
        character.charCodeAt(0)
    );

    return new TextDecoder()
      .decode(bytes)
      .slice(
        0,
        MAX_BODY_CHARACTERS
      );
  } catch {
    return "";
  }
}

function messageBodies(payload: unknown) {
  const bodies = {
    text: "",
    html: "",
  };

  const queue: Array<{
    value: unknown;
    depth: number;
  }> = [
    {
      value: payload,
      depth: 0,
    },
  ];

  let visited = 0;

  while (
    queue.length > 0 &&
    visited < MAX_MIME_PARTS
  ) {
    const current = queue.shift();

    if (!current) break;

    visited += 1;

    const part = record(
      current.value
    );

    if (!part) continue;

    const mimeType = readText(
      part.mimeType
    ).toLowerCase();

    const body = record(part.body);

    const content = decodeBody(
      body?.data
    );

    if (
      mimeType === "text/plain" &&
      content &&
      bodies.text.length <
        MAX_BODY_CHARACTERS
    ) {
      bodies.text =
        `${bodies.text}${
          bodies.text ? "\n" : ""
        }${content}`.slice(
          0,
          MAX_BODY_CHARACTERS
        );
    }

    if (
      mimeType === "text/html" &&
      content &&
      bodies.html.length <
        MAX_BODY_CHARACTERS
    ) {
      bodies.html =
        `${bodies.html}${
          bodies.html ? "\n" : ""
        }${content}`.slice(
          0,
          MAX_BODY_CHARACTERS
        );
    }

    if (
      current.depth >=
        MAX_MIME_DEPTH ||
      !Array.isArray(part.parts)
    ) {
      continue;
    }

    for (const child of part.parts) {
      queue.push({
        value: child,
        depth: current.depth + 1,
      });
    }
  }

  return bodies;
}

function labelIds(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter(
          (
            item
          ): item is string =>
            typeof item ===
            "string"
        )
        .slice(0, 100)
    : [];
}

function detectedMessage(
  item: GmailApiMessage,
  windowStartMs: number,
  windowEndMs: number
): GmailDetectedEvent | null {
  const id = readText(item.id);

  const internalDate = readText(
    item.internalDate
  );

  const receivedAtMs = Number(
    internalDate
  );

  if (
    !id ||
    id.length > 1_024 ||
    !Number.isSafeInteger(
      receivedAtMs
    ) ||
    receivedAtMs < windowStartMs ||
    receivedAtMs > windowEndMs
  ) {
    return null;
  }

  const headers = headerMap(
    item.payload
  );

  const bodies = messageBodies(
    item.payload
  );

  return {
    key: id,
    input: {
      provider: "GMAIL",
      event: "NEW_EMAIL",
      id,
      threadId:
        optionalText(
          item.threadId
        ),
      historyId:
        optionalText(
          item.historyId
        ),
      receivedAt: new Date(
        receivedAtMs
      ).toISOString(),
      labelIds: labelIds(
        item.labelIds
      ),
      snippet:
        optionalText(
          item.snippet
        ) ?? "",
      from:
        headers.get("from") ?? "",
      to:
        headers.get("to") ?? "",
      cc:
        headers.get("cc") ?? "",
      bcc:
        headers.get("bcc") ?? "",
      replyTo:
        headers.get("reply-to") ??
        "",
      subject:
        headers.get("subject") ??
        "",
      sentAt:
        headers.get("date") ?? "",
      messageId:
        headers.get("message-id") ??
        "",
      textBody: bodies.text,
      htmlBody: bodies.html,
    },
  };
}

export function processGmailMessagesPage({
  page,
  messages,
  windowStartMs,
  windowEndMs,
}: {
  page: GmailMessageListPage;
  messages: GmailApiMessage[];
  windowStartMs: number;
  windowEndMs: number;
}): {
  events: GmailDetectedEvent[];
  cursor: GmailTriggerCursor;
} {
  const events = messages.flatMap(
    (message) => {
      const event = detectedMessage(
        message,
        windowStartMs,
        windowEndMs
      );

      return event ? [event] : [];
    }
  );

  const nextPageToken = readText(
    page.nextPageToken
  );

  if (
    nextPageToken.length >
    MAX_PAGE_TOKEN_LENGTH
  ) {
    throw new GmailTriggerError(
      "Gmail returned an invalid page token."
    );
  }

  if (nextPageToken) {
    return {
      events,
      cursor: {
        phase: "PAGING",
        windowStartMs,
        windowEndMs,
        pageToken: nextPageToken,
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
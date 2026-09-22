import type {
  IntegrationTriggerCursor,
} from "@/lib/db/schema/workflow-integration-trigger";

import type {
  WorkflowNodeData,
} from "./types";

export type GoogleCalendarTriggerStartMode =
  | "FROM_NOW"
  | "FROM_BEGINNING";

export type GoogleCalendarTriggerConfiguration = {
  triggerType: "GOOGLE_CALENDAR_NEW_EVENT";
  integrationId: string;
  calendarId: string;
  startMode: GoogleCalendarTriggerStartMode;
  pollIntervalMinutes: number;
};

export type GoogleCalendarTriggerCursor = {
  phase: "BOOTSTRAP" | "SYNC";
  startedAt: string;
  lastSyncedAt: string;
  emitBootstrap: boolean;
  pageToken?: string;
  syncToken?: string;
};

export type GoogleCalendarApiEvent = {
  id?: unknown;
  status?: unknown;
  summary?: unknown;
  description?: unknown;
  location?: unknown;
  htmlLink?: unknown;
  hangoutLink?: unknown;
  created?: unknown;
  updated?: unknown;
  start?: unknown;
  end?: unknown;
  creator?: unknown;
  organizer?: unknown;
  attendees?: unknown;
  recurringEventId?: unknown;
};

export type GoogleCalendarEventsPage = {
  items?: unknown;
  nextPageToken?: unknown;
  nextSyncToken?: unknown;
};

export type GoogleCalendarDetectedEvent = {
  key: string;
  input: Record<string, unknown>;
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

const MAX_CALENDAR_ID_LENGTH = 1_024;

export class GoogleCalendarTriggerError
  extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "GoogleCalendarTriggerError";
  }
}

function readText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function validDateTime(value: unknown) {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    !Number.isNaN(Date.parse(value))
  );
}

export function parseGoogleCalendarTriggerConfiguration(
  data: WorkflowNodeData
): GoogleCalendarTriggerConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.triggerType !==
    "GOOGLE_CALENDAR_NEW_EVENT"
  ) {
    throw new GoogleCalendarTriggerError(
      `${data.label} is not a Google Calendar new-event trigger.`
    );
  }

  const integrationId = readText(
    configuration.integrationId
  );

  if (!UUID_PATTERN.test(integrationId)) {
    throw new GoogleCalendarTriggerError(
      `${data.label} requires a valid Google Calendar integration.`
    );
  }

  const calendarId =
    readText(configuration.calendarId) ||
    "primary";

  if (
    calendarId.length >
      MAX_CALENDAR_ID_LENGTH ||
    calendarId.includes("{{")
  ) {
    throw new GoogleCalendarTriggerError(
      "Calendar ID must be a static value of at most 1,024 characters."
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
    throw new GoogleCalendarTriggerError(
      "Select when the trigger should start reading events."
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
    throw new GoogleCalendarTriggerError(
      "Select a supported polling interval."
    );
  }

  return {
    triggerType:
      "GOOGLE_CALENDAR_NEW_EVENT",
    integrationId,
    calendarId,
    startMode,
    pollIntervalMinutes,
  };
}

export function createGoogleCalendarTriggerCursor(
  configuration: GoogleCalendarTriggerConfiguration,
  now: Date
): GoogleCalendarTriggerCursor {
  const timestamp = now.toISOString();

  return {
    phase: "BOOTSTRAP",
    startedAt: timestamp,
    lastSyncedAt: timestamp,
    emitBootstrap:
      configuration.startMode ===
      "FROM_BEGINNING",
  };
}

export function parseGoogleCalendarTriggerCursor(
  cursor: IntegrationTriggerCursor | null
): GoogleCalendarTriggerCursor | null {
  const startedAt = readText(
    cursor?.startedAt
  );

  const lastSyncedAt = readText(
    cursor?.lastSyncedAt
  );

  if (
    !cursor ||
    (cursor.phase !== "BOOTSTRAP" &&
      cursor.phase !== "SYNC") ||
    !validDateTime(startedAt) ||
    !validDateTime(lastSyncedAt) ||
    typeof cursor.emitBootstrap !==
      "boolean"
  ) {
    return null;
  }

  const pageToken = readText(
    cursor.pageToken
  );

  const syncToken = readText(
    cursor.syncToken
  );

  if (
    (cursor.phase === "SYNC" &&
      !syncToken) ||
    pageToken.length > 4_096 ||
    syncToken.length > 4_096
  ) {
    return null;
  }

  return {
    phase: cursor.phase,
    startedAt,
    lastSyncedAt,
    emitBootstrap:
      cursor.emitBootstrap,
    ...(pageToken
      ? { pageToken }
      : {}),
    ...(syncToken
      ? { syncToken }
      : {}),
  };
}

export function googleCalendarEventsQuery(
  cursor: GoogleCalendarTriggerCursor
) {
  const query = new URLSearchParams({
    maxResults: "100",
    showDeleted: "true",
    singleEvents: "false",
  });

  if (cursor.phase === "SYNC") {
    query.set(
      "syncToken",
      cursor.syncToken ?? ""
    );
  } else {
    query.set(
      "timeMin",
      cursor.startedAt
    );
  }

  if (cursor.pageToken) {
    query.set(
      "pageToken",
      cursor.pageToken
    );
  }

  return query;
}

function record(
  value: unknown
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<
        string,
        unknown
      >)
    : null;
}

function optionalText(value: unknown) {
  return typeof value === "string"
    ? value
    : null;
}

function eventDateTime(value: unknown) {
  const source = record(value);

  if (!source) {
    return null;
  }

  return {
    dateTime: optionalText(
      source.dateTime
    ),
    date: optionalText(source.date),
    timeZone: optionalText(
      source.timeZone
    ),
  };
}

function person(value: unknown) {
  const source = record(value);

  if (!source) {
    return null;
  }

  return {
    email: optionalText(source.email),
    displayName: optionalText(
      source.displayName
    ),
    self: source.self === true,
  };
}

function attendees(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 200).flatMap(
    (item) => {
      const source = record(item);

      if (!source) {
        return [];
      }

      return [
        {
          email: optionalText(
            source.email
          ),
          displayName: optionalText(
            source.displayName
          ),
          responseStatus: optionalText(
            source.responseStatus
          ),
          organizer:
            source.organizer === true,
          self: source.self === true,
        },
      ];
    }
  );
}

function parsePageItems(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new GoogleCalendarTriggerError(
      "Google Calendar returned invalid event data."
    );
  }

  return value.map((item) => {
    const source = record(item);

    if (!source) {
      throw new GoogleCalendarTriggerError(
        "Google Calendar returned invalid event data."
      );
    }

    return source as GoogleCalendarApiEvent;
  });
}

function detectedEvent(
  configuration: GoogleCalendarTriggerConfiguration,
  item: GoogleCalendarApiEvent
): GoogleCalendarDetectedEvent | null {
  const id = readText(item.id);

  const createdAt = readText(
    item.created
  );

  if (
    !id ||
    id.length > 1_024 ||
    !validDateTime(createdAt) ||
    item.status === "cancelled"
  ) {
    return null;
  }

  return {
    key: `${configuration.calendarId}:${id}`,
    input: {
      provider: "GOOGLE_CALENDAR",
      event: "NEW_EVENT",
      calendarId:
        configuration.calendarId,
      id,
      status:
        optionalText(item.status),
      title:
        optionalText(item.summary) ??
        "",
      description:
        optionalText(
          item.description
        ) ?? "",
      location:
        optionalText(item.location) ??
        "",
      htmlLink:
        optionalText(item.htmlLink),
      hangoutLink:
        optionalText(item.hangoutLink),
      createdAt,
      updatedAt:
        optionalText(item.updated),
      start: eventDateTime(item.start),
      end: eventDateTime(item.end),
      creator: person(item.creator),
      organizer: person(item.organizer),
      attendees: attendees(
        item.attendees
      ),
      recurringEventId:
        optionalText(
          item.recurringEventId
        ),
    },
  };
}

export function processGoogleCalendarEventsPage({
  configuration,
  cursor,
  page,
  now,
}: {
  configuration: GoogleCalendarTriggerConfiguration;
  cursor: GoogleCalendarTriggerCursor;
  page: GoogleCalendarEventsPage;
  now: Date;
}): {
  events: GoogleCalendarDetectedEvent[];
  cursor: GoogleCalendarTriggerCursor;
} {
  const items = parsePageItems(
    page.items
  );

  const requiresNewEvent =
    cursor.phase === "SYNC" ||
    !cursor.emitBootstrap;

  const startedAt = Date.parse(
    cursor.startedAt
  );

  const events = items.flatMap(
    (item) => {
      const event = detectedEvent(
        configuration,
        item
      );

      if (!event) {
        return [];
      }

      if (
        requiresNewEvent &&
        Date.parse(
          event.input
            .createdAt as string
        ) < startedAt
      ) {
        return [];
      }

      return [event];
    }
  );

  const nextPageToken = readText(
    page.nextPageToken
  );

  if (nextPageToken) {
    return {
      events,
      cursor: {
        ...cursor,
        pageToken: nextPageToken,
      },
    };
  }

  const nextSyncToken = readText(
    page.nextSyncToken
  );

  if (!nextSyncToken) {
    throw new GoogleCalendarTriggerError(
      "Google Calendar did not return a synchronization token."
    );
  }

  return {
    events,
    cursor: {
      phase: "SYNC",
      startedAt: cursor.startedAt,
      lastSyncedAt:
        now.toISOString(),
      emitBootstrap: false,
      syncToken: nextSyncToken,
    },
  };
}

export function recoverGoogleCalendarTriggerCursor(
  cursor: GoogleCalendarTriggerCursor
): GoogleCalendarTriggerCursor {
  return {
    phase: "BOOTSTRAP",
    startedAt: cursor.lastSyncedAt,
    lastSyncedAt: cursor.lastSyncedAt,
    emitBootstrap: true,
  };
}
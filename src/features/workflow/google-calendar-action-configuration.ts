import type {
  WorkflowNodeData,
} from "./types";

export type GoogleCalendarActionConfiguration = {
  actionType:
    "GOOGLE_CALENDAR_CREATE_EVENT";
  integrationId: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  attendees: string[];
  sendUpdates: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class GoogleCalendarActionError
  extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "GoogleCalendarActionError";
  }
}

function readText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function validateTimeZone(
  timeZone: string
) {
  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
      }
    ).format();
  } catch {
    throw new GoogleCalendarActionError(
      "Select a valid IANA timezone."
    );
  }
}

function parseAttendees(
  value: unknown
): string[] {
  const source =
    typeof value === "string"
      ? value
      : "";

  if (source.length > 5_000) {
    throw new GoogleCalendarActionError(
      "The attendee list is too long."
    );
  }

  const attendees = source
    .split(/[\n,;]/)
    .map((email) => email.trim())
    .filter(Boolean);

  if (attendees.length > 50) {
    throw new GoogleCalendarActionError(
      "Add at most 50 attendees."
    );
  }

  const unique = new Map<
    string,
    string
  >();

  for (const email of attendees) {
    if (
      email.length > 254 ||
      !EMAIL_PATTERN.test(email)
    ) {
      throw new GoogleCalendarActionError(
        `Invalid attendee email: ${email}.`
      );
    }

    const normalizedEmail =
      email.toLowerCase();

    if (
      !unique.has(normalizedEmail)
    ) {
      unique.set(
        normalizedEmail,
        email
      );
    }
  }

  return [...unique.values()];
}

export function parseGoogleCalendarActionConfiguration(
  data: WorkflowNodeData
): GoogleCalendarActionConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.actionType !==
    "GOOGLE_CALENDAR_CREATE_EVENT"
  ) {
    throw new GoogleCalendarActionError(
      `${data.label} is not a Google Calendar create-event action.`
    );
  }

  const integrationId = readText(
    configuration.integrationId
  );

  if (
    !UUID_PATTERN.test(integrationId)
  ) {
    throw new GoogleCalendarActionError(
      `${data.label} requires a valid Google Calendar integration.`
    );
  }

  const calendarId =
    readText(
      configuration.calendarId
    ) || "primary";

  if (
    calendarId.length > 1_024 ||
    calendarId.includes("{{")
  ) {
    throw new GoogleCalendarActionError(
      "Calendar ID must be a static value of at most 1,024 characters."
    );
  }

  const title = readText(
    configuration.title
  );

  if (
    !title ||
    title.length > 1_024
  ) {
    throw new GoogleCalendarActionError(
      `${data.label} requires an event title of at most 1,024 characters.`
    );
  }

  const description =
    typeof configuration.description ===
    "string"
      ? configuration.description
      : "";

  if (description.length > 8_192) {
    throw new GoogleCalendarActionError(
      "Event description cannot exceed 8,192 characters."
    );
  }

  const location =
    typeof configuration.location ===
    "string"
      ? configuration.location
      : "";

  if (location.length > 1_024) {
    throw new GoogleCalendarActionError(
      "Event location cannot exceed 1,024 characters."
    );
  }

  const startDateTime = readText(
    configuration.startDateTime
  );

  const endDateTime = readText(
    configuration.endDateTime
  );

  if (
    !DATE_TIME_PATTERN.test(
      startDateTime
    ) ||
    Number.isNaN(
      Date.parse(startDateTime)
    )
  ) {
    throw new GoogleCalendarActionError(
      "Enter a valid event start date and time."
    );
  }

  if (
    !DATE_TIME_PATTERN.test(
      endDateTime
    ) ||
    Number.isNaN(
      Date.parse(endDateTime)
    )
  ) {
    throw new GoogleCalendarActionError(
      "Enter a valid event end date and time."
    );
  }

  if (
    Date.parse(endDateTime) <=
    Date.parse(startDateTime)
  ) {
    throw new GoogleCalendarActionError(
      "Event end time must be after its start time."
    );
  }

  const timeZone =
    readText(
      configuration.timeZone
    ) || "UTC";

  if (
    timeZone.length > 100 ||
    timeZone.includes("{{")
  ) {
    throw new GoogleCalendarActionError(
      "Timezone must be a static value of at most 100 characters."
    );
  }

  validateTimeZone(timeZone);

  return {
    actionType:
      "GOOGLE_CALENDAR_CREATE_EVENT",
    integrationId,
    calendarId,
    title,
    description,
    location,
    startDateTime,
    endDateTime,
    timeZone,
    attendees: parseAttendees(
      configuration.attendees
    ),
    sendUpdates:
      configuration.sendUpdates ===
      true,
  };
}
import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  GoogleCalendarActionError,
  parseGoogleCalendarActionConfiguration,
} from "./google-calendar-action-configuration";
import type {
  WorkflowNodeData,
} from "./types";

type ExecuteGoogleCalendarActionOptions = {
  runId: string;
  workflowId: string;
  nodeId: string;
  data: WorkflowNodeData;
};

type GoogleCalendarEvent = {
  id?: unknown;
  status?: unknown;
  htmlLink?: unknown;
  summary?: unknown;
  start?: unknown;
  end?: unknown;
};

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 20_000;

function eventIdForExecution({
  runId,
  nodeId,
}: {
  runId: string;
  nodeId: string;
}) {
  return createHash("sha256")
    .update(`${runId}:${nodeId}`)
    .digest("hex");
}

async function readLimitedBody(
  response: Response
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader =
    response.body.getReader();
  const decoder = new TextDecoder();

  let bytes = 0;
  let result = "";

  try {
    while (true) {
      const chunk =
        await reader.read();

      if (chunk.done) {
        break;
      }

      bytes +=
        chunk.value.byteLength;

      if (bytes > MAX_RESPONSE_BYTES) {
        throw new GoogleCalendarActionError(
          "Google Calendar returned an unexpectedly large response."
        );
      }

      result += decoder.decode(
        chunk.value,
        {
          stream: true,
        }
      );
    }

    result += decoder.decode();

    return result;
  } finally {
    await reader
      .cancel()
      .catch(() => undefined);
  }
}

function parseEvent(
  body: string
): GoogleCalendarEvent {
  try {
    const value: unknown =
      JSON.parse(body);

    if (
      typeof value !== "object" ||
      value === null
    ) {
      throw new Error();
    }

    return value as GoogleCalendarEvent;
  } catch {
    throw new GoogleCalendarActionError(
      "Google Calendar returned an invalid response."
    );
  }
}

function readProviderError(
  body: string
): string {
  try {
    const value = JSON.parse(body) as {
      error?: {
        message?: unknown;
      };
    };

    return typeof value.error
      ?.message === "string"
      ? value.error.message.slice(
          0,
          500
        )
      : "";
  } catch {
    return "";
  }
}

async function requestExistingEvent({
  calendarId,
  eventId,
  accessToken,
}: {
  calendarId: string;
  eventId: string;
  accessToken: string;
}): Promise<GoogleCalendarEvent | null> {
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${
      encodeURIComponent(calendarId)
    }/events/${encodeURIComponent(eventId)}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        Accept: "application/json",
        "User-Agent":
          "Synapse-Workflow/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      ),
    });
  } catch {
    return null;
  }

  const body =
    await readLimitedBody(response);

  if (!response.ok) {
    return null;
  }

  return parseEvent(body);
}

export async function executeGoogleCalendarAction({
  runId,
  workflowId,
  nodeId,
  data,
}: ExecuteGoogleCalendarActionOptions): Promise<
  Record<string, unknown>
> {
  const configuration =
    parseGoogleCalendarActionConfiguration(
      data
    );

  const integration =
    await resolveWorkflowIntegration({
      workflowId,
      integrationId:
        configuration.integrationId,
      provider: "GOOGLE_CALENDAR",
    });

  const accessToken =
    integration.credentials.accessToken;

  if (!accessToken) {
    throw new WorkflowIntegrationError(
      "The Google Calendar integration does not contain an access token."
    );
  }

  const eventId =
    eventIdForExecution({
      runId,
      nodeId,
    });

  const query = new URLSearchParams({
    sendUpdates:
      configuration.sendUpdates &&
      configuration.attendees.length > 0
        ? "all"
        : "none",
  });

  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${
      encodeURIComponent(
        configuration.calendarId
      )
    }/events?${query.toString()}`;

  const requestBody = {
    id: eventId,
    summary: configuration.title,
    start: {
      dateTime:
        configuration.startDateTime,
      timeZone:
        configuration.timeZone,
    },
    end: {
      dateTime:
        configuration.endDateTime,
      timeZone:
        configuration.timeZone,
    },
    ...(configuration.description
      ? {
          description:
            configuration.description,
        }
      : {}),
    ...(configuration.location
      ? {
          location:
            configuration.location,
        }
      : {}),
    ...(configuration.attendees.length >
    0
      ? {
          attendees:
            configuration.attendees.map(
              (email) => ({
                email,
              })
            ),
        }
      : {}),
  };

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json",
        Accept: "application/json",
        "User-Agent":
          "Synapse-Workflow/1.0",
      },
      body: JSON.stringify(
        requestBody
      ),
      redirect: "error",
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      ),
    });
  } catch (error) {
    if (
      error instanceof
      WorkflowIntegrationError
    ) {
      throw error;
    }

    if (
      error instanceof Error &&
      (error.name ===
        "TimeoutError" ||
        error.name === "AbortError")
    ) {
      throw new GoogleCalendarActionError(
        "Google Calendar request timed out."
      );
    }

    throw new GoogleCalendarActionError(
      "Google Calendar request failed."
    );
  }

  const responseBody =
    await readLimitedBody(response);

  let event: GoogleCalendarEvent;
  let recoveredFromRetry = false;

  if (response.status === 409) {
    const existing =
      await requestExistingEvent({
        calendarId:
          configuration.calendarId,
        eventId,
        accessToken,
      });

    if (!existing) {
      throw new GoogleCalendarActionError(
        "Google Calendar reported an event ID conflict."
      );
    }

    event = existing;
    recoveredFromRetry = true;
  } else {
    if (!response.ok) {
      const providerMessage =
        readProviderError(responseBody);

      throw new GoogleCalendarActionError(
        `Google Calendar event creation failed (${response.status})${
          providerMessage
            ? `: ${providerMessage}`
            : "."
        }`
      );
    }

    event =
      parseEvent(responseBody);
  }

  if (typeof event.id !== "string") {
    throw new GoogleCalendarActionError(
      "Google Calendar did not return an event ID."
    );
  }

  return {
    success: true,
    provider: "GOOGLE_CALENDAR",
    integrationId: integration.id,
    integrationName:
      integration.name,
    eventId: event.id,
    eventStatus:
      typeof event.status === "string"
        ? event.status
        : null,
    eventUrl:
      typeof event.htmlLink ===
      "string"
        ? event.htmlLink
        : null,
    title:
      typeof event.summary === "string"
        ? event.summary
        : configuration.title,
    start: event.start ?? null,
    end: event.end ?? null,
    recoveredFromRetry,
    message:
      "Google Calendar event created successfully.",
  };
}
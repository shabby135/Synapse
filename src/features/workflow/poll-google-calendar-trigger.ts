import "server-only";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  createGoogleCalendarTriggerCursor,
  googleCalendarEventsQuery,
  type GoogleCalendarEventsPage,
  GoogleCalendarTriggerError,
  parseGoogleCalendarTriggerConfiguration,
  parseGoogleCalendarTriggerCursor,
  processGoogleCalendarEventsPage,
  recoverGoogleCalendarTriggerCursor,
} from "./google-calendar-trigger-configuration";
import type {
  IntegrationTriggerHandler,
} from "./integration-trigger-registry";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_000_000;

async function readLimitedBody(
  response: Response
) {
  if (!response.body) {
    return "";
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let received = 0;
  let result = "";

  try {
    while (true) {
      const chunk =
        await reader.read();

      if (chunk.done) {
        break;
      }

      received +=
        chunk.value.byteLength;

      if (
        received >
        MAX_RESPONSE_BYTES
      ) {
        throw new GoogleCalendarTriggerError(
          "Google Calendar returned too much event data."
        );
      }

      result += decoder.decode(
        chunk.value,
        {
          stream: true,
        }
      );
    }

    return (
      result + decoder.decode()
    );
  } finally {
    await reader
      .cancel()
      .catch(() => undefined);
  }
}

function providerError(
  body: string
) {
  try {
    const parsed = JSON.parse(
      body
    ) as {
      error?: {
        message?: unknown;
      };
    };

    return typeof parsed.error
      ?.message === "string"
      ? parsed.error.message.slice(
          0,
          500
        )
      : "";
  } catch {
    return "";
  }
}

function parsePage(
  body: string
): GoogleCalendarEventsPage {
  try {
    const parsed =
      JSON.parse(body);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error();
    }

    return parsed as GoogleCalendarEventsPage;
  } catch {
    throw new GoogleCalendarTriggerError(
      "Google Calendar returned an invalid response."
    );
  }
}

export const googleCalendarTriggerHandler: IntegrationTriggerHandler =
  {
    type:
      "GOOGLE_CALENDAR_NEW_EVENT",
    provider:
      "GOOGLE_CALENDAR",

    async poll({
      workflowId,
      activatedAt,
      configuration,
      cursor,
    }) {
      const parsedConfiguration =
        parseGoogleCalendarTriggerConfiguration(
          {
            label:
              "Google Calendar trigger",
            configuration,
          }
        );

      const integration =
        await resolveWorkflowIntegration(
          {
            workflowId,
            integrationId:
              parsedConfiguration.integrationId,
            provider:
              "GOOGLE_CALENDAR",
          }
        );

      const accessToken =
        integration.credentials
          .accessToken;

      if (!accessToken) {
        throw new WorkflowIntegrationError(
          "The Google Calendar integration does not contain an access token."
        );
      }

      const now = new Date();

      const activeCursor =
        parseGoogleCalendarTriggerCursor(
          cursor
        ) ??
        createGoogleCalendarTriggerCursor(
          parsedConfiguration,
          activatedAt
        );

      const query =
        googleCalendarEventsQuery(
          activeCursor
        );

      const url =
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          parsedConfiguration.calendarId
        )}/events?${query.toString()}`;

      let response: Response;

      try {
        response = await fetch(
          url,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
              Accept:
                "application/json",
              "User-Agent":
                "Synapse-Workflow/1.0",
            },
            redirect: "error",
            signal:
              AbortSignal.timeout(
                REQUEST_TIMEOUT_MS
              ),
          }
        );
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name ===
            "TimeoutError" ||
            error.name ===
              "AbortError")
        ) {
          throw new GoogleCalendarTriggerError(
            "Google Calendar trigger polling timed out."
          );
        }

        throw new GoogleCalendarTriggerError(
          "Google Calendar trigger polling failed."
        );
      }

      const body =
        await readLimitedBody(
          response
        );

      if (
        response.status === 410 &&
        activeCursor.phase ===
          "SYNC"
      ) {
        return {
          events: [],
          cursor:
            recoverGoogleCalendarTriggerCursor(
              activeCursor
            ),
          pollIntervalMinutes: 1,
        };
      }

      if (!response.ok) {
        const detail =
          providerError(body);

        throw new GoogleCalendarTriggerError(
          `Google Calendar trigger polling failed (${response.status})${
            detail
              ? `: ${detail}`
              : "."
          }`
        );
      }

      const detected =
        processGoogleCalendarEventsPage(
          {
            configuration:
              parsedConfiguration,
            cursor: activeCursor,
            page: parsePage(body),
            now,
          }
        );

      return {
        ...detected,
        pollIntervalMinutes:
          parsedConfiguration.pollIntervalMinutes,
      };
    },
  };
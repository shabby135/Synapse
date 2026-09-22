import assert from "node:assert/strict";
import test from "node:test";

import {
  createGoogleCalendarTriggerCursor,
  googleCalendarEventsQuery,
  GoogleCalendarTriggerError,
  parseGoogleCalendarTriggerConfiguration,
  processGoogleCalendarEventsPage,
  recoverGoogleCalendarTriggerCursor,
} from "../src/features/workflow/google-calendar-trigger-configuration.ts";
import {
  validateWorkflowForPublish,
} from "../src/features/workflow/validate-publish.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";

const publishedAt = new Date(
  "2026-09-22T08:00:00.000Z"
);

function createConfiguration(
  changes = {}
) {
  return {
    triggerType:
      "GOOGLE_CALENDAR_NEW_EVENT",
    integrationId,
    calendarId: "primary",
    startMode: "FROM_NOW",
    pollIntervalMinutes: 1,
    ...changes,
  };
}

function apiEvent(changes = {}) {
  return {
    id: "event-1",
    status: "confirmed",
    summary: "Planning session",
    description: "Weekly planning",
    location: "Online",
    htmlLink:
      "https://calendar.google.com/event?eid=event-1",
    created:
      "2026-09-22T08:01:00.000Z",
    updated:
      "2026-09-22T08:01:00.000Z",
    start: {
      dateTime:
        "2026-09-23T10:00:00+05:30",
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime:
        "2026-09-23T11:00:00+05:30",
      timeZone: "Asia/Kolkata",
    },
    organizer: {
      email: "owner@example.com",
      self: true,
    },
    attendees: [
      {
        email: "guest@example.com",
        responseStatus: "accepted",
      },
    ],
    ...changes,
  };
}

test(
  "parses a valid Google Calendar new-event trigger",
  () => {
    const result =
      parseGoogleCalendarTriggerConfiguration(
        {
          label: "New meeting",
          configuration:
            createConfiguration(),
        }
      );

    assert.equal(
      result.triggerType,
      "GOOGLE_CALENDAR_NEW_EVENT"
    );

    assert.equal(
      result.calendarId,
      "primary"
    );
  }
);

test(
  "rejects invalid or dynamic static Calendar settings",
  () => {
    assert.throws(
      () =>
        parseGoogleCalendarTriggerConfiguration(
          {
            label: "New meeting",
            configuration:
              createConfiguration({
                integrationId: "bad",
              }),
          }
        ),
      GoogleCalendarTriggerError
    );

    assert.throws(
      () =>
        parseGoogleCalendarTriggerConfiguration(
          {
            label: "New meeting",
            configuration:
              createConfiguration({
                calendarId:
                  "{{input.calendar}}",
              }),
          }
        ),
      GoogleCalendarTriggerError
    );
  }
);

test(
  "initializes from now without replaying existing events",
  () => {
    const configuration =
      createConfiguration();

    const cursor =
      createGoogleCalendarTriggerCursor(
        configuration,
        publishedAt
      );

    const result =
      processGoogleCalendarEventsPage({
        configuration,
        cursor,
        page: {
          items: [
            apiEvent({
              created:
                "2026-09-22T07:59:00.000Z",
            }),
          ],
          nextSyncToken: "sync-1",
        },
        now: new Date(
          "2026-09-22T08:02:00.000Z"
        ),
      });

    assert.deepEqual(
      result.events,
      []
    );

    assert.deepEqual(
      result.cursor,
      {
        phase: "SYNC",
        startedAt:
          "2026-09-22T08:00:00.000Z",
        lastSyncedAt:
          "2026-09-22T08:02:00.000Z",
        emitBootstrap: false,
        syncToken: "sync-1",
      }
    );
  }
);

test(
  "does not miss an event created after publishing but before the first poll",
  () => {
    const configuration =
      createConfiguration();

    const cursor =
      createGoogleCalendarTriggerCursor(
        configuration,
        publishedAt
      );

    const result =
      processGoogleCalendarEventsPage({
        configuration,
        cursor,
        page: {
          items: [apiEvent()],
          nextSyncToken: "sync-1",
        },
        now: new Date(
          "2026-09-22T08:02:00.000Z"
        ),
      });

    assert.deepEqual(
      result.events.map(
        (event) =>
          event.input.id
      ),
      ["event-1"]
    );
  }
);

test(
  "can emit existing upcoming events during bootstrap",
  () => {
    const configuration =
      createConfiguration({
        startMode: "FROM_BEGINNING",
      });

    const cursor =
      createGoogleCalendarTriggerCursor(
        configuration,
        publishedAt
      );

    const result =
      processGoogleCalendarEventsPage({
        configuration,
        cursor,
        page: {
          items: [apiEvent()],
          nextSyncToken: "sync-1",
        },
        now: publishedAt,
      });

    assert.equal(
      result.events.length,
      1
    );

    assert.equal(
      result.events[0].key,
      "primary:event-1"
    );

    assert.equal(
      result.events[0].input.title,
      "Planning session"
    );

    assert.deepEqual(
      result.events[0].input
        .attendees,
      [
        {
          email:
            "guest@example.com",
          displayName: null,
          responseStatus:
            "accepted",
          organizer: false,
          self: false,
        },
      ]
    );
  }
);

test(
  "continues paginated bootstrap without losing its mode",
  () => {
    const configuration =
      createConfiguration({
        startMode: "FROM_BEGINNING",
      });

    const cursor =
      createGoogleCalendarTriggerCursor(
        configuration,
        publishedAt
      );

    const result =
      processGoogleCalendarEventsPage({
        configuration,
        cursor,
        page: {
          items: [apiEvent()],
          nextPageToken: "page-2",
        },
        now: publishedAt,
      });

    assert.equal(
      result.events.length,
      1
    );

    assert.deepEqual(
      result.cursor,
      {
        ...cursor,
        pageToken: "page-2",
      }
    );
  }
);

test(
  "incremental sync emits newly created events but ignores old event updates",
  () => {
    const configuration =
      createConfiguration();

    const cursor = {
      phase: "SYNC",
      startedAt:
        "2026-09-22T08:00:00.000Z",
      lastSyncedAt:
        "2026-09-22T08:02:00.000Z",
      emitBootstrap: false,
      syncToken: "sync-1",
    };

    const result =
      processGoogleCalendarEventsPage({
        configuration,
        cursor,
        page: {
          items: [
            apiEvent({
              id: "old-event",
              created:
                "2026-09-20T08:00:00.000Z",
              updated:
                "2026-09-22T08:03:00.000Z",
            }),
            apiEvent({
              id: "new-event",
              created:
                "2026-09-22T08:03:00.000Z",
            }),
          ],
          nextSyncToken: "sync-2",
        },
        now: new Date(
          "2026-09-22T08:04:00.000Z"
        ),
      });

    assert.deepEqual(
      result.events.map(
        (event) =>
          event.input.id
      ),
      ["new-event"]
    );
  }
);

test(
  "ignores cancelled Calendar events",
  () => {
    const configuration =
      createConfiguration();

    const cursor = {
      phase: "SYNC",
      startedAt:
        "2026-09-22T08:00:00.000Z",
      lastSyncedAt:
        "2026-09-22T08:02:00.000Z",
      emitBootstrap: false,
      syncToken: "sync-1",
    };

    const result =
      processGoogleCalendarEventsPage({
        configuration,
        cursor,
        page: {
          items: [
            apiEvent({
              status: "cancelled",
            }),
          ],
          nextSyncToken: "sync-2",
        },
        now: publishedAt,
      });

    assert.deepEqual(
      result.events,
      []
    );
  }
);

test(
  "uses initial and incremental Calendar query parameters correctly",
  () => {
    const configuration =
      createConfiguration();

    const bootstrap =
      createGoogleCalendarTriggerCursor(
        configuration,
        publishedAt
      );

    const initialQuery =
      googleCalendarEventsQuery(
        bootstrap
      );

    assert.equal(
      initialQuery.get("timeMin"),
      "2026-09-22T08:00:00.000Z"
    );

    assert.equal(
      initialQuery.get("syncToken"),
      null
    );

    const syncQuery =
      googleCalendarEventsQuery({
        ...bootstrap,
        phase: "SYNC",
        syncToken: "sync-1",
        pageToken: "page-2",
      });

    assert.equal(
      syncQuery.get("syncToken"),
      "sync-1"
    );

    assert.equal(
      syncQuery.get("pageToken"),
      "page-2"
    );

    assert.equal(
      syncQuery.get("timeMin"),
      null
    );
  }
);

test(
  "recovers an expired sync token from the last successful sync time",
  () => {
    const recovered =
      recoverGoogleCalendarTriggerCursor(
        {
          phase: "SYNC",
          startedAt:
            "2026-09-22T08:00:00.000Z",
          lastSyncedAt:
            "2026-09-22T08:10:00.000Z",
          emitBootstrap: false,
          syncToken: "expired",
        }
      );

    assert.deepEqual(
      recovered,
      {
        phase: "BOOTSTRAP",
        startedAt:
          "2026-09-22T08:10:00.000Z",
        lastSyncedAt:
          "2026-09-22T08:10:00.000Z",
        emitBootstrap: true,
      }
    );
  }
);

test(
  "validates a published Google Calendar trigger workflow",
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
                label: "New meeting",
                configuration:
                  createConfiguration(),
              },
            },
            {
              id: "action-1",
              type: "action",
              position: {
                x: 200,
                y: 0,
              },
              data: {
                label:
                  "Test action",
                configuration: {
                  actionType:
                    "NO_OP",
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

    assert.deepEqual(
      result,
      {
        valid: true,
      }
    );
  }
);
import assert from "node:assert/strict";
import test from "node:test";

import {
  configurationForPublish,
  DataMappingError,
  resolveActionConfiguration,
} from "../src/features/workflow/data-mapping.ts";
import {
  GoogleCalendarActionError,
  parseGoogleCalendarActionConfiguration,
} from "../src/features/workflow/google-calendar-action-configuration.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";

function createData(
  changes = {}
) {
  return {
    label: "Create calendar event",
    configuration: {
      actionType:
        "GOOGLE_CALENDAR_CREATE_EVENT",
      integrationId,
      calendarId: "primary",
      title: "Synapse event",
      description:
        "Created by Synapse",
      location: "Online",
      startDateTime:
        "2026-09-22T10:00:00+05:30",
      endDateTime:
        "2026-09-22T11:00:00+05:30",
      timeZone: "Asia/Kolkata",
      attendees:
        "first@example.com, second@example.com",
      sendUpdates: true,
      ...changes,
    },
  };
}

test(
  "parses a valid Google Calendar action",
  () => {
    const result =
      parseGoogleCalendarActionConfiguration(
        createData()
      );

    assert.equal(
      result.integrationId,
      integrationId
    );

    assert.equal(
      result.calendarId,
      "primary"
    );

    assert.deepEqual(
      result.attendees,
      [
        "first@example.com",
        "second@example.com",
      ]
    );

    assert.equal(
      result.sendUpdates,
      true
    );
  }
);

test(
  "removes duplicate attendee emails case-insensitively",
  () => {
    const result =
      parseGoogleCalendarActionConfiguration(
        createData({
          attendees:
            "Person@example.com, person@example.com",
        })
      );

    assert.deepEqual(
      result.attendees,
      ["Person@example.com"]
    );
  }
);

test(
  "rejects an invalid integration ID",
  () => {
    assert.throws(
      () =>
        parseGoogleCalendarActionConfiguration(
          createData({
            integrationId:
              "not-a-uuid",
          })
        ),
      GoogleCalendarActionError
    );
  }
);

test(
  "rejects an end time before the start time",
  () => {
    assert.throws(
      () =>
        parseGoogleCalendarActionConfiguration(
          createData({
            endDateTime:
              "2026-09-22T09:00:00+05:30",
          })
        ),
      /end time must be after/i
    );
  }
);

test(
  "rejects an invalid timezone",
  () => {
    assert.throws(
      () =>
        parseGoogleCalendarActionConfiguration(
          createData({
            timeZone:
              "Invalid/Timezone",
          })
        ),
      GoogleCalendarActionError
    );
  }
);

test(
  "resolves Calendar event mapping fields",
  () => {
    const configuration =
      resolveActionConfiguration(
        {
          actionType:
            "GOOGLE_CALENDAR_CREATE_EVENT",
          integrationId,
          calendarId: "primary",
          title:
            "{{input.title}}",
          description:
            "Created for {{input.customer}}",
          location:
            "{{input.location}}",
          startDateTime:
            "{{input.start}}",
          endDateTime:
            "{{input.end}}",
          timeZone:
            "Asia/Kolkata",
          attendees:
            "{{input.email}}",
          sendUpdates: true,
        },
        {
          trigger: {},
          input: {
            title: "Customer call",
            customer: "Shubham",
            location: "Online",
            start:
              "2026-09-22T10:00:00+05:30",
            end:
              "2026-09-22T11:00:00+05:30",
            email:
              "person@example.com",
          },
          nodes: {},
        }
      );

    assert.equal(
      configuration.title,
      "Customer call"
    );

    assert.equal(
      configuration.description,
      "Created for Shubham"
    );

    assert.equal(
      configuration.startDateTime,
      "2026-09-22T10:00:00+05:30"
    );

    assert.equal(
      configuration.attendees,
      "person@example.com"
    );
  }
);

test(
  "does not allow mapping the integration ID",
  () => {
    assert.throws(
      () =>
        configurationForPublish(
          {
            actionType:
              "GOOGLE_CALENDAR_CREATE_EVENT",
            integrationId:
              "{{input.integrationId}}",
            calendarId: "primary",
            title: "Event",
            startDateTime:
              "2026-09-22T10:00:00+05:30",
            endDateTime:
              "2026-09-22T11:00:00+05:30",
            timeZone:
              "Asia/Kolkata",
          },
          new Set()
        ),
      DataMappingError
    );
  }
);

test(
  "validates mapped Calendar fields for publishing",
  () => {
    const configuration =
      configurationForPublish(
        {
          actionType:
            "GOOGLE_CALENDAR_CREATE_EVENT",
          integrationId,
          calendarId: "primary",
          title:
            "{{input.title}}",
          description:
            "{{input.description}}",
          location:
            "{{input.location}}",
          startDateTime:
            "{{input.start}}",
          endDateTime:
            "{{input.end}}",
          timeZone:
            "Asia/Kolkata",
          attendees:
            "{{input.email}}",
          sendUpdates: false,
        },
        new Set()
      );

    assert.doesNotThrow(() =>
      parseGoogleCalendarActionConfiguration(
        {
          label:
            "Create calendar event",
          configuration,
        }
      )
    );
  }
);
"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type GoogleCalendarActionConfigurationProps = {
  workspaceId: string;
  configuration: Record<
    string,
    unknown
  >;
  canEdit: boolean;
  onChange: (
    changes: Record<string, unknown>
  ) => void;
};

function readString(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

export function GoogleCalendarActionConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: GoogleCalendarActionConfigurationProps) {
  const trpc = useTRPC();

  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "GOOGLE_CALENDAR",
    })
  );

  const activeIntegrations =
    integrations.data?.filter(
      (integration) =>
        integration.status === "ACTIVE"
    ) ?? [];

  const integrationId = readString(
    configuration.integrationId
  );

  const calendarId =
    readString(
      configuration.calendarId
    ) || "primary";

  const title = readString(
    configuration.title
  );

  const description = readString(
    configuration.description
  );

  const location = readString(
    configuration.location
  );

  const startDateTime = readString(
    configuration.startDateTime
  );

  const endDateTime = readString(
    configuration.endDateTime
  );

  const timeZone =
    readString(
      configuration.timeZone
    ) || "UTC";

  const attendees = readString(
    configuration.attendees
  );

  const sendUpdates =
    configuration.sendUpdates === true;

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="space-y-2">
        <label
          htmlFor="calendar-integration"
          className="text-sm font-medium"
        >
          Google Calendar integration
        </label>

        {integrations.isPending ? (
          <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading integrations...
          </div>
        ) : integrations.isError ? (
          <p className="text-sm font-medium text-destructive">
            {integrations.error.message}
          </p>
        ) : (
          <>
            <select
              id="calendar-integration"
              value={integrationId}
              disabled={!canEdit}
              onChange={(event) =>
                onChange({
                  integrationId:
                    event.target.value,
                })
              }
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                Select an integration
              </option>

              {activeIntegrations.map(
                (integration) => (
                  <option
                    key={integration.id}
                    value={integration.id}
                  >
                    {integration.name}
                  </option>
                )
              )}
            </select>

            {activeIntegrations.length ===
              0 && (
              <p className="text-xs text-muted-foreground">
                Connect Google Calendar
                on the workspace page
                first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="calendar-id"
          className="text-sm font-medium"
        >
          Calendar ID
        </label>

        <Input
          id="calendar-id"
          value={calendarId}
          maxLength={1_024}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              calendarId:
                event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Use primary for the connected
          account&apos;s main calendar.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="calendar-title"
          className="text-sm font-medium"
        >
          Event title
        </label>

        <Input
          id="calendar-title"
          value={title}
          maxLength={1_024}
          disabled={!canEdit}
          placeholder="Workflow event"
          onChange={(event) =>
            onChange({
              title: event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="calendar-description"
          className="text-sm font-medium"
        >
          Description
        </label>

        <textarea
          id="calendar-description"
          value={description}
          rows={4}
          maxLength={8_192}
          disabled={!canEdit}
          placeholder="Created by Synapse"
          onChange={(event) =>
            onChange({
              description:
                event.target.value,
            })
          }
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="calendar-location"
          className="text-sm font-medium"
        >
          Location
        </label>

        <Input
          id="calendar-location"
          value={location}
          maxLength={1_024}
          disabled={!canEdit}
          placeholder="Online"
          onChange={(event) =>
            onChange({
              location:
                event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="calendar-start"
          className="text-sm font-medium"
        >
          Start date and time
        </label>

        <Input
          id="calendar-start"
          value={startDateTime}
          maxLength={100}
          disabled={!canEdit}
          placeholder="2026-09-21T10:00:00+05:30"
          onChange={(event) =>
            onChange({
              startDateTime:
                event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="calendar-end"
          className="text-sm font-medium"
        >
          End date and time
        </label>

        <Input
          id="calendar-end"
          value={endDateTime}
          maxLength={100}
          disabled={!canEdit}
          placeholder="2026-09-21T11:00:00+05:30"
          onChange={(event) =>
            onChange({
              endDateTime:
                event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="calendar-timezone"
          className="text-sm font-medium"
        >
          Timezone
        </label>

        <Input
          id="calendar-timezone"
          value={timeZone}
          maxLength={100}
          disabled={!canEdit}
          placeholder="Asia/Kolkata"
          onChange={(event) =>
            onChange({
              timeZone:
                event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Use an IANA timezone such as
          Asia/Kolkata or UTC.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="calendar-attendees"
          className="text-sm font-medium"
        >
          Attendee emails
        </label>

        <textarea
          id="calendar-attendees"
          value={attendees}
          rows={3}
          maxLength={5_000}
          disabled={!canEdit}
          placeholder="person@example.com"
          onChange={(event) =>
            onChange({
              attendees:
                event.target.value,
            })
          }
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <p className="text-xs text-muted-foreground">
          Separate multiple emails with
          commas or new lines.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-md border p-3">
        <input
          type="checkbox"
          checked={sendUpdates}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              sendUpdates:
                event.target.checked,
            })
          }
          className="mt-0.5 size-4"
        />

        <span>
          <span className="block text-sm font-medium">
            Send invitations
          </span>

          <span className="block text-xs text-muted-foreground">
            Google Calendar will notify
            the listed attendees.
          </span>
        </span>
      </label>

      <p className="text-xs text-muted-foreground">
        Event text and dates support
        mappings such as{" "}
        {"{{input.title}}"}.
      </p>
    </div>
  );
}
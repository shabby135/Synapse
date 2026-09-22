"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type GoogleCalendarTriggerConfigurationProps = {
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

function text(value: unknown) {
  return typeof value === "string"
    ? value
    : "";
}

export function GoogleCalendarTriggerConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: GoogleCalendarTriggerConfigurationProps) {
  const trpc = useTRPC();

  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider:
        "GOOGLE_CALENDAR",
    })
  );

  const active =
    integrations.data?.filter(
      (item) =>
        item.status === "ACTIVE"
    ) ?? [];

  const integrationId = text(
    configuration.integrationId
  );

  const calendarId =
    text(configuration.calendarId) ||
    "primary";

  const startMode =
    configuration.startMode ===
    "FROM_BEGINNING"
      ? "FROM_BEGINNING"
      : "FROM_NOW";

  const pollIntervalMinutes =
    typeof configuration.pollIntervalMinutes ===
    "number"
      ? configuration.pollIntervalMinutes
      : 1;

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="space-y-2">
        <label
          htmlFor="calendar-trigger-integration"
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
            {
              integrations.error
                .message
            }
          </p>
        ) : (
          <>
            <select
              id="calendar-trigger-integration"
              value={integrationId}
              disabled={!canEdit}
              onChange={(event) =>
                onChange({
                  integrationId:
                    event.target.value,
                })
              }
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">
                Select an integration
              </option>

              {active.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              ))}
            </select>

            {active.length === 0 && (
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
          htmlFor="calendar-trigger-id"
          className="text-sm font-medium"
        >
          Calendar ID
        </label>

        <Input
          id="calendar-trigger-id"
          value={calendarId}
          maxLength={1_024}
          disabled={!canEdit}
          placeholder="primary"
          onChange={(event) =>
            onChange({
              calendarId:
                event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Use primary for the connected
          account&apos;s main calendar,
          or enter another
          calendar&apos;s ID.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="calendar-trigger-start"
          className="text-sm font-medium"
        >
          Starting position
        </label>

        <select
          id="calendar-trigger-start"
          value={startMode}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              startMode:
                event.target.value,
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="FROM_NOW">
            Only events created after
            publishing
          </option>

          <option value="FROM_BEGINNING">
            Process existing upcoming
            events first
          </option>
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="calendar-trigger-interval"
          className="text-sm font-medium"
        >
          Check for events
        </label>

        <select
          id="calendar-trigger-interval"
          value={pollIntervalMinutes}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              pollIntervalMinutes:
                Number.parseInt(
                  event.target.value,
                  10
                ),
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value={1}>
            Every minute
          </option>

          <option value={5}>
            Every 5 minutes
          </option>

          <option value={15}>
            Every 15 minutes
          </option>

          <option value={30}>
            Every 30 minutes
          </option>

          <option value={60}>
            Every hour
          </option>
        </select>
      </div>
    </div>
  );
}
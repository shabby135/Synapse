"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type GoogleSheetsTriggerConfigurationProps = {
  workspaceId: string;

  configuration: Record<
    string,
    unknown
  >;

  canEdit: boolean;

  onChange: (
    changes: Record<
      string,
      unknown
    >
  ) => void;
};

function text(
  value: unknown
) {
  return typeof value === "string"
    ? value
    : "";
}

export function GoogleSheetsTriggerConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: GoogleSheetsTriggerConfigurationProps) {
  const trpc = useTRPC();

  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider:
        "GOOGLE_SHEETS",
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

  const spreadsheetId = text(
    configuration.spreadsheetId
  );

  const range =
    text(configuration.range) ||
    "Sheet1!A:Z";

  const startMode =
    configuration.startMode ===
    "FROM_BEGINNING"
      ? "FROM_BEGINNING"
      : "FROM_NOW";

  const pollIntervalMinutes =
    typeof configuration
      .pollIntervalMinutes ===
    "number"
      ? configuration
          .pollIntervalMinutes
      : 1;

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="space-y-2">
        <label
          htmlFor="sheets-trigger-integration"
          className="text-sm font-medium"
        >
          Google Sheets integration
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
              id="sheets-trigger-integration"
              value={integrationId}
              disabled={!canEdit}
              onChange={(event) =>
                onChange({
                  integrationId:
                    event.target
                      .value,
                })
              }
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">
                Select an integration
              </option>

              {active.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                )
              )}
            </select>

            {active.length ===
              0 && (
              <p className="text-xs text-muted-foreground">
                Connect Google Sheets
                on the workspace page
                first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="sheets-trigger-id"
          className="text-sm font-medium"
        >
          Spreadsheet ID
        </label>

        <Input
          id="sheets-trigger-id"
          value={spreadsheetId}
          maxLength={256}
          disabled={!canEdit}
          placeholder="1AbCdEfGhIjKlMnOp..."
          onChange={(event) =>
            onChange({
              spreadsheetId:
                event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Copy the value between
          /spreadsheets/d/ and /edit
          in the Google Sheets URL.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="sheets-trigger-range"
          className="text-sm font-medium"
        >
          Sheet range
        </label>

        <Input
          id="sheets-trigger-range"
          value={range}
          maxLength={1_024}
          disabled={!canEdit}
          placeholder="Sheet1!A:Z"
          onChange={(event) =>
            onChange({
              range:
                event.target.value,
            })
          }
        />
      </div>

      <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
        <input
          type="checkbox"
          checked={
            configuration.hasHeader ===
            true
          }
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              hasHeader:
                event.target.checked,
            })
          }
          className="mt-0.5 size-4"
        />

        <span>
          <span className="block font-medium">
            First row contains
            headers
          </span>

          <span className="mt-1 block text-xs text-muted-foreground">
            Row values will also be
            available by their header
            names under
            {" {{trigger.data}}"}.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <label
          htmlFor="sheets-trigger-start"
          className="text-sm font-medium"
        >
          Starting position
        </label>

        <select
          id="sheets-trigger-start"
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
            Only rows added after
            publishing
          </option>

          <option value="FROM_BEGINNING">
            Process existing rows first
          </option>
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="sheets-trigger-interval"
          className="text-sm font-medium"
        >
          Check for rows
        </label>

        <select
          id="sheets-trigger-interval"
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
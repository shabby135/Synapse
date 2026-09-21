"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type GoogleSheetsActionConfigurationProps = {
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

export function GoogleSheetsActionConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: GoogleSheetsActionConfigurationProps) {
  const trpc = useTRPC();

  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "GOOGLE_SHEETS",
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

  const spreadsheetId = readString(
    configuration.spreadsheetId
  );

  const range =
    readString(configuration.range) ||
    "Sheet1!A:Z";

  const valuesJson =
    readString(
      configuration.valuesJson
    ) || "[]";

  const valueInputOption =
    configuration.valueInputOption ===
    "RAW"
      ? "RAW"
      : "USER_ENTERED";

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="space-y-2">
        <label
          htmlFor="sheets-integration"
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
            {integrations.error.message}
          </p>
        ) : (
          <>
            <select
              id="sheets-integration"
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
                Connect Google Sheets on
                the workspace page first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="sheets-spreadsheet-id"
          className="text-sm font-medium"
        >
          Spreadsheet ID
        </label>

        <Input
          id="sheets-spreadsheet-id"
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
          /spreadsheets/d/ and /edit in
          the Google Sheets URL.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="sheets-range"
          className="text-sm font-medium"
        >
          Sheet range
        </label>

        <Input
          id="sheets-range"
          value={range}
          maxLength={1_024}
          disabled={!canEdit}
          placeholder="Sheet1!A:Z"
          onChange={(event) =>
            onChange({
              range: event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Use A1 notation, for example
          Sheet1!A:Z or Leads!A:D.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="sheets-values"
          className="text-sm font-medium"
        >
          Row values
        </label>

        <textarea
          id="sheets-values"
          value={valuesJson}
          rows={7}
          maxLength={100_000}
          disabled={!canEdit}
          spellCheck={false}
          placeholder={`[
  "{{input.name}}",
  "{{input.email}}",
  "{{input.score}}"
]`}
          onChange={(event) =>
            onChange({
              valuesJson:
                event.target.value,
            })
          }
          className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <p className="text-xs text-muted-foreground">
          Enter one JSON array. Each
          array item becomes one cell in
          the appended row.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="sheets-input-option"
          className="text-sm font-medium"
        >
          Value handling
        </label>

        <select
          id="sheets-input-option"
          value={valueInputOption}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              valueInputOption:
                event.target.value,
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="USER_ENTERED">
            User entered
          </option>

          <option value="RAW">
            Raw
          </option>
        </select>

        <p className="text-xs text-muted-foreground">
          User entered lets Google
          interpret dates, numbers and
          formulas. Raw stores the values
          without interpretation.
        </p>
      </div>
    </div>
  );
}
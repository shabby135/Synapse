"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type GmailTriggerConfigurationProps = {
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

function text(value: unknown) {
  return typeof value === "string"
    ? value
    : "";
}

export function GmailTriggerConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: GmailTriggerConfigurationProps) {
  const trpc = useTRPC();

  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "GMAIL",
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

  const labelId =
    typeof configuration.labelId ===
    "string"
      ? configuration.labelId
      : "INBOX";

  const searchQuery = text(
    configuration.searchQuery
  );

  const startMode =
    configuration.startMode ===
    "FROM_BEGINNING"
      ? "FROM_BEGINNING"
      : "FROM_NOW";

  const pollIntervalMinutes =
    typeof configuration
      .pollIntervalMinutes === "number"
      ? configuration
          .pollIntervalMinutes
      : 1;

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="space-y-2">
        <label
          htmlFor="gmail-trigger-integration"
          className="text-sm font-medium"
        >
          Gmail integration
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
              id="gmail-trigger-integration"
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
                Connect Gmail on the
                workspace page first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gmail-trigger-label"
          className="text-sm font-medium"
        >
          Message category
        </label>

        <select
          id="gmail-trigger-label"
          value={labelId}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              labelId:
                event.target.value,
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="INBOX">
            Inbox
          </option>

          <option value="UNREAD">
            Unread
          </option>

          <option value="IMPORTANT">
            Important
          </option>

          <option value="STARRED">
            Starred
          </option>

          <option value="ALL">
            All mail except spam and
            trash
          </option>
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gmail-trigger-query"
          className="text-sm font-medium"
        >
          Gmail search
        </label>

        <Input
          id="gmail-trigger-query"
          value={searchQuery}
          maxLength={500}
          disabled={!canEdit}
          placeholder="from:alerts@example.com"
          onChange={(event) =>
            onChange({
              searchQuery:
                event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Optional. Uses Gmail search
          syntax, such as from:,
          subject:, or has:attachment.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gmail-trigger-start"
          className="text-sm font-medium"
        >
          Starting position
        </label>

        <select
          id="gmail-trigger-start"
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
            Only emails received after
            publishing
          </option>

          <option value="FROM_BEGINNING">
            Process existing matching
            emails first
          </option>
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gmail-trigger-interval"
          className="text-sm font-medium"
        >
          Check for emails
        </label>

        <select
          id="gmail-trigger-interval"
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
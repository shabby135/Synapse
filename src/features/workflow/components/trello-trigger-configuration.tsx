"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type TrelloTriggerConfigurationProps = {
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

export function TrelloTriggerConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: TrelloTriggerConfigurationProps) {
  const trpc = useTRPC();
  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "TRELLO",
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
  const boardId = text(
    configuration.boardId
  );
  const listId = text(
    configuration.listId
  );
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
          htmlFor="trello-trigger-integration"
          className="text-sm font-medium"
        >
          Trello integration
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
              id="trello-trigger-integration"
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
                Connect Trello on the
                workspace page first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trello-trigger-board"
          className="text-sm font-medium"
        >
          Board ID
        </label>
        <Input
          id="trello-trigger-board"
          value={boardId}
          maxLength={24}
          disabled={!canEdit}
          placeholder="5abbe4b7ddc1b351ef961414"
          onChange={(event) =>
            onChange({
              boardId:
                event.target.value,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Enter the 24-character ID of the
          board to watch.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trello-trigger-list"
          className="text-sm font-medium"
        >
          List ID
        </label>
        <Input
          id="trello-trigger-list"
          value={listId}
          maxLength={24}
          disabled={!canEdit}
          placeholder="Optional"
          onChange={(event) =>
            onChange({
              listId:
                event.target.value,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Optional. Leave empty to detect new
          cards in every list on the board.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trello-trigger-start"
          className="text-sm font-medium"
        >
          Starting position
        </label>
        <select
          id="trello-trigger-start"
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
            Only cards created after
            publishing
          </option>
          <option value="FROM_BEGINNING">
            Process existing cards first
          </option>
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trello-trigger-interval"
          className="text-sm font-medium"
        >
          Check for cards
        </label>
        <select
          id="trello-trigger-interval"
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

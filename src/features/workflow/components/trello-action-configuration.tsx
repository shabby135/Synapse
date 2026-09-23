"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type TrelloActionConfigurationProps = {
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

function text(value: unknown): string {
  return typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value
          .filter(
            (item): item is string =>
              typeof item === "string"
          )
          .join(", ")
      : "";
}

export function TrelloActionConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: TrelloActionConfigurationProps) {
  const trpc = useTRPC();
  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "TRELLO",
    })
  );
  const activeIntegrations =
    integrations.data?.filter(
      (item) =>
        item.status === "ACTIVE"
    ) ?? [];

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="space-y-2">
        <label
          htmlFor="trello-action-integration"
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
              id="trello-action-integration"
              value={text(
                configuration.integrationId
              )}
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
                Connect Trello on the
                workspace page first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trello-action-list-id"
          className="text-sm font-medium"
        >
          Destination list ID
        </label>
        <Input
          id="trello-action-list-id"
          value={text(configuration.listId)}
          maxLength={24}
          disabled={!canEdit}
          placeholder="64f1234567890abcdef12345"
          onChange={(event) =>
            onChange({
              listId: event.target.value,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Static 24-character Trello list
          ID. Expressions are not supported.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trello-action-name"
          className="text-sm font-medium"
        >
          Card name
        </label>
        <Input
          id="trello-action-name"
          value={text(configuration.name)}
          maxLength={512}
          disabled={!canEdit}
          placeholder="Task for {{input.customer}}"
          onChange={(event) =>
            onChange({
              name: event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trello-action-description"
          className="text-sm font-medium"
        >
          Description
        </label>
        <textarea
          id="trello-action-description"
          value={text(
            configuration.description
          )}
          rows={7}
          maxLength={16_384}
          disabled={!canEdit}
          placeholder="Created from Synapse data: {{input}}"
          onChange={(event) =>
            onChange({
              description:
                event.target.value,
            })
          }
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trello-action-position"
          className="text-sm font-medium"
        >
          Card position
        </label>
        <select
          id="trello-action-position"
          value={text(
            configuration.position
          ) || "bottom"}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              position:
                event.target.value,
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="top">
            Top of list
          </option>
          <option value="bottom">
            Bottom of list
          </option>
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trello-action-due"
          className="text-sm font-medium"
        >
          Due date
        </label>
        <Input
          id="trello-action-due"
          value={text(configuration.due)}
          disabled={!canEdit}
          placeholder="2026-09-30T12:00:00Z or {{input.due}}"
          onChange={(event) =>
            onChange({
              due: event.target.value,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Optional ISO date-time or mapped
          date-time value.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={
            configuration.dueComplete ===
            true
          }
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              dueComplete:
                event.target.checked,
            })
          }
          className="mt-0.5 size-4 rounded border"
        />
        <span>
          Mark the due date as completed
        </span>
      </label>

      <div className="space-y-2">
        <label
          htmlFor="trello-action-member-ids"
          className="text-sm font-medium"
        >
          Member IDs
        </label>
        <Input
          id="trello-action-member-ids"
          value={text(
            configuration.memberIds
          )}
          disabled={!canEdit}
          placeholder="64f...123, 64f...456"
          onChange={(event) =>
            onChange({
              memberIds:
                event.target.value,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Optional comma-separated Trello
          member IDs or a mapped list.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trello-action-label-ids"
          className="text-sm font-medium"
        >
          Label IDs
        </label>
        <Input
          id="trello-action-label-ids"
          value={text(
            configuration.labelIds
          )}
          disabled={!canEdit}
          placeholder="64f...789, 64f...abc"
          onChange={(event) =>
            onChange({
              labelIds:
                event.target.value,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Optional comma-separated Trello
          label IDs or a mapped list.
        </p>
      </div>
    </div>
  );
}

"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { useTRPC } from "@/trpc/react";

type MessagingProvider =
  | "SLACK"
  | "DISCORD";

type MessagingActionConfigurationProps = {
  workspaceId: string;
  provider: MessagingProvider;
  configuration: Record<
    string,
    unknown
  >;
  canEdit: boolean;
  onChange: (
    changes: Record<string, unknown>
  ) => void;
};

export function MessagingActionConfiguration({
  workspaceId,
  provider,
  configuration,
  canEdit,
  onChange,
}: MessagingActionConfigurationProps) {
  const trpc = useTRPC();

  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider,
    })
  );

  const integrationId =
    typeof configuration.integrationId ===
    "string"
      ? configuration.integrationId
      : "";

  const message =
    typeof configuration.message ===
    "string"
      ? configuration.message
      : "";

  const providerLabel =
    provider === "SLACK"
      ? "Slack"
      : "Discord";

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="space-y-2">
        <label
          htmlFor="messaging-integration"
          className="text-sm font-medium"
        >
          {providerLabel} integration
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
              id="messaging-integration"
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

              {integrations.data.map(
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

            {integrations.data.length ===
              0 && (
              <p className="text-xs text-muted-foreground">
                Create a {providerLabel}{" "}
                integration on the workspace
                page first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="messaging-message"
          className="text-sm font-medium"
        >
          Message
        </label>

        <textarea
          id="messaging-message"
          value={message}
          rows={5}
         maxLength={
         provider === "DISCORD"
            ? 2_000
            : 4_000
            }
          disabled={!canEdit}
          placeholder="Workflow completed: {{input}}"
          onChange={(event) =>
            onChange({
              message: event.target.value,
            })
          }
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <p className="text-xs text-muted-foreground">
          Use {"{{input}}"} to include the
          action input as JSON.
        </p>
      </div>
    </div>
  );
}
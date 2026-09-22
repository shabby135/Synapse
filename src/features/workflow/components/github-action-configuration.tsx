"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type GitHubActionConfigurationProps = {
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

export function GitHubActionConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: GitHubActionConfigurationProps) {
  const trpc = useTRPC();
  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "GITHUB",
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
          htmlFor="github-action-integration"
          className="text-sm font-medium"
        >
          GitHub integration
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
              id="github-action-integration"
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
                Connect GitHub on the
                workspace page first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="github-action-repository"
          className="text-sm font-medium"
        >
          Repository
        </label>
        <Input
          id="github-action-repository"
          value={text(
            configuration.repository
          )}
          disabled={!canEdit}
          placeholder="owner/repository"
          onChange={(event) =>
            onChange({
              repository:
                event.target.value,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Static owner/repository name.
          Expressions are not supported in
          this field.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="github-action-title"
          className="text-sm font-medium"
        >
          Issue title
        </label>
        <Input
          id="github-action-title"
          value={text(configuration.title)}
          maxLength={256}
          disabled={!canEdit}
          placeholder="Issue from {{input.name}}"
          onChange={(event) =>
            onChange({
              title: event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="github-action-body"
          className="text-sm font-medium"
        >
          Issue body
        </label>
        <textarea
          id="github-action-body"
          value={text(configuration.body)}
          rows={8}
          maxLength={65_536}
          disabled={!canEdit}
          placeholder="Created from Synapse data: {{input}}"
          onChange={(event) =>
            onChange({
              body: event.target.value,
            })
          }
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="github-action-labels"
          className="text-sm font-medium"
        >
          Labels
        </label>
        <Input
          id="github-action-labels"
          value={text(configuration.labels)}
          disabled={!canEdit}
          placeholder="bug, automation"
          onChange={(event) =>
            onChange({
              labels: event.target.value,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Optional comma-separated labels.
          Labels must already exist in the
          repository.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="github-action-assignees"
          className="text-sm font-medium"
        >
          Assignees
        </label>
        <Input
          id="github-action-assignees"
          value={text(
            configuration.assignees
          )}
          disabled={!canEdit}
          placeholder="octocat, teammate"
          onChange={(event) =>
            onChange({
              assignees:
                event.target.value,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Optional comma-separated GitHub
          usernames with repository access.
        </p>
      </div>
    </div>
  );
}

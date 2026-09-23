"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type JiraTriggerConfigurationProps = {
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

function text(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

export function JiraTriggerConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: JiraTriggerConfigurationProps) {
  const trpc = useTRPC();

  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "JIRA",
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

  const projectKey = text(
    configuration.projectKey
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
          htmlFor="jira-trigger-integration"
          className="text-sm font-medium"
        >
          Jira integration
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
              id="jira-trigger-integration"
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
                Connect Jira on the
                workspace page first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jira-trigger-project-key"
          className="text-sm font-medium"
        >
          Project key
        </label>

        <Input
          id="jira-trigger-project-key"
          value={projectKey}
          maxLength={10}
          disabled={!canEdit}
          placeholder="KAN"
          autoCapitalize="characters"
          spellCheck={false}
          onChange={(event) =>
            onChange({
              projectKey:
                event.target.value
                  .toUpperCase()
                  .replace(
                    /[^A-Z0-9_]/gu,
                    ""
                  )
                  .slice(0, 10),
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Enter the Jira project key,
          such as KAN. This is not the
          complete Jira project URL.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jira-trigger-start"
          className="text-sm font-medium"
        >
          Starting position
        </label>

        <select
          id="jira-trigger-start"
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
            Only issues created after
            publishing
          </option>

          <option value="FROM_BEGINNING">
            Process existing issues first
          </option>
        </select>

        <p className="text-xs text-muted-foreground">
          Processing existing issues may
          create multiple workflow runs.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jira-trigger-interval"
          className="text-sm font-medium"
        >
          Check for issues
        </label>

        <select
          id="jira-trigger-interval"
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
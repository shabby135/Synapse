"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type GitHubTriggerConfigurationProps = {
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

function labelsText(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .join(", ")
    : text(value);
}

export function GitHubTriggerConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: GitHubTriggerConfigurationProps) {
  const trpc = useTRPC();
  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "GITHUB",
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
  const repository = text(
    configuration.repository
  );
  const labels = labelsText(
    configuration.labels
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
          htmlFor="github-trigger-integration"
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
              id="github-trigger-integration"
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
                Connect GitHub on the
                workspace page first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="github-trigger-repository"
          className="text-sm font-medium"
        >
          Repository
        </label>
        <Input
          id="github-trigger-repository"
          value={repository}
          maxLength={140}
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
          Enter the repository as
          owner/repository. The connected
          account must be able to read it.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="github-trigger-labels"
          className="text-sm font-medium"
        >
          Issue labels
        </label>
        <Input
          id="github-trigger-labels"
          value={labels}
          maxLength={1_019}
          disabled={!canEdit}
          placeholder="bug, urgent"
          onChange={(event) =>
            onChange({
              labels: event.target.value,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Optional. Separate multiple labels
          with commas. Only issues matching
          the selected labels are detected.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="github-trigger-start"
          className="text-sm font-medium"
        >
          Starting position
        </label>
        <select
          id="github-trigger-start"
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
            Process existing matching issues
            first
          </option>
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="github-trigger-interval"
          className="text-sm font-medium"
        >
          Check for issues
        </label>
        <select
          id="github-trigger-interval"
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

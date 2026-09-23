"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type JiraActionConfigurationProps = {
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

export function JiraActionConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: JiraActionConfigurationProps) {
  const trpc = useTRPC();

  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "JIRA",
    })
  );

  const activeIntegrations =
    integrations.data?.filter(
      (integration) =>
        integration.status === "ACTIVE"
    ) ?? [];

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="space-y-2">
        <label
          htmlFor="jira-action-integration"
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
            {integrations.error.message}
          </p>
        ) : (
          <>
            <select
              id="jira-action-integration"
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
                Connect Jira on the
                workspace page first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jira-action-project-key"
          className="text-sm font-medium"
        >
          Project key
        </label>

        <Input
          id="jira-action-project-key"
          value={text(
            configuration.projectKey
          )}
          maxLength={10}
          disabled={!canEdit}
          placeholder="KAN"
          onChange={(event) =>
            onChange({
              projectKey:
                event.target.value
                  .toUpperCase(),
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Static Jira project key.
          Expressions are not supported in
          this field.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jira-action-issue-type-id"
          className="text-sm font-medium"
        >
          Issue type ID
        </label>

        <Input
          id="jira-action-issue-type-id"
          value={text(
            configuration.issueTypeId
          )}
          maxLength={32}
          inputMode="numeric"
          disabled={!canEdit}
          placeholder="10003"
          onChange={(event) =>
            onChange({
              issueTypeId:
                event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Static numeric Jira issue-type
          ID. Your Feature issue type used
          ID 10003 during the trigger test.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jira-action-summary"
          className="text-sm font-medium"
        >
          Issue summary
        </label>

        <Input
          id="jira-action-summary"
          value={text(
            configuration.summary
          )}
          maxLength={255}
          disabled={!canEdit}
          placeholder="Issue from {{input.name}}"
          onChange={(event) =>
            onChange({
              summary:
                event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jira-action-description"
          className="text-sm font-medium"
        >
          Description
        </label>

        <textarea
          id="jira-action-description"
          value={text(
            configuration.description
          )}
          rows={8}
          maxLength={32_767}
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

        <p className="text-xs text-muted-foreground">
          Plain text is converted to
          Atlassian Document Format before
          the issue is created.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jira-action-labels"
          className="text-sm font-medium"
        >
          Labels
        </label>

        <Input
          id="jira-action-labels"
          value={text(
            configuration.labels
          )}
          disabled={!canEdit}
          placeholder="automation, synapse"
          onChange={(event) =>
            onChange({
              labels:
                event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Optional comma-separated Jira
          labels or a mapped list. Labels
          cannot contain spaces.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jira-action-priority-id"
          className="text-sm font-medium"
        >
          Priority ID
        </label>

        <Input
          id="jira-action-priority-id"
          value={text(
            configuration.priorityId
          )}
          maxLength={32}
          disabled={!canEdit}
          placeholder="3 or {{input.priorityId}}"
          onChange={(event) =>
            onChange({
              priorityId:
                event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Optional numeric Jira priority
          ID. In your Jira test, Medium used
          priority ID 3.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jira-action-assignee-account-id"
          className="text-sm font-medium"
        >
          Assignee account ID
        </label>

        <Input
          id="jira-action-assignee-account-id"
          value={text(
            configuration.assigneeAccountId
          )}
          maxLength={256}
          disabled={!canEdit}
          placeholder="712020:... or {{input.assignee.accountId}}"
          onChange={(event) =>
            onChange({
              assigneeAccountId:
                event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Optional Atlassian account ID.
          Leave it empty to create an
          unassigned issue.
        </p>
      </div>
    </div>
  );
}

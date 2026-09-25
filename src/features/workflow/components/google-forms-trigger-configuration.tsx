"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type GoogleFormsTriggerConfigurationProps = {
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

export function GoogleFormsTriggerConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: GoogleFormsTriggerConfigurationProps) {
  const trpc = useTRPC();

  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "GOOGLE_FORMS",
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

  const formId = text(
    configuration.formId
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
          htmlFor="google-forms-trigger-integration"
          className="text-sm font-medium"
        >
          Google Forms integration
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
              id="google-forms-trigger-integration"
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
                Connect Google Forms on
                the workspace page first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="google-forms-trigger-form-id"
          className="text-sm font-medium"
        >
          Form ID
        </label>

        <Input
          id="google-forms-trigger-form-id"
          value={formId}
          maxLength={256}
          disabled={!canEdit}
          placeholder="1FAIpQLSc..."
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) =>
            onChange({
              formId:
                event.target.value.trim(),
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Copy the ID between
          &quot;/d/&quot; and
          &quot;/edit&quot; in the Google
          Form URL. Expressions are not
          supported in this field.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="google-forms-trigger-start"
          className="text-sm font-medium"
        >
          Starting position
        </label>

        <select
          id="google-forms-trigger-start"
          value={startMode}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              startMode:
                event.target.value,
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="FROM_NOW">
            Only responses submitted after
            publishing
          </option>

          <option value="FROM_BEGINNING">
            Process existing responses
            first
          </option>
        </select>

        <p className="text-xs text-muted-foreground">
          Processing existing responses
          may create multiple workflow
          runs.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="google-forms-trigger-interval"
          className="text-sm font-medium"
        >
          Check for responses
        </label>

        <select
          id="google-forms-trigger-interval"
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
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
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
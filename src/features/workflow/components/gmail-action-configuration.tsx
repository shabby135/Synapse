"use client";

import {
  useQuery,
} from "@tanstack/react-query";
import {
  Loader2,
} from "lucide-react";

import {
  Input,
} from "@/components/ui/input";
import {
  useTRPC,
} from "@/trpc/react";

type GmailActionConfigurationProps = {
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

function readText(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

export function GmailActionConfiguration({
  workspaceId,
  configuration,
  canEdit,
  onChange,
}: GmailActionConfigurationProps) {
  const trpc = useTRPC();

  const integrations = useQuery(
    trpc.integration.list.queryOptions({
      workspaceId,
      provider: "GMAIL",
    })
  );

  const activeIntegrations =
    integrations.data?.filter(
      (integration) =>
        integration.status ===
        "ACTIVE"
    ) ?? [];

  const integrationId = readText(
    configuration.integrationId
  );

  const to = readText(
    configuration.to
  );

  const cc = readText(
    configuration.cc
  );

  const bcc = readText(
    configuration.bcc
  );

  const replyTo = readText(
    configuration.replyTo
  );

  const subject = readText(
    configuration.subject
  );

  const body = readText(
    configuration.body
  );

  const contentType =
    configuration.contentType ===
    "HTML"
      ? "HTML"
      : "PLAIN_TEXT";

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="space-y-2">
        <label
          htmlFor="gmail-integration"
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
              id="gmail-integration"
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
                    key={
                      integration.id
                    }
                    value={
                      integration.id
                    }
                  >
                    {
                      integration.name
                    }
                  </option>
                )
              )}
            </select>

            {activeIntegrations.length ===
              0 && (
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
          htmlFor="gmail-to"
          className="text-sm font-medium"
        >
          To
        </label>

        <textarea
          id="gmail-to"
          value={to}
          rows={2}
          disabled={!canEdit}
          placeholder="person@example.com"
          onChange={(event) =>
            onChange({
              to: event.target.value,
            })
          }
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <p className="text-xs text-muted-foreground">
          Separate multiple email
          addresses with commas or new
          lines.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gmail-cc"
          className="text-sm font-medium"
        >
          Cc
        </label>

        <Input
          id="gmail-cc"
          value={cc}
          disabled={!canEdit}
          placeholder="copy@example.com"
          onChange={(event) =>
            onChange({
              cc: event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gmail-bcc"
          className="text-sm font-medium"
        >
          Bcc
        </label>

        <Input
          id="gmail-bcc"
          value={bcc}
          disabled={!canEdit}
          placeholder="hidden@example.com"
          onChange={(event) =>
            onChange({
              bcc: event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gmail-reply-to"
          className="text-sm font-medium"
        >
          Reply-to
        </label>

        <Input
          id="gmail-reply-to"
          type="email"
          value={replyTo}
          disabled={!canEdit}
          placeholder="support@example.com"
          onChange={(event) =>
            onChange({
              replyTo:
                event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gmail-subject"
          className="text-sm font-medium"
        >
          Subject
        </label>

        <Input
          id="gmail-subject"
          value={subject}
          maxLength={998}
          disabled={!canEdit}
          placeholder="Workflow update for {{input.name}}"
          onChange={(event) =>
            onChange({
              subject:
                event.target.value,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gmail-content-type"
          className="text-sm font-medium"
        >
          Content type
        </label>

        <select
          id="gmail-content-type"
          value={contentType}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              contentType:
                event.target.value,
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="PLAIN_TEXT">
            Plain text
          </option>

          <option value="HTML">
            HTML
          </option>
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gmail-body"
          className="text-sm font-medium"
        >
          Email body
        </label>

        <textarea
          id="gmail-body"
          value={body}
          rows={8}
          disabled={!canEdit}
          placeholder="Hello {{input.name}}"
          onChange={(event) =>
            onChange({
              body: event.target.value,
            })
          }
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <p className="text-xs text-muted-foreground">
          Recipient, subject, and body
          fields can use values from
          earlier workflow steps.
        </p>
      </div>
    </div>
  );
}
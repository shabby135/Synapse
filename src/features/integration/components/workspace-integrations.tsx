"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  providerCredentialFields,
  type CredentialPreview,
} from "@/features/integration/credential-definition";
import {
  getIntegrationProvider,
  integrationProviderValues,
  type IntegrationProvider,
} from "@/features/integration/provider-registry";
import { hasWorkspacePermission } from "@/features/workspace/permissions";
import { useTRPC } from "@/trpc/react";

type WorkspaceIntegrationsProps = {
  workspaceId: string;
};

type IntegrationStatus =
  | "ACTIVE"
  | "NEEDS_REAUTH"
  | "ERROR"
  | "DISABLED";

type IntegrationItem = {
  id: string;
  name: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  credentialPreview: CredentialPreview[];
  canTest: boolean;
  externalAccountName: string | null;
  lastTestedAt: Date | null;
  lastError: string | null;
};

type ConnectionDialogState =
  | {
      mode: "CREATE";
    }
  | {
      mode: "RECONNECT";
      integration: IntegrationItem;
    }
  | null;

const activeProviders =
  integrationProviderValues.filter(
    (provider) =>
      getIntegrationProvider(provider)
        .availability === "ACTIVE"
  );

const statusLabels: Record<
  IntegrationStatus,
  string
> = {
  ACTIVE: "Connected",
  NEEDS_REAUTH: "Reconnect required",
  ERROR: "Connection error",
  DISABLED: "Disabled",
};

const statusClasses: Record<
  IntegrationStatus,
  string
> = {
  ACTIVE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  NEEDS_REAUTH:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ERROR:
    "bg-destructive/10 text-destructive",
  DISABLED:
    "bg-muted text-muted-foreground",
};

function credentialPlaceholder(
  provider: IntegrationProvider,
  key: string
): string {
  if (key === "apiKey") {
    return `Enter your ${
      getIntegrationProvider(provider)
        .label
    } API key`;
  }

  if (
    provider === "SLACK" &&
    key === "webhookUrl"
  ) {
    return "https://hooks.slack.com/services/...";
  }

  if (
    provider === "DISCORD" &&
    key === "webhookUrl"
  ) {
    return "https://discord.com/api/webhooks/...";
  }

  return `Enter ${key}`;
}

export function WorkspaceIntegrations({
  workspaceId,
}: WorkspaceIntegrationsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [dialog, setDialog] =
    useState<ConnectionDialogState>(null);

  const [
    deleteIntegration,
    setDeleteIntegration,
  ] = useState<IntegrationItem | null>(
    null
  );

  const [provider, setProvider] =
    useState<IntegrationProvider>(
      activeProviders[0] ?? "SLACK"
    );

  const [name, setName] =
    useState("");

  const [credentials, setCredentials] =
    useState<Record<string, string>>(
      {}
    );

  const [
    oauthRedirecting,
    setOauthRedirecting,
  ] = useState(false);

  useEffect(() => {
    const currentUrl = new URL(
      window.location.href
    );

    const result =
      currentUrl.searchParams.get(
        "integration"
      );

    if (
      result !== "connected" &&
      result !== "failed"
    ) {
      return;
    }

    if (result === "connected") {
      toast.success(
        "OAuth connection saved successfully."
      );
    } else {
      toast.error(
        "OAuth connection failed. Please try again."
      );
    }

    currentUrl.searchParams.delete(
      "integration"
    );

    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
    );
  }, []);

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions({
      id: workspaceId,
    })
  );

  const canRead =
    workspace.isSuccess &&
    hasWorkspacePermission(
      workspace.data.role,
      "integration:read"
    );

  const canManage =
    workspace.isSuccess &&
    hasWorkspacePermission(
      workspace.data.role,
      "integration:manage"
    );

  const integrationOptions =
    trpc.integration.list.queryOptions({
      workspaceId,
    });

  const integrations = useQuery({
    ...integrationOptions,
    enabled: canRead,
  });

  const credentialFields = useMemo(
    () => {
      if (
        getIntegrationProvider(provider)
          .authStrategy === "OAUTH2"
      ) {
        return [];
      }

      return providerCredentialFields[
        provider
      ];
    },
    [provider]
  );

  const usesOAuth =
    getIntegrationProvider(provider)
      .authStrategy === "OAUTH2";

  async function refreshIntegrations() {
    await queryClient.invalidateQueries(
      trpc.integration.list.queryFilter({
        workspaceId,
      })
    );
  }

  function closeConnectionDialog() {
    setDialog(null);
    setName("");
    setCredentials({});
    setProvider(
      activeProviders[0] ?? "SLACK"
    );
  }

  const createIntegration = useMutation(
    trpc.integration.create.mutationOptions(
      {
        onSuccess: async () => {
          await refreshIntegrations();

          toast.success(
            "Connection tested and saved."
          );

          closeConnectionDialog();
        },
      }
    )
  );

  const reconnectIntegration =
    useMutation(
      trpc.integration.reconnect.mutationOptions(
        {
          onSuccess: async () => {
            await refreshIntegrations();

            toast.success(
              "Connection updated successfully."
            );

            closeConnectionDialog();
          },
        }
      )
    );

  const testConnection = useMutation(
    trpc.integration.test.mutationOptions(
      {
        onSuccess: async (result) => {
          await refreshIntegrations();

          if (
            result.status ===
            "CONNECTED"
          ) {
            toast.success(
              "Connection test succeeded."
            );
          } else {
            toast.error(
              result.message ??
                "Connection test failed."
            );
          }
        },
      }
    )
  );

  const removeIntegration = useMutation(
    trpc.integration.delete.mutationOptions(
      {
        onSuccess: async () => {
          await refreshIntegrations();

          toast.success(
            "Connection deleted."
          );

          setDeleteIntegration(null);
        },
      }
    )
  );

  const connectionPending =
    createIntegration.isPending ||
    reconnectIntegration.isPending ||
    oauthRedirecting;

  const connectionError =
    createIntegration.error ??
    reconnectIntegration.error;

  function openCreateDialog() {
    createIntegration.reset();
    reconnectIntegration.reset();

    setProvider(
      activeProviders[0] ?? "SLACK"
    );
    setName("");
    setCredentials({});
    setDialog({ mode: "CREATE" });
  }

  function openReconnectDialog(
    integration: IntegrationItem
  ) {
    createIntegration.reset();
    reconnectIntegration.reset();

    setProvider(integration.provider);
    setName(integration.name);
    setCredentials({});

    setDialog({
      mode: "RECONNECT",
      integration,
    });
  }

  function handleConnectionSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (usesOAuth) {
      const connectionName =
        dialog?.mode === "RECONNECT"
          ? dialog.integration.name
          : name.trim();

      if (
        connectionName.length < 2 ||
        connectionName.length > 50
      ) {
        return;
      }

      const url = new URL(
        "/api/integrations/oauth/start",
        window.location.origin
      );

      url.searchParams.set(
        "workspaceId",
        workspaceId
      );

      url.searchParams.set(
        "provider",
        provider
      );

      url.searchParams.set(
        "name",
        connectionName
      );

      if (
        dialog?.mode === "RECONNECT"
      ) {
        url.searchParams.set(
          "integrationId",
          dialog.integration.id
        );
      }

      setOauthRedirecting(true);

      window.location.assign(
        url.toString()
      );

      return;
    }

    const submittedCredentials =
      Object.fromEntries(
        Object.entries(credentials)
          .map(([key, value]) => [
            key,
            value.trim(),
          ])
          .filter(([, value]) => value)
      );

    if (dialog?.mode === "CREATE") {
      createIntegration.mutate({
        workspaceId,
        provider,
        name: name.trim(),
        credentials:
          submittedCredentials,
      });
    }

    if (
      dialog?.mode === "RECONNECT"
    ) {
      reconnectIntegration.mutate({
        id: dialog.integration.id,
        credentials:
          submittedCredentials,
      });
    }
  }

  if (
    workspace.isPending ||
    (canRead && integrations.isPending)
  ) {
    return (
      <Card id="connections">
        <CardContent className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (
    workspace.isError ||
    integrations.isError
  ) {
    const error =
      workspace.error ??
      integrations.error;

    return (
      <Card id="connections">
        <CardContent className="pt-6">
          <p className="font-medium text-destructive">
            Unable to load connections
          </p>

          <p className="mt-1 text-sm text-destructive">
            {error?.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canRead) {
    return null;
  }

  return (
    <>
      <Card id="connections">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>
                Connections
              </CardTitle>

              <CardDescription className="mt-1">
                Connect, test and manage
                encrypted credentials for
                this workspace.
              </CardDescription>
            </div>

            {canManage && (
              <Button
                type="button"
                onClick={openCreateDialog}
              >
                <Plus className="size-4" />
                Add connection
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {integrations.data?.length ? (
            <div className="space-y-3">
              {integrations.data.map(
                (integration) => {
                  const definition =
                    getIntegrationProvider(
                      integration.provider
                    );

                  return (
                    <div
                      key={integration.id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">
                              {
                                integration.name
                              }
                            </p>

                            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                              {
                                definition.label
                              }
                            </span>

                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${statusClasses[integration.status]}`}
                            >
                              {
                                statusLabels[
                                  integration
                                    .status
                                ]
                              }
                            </span>
                          </div>

                          {integration
                            .credentialPreview
                            .length > 0 && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {integration.credentialPreview
                                .filter(
                                  (field) =>
                                    field.configured
                                )
                                .map(
                                  (field) =>
                                    `${field.label}: ${field.displayValue}`
                                )
                                .join(" · ")}
                            </p>
                          )}

                          {integration.lastError && (
                            <p className="mt-2 text-sm text-destructive">
                              {
                                integration.lastError
                              }
                            </p>
                          )}

                          {integration.externalAccountName && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Account:{" "}
                              {
                                integration.externalAccountName
                              }
                            </p>
                          )}
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-2">
                            {integration.canTest && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                  testConnection.isPending
                                }
                                onClick={() =>
                                  testConnection.mutate(
                                    {
                                      id: integration.id,
                                    }
                                  )
                                }
                              >
                                <RefreshCw className="size-4" />
                                Test
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                openReconnectDialog(
                                  integration
                                )
                              }
                            >
                              <KeyRound className="size-4" />
                              Reconnect
                            </Button>

                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              aria-label={`Delete ${integration.name}`}
                              onClick={() =>
                                setDeleteIntegration(
                                  integration
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">
                No connections
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Add a provider connection to
                use it in workflows.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (
            !open &&
            !connectionPending
          ) {
            closeConnectionDialog();
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={
              handleConnectionSubmit
            }
            className="space-y-5"
          >
            <DialogHeader>
              <DialogTitle>
                {dialog?.mode ===
                "RECONNECT"
                  ? "Reconnect provider"
                  : "Add connection"}
              </DialogTitle>

              <DialogDescription>
                {usesOAuth
                  ? "You will continue to the provider to authorize Synapse. OAuth tokens are encrypted before storage."
                  : "Credentials are tested before being encrypted and saved. A test message will be sent to webhook-based providers."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label
                htmlFor="integration-provider"
                className="text-sm font-medium"
              >
                Provider
              </label>

              <select
                id="integration-provider"
                value={provider}
                disabled={
                  connectionPending ||
                  dialog?.mode ===
                    "RECONNECT"
                }
                onChange={(event) => {
                  setProvider(
                    event.target
                      .value as IntegrationProvider
                  );

                  setCredentials({});
                }}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {activeProviders.map(
                  (
                    availableProvider
                  ) => (
                    <option
                      key={
                        availableProvider
                      }
                      value={
                        availableProvider
                      }
                    >
                      {
                        getIntegrationProvider(
                          availableProvider
                        ).label
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            {dialog?.mode ===
              "CREATE" && (
              <div className="space-y-2">
                <label
                  htmlFor="integration-name"
                  className="text-sm font-medium"
                >
                  Name
                </label>

                <Input
                  id="integration-name"
                  value={name}
                  required
                  minLength={2}
                  maxLength={50}
                  placeholder="Team notifications"
                  disabled={
                    connectionPending
                  }
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                />
              </div>
            )}

            {credentialFields.map(
              (field) => (
                <div
                  key={field.key}
                  className="space-y-2"
                >
                  <label
                    htmlFor={`credential-${field.key}`}
                    className="text-sm font-medium"
                  >
                    {field.label}
                  </label>

                  <Input
                    id={`credential-${field.key}`}
                    type={
                      field.secret
                        ? "password"
                        : "text"
                    }
                    value={
                      credentials[
                        field.key
                      ] ?? ""
                    }
                    required={
                      field.required
                    }
                    autoComplete="off"
                    placeholder={credentialPlaceholder(
                      provider,
                      field.key
                    )}
                    disabled={
                      connectionPending
                    }
                    onChange={(event) =>
                      setCredentials(
                        (current) => ({
                          ...current,
                          [field.key]:
                            event.target
                              .value,
                        })
                      )
                    }
                  />
                </div>
              )
            )}

            {usesOAuth && (
              <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                Synapse never asks you to
                paste an OAuth access token.
                Sign in directly on the
                provider&apos;s authorization
                page.
              </p>
            )}

            {connectionError && (
              <p className="text-sm font-medium text-destructive">
                {
                  connectionError.message
                }
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={
                  connectionPending
                }
                onClick={
                  closeConnectionDialog
                }
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  connectionPending
                }
              >
                {connectionPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}

                {usesOAuth
                  ? `Continue to ${
                      getIntegrationProvider(
                        provider
                      ).label
                    }`
                  : "Test and save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={
          deleteIntegration !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !removeIntegration.isPending
          ) {
            setDeleteIntegration(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete connection?
            </DialogTitle>

            <DialogDescription>
              Workflows using this
              connection will fail until
              another credential is
              selected.
            </DialogDescription>
          </DialogHeader>

          {removeIntegration.error && (
            <p className="text-sm font-medium text-destructive">
              {
                removeIntegration.error
                  .message
              }
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={
                removeIntegration.isPending
              }
              onClick={() =>
                setDeleteIntegration(null)
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={
                !deleteIntegration ||
                removeIntegration.isPending
              }
              onClick={() => {
                if (deleteIntegration) {
                  removeIntegration.mutate(
                    {
                      id:
                        deleteIntegration.id,
                    }
                  );
                }
              }}
            >
              {removeIntegration.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
"use client";

import {
  useState,
  type FormEvent,
} from "react";
import {
  Loader2,
  Plus,
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
import { hasWorkspacePermission } from "@/features/workspace/permissions";
import { useTRPC } from "@/trpc/react";

type WorkspaceIntegrationsProps = {
  workspaceId: string;
};

type IntegrationProvider =
  | "SLACK"
  | "DISCORD";

type IntegrationItem = {
  id: string;
  name: string;
  provider: IntegrationProvider;
};

export function WorkspaceIntegrations({
  workspaceId,
}: WorkspaceIntegrationsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [
    createDialogOpen,
    setCreateDialogOpen,
  ] = useState(false);

  const [
    deleteIntegration,
    setDeleteIntegration,
  ] = useState<IntegrationItem | null>(
    null
  );

  const [provider, setProvider] =
    useState<IntegrationProvider>(
      "SLACK"
    );

  const [name, setName] =
    useState("");

  const [webhookUrl, setWebhookUrl] =
    useState("");

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

  const createIntegration = useMutation(
    trpc.integration.create.mutationOptions(
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries(
            trpc.integration.list.queryFilter(
              {
                workspaceId,
              }
            )
          );

          toast.success(
            "Integration created."
          );

          setCreateDialogOpen(false);
          setProvider("SLACK");
          setName("");
          setWebhookUrl("");
        },
      }
    )
  );

  const removeIntegration = useMutation(
    trpc.integration.delete.mutationOptions(
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries(
            trpc.integration.list.queryFilter(
              {
                workspaceId,
              }
            )
          );

          toast.success(
            "Integration deleted."
          );

          setDeleteIntegration(null);
        },
      }
    )
  );

  function handleCreate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    createIntegration.mutate({
      workspaceId,
      provider,
      name: name.trim(),
      webhookUrl:
        webhookUrl.trim(),
    });
  }

  if (
    workspace.isPending ||
    (canRead &&
      integrations.isPending)
  ) {
    return (
      <Card>
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
      <Card>
        <CardContent className="pt-6">
          <p className="font-medium text-destructive">
            Unable to load integrations
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
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>
                Integrations
              </CardTitle>

              <CardDescription className="mt-1">
                Secure webhook credentials
                available to workflows in
                this workspace.
              </CardDescription>
            </div>

            {canManage && (
              <Button
                type="button"
                onClick={() => {
                  createIntegration.reset();
                  setCreateDialogOpen(
                    true
                  );
                }}
              >
                <Plus className="size-4" />
                Add integration
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {integrations.data?.length ? (
            <div className="space-y-3">
              {integrations.data.map(
                (integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between gap-4 rounded-lg border p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {
                            integration.name
                          }
                        </p>

                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                          {
                            integration.provider
                          }
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Credential encrypted
                        and stored securely.
                      </p>
                    </div>

                    {canManage && (
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
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">
                No integrations
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Add a Slack or Discord
                webhook to use messaging
                actions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (
            !createIntegration.isPending
          ) {
            setCreateDialogOpen(open);
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={handleCreate}
            className="space-y-5"
          >
            <DialogHeader>
              <DialogTitle>
                Add integration
              </DialogTitle>

              <DialogDescription>
                The webhook URL will be
                encrypted before it is stored
                and will not be displayed
                again.
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
                  createIntegration.isPending
                }
                onChange={(event) =>
                  setProvider(
                    event.target
                      .value as IntegrationProvider
                  )
                }
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="SLACK">
                  Slack
                </option>

                <option value="DISCORD">
                  Discord
                </option>
              </select>
            </div>

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
                  createIntegration.isPending
                }
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="integration-webhook-url"
                className="text-sm font-medium"
              >
                Webhook URL
              </label>

              <Input
                id="integration-webhook-url"
                type="password"
                value={webhookUrl}
                required
                autoComplete="off"
                placeholder={
                  provider === "SLACK"
                    ? "https://hooks.slack.com/services/..."
                    : "https://discord.com/api/webhooks/..."
                }
                disabled={
                  createIntegration.isPending
                }
                onChange={(event) =>
                  setWebhookUrl(
                    event.target.value
                  )
                }
              />

              <p className="text-xs text-muted-foreground">
                This value cannot be viewed
                after saving.
              </p>
            </div>

            {createIntegration.error && (
              <p className="text-sm font-medium text-destructive">
                {
                  createIntegration.error
                    .message
                }
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={
                  createIntegration.isPending
                }
                onClick={() =>
                  setCreateDialogOpen(
                    false
                  )
                }
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  createIntegration.isPending
                }
              >
                {createIntegration.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}

                Save integration
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
              Delete integration?
            </DialogTitle>

            <DialogDescription>
              Workflows using this integration
              will fail until another
              credential is selected.
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
                removeIntegration.isPending
              }
              onClick={() => {
                if (deleteIntegration) {
                  removeIntegration.mutate({
                    id:
                      deleteIntegration.id,
                  });
                }
              }}
            >
              {removeIntegration.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}

              Delete integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
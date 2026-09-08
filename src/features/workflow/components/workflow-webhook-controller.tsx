"use client";

import {
  useState,
} from "react";
import {
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Webhook,
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
import { useTRPC } from "@/trpc/react";

type WorkflowWebhookControlProps = {
  workflowId: string;
  canManage: boolean;
  isActive: boolean;
};

export function WorkflowWebhookControl({
  workflowId,
  canManage,
  isActive,
}: WorkflowWebhookControlProps) {
  const trpc = useTRPC();
  const queryClient =
    useQueryClient();

  const [
    generatedUrl,
    setGeneratedUrl,
  ] = useState<string | null>(
    null
  );

  const [
    rotateDialogOpen,
    setRotateDialogOpen,
  ] = useState(false);

  const webhook = useQuery(
    trpc.workflowWebhook.get.queryOptions(
      {
        workflowId,
      }
    )
  );

  async function invalidateWebhook() {
    await queryClient.invalidateQueries(
      trpc.workflowWebhook.get.queryFilter(
        {
          workflowId,
        }
      )
    );
  }

  const createWebhook = useMutation(
    trpc.workflowWebhook.create.mutationOptions(
      {
        onSuccess: async (result) => {
          setGeneratedUrl(
            `${window.location.origin}${result.path}`
          );

          await invalidateWebhook();

          toast.success(
            "Webhook created."
          );
        },
      }
    )
  );

  const rotateWebhook = useMutation(
    trpc.workflowWebhook.rotate.mutationOptions(
      {
        onSuccess: async (result) => {
          setGeneratedUrl(
            `${window.location.origin}${result.path}`
          );

          setRotateDialogOpen(false);

          await invalidateWebhook();

          toast.success(
            "Webhook secret rotated."
          );
        },
      }
    )
  );

  const setEnabled = useMutation(
    trpc.workflowWebhook.setEnabled.mutationOptions(
      {
        onSuccess: async (result) => {
          await invalidateWebhook();

          toast.success(
            result.enabled
              ? "Webhook enabled."
              : "Webhook disabled."
          );
        },
      }
    )
  );

  async function copyWebhookUrl() {
    if (!generatedUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        generatedUrl
      );

      toast.success(
        "Webhook URL copied."
      );
    } catch {
      toast.error(
        "Unable to copy the webhook URL."
      );
    }
  }

  const mutationError =
    createWebhook.error ??
    rotateWebhook.error ??
    setEnabled.error;

  const isMutating =
    createWebhook.isPending ||
    rotateWebhook.isPending ||
    setEnabled.isPending;

  if (webhook.isPending) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (webhook.isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-medium text-destructive">
            Unable to load webhook
          </p>

          <p className="mt-1 text-sm text-destructive">
            {webhook.error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Webhook className="size-5" />

                <CardTitle>
                  Webhook trigger
                </CardTitle>
              </div>

              <CardDescription className="mt-2">
                Start this workflow by sending
                an authenticated JSON request.
              </CardDescription>
            </div>

            {webhook.data && (
              <span
                className={
                  webhook.data.enabled
                    ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                    : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                }
              >
                {webhook.data.enabled
                  ? "ENABLED"
                  : "DISABLED"}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!webhook.data ? (
            <>
              <p className="text-sm text-muted-foreground">
                No webhook has been created
                for this workflow.
              </p>

              {!isActive && (
                <p className="text-sm font-medium text-destructive">
                  Publish the workflow before
                  creating its webhook.
                </p>
              )}

              {canManage && (
                <Button
                  type="button"
                  disabled={
                    !isActive ||
                    createWebhook.isPending
                  }
                  onClick={() => {
                    setGeneratedUrl(null);

                    createWebhook.mutate({
                      workflowId,
                    });
                  }}
                >
                  {createWebhook.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}

                  Create webhook
                </Button>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isMutating}
                    onClick={() => {
                      setGeneratedUrl(null);
                      setRotateDialogOpen(true);
                    }}
                  >
                    <RefreshCw className="size-4" />
                    Rotate secret
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isMutating}
                    onClick={() =>
                      setEnabled.mutate({
                        workflowId,
                        enabled:
                          !webhook.data.enabled,
                      })
                    }
                  >
                    {setEnabled.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}

                    {webhook.data.enabled
                      ? "Disable webhook"
                      : "Enable webhook"}
                  </Button>
                </>
              )}
            </div>
          )}

          {generatedUrl && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">
                Webhook URL
              </p>

              <div className="flex gap-2">
                <Input
                  value={generatedUrl}
                  readOnly
                  type="password"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={
                    copyWebhookUrl
                  }
                  aria-label="Copy webhook URL"
                >
                  <Copy className="size-4" />
                </Button>
              </div>

              <p className="text-xs font-medium text-destructive">
                Copy this URL now. It cannot
                be displayed again after you
                leave or refresh this page.
              </p>
            </div>
          )}

          {webhook.data &&
            !generatedUrl && (
              <p className="text-sm text-muted-foreground">
                The existing secret is hidden.
                Rotate it if you need a new
                webhook URL.
              </p>
            )}

          {mutationError && (
            <p className="text-sm font-medium text-destructive">
              {mutationError.message}
            </p>
          )}

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Requests must use{" "}
            <code>
              Content-Type:
              application/json
            </code>{" "}
            and include a unique{" "}
            <code>
              Idempotency-Key
            </code>{" "}
            header.
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={rotateDialogOpen}
        onOpenChange={(open) => {
          if (
            !rotateWebhook.isPending
          ) {
            setRotateDialogOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rotate webhook secret?
            </DialogTitle>

            <DialogDescription>
              The current webhook URL will stop
              working immediately. Any external
              service using it must be updated
              with the new URL.
            </DialogDescription>
          </DialogHeader>

          {rotateWebhook.error && (
            <p className="text-sm font-medium text-destructive">
              {
                rotateWebhook.error
                  .message
              }
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={
                rotateWebhook.isPending
              }
              onClick={() =>
                setRotateDialogOpen(
                  false
                )
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={
                rotateWebhook.isPending
              }
              onClick={() =>
                rotateWebhook.mutate({
                  workflowId,
                })
              }
            >
              {rotateWebhook.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}

              Rotate secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
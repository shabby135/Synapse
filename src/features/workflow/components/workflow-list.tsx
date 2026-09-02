"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  Archive,
  ExternalLink,
  Loader2,
  Trash2,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { hasWorkspacePermission } from "@/features/workspace/permissions";
import { useTRPC } from "@/trpc/react";

type WorkflowListProps = {
  workspaceId: string;
};

type SelectedAction = {
  id: string;
  name: string;
  action: "archive" | "delete";
};

export function WorkflowList({
  workspaceId,
}: WorkflowListProps) {
  const trpc = useTRPC();

  const [
    includeArchived,
    setIncludeArchived,
  ] = useState(false);

  const [
    selectedAction,
    setSelectedAction,
  ] = useState<SelectedAction | null>(
    null
  );

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions({
      id: workspaceId,
    })
  );

  const workflows = useQuery(
    trpc.workflow.list.queryOptions({
      workspaceId,
      includeArchived,
    })
  );

  const archiveWorkflow = useMutation(
    trpc.workflow.archive.mutationOptions({
      onSuccess: async () => {
        setSelectedAction(null);
        toast.success("Workflow archived.");
        await workflows.refetch();
      },
    })
  );

  const deleteWorkflow = useMutation(
    trpc.workflow.delete.mutationOptions({
      onSuccess: async () => {
        setSelectedAction(null);

        toast.success(
          "Workflow permanently deleted."
        );

        await workflows.refetch();
      },
    })
  );

  const role = workspace.data?.role;

  const canDelete =
    role !== undefined &&
    hasWorkspacePermission(
      role,
      "workflow:delete"
    );

  const isActionPending =
    archiveWorkflow.isPending ||
    deleteWorkflow.isPending;

  const actionError =
    archiveWorkflow.error?.message ??
    deleteWorkflow.error?.message;

  function openConfirmation(
    workflowId: string,
    workflowName: string,
    action: SelectedAction["action"]
  ) {
    archiveWorkflow.reset();
    deleteWorkflow.reset();

    setSelectedAction({
      id: workflowId,
      name: workflowName,
      action,
    });
  }

  function handleConfirmedAction() {
    if (!selectedAction) {
      return;
    }

    if (
      selectedAction.action === "archive"
    ) {
      archiveWorkflow.mutate({
        id: selectedAction.id,
      });

      return;
    }

    deleteWorkflow.mutate({
      id: selectedAction.id,
    });
  }

  if (workflows.isPending) {
    return (
      <Card>
        <CardContent className="flex min-h-48 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (workflows.isError) {
    return (
      <Card>
        <CardContent>
          <p className="font-medium text-destructive">
            Unable to load workflows
          </p>

          <p className="mt-1 text-sm text-destructive">
            {workflows.error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>
                Workflows
              </CardTitle>

              <CardDescription className="mt-1">
                Create and manage automation
                workflows in this workspace.
              </CardDescription>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) =>
                  setIncludeArchived(
                    event.target.checked
                  )
                }
                className="size-4"
              />

              Show archived
            </label>
          </div>
        </CardHeader>

        <CardContent>
          {workflows.data.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed text-center">
              <WorkflowIcon className="size-8 text-muted-foreground" />

              <p className="mt-3 font-medium">
                No workflows yet
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Create your first workflow using
                the form above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.data.map(
                (workflowItem) => (
                  <div
                    key={workflowItem.id}
                    className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">
                          {workflowItem.name}
                        </p>

                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                          {workflowItem.status}
                        </span>
                      </div>

                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {workflowItem.description ??
                          "No description provided."}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        nativeButton={false}
                        size="sm"
                        variant="outline"
                        render={
                          <Link
                            href={`/workspaces/${workspaceId}/workflows/${workflowItem.id}`}
                          />
                        }
                      >
                        <ExternalLink className="size-4" />
                        Open
                      </Button>

                      {canDelete &&
                        workflowItem.status !==
                          "ARCHIVED" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openConfirmation(
                                workflowItem.id,
                                workflowItem.name,
                                "archive"
                              )
                            }
                          >
                            <Archive className="size-4" />
                            Archive
                          </Button>
                        )}

                      {canDelete && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            openConfirmation(
                              workflowItem.id,
                              workflowItem.name,
                              "delete"
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={selectedAction !== null}
        onOpenChange={(open) => {
          if (
            !open &&
            !isActionPending
          ) {
            setSelectedAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedAction?.action ===
              "delete"
                ? "Permanently delete workflow?"
                : "Archive workflow?"}
            </AlertDialogTitle>

            <AlertDialogDescription>
              You are about to{" "}
              {selectedAction?.action}{" "}
              <span className="font-semibold text-foreground">
                {selectedAction?.name}
              </span>
              .
            </AlertDialogDescription>

            {selectedAction?.action ===
              "delete" && (
              <p className="text-sm font-medium text-destructive">
                This permanently deletes every
                version of the workflow and cannot
                be undone.
              </p>
            )}
          </AlertDialogHeader>

          {actionError && (
            <p className="text-sm font-medium text-destructive">
              {actionError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isActionPending}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={isActionPending}
              className={
                selectedAction?.action ===
                "delete"
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                handleConfirmedAction();
              }}
            >
              {isActionPending && (
                <Loader2 className="size-4 animate-spin" />
              )}

              {selectedAction?.action ===
              "delete"
                ? "Delete permanently"
                : "Archive workflow"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
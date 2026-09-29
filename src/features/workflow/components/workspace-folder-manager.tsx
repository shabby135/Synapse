"use client";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Check,
  Folder,
  FolderPlus,
  Loader2,
  Pencil,
  Trash2,
  X,
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
import { Input } from "@/components/ui/input";
import { hasWorkspacePermission } from "@/features/workspace/permissions";
import { useTRPC } from "@/trpc/react";

type WorkspaceFolderManagerProps = {
  workspaceId: string;
};

type DeleteTarget = {
  id: string;
  name: string;
};

export function WorkspaceFolderManager({
  workspaceId,
}: WorkspaceFolderManagerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [editingId, setEditingId] =
    useState<string | null>(null);
  const [editingName, setEditingName] =
    useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<DeleteTarget | null>(null);

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions({
      id: workspaceId,
    })
  );

  const folders = useQuery(
    trpc.workflowFolder.list.queryOptions({
      workspaceId,
    })
  );

  const workflows = useQuery(
    trpc.workflow.list.queryOptions({
      workspaceId,
      includeArchived: true,
    })
  );

  async function invalidateFolderData() {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.workflowFolder.list.queryFilter({
          workspaceId,
        })
      ),
      queryClient.invalidateQueries(
        trpc.workflowFolder.listAll.queryFilter()
      ),
    ]);
  }

  async function invalidateWorkflowData() {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.workflow.list.queryFilter({
          workspaceId,
          includeArchived: true,
        })
      ),
      queryClient.invalidateQueries(
        trpc.workflow.listAll.queryFilter({
          includeArchived: true,
          favoritesOnly: false,
        })
      ),
      queryClient.invalidateQueries(
        trpc.workflow.listAll.queryFilter({
          includeArchived: true,
          favoritesOnly: true,
        })
      ),
    ]);
  }

  const createFolder = useMutation(
    trpc.workflowFolder.create.mutationOptions({
      onSuccess: async () => {
        setName("");
        await invalidateFolderData();
        toast.success("Folder created.");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const renameFolder = useMutation(
    trpc.workflowFolder.rename.mutationOptions({
      onSuccess: async () => {
        setEditingId(null);
        setEditingName("");
        await invalidateFolderData();
        toast.success("Folder renamed.");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const deleteFolder = useMutation(
    trpc.workflowFolder.delete.mutationOptions({
      onSuccess: async () => {
        setDeleteTarget(null);
        await Promise.all([
          invalidateFolderData(),
          invalidateWorkflowData(),
        ]);

        toast.success(
          "Folder deleted. Its workflows are now unfiled."
        );
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const moveWorkflow = useMutation(
    trpc.workflowFolder.moveWorkflow.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          invalidateFolderData(),
          invalidateWorkflowData(),
        ]);
        toast.success("Workflow moved.");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const folderRows = useMemo(
    () => folders.data ?? [],
    [folders.data]
  );

  const workflowRows = useMemo(
    () => workflows.data ?? [],
    [workflows.data]
  );

  const role = workspace.data?.role;

  const canCreate =
    role !== undefined &&
    hasWorkspacePermission(
      role,
      "workflow:create"
    );

  const canManage =
    role !== undefined &&
    hasWorkspacePermission(
      role,
      "workflow:update"
    );

  function handleCreate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedName = name.trim();

    if (normalizedName.length < 2) {
      return;
    }

    createFolder.mutate({
      workspaceId,
      name: normalizedName,
    });
  }

  function handleRename(folderId: string) {
    const normalizedName =
      editingName.trim();

    if (normalizedName.length < 2) {
      return;
    }

    renameFolder.mutate({
      id: folderId,
      name: normalizedName,
    });
  }

  if (
    workspace.isPending ||
    folders.isPending ||
    workflows.isPending
  ) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const queryError =
    workspace.error ??
    folders.error ??
    workflows.error;

  if (queryError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-5">
          <p className="font-medium text-destructive">
            Unable to load folders
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {queryError.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
      <CardHeader>
        <CardTitle>Folders</CardTitle>
        <CardDescription>
          Organize this workspace&apos;s workflows without changing how they run.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {canCreate && (
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              placeholder="New folder name"
              aria-label="New folder name"
              minLength={2}
              maxLength={50}
              disabled={createFolder.isPending}
            />

            <Button
              type="submit"
              disabled={
                createFolder.isPending ||
                name.trim().length < 2
              }
            >
              {createFolder.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FolderPlus className="size-4" />
              )}
              Create folder
            </Button>
          </form>
        )}

        {folderRows.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center">
            <Folder className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">
              No folders yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a folder, then move workflows into it from the workflow list.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {folderRows.map((folder) => {
              const editing =
                editingId === folder.id;
              const renamePending =
                renameFolder.isPending &&
                renameFolder.variables?.id ===
                  folder.id;
              const deletePending =
                deleteFolder.isPending &&
                deleteFolder.variables?.id ===
                  folder.id;

              return (
                <div
                  key={folder.id}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Folder className="size-4" />
                    </span>

                    {editing ? (
                      <Input
                        value={editingName}
                        onChange={(event) => {
                          setEditingName(
                            event.target.value
                          );
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleRename(folder.id);
                          }

                          if (event.key === "Escape") {
                            setEditingId(null);
                            setEditingName("");
                          }
                        }}
                        aria-label={`Rename ${folder.name}`}
                        minLength={2}
                        maxLength={50}
                        disabled={renamePending}
                        className="max-w-sm"
                        autoFocus
                      />
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {folder.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {folder.workflowCount}{" "}
                          {folder.workflowCount === 1
                            ? "workflow"
                            : "workflows"}
                        </p>
                      </div>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      {editing ? (
                        <>
                          <button
                            type="button"
                            aria-label={`Save ${folder.name}`}
                            disabled={
                              renamePending ||
                              editingName.trim().length < 2
                            }
                            onClick={() => {
                              handleRename(folder.id);
                            }}
                            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                          >
                            {renamePending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            aria-label="Cancel rename"
                            disabled={renamePending}
                            onClick={() => {
                              setEditingId(null);
                              setEditingName("");
                            }}
                            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                          >
                            <X className="size-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Rename ${folder.name}`}
                          onClick={() => {
                            setEditingId(folder.id);
                            setEditingName(folder.name);
                          }}
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        aria-label={`Delete ${folder.name}`}
                        disabled={deletePending}
                        onClick={() => {
                          deleteFolder.reset();
                          setDeleteTarget({
                            id: folder.id,
                            name: folder.name,
                          });
                        }}
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        {deletePending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {workflowRows.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <div>
              <h3 className="text-sm font-semibold">
                Organize workflows
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Assign each workflow to a folder or leave it unfiled.
              </p>
            </div>

            <div className="divide-y rounded-lg border">
              {workflowRows.map((workflow) => {
                const movePending =
                  moveWorkflow.isPending &&
                  moveWorkflow.variables
                    ?.workflowId === workflow.id;

                return (
                  <div
                    key={workflow.id}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {workflow.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {workflow.status.toLowerCase()}
                      </p>
                    </div>

                    {canManage ? (
                      <div className="relative w-full sm:w-56">
                        <select
                          value={workflow.folderId ?? ""}
                          aria-label={`Folder for ${workflow.name}`}
                          disabled={movePending}
                          onChange={(event) => {
                            moveWorkflow.mutate({
                              workflowId: workflow.id,
                              folderId:
                                event.target.value ||
                                null,
                            });
                          }}
                          className="h-9 w-full rounded-md border bg-background px-3 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                        >
                          <option value="">
                            Unfiled
                          </option>
                          {folderRows.map((folder) => (
                            <option
                              key={folder.id}
                              value={folder.id}
                            >
                              {folder.name}
                            </option>
                          ))}
                        </select>

                        {movePending && (
                          <Loader2 className="pointer-events-none absolute right-8 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {folderRows.find(
                          (folder) =>
                            folder.id ===
                            workflow.folderId
                        )?.name ?? "Unfiled"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteFolder.isPending) {
            setDeleteTarget(null);
            deleteFolder.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete folder?
            </AlertDialogTitle>

            <AlertDialogDescription>
              The folder{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              will be deleted. Workflows inside it will remain available and become unfiled.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteFolder.error && (
            <p className="text-sm font-medium text-destructive">
              {deleteFolder.error.message}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteFolder.isPending}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={deleteFolder.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();

                if (deleteTarget) {
                  deleteFolder.mutate({
                    id: deleteTarget.id,
                  });
                }
              }}
            >
              {deleteFolder.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

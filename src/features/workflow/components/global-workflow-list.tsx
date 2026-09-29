"use client";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Check,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock3,
  Folder,
  FolderCog,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Workflow,
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
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type WorkflowStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ARCHIVED";

type StatusFilter =
  | "ALL"
  | WorkflowStatus;

type FolderFilter =
  | "ALL"
  | "UNFILED"
  | string;

type GlobalWorkflowListProps = {
  favoritesOnly?: boolean;
};

type DeleteTarget = {
  id: string;
  name: string;
};

const statusFilters: ReadonlyArray<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
];

const workflowStatusClasses: Record<
  WorkflowStatus,
  string
> = {
  ACTIVE:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  DRAFT:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ARCHIVED:
    "border-border bg-muted text-muted-foreground",
};

function formatDate(
  value: Date | string
): string {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(new Date(value));
}

function RunStatusIcon({
  status,
}: {
  status: string;
}) {
  switch (status) {
    case "SUCCESS":
      return (
        <CircleCheck className="size-4 text-emerald-600" />
      );

    case "FAILED":
      return (
        <CircleX className="size-4 text-destructive" />
      );

    case "RUNNING":
      return (
        <Loader2 className="size-4 animate-spin text-blue-600" />
      );

    case "PENDING":
      return (
        <Clock3 className="size-4 text-amber-600" />
      );

    default:
      return (
        <CircleDashed className="size-4 text-muted-foreground" />
      );
  }
}

export function GlobalWorkflowList({
  favoritesOnly = false,
}: GlobalWorkflowListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [query, setQuery] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<StatusFilter>("ALL");

  const [
    folderFilter,
    setFolderFilter,
  ] = useState<FolderFilter>("ALL");

  const [
    folderManagerOpen,
    setFolderManagerOpen,
  ] = useState(false);

  const [
    createWorkspaceId,
    setCreateWorkspaceId,
  ] = useState("");

  const [
    newFolderName,
    setNewFolderName,
  ] = useState("");

  const [
    editingFolderId,
    setEditingFolderId,
  ] = useState<string | null>(null);

  const [
    editingFolderName,
    setEditingFolderName,
  ] = useState("");

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState<DeleteTarget | null>(null);

  const workflows = useQuery(
    trpc.workflow.listAll.queryOptions({
      includeArchived: true,
      favoritesOnly,
    })
  );

  const folders = useQuery(
    trpc.workflowFolder.listAll.queryOptions()
  );

  const workspaces = useQuery(
    trpc.workspace.list.queryOptions()
  );

  async function invalidateWorkflowLists() {
    await Promise.all([
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

  async function invalidateFolders() {
    await queryClient.invalidateQueries(
      trpc.workflowFolder.listAll.queryFilter()
    );
  }

  const setFavorite = useMutation(
    trpc.workflow.setFavorite.mutationOptions({
      onSuccess: async (
        _result,
        variables
      ) => {
        await invalidateWorkflowLists();

        toast.success(
          variables.favorite
            ? "Added to favorites."
            : "Removed from favorites."
        );
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const createFolder = useMutation(
    trpc.workflowFolder.create.mutationOptions({
      onSuccess: async () => {
        setNewFolderName("");
        await invalidateFolders();
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
        setEditingFolderId(null);
        setEditingFolderName("");
        await invalidateFolders();
        toast.success("Folder renamed.");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const deleteFolder = useMutation(
    trpc.workflowFolder.delete.mutationOptions({
      onSuccess: async (_result, variables) => {
        setDeleteTarget(null);

        if (folderFilter === variables.id) {
          setFolderFilter("ALL");
        }

        await Promise.all([
          invalidateFolders(),
          invalidateWorkflowLists(),
        ]);

        toast.success(
          "Folder deleted. Its automations are now unfiled."
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
          invalidateFolders(),
          invalidateWorkflowLists(),
        ]);
        toast.success("Automation moved.");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const workflowRows = useMemo(
    () => workflows.data ?? [],
    [workflows.data]
  );

  const folderRows = useMemo(
    () => folders.data ?? [],
    [folders.data]
  );

  const workspaceRows = useMemo(
    () => workspaces.data ?? [],
    [workspaces.data]
  );

  const manageableWorkspaces =
    useMemo(
      () =>
        workspaceRows.filter(
          (workspace) =>
            workspace.role !== "VIEWER"
        ),
      [workspaceRows]
    );

  const workspaceRoleById = useMemo(
    () =>
      new Map(
        workspaceRows.map(
          (workspace) => [
            workspace.id,
            workspace.role,
          ]
        )
      ),
    [workspaceRows]
  );

  const counts = useMemo(() => {
    const result: Record<
      StatusFilter,
      number
    > = {
      ALL: workflowRows.length,
      ACTIVE: 0,
      DRAFT: 0,
      ARCHIVED: 0,
    };

    for (const workflowItem of workflowRows) {
      result[workflowItem.status] += 1;
    }

    return result;
  }, [workflowRows]);

  const visibleWorkflows = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLowerCase();

    return workflowRows.filter(
      (workflowItem) => {
        const matchesStatus =
          statusFilter === "ALL" ||
          workflowItem.status ===
            statusFilter;

        const matchesFolder =
          folderFilter === "ALL" ||
          (folderFilter === "UNFILED"
            ? workflowItem.folderId === null
            : workflowItem.folderId ===
              folderFilter);

        const matchesQuery =
          !normalizedQuery ||
          workflowItem.name
            .toLowerCase()
            .includes(normalizedQuery) ||
          (workflowItem.description ?? "")
            .toLowerCase()
            .includes(normalizedQuery) ||
          workflowItem.workspaceName
            .toLowerCase()
            .includes(normalizedQuery);

        return (
          matchesStatus &&
          matchesFolder &&
          matchesQuery
        );
      }
    );
  }, [
    folderFilter,
    query,
    statusFilter,
    workflowRows,
  ]);

  function handleCreateFolder(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const name = newFolderName.trim();

    if (!createWorkspaceId || !name) {
      return;
    }

    createFolder.mutate({
      workspaceId: createWorkspaceId,
      name,
    });
  }

  function handleRenameFolder(
    folderId: string
  ) {
    const name = editingFolderName.trim();

    if (!name) {
      return;
    }

    renameFolder.mutate({
      id: folderId,
      name,
    });
  }

  const loading =
    workflows.isPending ||
    folders.isPending ||
    workspaces.isPending;

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const queryError =
    workflows.error ??
    folders.error ??
    workspaces.error;

  if (queryError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          Unable to load automation data
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          {queryError.message}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const active =
              statusFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => {
                  setStatusFilter(filter.value);
                }}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {filter.label}

                <span className="ml-2 text-xs opacity-70">
                  {counts[filter.value]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <label className="relative min-w-48">
            <span className="sr-only">
              Filter by folder
            </span>

            <Folder className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <select
              value={folderFilter}
              onChange={(event) => {
                setFolderFilter(
                  event.target.value
                );
              }}
              className="h-9 w-full appearance-none rounded-md border bg-background pl-9 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="ALL">
                All folders
              </option>
              <option value="UNFILED">
                Unfiled
              </option>
              {folderRows.map((folder) => (
                <option
                  key={folder.id}
                  value={folder.id}
                >
                  {folder.workspaceName} / {folder.name}
                </option>
              ))}
            </select>
          </label>

          {!favoritesOnly && (
            <button
              type="button"
              onClick={() => {
                setFolderManagerOpen(
                  (current) => !current
                );
              }}
              aria-expanded={folderManagerOpen}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <FolderCog className="size-4" />
              Manage folders
            </button>
          )}

          <div className="relative min-w-64 flex-1 xl:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={
                favoritesOnly
                  ? "Search favorites..."
                  : "Search automations..."
              }
              aria-label={
                favoritesOnly
                  ? "Search favorite automations"
                  : "Search automations"
              }
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {folderManagerOpen &&
        !favoritesOnly && (
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <div>
              <h2 className="font-semibold">
                Workflow folders
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Folders belong to one workspace. A workflow can be in one folder at a time.
              </p>
            </div>

            <form
              onSubmit={handleCreateFolder}
              className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
            >
              <select
                value={createWorkspaceId}
                onChange={(event) => {
                  setCreateWorkspaceId(
                    event.target.value
                  );
                }}
                aria-label="Folder workspace"
                disabled={
                  createFolder.isPending
                }
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="">
                  Select workspace
                </option>
                {manageableWorkspaces.map(
                  (workspace) => (
                    <option
                      key={workspace.id}
                      value={workspace.id}
                    >
                      {workspace.name}
                    </option>
                  )
                )}
              </select>

              <Input
                value={newFolderName}
                onChange={(event) => {
                  setNewFolderName(
                    event.target.value
                  );
                }}
                placeholder="Folder name"
                aria-label="New folder name"
                minLength={2}
                maxLength={50}
                disabled={
                  createFolder.isPending
                }
              />

              <button
                type="submit"
                disabled={
                  createFolder.isPending ||
                  !createWorkspaceId ||
                  newFolderName.trim().length < 2
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createFolder.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FolderPlus className="size-4" />
                )}
                Create folder
              </button>
            </form>

            {folderRows.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No folders have been created yet.
              </p>
            ) : (
              <div className="mt-4 divide-y rounded-lg border">
                {folderRows.map((folder) => {
                  const role =
                    workspaceRoleById.get(
                      folder.workspaceId
                    );
                  const canManage =
                    role !== "VIEWER";
                  const editing =
                    editingFolderId ===
                    folder.id;
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
                            value={
                              editingFolderName
                            }
                            onChange={(event) => {
                              setEditingFolderName(
                                event.target.value
                              );
                            }}
                            onKeyDown={(event) => {
                              if (
                                event.key === "Enter"
                              ) {
                                event.preventDefault();
                                handleRenameFolder(
                                  folder.id
                                );
                              }

                              if (
                                event.key === "Escape"
                              ) {
                                setEditingFolderId(
                                  null
                                );
                                setEditingFolderName(
                                  ""
                                );
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
                            <p className="truncate text-xs text-muted-foreground">
                              {folder.workspaceName} · {folder.workflowCount} {folder.workflowCount === 1 ? "automation" : "automations"}
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
                                  editingFolderName.trim().length < 2
                                }
                                onClick={() => {
                                  handleRenameFolder(
                                    folder.id
                                  );
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
                                  setEditingFolderId(null);
                                  setEditingFolderName("");
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
                                setEditingFolderId(
                                  folder.id
                                );
                                setEditingFolderName(
                                  folder.name
                                );
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
          </div>
        )}

      {workflowRows.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 text-center">
          <div className="flex size-11 items-center justify-center rounded-lg border bg-background">
            {favoritesOnly ? (
              <Star className="size-5 text-muted-foreground" />
            ) : (
              <Workflow className="size-5" />
            )}
          </div>

          <h2 className="mt-4 font-semibold">
            {favoritesOnly
              ? "No favorite automations"
              : "No automations yet"}
          </h2>

          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {favoritesOnly
              ? "Select the star beside an automation to keep it here."
              : "Create a workflow manually or describe what you want Synapse to automate."}
          </p>

          {!favoritesOnly && (
            <Link
              href="/workspaces?create=assistant"
              className="mt-5 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-4" />
              Create automation
            </Link>
          )}
        </div>
      ) : visibleWorkflows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <p className="font-medium">
            No matching {favoritesOnly ? "favorites" : "automations"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search, status, or folder filter.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_7rem_8rem_6rem_3rem] gap-3 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Automation</span>
            <span>Workspace</span>
            <span>Folder</span>
            <span>Status</span>
            <span>Latest run</span>
            <span>Updated</span>
            <span className="sr-only">Favorite</span>
          </div>

          <div className="divide-y">
            {visibleWorkflows.map(
              (workflowItem) => {
                const href =
                  `/workspaces/${workflowItem.workspaceId}/workflows/${workflowItem.id}`;
                const workspaceFolders =
                  folderRows.filter(
                    (folder) =>
                      folder.workspaceId ===
                      workflowItem.workspaceId
                  );
                const canMove =
                  workflowItem.workspaceRole !==
                  "VIEWER";
                const favoritePending =
                  setFavorite.isPending &&
                  setFavorite.variables
                    ?.workflowId ===
                    workflowItem.id;
                const movePending =
                  moveWorkflow.isPending &&
                  moveWorkflow.variables
                    ?.workflowId ===
                    workflowItem.id;

                return (
                  <div
                    key={workflowItem.id}
                    className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/40 lg:grid-cols-[minmax(0,2fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_7rem_8rem_6rem_3rem] lg:items-center lg:gap-3"
                  >
                    <Link
                      href={href}
                      className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                        <Workflow className="size-4" />
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium hover:underline">
                          {workflowItem.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {workflowItem.description || "No description"}
                        </span>
                      </span>
                    </Link>

                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {workflowItem.workspaceName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {workflowItem.workspaceRole}
                      </p>
                    </div>

                    <div>
                      {canMove ? (
                        <select
                          value={workflowItem.folderId ?? ""}
                          aria-label={`Folder for ${workflowItem.name}`}
                          disabled={movePending}
                          onChange={(event) => {
                            moveWorkflow.mutate({
                              workflowId:
                                workflowItem.id,
                              folderId:
                                event.target.value ||
                                null,
                            });
                          }}
                          className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                        >
                          <option value="">
                            Unfiled
                          </option>
                          {workspaceFolders.map(
                            (folder) => (
                              <option
                                key={folder.id}
                                value={folder.id}
                              >
                                {folder.name}
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {workspaceFolders.find(
                            (folder) =>
                              folder.id ===
                              workflowItem.folderId
                          )?.name ?? "Unfiled"}
                        </span>
                      )}
                    </div>

                    <div>
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${
                          workflowStatusClasses[
                            workflowItem.status
                          ]
                        }`}
                      >
                        {workflowItem.status.toLowerCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {workflowItem.latestRun ? (
                        <>
                          <RunStatusIcon
                            status={
                              workflowItem.latestRun.status
                            }
                          />
                          <span className="capitalize text-muted-foreground">
                            {workflowItem.latestRun.status.toLowerCase()}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Never run
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {formatDate(
                        workflowItem.updatedAt
                      )}
                    </p>

                    <button
                      type="button"
                      aria-label={
                        workflowItem.isFavorite
                          ? `Remove ${workflowItem.name} from favorites`
                          : `Add ${workflowItem.name} to favorites`
                      }
                      aria-pressed={
                        workflowItem.isFavorite
                      }
                      title={
                        workflowItem.isFavorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      disabled={favoritePending}
                      onClick={() => {
                        setFavorite.mutate({
                          workflowId:
                            workflowItem.id,
                          favorite:
                            !workflowItem.isFavorite,
                        });
                      }}
                      className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {favoritePending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Star
                          className={`size-4 ${
                            workflowItem.isFavorite
                              ? "fill-amber-400 text-amber-500"
                              : ""
                          }`}
                        />
                      )}
                    </button>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

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
              will be deleted. Automations inside it will remain available and become unfiled.
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
    </section>
  );
}

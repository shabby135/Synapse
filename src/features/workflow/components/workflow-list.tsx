"use client";

import {
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock3,
  ExternalLink,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  hasWorkspacePermission,
} from "@/features/workspace/permissions";
import { useTRPC } from "@/trpc/react";

type WorkflowListProps = {
  workspaceId: string;
};

type WorkflowStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ARCHIVED";

type StatusFilter =
  | "ALL"
  | WorkflowStatus;

type SelectedAction = {
  id: string;
  name: string;
  action: "archive" | "delete";
};

type RunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

const statusFilters: Array<{
  value: StatusFilter;
  label: string;
}> = [
  {
    value: "ALL",
    label: "All",
  },
  {
    value: "ACTIVE",
    label: "Active",
  },
  {
    value: "DRAFT",
    label: "Draft",
  },
  {
    value: "ARCHIVED",
    label: "Archived",
  },
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

const runStatusClasses: Record<
  RunStatus,
  string
> = {
  PENDING: "bg-amber-500",
  RUNNING: "bg-blue-500",
  SUCCESS: "bg-emerald-500",
  FAILED: "bg-destructive",
  CANCELLED:
    "bg-muted-foreground",
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
      timeZone: "UTC",
    }
  ).format(new Date(value));
}

function formatDuration({
  startedAt,
  completedAt,
}: {
  startedAt:
    | Date
    | string
    | null;
  completedAt:
    | Date
    | string
    | null;
}): string | null {
  if (!startedAt) {
    return null;
  }

  const start =
    new Date(
      startedAt
    ).getTime();

  const end = completedAt
    ? new Date(
        completedAt
      ).getTime()
    : Date.now();

  const duration = Math.max(
    0,
    end - start
  );

  if (duration < 1_000) {
    return `${duration}ms`;
  }

  if (duration < 60_000) {
    return `${(
      duration / 1_000
    ).toFixed(1)}s`;
  }

  const minutes = Math.floor(
    duration / 60_000
  );

  const seconds = Math.floor(
    (duration % 60_000) /
      1_000
  );

  return `${minutes}m ${seconds}s`;
}

function RunStatusIcon({
  status,
}: {
  status: RunStatus;
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

    case "CANCELLED":
      return (
        <CircleDashed className="size-4 text-muted-foreground" />
      );
  }
}

export function WorkflowList({
  workspaceId,
}: WorkflowListProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient =
    useQueryClient();

  const [query, setQuery] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      "ALL"
    );

  const [
    createDialogOpen,
    setCreateDialogOpen,
  ] = useState(false);

  const [
    workflowName,
    setWorkflowName,
  ] = useState("");

  const [
    workflowDescription,
    setWorkflowDescription,
  ] = useState("");

  const [
    selectedAction,
    setSelectedAction,
  ] =
    useState<SelectedAction | null>(
      null
    );

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions(
      {
        id: workspaceId,
      }
    )
  );

  const workflows = useQuery(
    trpc.workflow.list.queryOptions(
      {
        workspaceId,
        includeArchived: true,
      }
    )
  );

  const createWorkflow =
    useMutation(
      trpc.workflow.create.mutationOptions(
        {
          onSuccess: async (
            createdWorkflow
          ) => {
            await queryClient.invalidateQueries(
              trpc.workflow.list.queryFilter(
                {
                  workspaceId,
                  includeArchived:
                    true,
                }
              )
            );

            setWorkflowName("");
            setWorkflowDescription(
              ""
            );
            setCreateDialogOpen(
              false
            );

            toast.success(
              "Workflow created."
            );

            router.push(
              `/workspaces/${workspaceId}/workflows/${createdWorkflow.id}`
            );
          },
        }
      )
    );

  const archiveWorkflow =
    useMutation(
      trpc.workflow.archive.mutationOptions(
        {
          onSuccess: async () => {
            setSelectedAction(
              null
            );

            toast.success(
              "Workflow archived."
            );

            await workflows.refetch();
          },
        }
      )
    );

  const deleteWorkflow =
    useMutation(
      trpc.workflow.delete.mutationOptions(
        {
          onSuccess: async () => {
            setSelectedAction(
              null
            );

            toast.success(
              "Workflow permanently deleted."
            );

            await workflows.refetch();
          },
        }
      )
    );

  const role =
    workspace.data?.role;

  const canCreate =
    role !== undefined &&
    hasWorkspacePermission(
      role,
      "workflow:create"
    );

  const canDelete =
    role !== undefined &&
    hasWorkspacePermission(
      role,
      "workflow:delete"
    );

  const workflowRows =
    useMemo(
      () =>
        workflows.data ?? [],
      [workflows.data]
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

    for (
      const workflowItem of
      workflowRows
    ) {
      result[
        workflowItem.status
      ] += 1;
    }

    return result;
  }, [workflowRows]);

  const visibleWorkflows =
    useMemo(() => {
      const normalizedQuery =
        query
          .trim()
          .toLowerCase();

      return workflowRows.filter(
        (workflowItem) => {
          const matchesStatus =
            statusFilter ===
              "ALL" ||
            workflowItem.status ===
              statusFilter;

          const matchesQuery =
            !normalizedQuery ||
            workflowItem.name
              .toLowerCase()
              .includes(
                normalizedQuery
              ) ||
            (
              workflowItem.description ??
              ""
            )
              .toLowerCase()
              .includes(
                normalizedQuery
              );

          return (
            matchesStatus &&
            matchesQuery
          );
        }
      );
    }, [
      query,
      statusFilter,
      workflowRows,
    ]);

  const isActionPending =
    archiveWorkflow.isPending ||
    deleteWorkflow.isPending;

  const actionError =
    archiveWorkflow.error
      ?.message ??
    deleteWorkflow.error
      ?.message;

  function openConfirmation(
    workflowId: string,
    workflowNameValue: string,
    action: SelectedAction["action"]
  ) {
    archiveWorkflow.reset();
    deleteWorkflow.reset();

    setSelectedAction({
      id: workflowId,
      name: workflowNameValue,
      action,
    });
  }

  function handleConfirmedAction() {
    if (!selectedAction) {
      return;
    }

    if (
      selectedAction.action ===
      "archive"
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

  function handleCreateWorkflow(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    createWorkflow.mutate({
      workspaceId,
      name:
        workflowName.trim(),
      description:
        workflowDescription.trim() ||
        undefined,
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>
                Workflows
              </CardTitle>

              <CardDescription className="mt-1">
                Build, publish, and
                monitor automations in
                this workspace.
              </CardDescription>
            </div>

            {canCreate && (
              <div className="flex flex-wrap gap-2">
                <Button
                  nativeButton={
                    false
                  }
                  variant="outline"
                  render={
                    <Link href="/templates" />
                  }
                >
                  <LayoutTemplate className="size-4" />
                  Browse templates
                </Button>

                <Button
                  type="button"
                  onClick={() =>
                    setCreateDialogOpen(
                      true
                    )
                  }
                >
                  <Plus className="size-4" />
                  New workflow
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                type="search"
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target
                      .value
                  )
                }
                placeholder="Search workflows..."
                aria-label="Search workflows"
                className="pl-9"
              />
            </div>

            <div
              role="group"
              aria-label="Filter workflows by status"
              className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1"
            >
              {statusFilters.map(
                (filter) => {
                  const active =
                    statusFilter ===
                    filter.value;

                  return (
                    <button
                      key={
                        filter.value
                      }
                      type="button"
                      aria-pressed={
                        active
                      }
                      onClick={() =>
                        setStatusFilter(
                          filter.value
                        )
                      }
                      className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {filter.label}

                      <span className="text-xs">
                        {
                          counts[
                            filter
                              .value
                          ]
                        }
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {workflows.isPending ? (
            <div
              role="status"
              aria-label="Loading workflows"
              className="space-y-3"
            >
              {[0, 1, 2].map(
                (item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-xl border bg-muted/30"
                  />
                )
              )}
            </div>
          ) : workflows.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
              <p className="font-medium text-destructive">
                Unable to load
                workflows
              </p>

              <p className="mt-1 text-sm text-destructive">
                {
                  workflows.error
                    .message
                }
              </p>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() =>
                  workflows.refetch()
                }
              >
                Try again
              </Button>
            </div>
          ) : workflowRows.length ===
            0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <WorkflowIcon className="size-6" />
              </span>

              <p className="mt-4 font-semibold">
                Create your first
                workflow
              </p>

              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Start with an empty
                workflow or select a
                ready-made template.
              </p>

              {canCreate && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    onClick={() =>
                      setCreateDialogOpen(
                        true
                      )
                    }
                  >
                    <Plus className="size-4" />
                    New workflow
                  </Button>

                  <Button
                    nativeButton={
                      false
                    }
                    variant="outline"
                    render={
                      <Link href="/templates" />
                    }
                  >
                    <LayoutTemplate className="size-4" />
                    Browse templates
                  </Button>
                </div>
              )}
            </div>
          ) : visibleWorkflows.length ===
            0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
              <Search className="size-7 text-muted-foreground" />

              <p className="mt-3 font-medium">
                No workflows match
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Change the search term or
                status filter.
              </p>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setQuery("");
                  setStatusFilter(
                    "ALL"
                  );
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border lg:block">
                <div className="grid grid-cols-[minmax(0,1.8fr)_110px_minmax(170px,1fr)_120px_44px] items-center gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>
                    Workflow
                  </span>
                  <span>Status</span>
                  <span>
                    Last run
                  </span>
                  <span>Updated</span>
                  <span className="sr-only">
                    Actions
                  </span>
                </div>

                {visibleWorkflows.map(
                  (workflowItem) => {
                    const latestRun =
                      workflowItem.latestRun;

                    const duration =
                      latestRun
                        ? formatDuration(
                            {
                              startedAt:
                                latestRun.startedAt,
                              completedAt:
                                latestRun.completedAt,
                            }
                          )
                        : null;

                    return (
                      <div
                        key={
                          workflowItem.id
                        }
                        className="grid grid-cols-[minmax(0,1.8fr)_110px_minmax(170px,1fr)_120px_44px] items-center gap-4 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/30"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <WorkflowIcon className="size-5" />
                          </span>

                          <div className="min-w-0">
                            <Link
                              href={`/workspaces/${workspaceId}/workflows/${workflowItem.id}`}
                              className="block truncate font-medium hover:underline"
                            >
                              {
                                workflowItem.name
                              }
                            </Link>

                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {workflowItem.description ??
                                "No description provided."}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${
                            workflowStatusClasses[
                              workflowItem
                                .status
                            ]
                          }`}
                        >
                          {
                            workflowItem.status
                          }
                        </span>

                        <div className="min-w-0">
                          {latestRun ? (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <RunStatusIcon
                                  status={
                                    latestRun.status
                                  }
                                />

                                <span className="font-medium capitalize">
                                  {latestRun.status.toLowerCase()}
                                </span>

                                {duration && (
                                  <span className="text-xs text-muted-foreground">
                                    {
                                      duration
                                    }
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 flex items-center gap-1">
                                {workflowItem.recentRuns.map(
                                  (run) => (
                                    <span
                                      key={
                                        run.id
                                      }
                                      title={
                                        run.status
                                      }
                                      className={`size-2 rounded-full ${
                                        runStatusClasses[
                                          run
                                            .status
                                        ]
                                      }`}
                                    />
                                  )
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No runs yet
                            </span>
                          )}
                        </div>

                        <time
                          dateTime={new Date(
                            workflowItem.updatedAt
                          ).toISOString()}
                          className="text-sm text-muted-foreground"
                        >
                          {formatDate(
                            workflowItem.updatedAt
                          )}
                        </time>

                        <WorkflowActions
                          workspaceId={
                            workspaceId
                          }
                          workflow={
                            workflowItem
                          }
                          canDelete={
                            canDelete
                          }
                          onArchive={() =>
                            openConfirmation(
                              workflowItem.id,
                              workflowItem.name,
                              "archive"
                            )
                          }
                          onDelete={() =>
                            openConfirmation(
                              workflowItem.id,
                              workflowItem.name,
                              "delete"
                            )
                          }
                        />
                      </div>
                    );
                  }
                )}
              </div>

              <div className="space-y-3 lg:hidden">
                {visibleWorkflows.map(
                  (workflowItem) => {
                    const latestRun =
                      workflowItem.latestRun;

                    return (
                      <div
                        key={
                          workflowItem.id
                        }
                        className="rounded-xl border p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <WorkflowIcon className="size-5" />
                            </span>

                            <div className="min-w-0">
                              <Link
                                href={`/workspaces/${workspaceId}/workflows/${workflowItem.id}`}
                                className="block truncate font-medium hover:underline"
                              >
                                {
                                  workflowItem.name
                                }
                              </Link>

                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {workflowItem.description ??
                                  "No description provided."}
                              </p>
                            </div>
                          </div>

                          <WorkflowActions
                            workspaceId={
                              workspaceId
                            }
                            workflow={
                              workflowItem
                            }
                            canDelete={
                              canDelete
                            }
                            onArchive={() =>
                              openConfirmation(
                                workflowItem.id,
                                workflowItem.name,
                                "archive"
                              )
                            }
                            onDelete={() =>
                              openConfirmation(
                                workflowItem.id,
                                workflowItem.name,
                                "delete"
                              )
                            }
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                              workflowStatusClasses[
                                workflowItem
                                  .status
                              ]
                            }`}
                          >
                            {
                              workflowItem.status
                            }
                          </span>

                          {latestRun ? (
                            <span className="flex items-center gap-1.5 text-xs">
                              <RunStatusIcon
                                status={
                                  latestRun.status
                                }
                              />

                              Latest run:{" "}
                              {latestRun.status.toLowerCase()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No runs yet
                            </span>
                          )}

                          <span className="ml-auto text-xs text-muted-foreground">
                            Updated{" "}
                            {formatDate(
                              workflowItem.updatedAt
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Showing{" "}
                {
                  visibleWorkflows.length
                }{" "}
                of{" "}
                {workflowRows.length}{" "}
                workflows
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (
            !createWorkflow.isPending
          ) {
            setCreateDialogOpen(
              open
            );

            if (!open) {
              createWorkflow.reset();
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create workflow
            </DialogTitle>

            <DialogDescription>
              Start with an empty
              workflow. You can add a
              template after opening the
              editor.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={
              handleCreateWorkflow
            }
            className="space-y-4"
          >
            <div className="space-y-2">
              <label
                htmlFor="new-workflow-name"
                className="text-sm font-medium"
              >
                Name
              </label>

              <Input
                id="new-workflow-name"
                value={workflowName}
                required
                minLength={2}
                maxLength={100}
                autoFocus
                placeholder="Customer support automation"
                disabled={
                  createWorkflow.isPending
                }
                onChange={(event) =>
                  setWorkflowName(
                    event.target
                      .value
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="new-workflow-description"
                className="text-sm font-medium"
              >
                Description
              </label>

              <textarea
                id="new-workflow-description"
                value={
                  workflowDescription
                }
                rows={4}
                maxLength={500}
                placeholder="Describe what this workflow will automate."
                disabled={
                  createWorkflow.isPending
                }
                onChange={(event) =>
                  setWorkflowDescription(
                    event.target
                      .value
                  )
                }
                className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {createWorkflow.error && (
              <p className="text-sm font-medium text-destructive">
                {
                  createWorkflow.error
                    .message
                }
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={
                  createWorkflow.isPending
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
                  createWorkflow.isPending ||
                  workflowName
                    .trim()
                    .length < 2
                }
              >
                {createWorkflow.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}

                Create workflow
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={
          selectedAction !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !isActionPending
          ) {
            setSelectedAction(
              null
            );
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
                {
                  selectedAction?.name
                }
              </span>
              .
            </AlertDialogDescription>

            {selectedAction?.action ===
              "delete" && (
              <p className="text-sm font-medium text-destructive">
                This permanently deletes
                every version and run of
                the workflow. This action
                cannot be undone.
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
              disabled={
                isActionPending
              }
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={
                isActionPending
              }
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

type WorkflowActionsProps = {
  workspaceId: string;
  workflow: {
    id: string;
    name: string;
    status: WorkflowStatus;
  };
  canDelete: boolean;
  onArchive: () => void;
  onDelete: () => void;
};

function WorkflowActions({
  workspaceId,
  workflow,
  canDelete,
  onArchive,
  onDelete,
}: WorkflowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Actions for ${workflow.name}`}
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-48"
      >
        <DropdownMenuItem
          render={
            <Link
              href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
            />
          }
        >
          <ExternalLink className="size-4" />
          Open workflow
        </DropdownMenuItem>

        {canDelete &&
          workflow.status !==
            "ARCHIVED" && (
            <DropdownMenuItem
              onClick={onArchive}
            >
              <Archive className="size-4" />
              Archive
            </DropdownMenuItem>
          )}

        {canDelete && (
          <>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
              Delete permanently
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
"use client";

import {
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  useQuery,
} from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  History,
  Loader2,
  PlayCircle,
  PlugZap,
  RefreshCw,
  Search,
  Timer,
  Webhook,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

import {
  WorkflowRunDetailsDialog,
} from "./workflow-run-details-dialog";

type RunStatus =
  | "ALL"
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

type RunTriggerType =
  | "ALL"
  | "MANUAL"
  | "WEBHOOK"
  | "SCHEDULE"
  | "INTEGRATION";

function getRunStatusClassName(
  status: string
): string {
  switch (status) {
    case "SUCCESS":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";

    case "FAILED":
      return "border-destructive/20 bg-destructive/10 text-destructive";

    case "RUNNING":
      return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400";

    case "CANCELLED":
      return "border-border bg-muted text-muted-foreground";

    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
}

function getRunStatusIcon(
  status: string
) {
  switch (status) {
    case "SUCCESS":
      return (
        <CheckCircle2 className="size-3.5" />
      );

    case "FAILED":
      return (
        <AlertCircle className="size-3.5" />
      );

    case "RUNNING":
      return (
        <Loader2 className="size-3.5 animate-spin" />
      );

    default:
      return (
        <Clock3 className="size-3.5" />
      );
  }
}

function getRunTriggerLabel(
  triggerType: string
): string {
  switch (triggerType) {
    case "WEBHOOK":
      return "Webhook";

    case "SCHEDULE":
      return "Schedule";

    case "INTEGRATION":
      return "Integration";

    case "MANUAL":
      return "Manual";

    default:
      return "Workflow";
  }
}

function getRunTriggerIcon(
  triggerType: string
) {
  const className = "size-4";

  switch (triggerType) {
    case "WEBHOOK":
      return (
        <Webhook
          className={className}
        />
      );

    case "SCHEDULE":
      return (
        <CalendarClock
          className={className}
        />
      );

    case "INTEGRATION":
      return (
        <PlugZap
          className={className}
        />
      );

    default:
      return (
        <PlayCircle
          className={className}
        />
      );
  }
}

function formatRunDate(
  value: Date | string
): string {
  const parsed = new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "Unknown date";
  }

  return parsed.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

function formatRunDuration(
  startedAt:
    | Date
    | string
    | null,
  completedAt:
    | Date
    | string
    | null,
  status: string
): string {
  if (!startedAt) {
    return status === "PENDING"
      ? "Waiting"
      : "Not started";
  }

  if (!completedAt) {
    return status === "RUNNING"
      ? "In progress"
      : "Not completed";
  }

  const start =
    new Date(
      startedAt
    ).getTime();

  const end =
    new Date(
      completedAt
    ).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start
  ) {
    return "Unavailable";
  }

  const milliseconds =
    end - start;

  if (milliseconds < 1_000) {
    return `${milliseconds} ms`;
  }

  const seconds =
    Math.round(
      milliseconds / 1_000
    );

  if (seconds < 60) {
    return `${seconds} sec`;
  }

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    seconds % 60;

  if (minutes < 60) {
    return remainingSeconds
      ? `${minutes} min ${remainingSeconds} sec`
      : `${minutes} min`;
  }

  const hours =
    Math.floor(minutes / 60);

  const remainingMinutes =
    minutes % 60;

  return remainingMinutes
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
}

export function GlobalRunHistory() {
  const trpc = useTRPC();

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState<RunStatus>(
    "ALL"
  );

  const [
    triggerType,
    setTriggerType,
  ] = useState<RunTriggerType>(
    "ALL"
  );

  const [
    selectedRunId,
    setSelectedRunId,
  ] = useState<
    string | null
  >(null);

  const runs = useQuery(
    trpc.workflow.listAllRuns.queryOptions({
      limit: 100,

      status:
        status === "ALL"
          ? undefined
          : status,

      triggerType:
        triggerType === "ALL"
          ? undefined
          : triggerType,
    })
  );

  const visibleRuns =
    useMemo(() => {
      if (!runs.data) {
        return [];
      }

      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      if (!normalizedSearch) {
        return runs.data;
      }

      return runs.data.filter(
        (run) =>
          run.workflowName
            .toLowerCase()
            .includes(
              normalizedSearch
            ) ||
          run.workspaceName
            .toLowerCase()
            .includes(
              normalizedSearch
            ) ||
          run.id
            .toLowerCase()
            .includes(
              normalizedSearch
            ) ||
          run.status
            .toLowerCase()
            .includes(
              normalizedSearch
            ) ||
          run.triggerType
            .toLowerCase()
            .includes(
              normalizedSearch
            )
      );
    }, [
      runs.data,
      search,
    ]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <History className="size-5" />

                <CardTitle>
                  Executions
                </CardTitle>
              </div>

              <CardDescription className="mt-1">
                Review workflow executions
                from every workspace you can
                access.
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                runs.isFetching
              }
              onClick={() => {
                void runs.refetch();
              }}
            >
              <RefreshCw
                className={`size-4 ${
                  runs.isFetching
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search workflow, workspace or run ID..."
                aria-label="Search workflow runs"
                className="pl-9"
              />
            </div>

            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target
                    .value as RunStatus
                )
              }
              aria-label="Filter by run status"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="PENDING">
                Pending
              </option>

              <option value="RUNNING">
                Running
              </option>

              <option value="SUCCESS">
                Successful
              </option>

              <option value="FAILED">
                Failed
              </option>

              <option value="CANCELLED">
                Cancelled
              </option>
            </select>

            <select
              value={triggerType}
              onChange={(event) =>
                setTriggerType(
                  event.target
                    .value as RunTriggerType
                )
              }
              aria-label="Filter by trigger type"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="ALL">
                All triggers
              </option>

              <option value="MANUAL">
                Manual
              </option>

              <option value="WEBHOOK">
                Webhook
              </option>

              <option value="SCHEDULE">
                Schedule
              </option>

              <option value="INTEGRATION">
                Integration
              </option>
            </select>
          </div>

          {runs.isPending && (
            <div className="flex min-h-56 items-center justify-center rounded-lg border">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {runs.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
              <p className="font-medium text-destructive">
                Unable to load run
                history
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {
                  runs.error.message
                }
              </p>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  void runs.refetch();
                }}
              >
                <RefreshCw className="size-4" />
                Try again
              </Button>
            </div>
          )}

          {!runs.isPending &&
            !runs.isError &&
            visibleRuns.length ===
              0 && (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-lg border bg-muted/40">
                  <History className="size-5 text-muted-foreground" />
                </span>

                <p className="mt-4 font-medium">
                  No workflow runs found
                </p>

                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {search ||
                  status !== "ALL" ||
                  triggerType !== "ALL"
                    ? "No executions match the selected search and filters."
                    : "Run a published workflow and its execution will appear here."}
                </p>
              </div>
            )}

          {!runs.isPending &&
            !runs.isError &&
            visibleRuns.length >
              0 && (
              <div className="overflow-hidden rounded-lg border">
                <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_130px_150px_90px] gap-4 border-b bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
                  <span>
                    Workflow
                  </span>

                  <span>
                    Workspace
                  </span>

                  <span>
                    Status
                  </span>

                  <span>
                    Started
                  </span>

                  <span className="text-right">
                    Details
                  </span>
                </div>

                <div className="divide-y">
                  {visibleRuns.map(
                    (run) => {
                      const duration =
                        formatRunDuration(
                          run.startedAt,
                          run.completedAt,
                          run.status
                        );

                      return (
                        <div
                          key={run.id}
                          className="grid gap-4 p-4 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_130px_150px_90px] lg:items-center"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                              {getRunTriggerIcon(
                                run.triggerType
                              )}
                            </span>

                            <div className="min-w-0">
                              <Link
                                href={`/workspaces/${run.workspaceId}/workflows/${run.workflowId}`}
                                className="block truncate text-sm font-medium hover:underline"
                              >
                                {
                                  run.workflowName
                                }
                              </Link>

                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>
                                  {getRunTriggerLabel(
                                    run.triggerType
                                  )}
                                </span>

                                <span className="inline-flex items-center gap-1">
                                  <Timer className="size-3.5" />
                                  {
                                    duration
                                  }
                                </span>
                              </div>

                              <p
                                className="mt-1 truncate font-mono text-[10px] text-muted-foreground"
                                title={run.id}
                              >
                                {run.id}
                              </p>

                              {run.error && (
                                <p className="mt-2 line-clamp-2 text-xs text-destructive">
                                  {
                                    run.error
                                  }
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <Link
                              href={`/workspaces/${run.workspaceId}`}
                              className="block truncate text-sm hover:underline"
                            >
                              {
                                run.workspaceName
                              }
                            </Link>

                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {
                                run.workspaceRole
                              }
                            </p>
                          </div>

                          <div>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${getRunStatusClassName(
                                run.status
                              )}`}
                            >
                              {getRunStatusIcon(
                                run.status
                              )}

                              {
                                run.status
                              }
                            </span>
                          </div>

                          <time
                            dateTime={new Date(
                              run.createdAt
                            ).toISOString()}
                            suppressHydrationWarning
                            className="text-xs text-muted-foreground"
                          >
                            {formatRunDate(
                              run.createdAt
                            )}
                          </time>

                          <div className="flex justify-start lg:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSelectedRunId(
                                  run.id
                                )
                              }
                            >
                              <Eye className="size-4" />
                              <span className="lg:hidden">
                                Details
                              </span>
                            </Button>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {selectedRunId && (
        <WorkflowRunDetailsDialog
          runId={selectedRunId}
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRunId(
                null
              );
            }
          }}
        />
      )}
    </>
  );
}
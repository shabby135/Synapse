"use client";

import {
  useState,
} from "react";
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
  Timer,
  Webhook,
} from "lucide-react";
import {
  useQuery,
} from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTRPC } from "@/trpc/react";

import {
  WorkflowRunDetailsDialog,
} from "./workflow-run-details-dialog";

type WorkflowRunHistoryProps = {
  workflowId: string;
};

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
      return "Webhook run";

    case "SCHEDULE":
      return "Scheduled run";

    case "INTEGRATION":
      return "Integration run";

    case "MANUAL":
      return "Manual run";

    default:
      return "Workflow run";
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

    case "MANUAL":
      return (
        <PlayCircle
          className={className}
        />
      );

    default:
      return (
        <History
          className={className}
        />
      );
  }
}

function formatRunDate(
  value: Date | string
): string {
  return new Date(
    value
  ).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(
  milliseconds: number
): string {
  if (milliseconds < 1_000) {
    return `${milliseconds} ms`;
  }

  if (milliseconds < 60_000) {
    return `${(
      milliseconds / 1_000
    ).toFixed(1)} s`;
  }

  const minutes = Math.floor(
    milliseconds / 60_000
  );

  const seconds = Math.floor(
    (milliseconds % 60_000) /
      1_000
  );

  return `${minutes}m ${seconds}s`;
}

function getRunDuration({
  status,
  startedAt,
  completedAt,
}: {
  status: string;
  startedAt:
    | Date
    | string
    | null;
  completedAt:
    | Date
    | string
    | null;
}): string {
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

  const started =
    new Date(
      startedAt
    ).getTime();

  const completed =
    new Date(
      completedAt
    ).getTime();

  if (
    !Number.isFinite(started) ||
    !Number.isFinite(completed) ||
    completed < started
  ) {
    return "Unavailable";
  }

  return formatDuration(
    completed - started
  );
}

export function WorkflowRunHistory({
  workflowId,
}: WorkflowRunHistoryProps) {
  const trpc = useTRPC();

  const [
    selectedRunId,
    setSelectedRunId,
  ] = useState<string | null>(null);

  const runs = useQuery(
    trpc.workflow.listRuns.queryOptions({
      workflowId,
      limit: 20,
    })
  );

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <History className="size-4" />
                </span>

                <CardTitle>
                  Run history
                </CardTitle>
              </div>

              <CardDescription className="mt-2">
                Recent manual, webhook,
                scheduled, and integration
                executions.
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

        <CardContent className="p-0">
          {runs.isPending && (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {runs.isError && (
            <div className="p-5">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

                  <div>
                    <p className="font-medium text-destructive">
                      Unable to load
                      run history
                    </p>

                    <p className="mt-1 text-sm text-destructive">
                      {
                        runs.error
                          .message
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {runs.isSuccess &&
            runs.data.length === 0 && (
              <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <History className="size-5 text-muted-foreground" />
                </span>

                <p className="mt-4 font-medium">
                  No workflow runs yet
                </p>

                <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  Publish and run this
                  workflow, call its
                  webhook, or wait for an
                  active integration
                  trigger.
                </p>
              </div>
            )}

          {runs.isSuccess &&
            runs.data.length > 0 && (
              <div className="divide-y">
                {runs.data.map(
                  (run) => {
                    const duration =
                      getRunDuration({
                        status:
                          run.status,
                        startedAt:
                          run.startedAt,
                        completedAt:
                          run.completedAt,
                      });

                    return (
                      <div
                        key={run.id}
                        className="group p-4 transition hover:bg-muted/30"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                              {getRunTriggerIcon(
                                run.triggerType
                              )}
                            </span>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                  {getRunTriggerLabel(
                                    run.triggerType
                                  )}
                                </p>

                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getRunStatusClassName(
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

                              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <time
                                  dateTime={new Date(
                                    run.createdAt
                                  ).toISOString()}
                                  suppressHydrationWarning
                                >
                                  {formatRunDate(
                                    run.createdAt
                                  )}
                                </time>

                                <span className="inline-flex items-center gap-1">
                                  <Timer className="size-3.5" />
                                  {duration}
                                </span>
                              </div>

                              <p
                                className="mt-1.5 max-w-lg truncate font-mono text-[11px] text-muted-foreground"
                                title={run.id}
                              >
                                {run.id}
                              </p>

                              {run.error && (
                                <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-destructive">
                                  {
                                    run.error
                                  }
                                </p>
                              )}
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 self-start sm:self-center"
                            onClick={() =>
                              setSelectedRunId(
                                run.id
                              )
                            }
                          >
                            <Eye className="size-4" />
                            Details
                          </Button>
                        </div>
                      </div>
                    );
                  }
                )}
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
              setSelectedRunId(null);
            }
          }}
        />
      )}
    </>
  );
}
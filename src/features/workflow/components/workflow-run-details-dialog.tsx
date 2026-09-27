"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  FileInput,
  FileOutput,
  Hash,
  Info,
  Loader2,
  ScrollText,
  Timer,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import {
  useQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/react";

type WorkflowRunDetailsDialogProps = {
  runId: string;
  open: boolean;
  onOpenChange: (
    open: boolean
  ) => void;
};

type JsonBlockProps = {
  title: string;
  value: unknown;
  icon:
    | "input"
    | "output";
  defaultOpen?: boolean;
};

function getStatusClassName(
  status: string
): string {
  switch (status) {
    case "SUCCESS":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";

    case "FAILED":
      return "border-destructive/20 bg-destructive/10 text-destructive";

    case "RUNNING":
      return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400";

    case "SKIPPED":
    case "CANCELLED":
      return "border-border bg-muted text-muted-foreground";

    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
}

function getStatusIcon(
  status: string
) {
  switch (status) {
    case "SUCCESS":
      return (
        <CheckCircle2 className="size-4" />
      );

    case "FAILED":
      return (
        <AlertCircle className="size-4" />
      );

    case "RUNNING":
      return (
        <Loader2 className="size-4 animate-spin" />
      );

    case "SKIPPED":
    case "CANCELLED":
      return (
        <Clock3 className="size-4" />
      );

    default:
      return (
        <Clock3 className="size-4" />
      );
  }
}

function formatDate(
  value:
    | Date
    | string
    | null
): string {
  if (!value) {
    return "Not available";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "Not available";
  }

  return parsed.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "medium",
    }
  );
}

function formatDuration(
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

  if (
    milliseconds < 60_000
  ) {
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

function jsonText(
  value: unknown
): string {
  try {
    return JSON.stringify(
      value ?? null,
      null,
      2
    );
  } catch {
    return String(value);
  }
}

async function copyText(
  value: string,
  label: string
) {
  try {
    await navigator.clipboard.writeText(
      value
    );

    toast.success(
      `${label} copied.`
    );
  } catch {
    toast.error(
      `Unable to copy ${label.toLowerCase()}.`
    );
  }
}

function JsonBlock({
  title,
  value,
  icon,
  defaultOpen = false,
}: JsonBlockProps) {
  const serialized =
    jsonText(value);

  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-lg border bg-muted/10"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted/40">
        <span className="flex items-center gap-2 text-sm font-medium">
          {icon === "input" ? (
            <FileInput className="size-4 text-muted-foreground" />
          ) : (
            <FileOutput className="size-4 text-muted-foreground" />
          )}

          {title}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            void copyText(
              serialized,
              title
            );
          }}
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
      </summary>

      <pre className="max-h-72 overflow-auto border-t bg-muted/40 p-4 text-xs leading-5">
        {serialized}
      </pre>
    </details>
  );
}

function getLogClassName(
  level: string
): string {
  switch (level) {
    case "ERROR":
      return "border-destructive/30 bg-destructive/5";

    case "WARN":
      return "border-amber-500/30 bg-amber-500/5";

    default:
      return "border-border bg-muted/10";
  }
}

function getLogIcon(
  level: string
) {
  switch (level) {
    case "ERROR":
      return (
        <AlertCircle className="size-4 text-destructive" />
      );

    case "WARN":
      return (
        <TriangleAlert className="size-4 text-amber-600" />
      );

    default:
      return (
        <Info className="size-4 text-blue-600" />
      );
  }
}

export function WorkflowRunDetailsDialog({
  runId,
  open,
  onOpenChange,
}: WorkflowRunDetailsDialogProps) {
  const trpc = useTRPC();

  const run = useQuery(
    trpc.workflow.getRunById.queryOptions(
      {
        id: runId,
      },
      {
        enabled: open,
        refetchInterval:
          open ? 5_000 : false,
      }
    )
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Workflow className="size-5" />
                Workflow run
              </DialogTitle>

              <DialogDescription className="mt-1">
                Inspect execution
                timing, steps, data,
                errors, and logs.
              </DialogDescription>
            </div>

            {run.isSuccess && (
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClassName(
                  run.data.status
                )}`}
              >
                {getStatusIcon(
                  run.data.status
                )}

                {run.data.status}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[calc(90vh-104px)] overflow-y-auto">
          {run.isPending && (
            <div className="flex min-h-80 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {run.isError && (
            <div className="p-6">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

                  <div>
                    <p className="font-medium text-destructive">
                      Unable to load
                      workflow run
                    </p>

                    <p className="mt-1 text-sm text-destructive">
                      {
                        run.error
                          .message
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {run.isSuccess && (
            <div className="space-y-6 p-6">
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Hash className="size-3.5" />
                    Trigger
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    {
                      run.data
                        .triggerType
                    }
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Timer className="size-3.5" />
                    Duration
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    {formatDuration(
                      run.data
                        .startedAt,
                      run.data
                        .completedAt,
                      run.data.status
                    )}
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">
                    Version
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    {run.data
                      .workflowVersionNumber !==
                    null
                      ? `Version ${run.data.workflowVersionNumber}`
                      : "Unavailable"}
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">
                    Steps
                  </p>

                  <p className="mt-1 text-sm font-medium">
                    {
                      run.data.steps
                        .length
                    }
                  </p>
                </div>
              </section>

              <section className="rounded-lg border">
                <div className="grid gap-4 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Created
                    </p>

                    <time
                      className="mt-1 block text-sm font-medium"
                      suppressHydrationWarning
                    >
                      {formatDate(
                        run.data
                          .createdAt
                      )}
                    </time>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">
                      Started
                    </p>

                    <time
                      className="mt-1 block text-sm font-medium"
                      suppressHydrationWarning
                    >
                      {formatDate(
                        run.data
                          .startedAt
                      )}
                    </time>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">
                      Completed
                    </p>

                    <time
                      className="mt-1 block text-sm font-medium"
                      suppressHydrationWarning
                    >
                      {formatDate(
                        run.data
                          .completedAt
                      )}
                    </time>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
                  <p
                    className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                    title={runId}
                  >
                    {runId}
                  </p>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0"
                    onClick={() =>
                      void copyText(
                        runId,
                        "Run ID"
                      )
                    }
                  >
                    <Copy className="size-3.5" />
                    Copy ID
                  </Button>
                </div>
              </section>

              {run.data.error && (
                <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

                    <div className="min-w-0">
                      <p className="font-medium text-destructive">
                        Execution error
                      </p>

                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-destructive">
                        {
                          run.data.error
                        }
                      </p>
                    </div>
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <div>
                  <h3 className="font-semibold">
                    Run data
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Initial input and
                    final workflow
                    output.
                  </p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <JsonBlock
                    title="Run input"
                    value={
                      run.data.input
                    }
                    icon="input"
                  />

                  <JsonBlock
                    title="Final output"
                    value={
                      run.data
                        .output
                    }
                    icon="output"
                    defaultOpen={
                      run.data.status ===
                      "SUCCESS"
                    }
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="font-semibold">
                    Execution steps
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Actions are shown in
                    their recorded
                    execution order.
                  </p>
                </div>

                {run.data.steps.length ===
                0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-sm font-medium">
                      No action steps
                      recorded
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      The run may still
                      be waiting or may
                      have failed before
                      executing an
                      action.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {run.data.steps.map(
                      (
                        step,
                        index
                      ) => (
                        <article
                          key={
                            step.id
                          }
                          className="overflow-hidden rounded-lg border"
                        >
                          <div className="flex flex-col gap-3 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                                {index +
                                  1}
                              </span>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {
                                    step.nodeLabel
                                  }
                                </p>

                                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                  {
                                    step.nodeId
                                  }
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                                {
                                  step.nodeType
                                }
                              </span>

                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusClassName(
                                  step.status
                                )}`}
                              >
                                {getStatusIcon(
                                  step.status
                                )}

                                {
                                  step.status
                                }
                              </span>

                              <span className="text-xs text-muted-foreground">
                                {formatDuration(
                                  step.startedAt,
                                  step.completedAt,
                                  step.status
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3 p-4">
                            {step.error && (
                              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                                {
                                  step.error
                                }
                              </div>
                            )}

                            <div className="grid gap-3 lg:grid-cols-2">
                              <JsonBlock
                                title="Step input"
                                value={
                                  step.input
                                }
                                icon="input"
                              />

                              <JsonBlock
                                title="Step output"
                                value={
                                  step.output
                                }
                                icon="output"
                                defaultOpen={
                                  step.status ===
                                  "SUCCESS"
                                }
                              />
                            </div>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <ScrollText className="size-4" />

                  <h3 className="font-semibold">
                    Execution logs
                  </h3>

                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {
                      run.data.logs
                        .length
                    }
                  </span>
                </div>

                {run.data.logs.length ===
                0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No execution logs
                    were recorded.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {run.data.logs.map(
                      (log) => (
                        <div
                          key={log.id}
                          className={`rounded-lg border p-3 ${getLogClassName(
                            log.level
                          )}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 shrink-0">
                              {getLogIcon(
                                log.level
                              )}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-semibold">
                                  {
                                    log.level
                                  }
                                </span>

                                <time
                                  className="text-xs text-muted-foreground"
                                  suppressHydrationWarning
                                >
                                  {formatDate(
                                    log.createdAt
                                  )}
                                </time>
                              </div>

                              <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                                {
                                  log.message
                                }
                              </p>

                              {Object.keys(
                                log.metadata
                              ).length >
                                0 && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                                    Metadata
                                  </summary>

                                  <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-background/70 p-3 text-xs">
                                    {jsonText(
                                      log.metadata
                                    )}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>

              {run.isFetching && (
                <div className="flex items-center justify-center gap-2 border-t pt-4 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Refreshing run data
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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

function getStatusIcon(status: string) {
  switch (status) {
    case "SUCCESS":
      return (
        <CheckCircle2 className="size-4 text-green-600" />
      );

    case "FAILED":
      return (
        <AlertCircle className="size-4 text-destructive" />
      );

    case "RUNNING":
      return (
        <Loader2 className="size-4 animate-spin text-blue-600" />
      );

    default:
      return (
        <Clock className="size-4 text-muted-foreground" />
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
      }
    )
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Workflow run
          </DialogTitle>

          <DialogDescription>
            Run ID: {runId}
          </DialogDescription>
        </DialogHeader>

        {run.isPending && (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {run.isError && (
          <div>
            <p className="font-medium text-destructive">
              Unable to load run
            </p>

            <p className="mt-1 text-sm text-destructive">
              {run.error.message}
            </p>
          </div>
        )}

        {run.isSuccess && (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">
                  Run status
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(
                    run.data.createdAt
                  ).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {getStatusIcon(
                  run.data.status
                )}

                <span className="text-sm font-medium">
                  {run.data.status}
                </span>
              </div>
            </div>

            {run.data.error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="font-medium text-destructive">
                  Execution error
                </p>

                <p className="mt-1 text-sm text-destructive">
                  {run.data.error}
                </p>
              </div>
            )}

            <section>
              <h3 className="font-semibold">
                Steps
              </h3>

              <div className="mt-3 space-y-3">
                {run.data.steps.length ===
                  0 && (
                  <p className="text-sm text-muted-foreground">
                    No action steps were
                    recorded.
                  </p>
                )}

                {run.data.steps.map(
                  (step, index) => (
                    <div
                      key={step.id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">
                            Step {index + 1}
                          </p>

                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {step.nodeId}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusIcon(
                            step.status
                          )}

                          <span className="text-xs font-medium">
                            {step.status}
                          </span>
                        </div>
                      </div>

                      {step.error && (
                        <p className="mt-3 text-sm text-destructive">
                          {step.error}
                        </p>
                      )}

                      {step.output && (
                        <div className="mt-3">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Output
                          </p>

                          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                            {JSON.stringify(
                              step.output,
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </section>

            <section>
              <h3 className="font-semibold">
                Logs
              </h3>

              <div className="mt-3 space-y-2">
                {run.data.logs.length ===
                  0 && (
                  <p className="text-sm text-muted-foreground">
                    No logs were recorded.
                  </p>
                )}

                {run.data.logs.map(
                  (log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-medium">
                          {log.level}
                        </span>

                        <span className="text-xs text-muted-foreground">
                          {new Date(
                            log.createdAt
                          ).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="mt-1 text-sm">
                        {log.message}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>

            {run.data.output && (
              <section>
                <h3 className="font-semibold">
                  Final output
                </h3>

                <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(
                    run.data.output,
                    null,
                    2
                  )}
                </pre>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
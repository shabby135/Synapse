"use client";

import { useState } from "react";
import {
  Loader2,
  Play,
} from "lucide-react";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/react";

type RunWorkflowControlProps = {
  workflowId: string;
  canExecute: boolean;
};

export function RunWorkflowControl({
  workflowId,
  canExecute,
}: RunWorkflowControlProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [
    dialogOpen,
    setDialogOpen,
  ] = useState(false);

  const [inputJson, setInputJson] =
    useState(
      `{
  "topic": "workflow automation"
}`
    );

  const [
    validationError,
    setValidationError,
  ] = useState<string | null>(null);

  const executeWorkflow = useMutation(
    trpc.workflow.executeManual.mutationOptions(
      {
        onSuccess: () => {
          toast.success(
            "Workflow execution queued."
          );

          setDialogOpen(false);
        },

        onSettled: async () => {
          await queryClient.invalidateQueries(
            trpc.workflow.listRuns.queryFilter(
              {
                workflowId,
                limit: 20,
              }
            )
          );
        },
      }
    )
  );

  function openDialog() {
    executeWorkflow.reset();
    setValidationError(null);
    setDialogOpen(true);
  }

  function handleRun() {
    if (
      !canExecute ||
      executeWorkflow.isPending
    ) {
      return;
    }

    setValidationError(null);

    let parsedInput: unknown;

    try {
      parsedInput = JSON.parse(
        inputJson
      );
    } catch {
      setValidationError(
        "Workflow input must be valid JSON."
      );

      return;
    }

    if (
      typeof parsedInput !== "object" ||
      parsedInput === null ||
      Array.isArray(parsedInput)
    ) {
      setValidationError(
        "Workflow input must be a JSON object."
      );

      return;
    }

    executeWorkflow.mutate({
      id: workflowId,
      input:
        parsedInput as Record<
          string,
          unknown
        >,
    });
  }

  if (!canExecute) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        onClick={openDialog}
      >
        <Play className="size-4" />
        Run workflow
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (
            !executeWorkflow.isPending
          ) {
            setDialogOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Run workflow
            </DialogTitle>

            <DialogDescription>
              Provide the JSON input for the
              latest published workflow
              version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="workflow-run-input"
              className="text-sm font-medium"
            >
              Input JSON
            </label>

            <textarea
              id="workflow-run-input"
              value={inputJson}
              rows={10}
              maxLength={100_000}
              spellCheck={false}
              disabled={
                executeWorkflow.isPending
              }
              onChange={(event) => {
                setInputJson(
                  event.target.value
                );

                if (validationError) {
                  setValidationError(null);
                }
              }}
              className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <p className="text-xs text-muted-foreground">
              AI prompts can access this
              object through{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                {"{{input}}"}
              </code>
              .
            </p>
          </div>

          {validationError && (
            <p className="text-sm font-medium text-destructive">
              {validationError}
            </p>
          )}

          {executeWorkflow.error && (
            <p className="text-sm font-medium text-destructive">
              {
                executeWorkflow.error
                  .message
              }
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={
                executeWorkflow.isPending
              }
              onClick={() =>
                setDialogOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={
                executeWorkflow.isPending
              }
              onClick={handleRun}
            >
              {executeWorkflow.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}

              Run now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
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

  const [dialogOpen, setDialogOpen] =
    useState(false);

 const executeWorkflow = useMutation(
  trpc.workflow.executeManual.mutationOptions({
    onSuccess: (run) => {
      toast.success(
        `Workflow run completed: ${run.status}.`
      );

      setDialogOpen(false);
    },

    onSettled: async () => {
      await queryClient.invalidateQueries(
        trpc.workflow.listRuns.queryFilter({
          workflowId,
          limit: 20,
        })
      );
    },
  })
);

  function handleRun() {
    if (!canExecute) {
      return;
    }

    executeWorkflow.mutate({
      id: workflowId,
      input: {},
    });
  }

  if (!canExecute) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          executeWorkflow.reset();
          setDialogOpen(true);
        }}
      >
        <Play className="size-4" />
        Run workflow
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!executeWorkflow.isPending) {
            setDialogOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Run workflow?
            </DialogTitle>

            <DialogDescription>
              The latest published version will
              execute immediately.
            </DialogDescription>
          </DialogHeader>

          {executeWorkflow.error && (
            <p className="text-sm font-medium text-destructive">
              {executeWorkflow.error.message}
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
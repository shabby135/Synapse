"use client";

import { useState } from "react";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Loader2,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type {
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
} from "@/features/workflow/types";
import { validateWorkflowForPublish } from "@/features/workflow/validate-publish";
import { useTRPC } from "@/trpc/react";

import { PublishWorkflowDialog } from "./publish-workflow-dialog";

type PublishWorkflowControlProps = {
  workflowId: string;
  workspaceId: string;
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  disabled?: boolean;
  onError: (
    message: string | null
  ) => void;
  onPublished?: () => void;
};

export function PublishWorkflowControl({
  workflowId,
  workspaceId,
  nodes,
  edges,
  disabled = false,
  onError,
  onPublished,
}: PublishWorkflowControlProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [
    dialogOpen,
    setDialogOpen,
  ] = useState(false);

  const saveBeforePublish =
    useMutation(
      trpc.workflow.saveDefinition.mutationOptions()
    );

  const publishWorkflow =
    useMutation(
      trpc.workflow.publish.mutationOptions(
        {
          onSuccess: async () => {
            setDialogOpen(false);
            onError(null);
            onPublished?.();

            await Promise.all([
              queryClient.invalidateQueries(
                trpc.workflow.getById.queryFilter(
                  {
                    id: workflowId,
                  }
                )
              ),

              queryClient.invalidateQueries(
                trpc.workflow.list.queryFilter(
                  {
                    workspaceId,
                    includeArchived: true,
                  }
                )
              ),

              queryClient.invalidateQueries(
                trpc.workflow.listRuns.queryFilter(
                  {
                    workflowId,
                    limit: 20,
                  }
                )
              ),
            ]);

            toast.success(
              "Workflow published."
            );
          },

          onError: (error) => {
            const message =
              error.message ||
              "Unable to publish workflow.";

            onError(message);

            toast.error(
              "Unable to publish workflow."
            );
          },
        }
      )
    );

  const isPending =
    saveBeforePublish.isPending ||
    publishWorkflow.isPending;

  const definitionInput = {
    id: workflowId,

    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      data: {
        label: node.data.label,
        description:
          node.data.description,
        configuration:
          node.data.configuration,
      },
    })),

    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle:
        edge.sourceHandle ?? null,
      targetHandle:
        edge.targetHandle ?? null,
      animated:
        edge.animated ?? false,
    })),
  };

  function openPublishDialog() {
    if (disabled || isPending) {
      return;
    }

    const validation =
      validateWorkflowForPublish(
        workflowId,
        {
          nodes:
            definitionInput.nodes,
          edges:
            definitionInput.edges,
        }
      );

    if (!validation.valid) {
      onError(validation.message);

      toast.error(
        validation.message
      );

      return;
    }

    onError(null);
    setDialogOpen(true);
  }

  async function confirmPublish() {
    if (disabled || isPending) {
      return;
    }

    onError(null);

    try {
      await saveBeforePublish.mutateAsync(
        definitionInput
      );

      await publishWorkflow.mutateAsync({
        id: workflowId,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to publish workflow.";

      onError(message);
    }
  }

  function handleDialogOpenChange(
    open: boolean
  ) {
    if (!isPending) {
      setDialogOpen(open);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={
          disabled || isPending
        }
        onClick={openPublishDialog}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Rocket className="size-4" />
        )}

        {isPending
          ? "Publishing..."
          : "Publish"}
      </Button>

      <PublishWorkflowDialog
        open={dialogOpen}
        isPending={isPending}
        onOpenChange={
          handleDialogOpenChange
        }
        onConfirm={confirmPublish}
      />
    </>
  );
}
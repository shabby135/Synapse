"use client";

import { useState } from "react";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Rocket } from "lucide-react";
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
};

export function PublishWorkflowControl({
  workflowId,
  workspaceId,
  nodes,
  edges,
  disabled = false,
  onError,
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
                    includeArchived:
                      false,
                  }
                )
              ),
            ]);

            toast.success(
              "Workflow published."
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
      return;
    }

    onError(null);
    setDialogOpen(true);
  }

  async function confirmPublish() {
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

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={
          disabled || isPending
        }
        onClick={openPublishDialog}
      >
        <Rocket className="size-4" />
        Publish
      </Button>

      <PublishWorkflowDialog
        open={dialogOpen}
        isPending={isPending}
        onOpenChange={setDialogOpen}
        onConfirm={confirmPublish}
      />
    </>
  );
}
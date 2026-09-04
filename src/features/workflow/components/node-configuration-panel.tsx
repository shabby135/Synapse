"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  WorkflowCanvasNode,
  WorkflowNodeData,
} from "@/features/workflow/types";

type NodeConfigurationPanelProps = {
  node: WorkflowCanvasNode | null;
  canEdit: boolean;
  onUpdate: (
    nodeId: string,
    data: WorkflowNodeData
  ) => void;
  onDelete: (
    nodeId: string
  ) => void;
};

const actionTypes = [
  {
    value: "NO_OP",
    label: "Test / No-op",
  },
  {
    value: "HTTP_REQUEST",
    label: "HTTP Request",
  },
  {
    value: "AI_PROMPT",
    label: "AI Prompt",
  },
  {
    value: "SLACK_MESSAGE",
    label: "Slack Message",
  },
  {
    value: "DISCORD_MESSAGE",
    label: "Discord Message",
  },
] as const;

export function NodeConfigurationPanel({
  node,
  canEdit,
  onUpdate,
  onDelete,
}: NodeConfigurationPanelProps) {
  const [
    deleteDialogOpen,
    setDeleteDialogOpen,
  ] = useState(false);

  if (!node) {
    return (
      <aside className="flex w-80 shrink-0 items-center justify-center border-l bg-background p-6">
        <p className="text-center text-sm text-muted-foreground">
          Select a node to configure it.
        </p>
      </aside>
    );
  }

  const selectedNode = node;

  const actionType =
    typeof selectedNode.data
      .configuration?.actionType ===
    "string"
      ? selectedNode.data
          .configuration.actionType
      : "NO_OP";

  function updateData(
    changes: Partial<WorkflowNodeData>
  ) {
    onUpdate(selectedNode.id, {
      ...selectedNode.data,
      ...changes,
    });
  }

  function updateConfiguration(
    changes: Record<string, unknown>
  ) {
    updateData({
      configuration: {
        ...selectedNode.data
          .configuration,
        ...changes,
      },
    });
  }

  function confirmDelete() {
    onDelete(selectedNode.id);
    setDeleteDialogOpen(false);
  }

  return (
    <>
      <aside className="w-80 shrink-0 overflow-y-auto border-l bg-background">
        <div className="border-b p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {selectedNode.type}
          </p>

          <h3 className="mt-1 font-semibold">
            Configure node
          </h3>
        </div>

        <div className="space-y-5 p-4">
          <div className="space-y-2">
            <label
              htmlFor="node-label"
              className="text-sm font-medium"
            >
              Label
            </label>

            <Input
              id="node-label"
              value={
                selectedNode.data.label
              }
              maxLength={100}
              disabled={!canEdit}
              onChange={(event) =>
                updateData({
                  label:
                    event.target.value,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="node-description"
              className="text-sm font-medium"
            >
              Description
            </label>

            <textarea
              id="node-description"
              value={
                selectedNode.data
                  .description ?? ""
              }
              rows={4}
              maxLength={500}
              disabled={!canEdit}
              onChange={(event) =>
                updateData({
                  description:
                    event.target.value,
                })
              }
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {selectedNode.type ===
          "trigger" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Trigger type
              </p>

              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                Manual trigger
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor="action-type"
                className="text-sm font-medium"
              >
                Action type
              </label>

              <select
                id="action-type"
                value={actionType}
                disabled={!canEdit}
                onChange={(event) =>
                  updateConfiguration({
                    actionType:
                      event.target.value,
                  })
                }
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionTypes.map(
                  (action) => (
                    <option
                      key={action.value}
                      value={action.value}
                    >
                      {action.label}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          {canEdit &&
            selectedNode.type !==
              "trigger" && (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() =>
                  setDeleteDialogOpen(
                    true
                  )
                }
              >
                <Trash2 className="size-4" />
                Delete node
              </Button>
            )}
        </div>
      </aside>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={
          setDeleteDialogOpen
        }
      >
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>

            <DialogTitle>
              Delete node?
            </DialogTitle>

            <DialogDescription>
              This will remove “
              {selectedNode.data.label}”
              and all connections attached
              to it. The change will become
              permanent after you save the
              workflow.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDeleteDialogOpen(
                  false
                )
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
            >
              Delete node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
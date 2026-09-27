import {
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import {
  AlertCircle,
  Check,
  Zap,
} from "lucide-react";

import type {
  WorkflowNodeData,
} from "@/features/workflow/types";
import {
  actionNeedsIntegration,
  getWorkflowAction,
} from "@/features/workflow/workflow-node-catalog";

export function ActionNode({
  data,
  selected,
}: NodeProps) {
  const nodeData =
    data as WorkflowNodeData;

  const configuration =
    nodeData.configuration ?? {};

  const actionType =
    typeof configuration.actionType ===
    "string"
      ? configuration.actionType
      : "NO_OP";

  const action =
    getWorkflowAction(actionType);

  const setupRequired =
    actionNeedsIntegration(
      actionType
    ) &&
    (typeof configuration.integrationId !==
      "string" ||
      !configuration.integrationId.trim());

  return (
    <div
      className={`w-72 rounded-xl border bg-background shadow-sm transition-shadow ${
        selected
          ? "border-primary shadow-md ring-2 ring-primary/15"
          : setupRequired
            ? "border-amber-500/60"
            : "border-border hover:shadow-md"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-blue-500"
      />

      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
          <Zap className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {nodeData.label}
          </p>

          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {action.label}
          </p>
        </div>

        <span
          className={`flex size-6 items-center justify-center rounded-full ${
            setupRequired
              ? "bg-amber-500/10 text-amber-600"
              : "bg-emerald-500/10 text-emerald-600"
          }`}
          title={
            setupRequired
              ? "Setup required"
              : "Step configured"
          }
        >
          {setupRequired ? (
            <AlertCircle className="size-3.5" />
          ) : (
            <Check className="size-3.5" />
          )}
        </span>
      </div>

      {nodeData.description && (
        <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
          {nodeData.description}
        </p>
      )}

      {setupRequired && (
        <div className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs font-medium text-amber-700">
          Select an integration
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-blue-500"
      />
    </div>
  );
}
import {
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import { Play } from "lucide-react";

import type {
  WorkflowNodeData,
} from "@/features/workflow/types";

export function TriggerNode({
  data,
  selected,
}: NodeProps) {
  const nodeData =
    data as WorkflowNodeData;

  const triggerType =
    typeof nodeData.configuration
      ?.triggerType === "string"
      ? nodeData.configuration
          .triggerType
      : "MANUAL";

  const triggerLabel = triggerType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/gu,
      (character) =>
        character.toUpperCase()
    );

  return (
    <div
      className={`w-72 rounded-xl border bg-background shadow-sm transition-shadow ${
        selected
          ? "border-primary shadow-md ring-2 ring-primary/15"
          : "border-border hover:shadow-md"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
          <Play className="size-4" />
        </div>

        <div className="min-w-0">
          <p className="truncate font-medium">
            {nodeData.label}
          </p>

          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {triggerLabel}
          </p>
        </div>
      </div>

      {nodeData.description && (
        <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
          {nodeData.description}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-emerald-500"
      />
    </div>
  );
}
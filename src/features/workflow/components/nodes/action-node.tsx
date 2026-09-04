import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Zap } from "lucide-react";

export type ActionNodeType = Node<
  {
    label: string;
    description?: string;
  },
  "action"
>;

export function ActionNode({
  data,
  selected,
}: NodeProps<ActionNodeType>) {
  return (
    <div
      className={`w-64 rounded-lg border bg-background shadow-sm ${
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-blue-500"
      />

      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
          <Zap className="size-4" />
        </div>

        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Action
          </p>

          <p className="font-medium">{data.label}</p>
        </div>
      </div>

      {data.description && (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {data.description}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-blue-500"
      />
    </div>
  );
}
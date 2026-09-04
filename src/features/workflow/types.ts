import type {
  Edge,
  Node,
} from "@xyflow/react";

export type WorkflowNodeData = {
  label: string;
  description?: string;
  configuration?: Record<
    string,
    unknown
  >;
};

export type TriggerNodeType = Node<
  WorkflowNodeData,
  "trigger"
>;

export type ActionNodeType = Node<
  WorkflowNodeData,
  "action"
>;

export type WorkflowCanvasNode =
  | TriggerNodeType
  | ActionNodeType;

export type WorkflowCanvasEdge = Edge;
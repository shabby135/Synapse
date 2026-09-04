import type {
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
} from "./types";

export type WorkflowValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      message: string;
    };

export function validateWorkflowDraft(
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[]
): WorkflowValidationResult {
  const triggerNodes = nodes.filter(
    (node) =>
      node.type === "trigger"
  );

  if (triggerNodes.length !== 1) {
    return {
      valid: false,
      message:
        "The workflow must contain exactly one trigger.",
    };
  }

  const nodeIds = new Set<string>();

  for (const node of nodes) {
    if (!node.data.label.trim()) {
      return {
        valid: false,
        message:
          "Every node must have a label.",
      };
    }

    if (nodeIds.has(node.id)) {
      return {
        valid: false,
        message:
          "The workflow contains duplicate node IDs.",
      };
    }

    nodeIds.add(node.id);
  }

  const edgeIds = new Set<string>();
  const connections = new Set<string>();

  for (const edge of edges) {
    if (edgeIds.has(edge.id)) {
      return {
        valid: false,
        message:
          "The workflow contains duplicate connection IDs.",
      };
    }

    edgeIds.add(edge.id);

    if (
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target)
    ) {
      return {
        valid: false,
        message:
          "A connection references a missing node.",
      };
    }

    if (
      edge.source === edge.target
    ) {
      return {
        valid: false,
        message:
          "A node cannot connect to itself.",
      };
    }

    const connectionKey =
      `${edge.source}:${edge.target}`;

    if (
      connections.has(connectionKey)
    ) {
      return {
        valid: false,
        message:
          "Duplicate connections are not allowed.",
      };
    }

    connections.add(connectionKey);
  }

  return {
    valid: true,
  };
}
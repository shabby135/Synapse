import type { WorkflowDefinition } from "@/lib/db/schema/workflow";

import { saveWorkflowDefinitionSchema } from "./validator";

export type PublishValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      message: string;
    };

export function validateWorkflowForPublish(
  workflowId: string,
  definition: WorkflowDefinition
): PublishValidationResult {
  const parsed =
    saveWorkflowDefinitionSchema.safeParse({
      id: workflowId,
      nodes: definition.nodes,
      edges: definition.edges,
    });

  if (!parsed.success) {
    return {
      valid: false,
      message:
        parsed.error.issues[0]
          ?.message ??
        "The workflow definition is invalid.",
    };
  }

  const {
    nodes,
    edges,
  } = parsed.data;

  const trigger = nodes.find(
    (node) =>
      node.type === "trigger"
  );

  if (!trigger) {
    return {
      valid: false,
      message:
        "The workflow requires a trigger.",
    };
  }

  const actions = nodes.filter(
    (node) =>
      node.type === "action"
  );

  if (actions.length === 0) {
    return {
      valid: false,
      message:
        "Add at least one action before publishing.",
    };
  }

  if (
    edges.some(
      (edge) =>
        edge.target === trigger.id
    )
  ) {
    return {
      valid: false,
      message:
        "The trigger cannot have incoming connections.",
    };
  }

  for (const action of actions) {
    const actionType =
      action.data.configuration
        ?.actionType;

    if (
      typeof actionType !==
        "string" ||
      !actionType.trim()
    ) {
      return {
        valid: false,
        message: `${action.data.label} requires an action type.`,
      };
    }
  }

  const adjacency = new Map<
    string,
    string[]
  >();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    adjacency
      .get(edge.source)
      ?.push(edge.target);
  }

  const reachable = new Set<string>();
  const queue = [trigger.id];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (
      !nodeId ||
      reachable.has(nodeId)
    ) {
      continue;
    }

    reachable.add(nodeId);

    for (
      const nextNodeId of
      adjacency.get(nodeId) ?? []
    ) {
      queue.push(nextNodeId);
    }
  }

  const unreachableNode = nodes.find(
    (node) =>
      !reachable.has(node.id)
  );

  if (unreachableNode) {
    return {
      valid: false,
      message: `${unreachableNode.data.label} is not connected to the trigger.`,
    };
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function containsCycle(
    nodeId: string
  ): boolean {
    if (visiting.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);

    for (
      const nextNodeId of
      adjacency.get(nodeId) ?? []
    ) {
      if (
        containsCycle(nextNodeId)
      ) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);

    return false;
  }

  if (containsCycle(trigger.id)) {
    return {
      valid: false,
      message:
        "Workflow connections cannot contain a cycle.",
    };
  }

  return {
    valid: true,
  };
}
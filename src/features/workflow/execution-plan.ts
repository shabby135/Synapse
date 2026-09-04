import type { WorkflowDefinition } from "@/lib/db/schema/workflow";

import { validateWorkflowForPublish } from "./validate-publish";
import { saveWorkflowDefinitionSchema } from "./validator";

export class WorkflowExecutionPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "WorkflowExecutionPlanError";
  }
}

export function createExecutionPlan(
  workflowId: string,
  definition: WorkflowDefinition
) {
  const validation =
    validateWorkflowForPublish(
      workflowId,
      definition
    );

  if (!validation.valid) {
    throw new WorkflowExecutionPlanError(
      validation.message
    );
  }

  const parsed =
    saveWorkflowDefinitionSchema.safeParse({
      id: workflowId,
      nodes: definition.nodes,
      edges: definition.edges,
    });

  if (!parsed.success) {
    throw new WorkflowExecutionPlanError(
      parsed.error.issues[0]
        ?.message ??
        "Invalid workflow definition."
    );
  }

  const {
    nodes,
    edges,
  } = parsed.data;

  const nodeById = new Map(
    nodes.map((node) => [
      node.id,
      node,
    ])
  );

  const inDegree = new Map<
    string,
    number
  >();

  const adjacency = new Map<
    string,
    string[]
  >();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    adjacency
      .get(edge.source)
      ?.push(edge.target);

    inDegree.set(
      edge.target,
      (inDegree.get(edge.target) ??
        0) + 1
    );
  }

  const queue = nodes
    .filter(
      (node) =>
        inDegree.get(node.id) === 0
    )
    .map((node) => node.id);

  const orderedNodeIds: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId) {
      continue;
    }

    orderedNodeIds.push(nodeId);

    for (
      const nextNodeId of
      adjacency.get(nodeId) ?? []
    ) {
      const nextInDegree =
        (inDegree.get(nextNodeId) ??
          0) - 1;

      inDegree.set(
        nextNodeId,
        nextInDegree
      );

      if (nextInDegree === 0) {
        queue.push(nextNodeId);
      }
    }
  }

  if (
    orderedNodeIds.length !==
    nodes.length
  ) {
    throw new WorkflowExecutionPlanError(
      "The workflow contains a cycle."
    );
  }

  const orderedNodes =
    orderedNodeIds.map((nodeId) => {
      const node =
        nodeById.get(nodeId);

      if (!node) {
        throw new WorkflowExecutionPlanError(
          `Node ${nodeId} is missing.`
        );
      }

      return node;
    });

  const trigger =
    orderedNodes.find(
      (node) =>
        node.type === "trigger"
    );

  if (!trigger) {
    throw new WorkflowExecutionPlanError(
      "The workflow trigger is missing."
    );
  }

  const actions =
    orderedNodes.filter(
      (node) =>
        node.type === "action"
    );

  return {
  trigger,
  actions,
  edges,
  orderedNodes,
};
}

export type WorkflowExecutionPlan =
  ReturnType<
    typeof createExecutionPlan
  >;
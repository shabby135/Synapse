"use client";

import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type NodeTypes,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type {
  ActionNodeType,
  WorkflowCanvasNode,
  WorkflowNodeData,
} from "@/features/workflow/types";
import { validateWorkflowDraft } from "@/features/workflow/validate-workflow";
import { saveWorkflowDefinitionSchema } from "@/features/workflow/validator";
import { useTRPC } from "@/trpc/react";

import { ActionNode } from "./nodes/action-node";
import { TriggerNode } from "./nodes/trigger-node";
import { NodeConfigurationPanel } from "./node-configuration-panel";

type WorkflowBuilderProps = {
  workflowId: string;
  canEdit: boolean;
  initialDefinition?: {
    nodes: unknown[];
    edges: unknown[];
  };
};

const defaultNodes: WorkflowCanvasNode[] = [
  {
    id: "trigger-1",
    type: "trigger",
    position: {
      x: 100,
      y: 200,
    },
    data: {
      label: "Manual Trigger",
      description:
        "Starts when the workflow is run manually.",
      configuration: {
        triggerType: "MANUAL",
      },
    },
    deletable: false,
  },
];

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
} satisfies NodeTypes;

function getMiniMapNodeColor(
  node: WorkflowCanvasNode
) {
  return node.type === "trigger"
    ? "#22c55e"
    : "#3b82f6";
}

export function WorkflowBuilder({
  workflowId,
  canEdit,
  initialDefinition,
}: WorkflowBuilderProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState<string | null>(null);

  const [
    validationError,
    setValidationError,
  ] = useState<string | null>(null);

  const initialCanvas = useMemo(() => {
    const result =
      saveWorkflowDefinitionSchema.safeParse(
        {
          id: workflowId,
          nodes:
            initialDefinition?.nodes ?? [],
          edges:
            initialDefinition?.edges ?? [],
        }
      );

    if (!result.success) {
      return {
        nodes: defaultNodes,
        edges: [] as Edge[],
      };
    }

    return {
      nodes:
        result.data
          .nodes as WorkflowCanvasNode[],
      edges:
        result.data.edges as Edge[],
    };
  }, [
    workflowId,
    initialDefinition,
  ]);

  const [
    nodes,
    setNodes,
    onNodesChange,
  ] = useNodesState<WorkflowCanvasNode>(
    initialCanvas.nodes
  );

  const [
    edges,
    setEdges,
    onEdgesChange,
  ] = useEdgesState<Edge>(
    initialCanvas.edges
  );

  const selectedNode =
    nodes.find(
      (node) =>
        node.id === selectedNodeId
    ) ?? null;

  const saveDefinition = useMutation(
    trpc.workflow.saveDefinition.mutationOptions(
      {
        onSuccess: async () => {
          setValidationError(null);

          await queryClient.invalidateQueries(
            trpc.workflow.getById.queryFilter(
              {
                id: workflowId,
              }
            )
          );

          toast.success(
            "Workflow draft saved."
          );
        },
      }
    )
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) {
        return;
      }

      setValidationError(null);

      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            animated: true,
          },
          currentEdges
        )
      );
    },
    [canEdit, setEdges]
  );

  const addActionNode = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const actionCount =
      nodes.filter(
        (node) =>
          node.type === "action"
      ).length;

    const newNode: ActionNodeType = {
      id: crypto.randomUUID(),
      type: "action",
      position: {
        x: 400,
        y: 150 + actionCount * 140,
      },
      data: {
        label: `Action ${
          actionCount + 1
        }`,
        description:
          "Configure this workflow action.",
        configuration: {
          actionType: "HTTP_REQUEST",
        },
      },
    };

    setValidationError(null);

    setNodes((currentNodes) => [
      ...currentNodes,
      newNode,
    ]);

    setSelectedNodeId(newNode.id);
  }, [
    canEdit,
    nodes,
    setNodes,
  ]);

  const updateNode = useCallback(
    (
      nodeId: string,
      data: WorkflowNodeData
    ) => {
      if (!canEdit) {
        return;
      }

      setValidationError(null);

      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data,
              }
            : node
        )
      );
    },
    [canEdit, setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!canEdit) {
        return;
      }

      setValidationError(null);

      setNodes((currentNodes) =>
        currentNodes.filter(
          (node) =>
            node.id !== nodeId ||
            node.type === "trigger"
        )
      );

      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) =>
            edge.source !== nodeId &&
            edge.target !== nodeId
        )
      );

      setSelectedNodeId(null);
    },
    [
      canEdit,
      setEdges,
      setNodes,
    ]
  );

  const handleSave = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const validation =
      validateWorkflowDraft(
        nodes,
        edges
      );

    if (!validation.valid) {
      setValidationError(
        validation.message
      );

      return;
    }

    setValidationError(null);

    saveDefinition.mutate({
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
    });
  }, [
    canEdit,
    edges,
    nodes,
    saveDefinition,
    workflowId,
  ]);

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[600px] flex-col">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">
            Workflow Builder
          </h2>

          <p className="text-sm text-muted-foreground">
            Add, connect and configure
            workflow nodes.
          </p>

          {validationError && (
            <p className="mt-1 text-sm font-medium text-destructive">
              {validationError}
            </p>
          )}

          {saveDefinition.error && (
            <p className="mt-1 text-sm font-medium text-destructive">
              {
                saveDefinition.error
                  .message
              }
            </p>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addActionNode}
              disabled={
                saveDefinition.isPending
              }
            >
              Add action
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={
                saveDefinition.isPending
              }
            >
              {saveDefinition.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}

              Save draft
            </Button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ReactFlow<
            WorkflowCanvasNode,
            Edge
          >
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={
              onNodesChange
            }
            onEdgesChange={
              onEdgesChange
            }
            onConnect={
              canEdit
                ? onConnect
                : undefined
            }
            onNodeClick={(
              _event,
              node
            ) => {
              setSelectedNodeId(
                node.id
              );
            }}
            onPaneClick={() => {
              setSelectedNodeId(
                null
              );
            }}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            edgesReconnectable={canEdit}
            deleteKeyCode={
              canEdit
                ? [
                    "Backspace",
                    "Delete",
                  ]
                : null
            }
            fitView
          >
            <Background
              variant={
                BackgroundVariant.Dots
              }
              gap={20}
              size={1}
            />

            <Controls />

            <MiniMap<WorkflowCanvasNode>
              nodeColor={
                getMiniMapNodeColor
              }
              pannable
              zoomable
            />
          </ReactFlow>
        </div>

        <NodeConfigurationPanel
          node={selectedNode}
          canEdit={canEdit}
          onUpdate={updateNode}
          onDelete={deleteNode}
        />
      </div>
    </div>
  );
}
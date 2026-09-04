"use client";

import {
  useCallback,
  useMemo,
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
  Loader2,
  Save,
} from "lucide-react";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveWorkflowDefinitionSchema } from "@/features/workflow/validator";
import { useTRPC } from "@/trpc/react";

import {
  TriggerNode,
  type TriggerNodeType,
} from "./nodes/trigger-node";
import {
  ActionNode,
  type ActionNodeType,
} from "./nodes/action-node";

type WorkflowCanvasNode =
  | TriggerNodeType
  | ActionNodeType;

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

  const saveDefinition = useMutation(
    trpc.workflow.saveDefinition.mutationOptions(
      {
        onSuccess: async () => {
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

    setNodes((currentNodes) => {
      const actionCount =
        currentNodes.filter(
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
        },
      };

      return [
        ...currentNodes,
        newNode,
      ];
    });
  }, [canEdit, setNodes]);

  const handleSave = useCallback(() => {
    if (!canEdit) {
      return;
    }

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
            Add actions and connect them to
            define the workflow.
          </p>

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

      <div className="min-h-0 flex-1">
        <ReactFlow<
          WorkflowCanvasNode,
          Edge
        >
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={
            canEdit
              ? onConnect
              : undefined
          }
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
    </div>
  );
}
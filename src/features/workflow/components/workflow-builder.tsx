"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
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
  CircleCheck,
  Loader2,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
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
import {
  createActionConfiguration,
  getWorkflowAction,
  type WorkflowActionType,
} from "@/features/workflow/workflow-node-catalog";
import { useTRPC } from "@/trpc/react";

import { ActionNode } from "./nodes/action-node";
import { TriggerNode } from "./nodes/trigger-node";
import { NodeConfigurationPanel } from "./node-configuration-panel";
import { PublishWorkflowControl } from "./publish-workflow-control";
import { WorkflowNodeLibrary } from "./workflow-node-library";

type WorkflowBuilderProps = {
  workflowId: string;
  workspaceId: string;
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
): string {
  return node.type === "trigger"
    ? "#22c55e"
    : "#3b82f6";
}

export function WorkflowBuilder({
  workflowId,
  workspaceId,
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

  const [isDirty, setIsDirty] =
    useState(false);

  const [
    libraryOpen,
    setLibraryOpen,
  ] = useState(true);

  const [
    configurationOpen,
    setConfigurationOpen,
  ] = useState(false);

  const [
    configurationHeight,
    setConfigurationHeight,
  ] = useState(320);

  const initialCanvas = useMemo(() => {
    const result =
      saveWorkflowDefinitionSchema.safeParse(
        {
          id: workflowId,
          nodes:
            initialDefinition?.nodes ??
            [],
          edges:
            initialDefinition?.edges ??
            [],
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
          setIsDirty(false);

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
      setIsDirty(true);

      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: true,
            markerEnd: {
              type:
                MarkerType.ArrowClosed,
            },
          },
          currentEdges
        )
      );
    },
    [
      canEdit,
      setEdges,
    ]
  );

  const addActionNode = useCallback(
    (
      actionType: WorkflowActionType =
        "NO_OP"
    ) => {
      if (!canEdit) {
        return;
      }

      const actionCount =
        nodes.filter(
          (node) =>
            node.type === "action"
        ).length;

      const selectedSource =
        nodes.find(
          (node) =>
            node.id ===
            selectedNodeId
        );

      const action =
        getWorkflowAction(
          actionType
        );

      const newNode: ActionNodeType = {
        id: crypto.randomUUID(),
        type: "action",
        position: {
          x: selectedSource
            ? selectedSource.position.x +
              340
            : 430 +
              Math.floor(
                actionCount / 4
              ) *
                340,
          y: selectedSource
            ? selectedSource.position.y
            : 100 +
              (actionCount % 4) *
                170,
        },
        data: {
          label: action.label,
          description:
            action.description,
          configuration:
            createActionConfiguration(
              actionType
            ),
        },
      };

      setValidationError(null);
      setIsDirty(true);

      setNodes((currentNodes) => [
        ...currentNodes,
        newNode,
      ]);

      if (selectedSource) {
        setEdges((currentEdges) =>
          addEdge(
            {
              id: crypto.randomUUID(),
              source:
                selectedSource.id,
              target: newNode.id,
              type: "smoothstep",
              animated: true,
              markerEnd: {
                type:
                  MarkerType.ArrowClosed,
              },
            },
            currentEdges
          )
        );
      }

      setSelectedNodeId(newNode.id);
      setConfigurationOpen(true);
    },
    [
      canEdit,
      nodes,
      selectedNodeId,
      setEdges,
      setNodes,
    ]
  );

  const updateNode = useCallback(
    (
      nodeId: string,
      data: WorkflowNodeData
    ) => {
      if (!canEdit) {
        return;
      }

      setValidationError(null);
      setIsDirty(true);

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
    [
      canEdit,
      setNodes,
    ]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!canEdit) {
        return;
      }

      setValidationError(null);
      setIsDirty(true);

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
      setConfigurationOpen(false);
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

  const handleNodesChange = useCallback(
    (
      changes: NodeChange<WorkflowCanvasNode>[]
    ) => {
      if (
        changes.some(
          (change) =>
            change.type !== "select" &&
            change.type !== "dimensions"
        )
      ) {
        setIsDirty(true);
      }

      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      if (
        changes.some(
          (change) =>
            change.type !== "select"
        )
      ) {
        setIsDirty(true);
      }

      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  const handleNodeClick = useCallback(
    (node: WorkflowCanvasNode) => {
      const clickedSameNode =
        node.id === selectedNodeId;

      if (
        clickedSameNode &&
        configurationOpen
      ) {
        setConfigurationOpen(false);

        return;
      }

      setSelectedNodeId(node.id);
      setConfigurationOpen(true);
    },
    [
      configurationOpen,
      selectedNodeId,
    ]
  );

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        canEdit &&
        (event.metaKey ||
          event.ctrlKey) &&
        event.key.toLowerCase() ===
          "s"
      ) {
        event.preventDefault();
        handleSave();

        return;
      }

      if (event.key === "Escape") {
        setConfigurationOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    canEdit,
    handleSave,
  ]);

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[560px] max-h-[760px] flex-col overflow-hidden rounded-xl border bg-muted/20">
      <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden size-8 lg:inline-flex"
            title={
              libraryOpen
                ? "Hide step library"
                : "Show step library"
            }
            aria-label={
              libraryOpen
                ? "Hide step library"
                : "Show step library"
            }
            aria-pressed={libraryOpen}
            onClick={() =>
              setLibraryOpen(
                (current) =>
                  !current
              )
            }
          >
            {libraryOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </Button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold">
                Workflow editor
              </h2>

              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {nodes.length} step
                {nodes.length === 1
                  ? ""
                  : "s"}
              </span>

              <span
                className={`inline-flex items-center gap-1 text-[11px] ${
                  isDirty
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                {isDirty ? (
                  <span className="size-1.5 rounded-full bg-current" />
                ) : (
                  <CircleCheck className="size-3.5" />
                )}

                {isDirty
                  ? "Unsaved"
                  : "Saved"}
              </span>
            </div>

            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Select a step to configure
              it. Press Ctrl+S to save.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() =>
                addActionNode("NO_OP")
              }
              disabled={
                saveDefinition.isPending
              }
            >
              <Plus className="size-4" />
              Add step
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={!selectedNode}
            title={
              configurationOpen
                ? "Close configuration"
                : "Open configuration"
            }
            aria-label={
              configurationOpen
                ? "Close configuration"
                : "Open configuration"
            }
            aria-pressed={
              configurationOpen
            }
            onClick={() =>
              setConfigurationOpen(
                (current) => !current
              )
            }
          >
            {configurationOpen ? (
              <PanelBottomClose className="size-4" />
            ) : (
              <PanelBottomOpen className="size-4" />
            )}
          </Button>

          {canEdit && (
            <>
              <PublishWorkflowControl
                workflowId={workflowId}
                workspaceId={
                  workspaceId
                }
                nodes={nodes}
                edges={edges}
                disabled={
                  saveDefinition.isPending
                }
                onError={
                  setValidationError
                }
              />

              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={
                  saveDefinition.isPending ||
                  !isDirty
                }
              >
                {saveDefinition.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}

                <span className="hidden sm:inline">
                  Save draft
                </span>
              </Button>
            </>
          )}
        </div>
      </div>

      {(validationError ||
        saveDefinition.error) && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/5 px-4 py-2">
          <p className="text-sm font-medium text-destructive">
            {validationError ??
              saveDefinition.error
                ?.message}
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          {libraryOpen && (
            <WorkflowNodeLibrary
              canEdit={canEdit}
              onAddAction={
                addActionNode
              }
            />
          )}

          <div className="relative min-w-0 flex-1 bg-background">
            <ReactFlow<
              WorkflowCanvasNode,
              Edge
            >
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={
                handleNodesChange
              }
              onEdgesChange={
                handleEdgesChange
              }
              onConnect={
                canEdit
                  ? onConnect
                  : undefined
              }
              onNodeClick={(
                _event,
                node
              ) =>
                handleNodeClick(node)
              }
              nodesDraggable={canEdit}
              nodesConnectable={
                canEdit
              }
              edgesReconnectable={
                canEdit
              }
              deleteKeyCode={
                canEdit
                  ? [
                      "Backspace",
                      "Delete",
                    ]
                  : null
              }
              fitView
              fitViewOptions={{
                padding: 0.25,
              }}
              minZoom={0.25}
              maxZoom={1.75}
              defaultEdgeOptions={{
                type: "smoothstep",
                animated: true,
                markerEnd: {
                  type:
                    MarkerType.ArrowClosed,
                },
              }}
              proOptions={{
                hideAttribution: true,
              }}
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
                className="hidden xl:block"
                nodeColor={
                  getMiniMapNodeColor
                }
                pannable
                zoomable
              />
            </ReactFlow>
          </div>
        </div>

        {configurationOpen &&
          selectedNode && (
            <NodeConfigurationPanel
              nodes={nodes}
              edges={edges}
              workspaceId={
                workspaceId
              }
              node={selectedNode}
              canEdit={canEdit}
              height={
                configurationHeight
              }
              onHeightChange={
                setConfigurationHeight
              }
              onUpdate={updateNode}
              onDelete={deleteNode}
            />
          )}
      </div>
    </div>
  );
}
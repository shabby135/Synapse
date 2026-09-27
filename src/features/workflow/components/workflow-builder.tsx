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
  Keyboard,
  LayoutGrid,
  Loader2,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

import { NodeConfigurationPanel } from "./node-configuration-panel";
import { ActionNode } from "./nodes/action-node";
import { TriggerNode } from "./nodes/trigger-node";
import { PublishWorkflowControl } from "./publish-workflow-control";
import { RunWorkflowControl } from "./run-workflow-control";
import { WorkflowNodeLibrary } from "./workflow-node-library";

type WorkflowBuilderProps = {
  workflowId: string;
  workspaceId: string;
  canEdit: boolean;
  canExecute: boolean;
  initialDefinition?: {
    nodes: unknown[];
    edges: unknown[];
  };
};

type CanvasSnapshot = {
  nodes: WorkflowCanvasNode[];
  edges: Edge[];
};

type DefinitionInput = {
  id: string;
  nodes: Array<{
    id: string;
    type: "trigger" | "action";
    position: {
      x: number;
      y: number;
    };
    data: {
      label: string;
      description?: string;
      configuration?: Record<
        string,
        unknown
      >;
    };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    animated?: boolean;
  }>;
};

const MAX_HISTORY_LENGTH = 50;

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

function cloneSnapshot(
  nodes: WorkflowCanvasNode[],
  edges: Edge[]
): CanvasSnapshot {
  return structuredClone({
    nodes,
    edges,
  });
}

function buildDefinitionInput(
  workflowId: string,
  nodes: WorkflowCanvasNode[],
  edges: Edge[]
): DefinitionInput {
  return {
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
  };
}

function getDefinitionSignature(
  definition: DefinitionInput
): string {
  return JSON.stringify({
    nodes: definition.nodes,
    edges: definition.edges,
  });
}

function isEditableTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function createTidyLayout(
  nodes: WorkflowCanvasNode[],
  edges: Edge[]
): WorkflowCanvasNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const nodeIds = new Set(
    nodes.map((node) => node.id)
  );

  const incomingCount = new Map<
    string,
    number
  >();

  const outgoingNodes = new Map<
    string,
    string[]
  >();

  const levels = new Map<
    string,
    number
  >();

  for (const node of nodes) {
    incomingCount.set(node.id, 0);
    outgoingNodes.set(node.id, []);
  }

  for (const edge of edges) {
    if (
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target)
    ) {
      continue;
    }

    incomingCount.set(
      edge.target,
      (incomingCount.get(
        edge.target
      ) ?? 0) + 1
    );

    outgoingNodes
      .get(edge.source)
      ?.push(edge.target);
  }

  const queue = nodes
    .filter(
      (node) =>
        (incomingCount.get(
          node.id
        ) ?? 0) === 0
    )
    .map((node) => node.id);

  for (const nodeId of queue) {
    levels.set(nodeId, 0);
  }

  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const nodeId =
      queue[queueIndex];

    queueIndex += 1;

    const currentLevel =
      levels.get(nodeId) ?? 0;

    for (
      const targetId of
      outgoingNodes.get(nodeId) ?? []
    ) {
      levels.set(
        targetId,
        Math.max(
          levels.get(targetId) ?? 0,
          currentLevel + 1
        )
      );

      const remainingIncoming =
        (incomingCount.get(
          targetId
        ) ?? 1) - 1;

      incomingCount.set(
        targetId,
        remainingIncoming
      );

      if (remainingIncoming === 0) {
        queue.push(targetId);
      }
    }
  }

  const highestLevel = Math.max(
    0,
    ...Array.from(levels.values())
  );

  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(
        node.id,
        highestLevel + 1
      );
    }
  }

  const groupedNodes = new Map<
    number,
    WorkflowCanvasNode[]
  >();

  for (const node of nodes) {
    const level =
      levels.get(node.id) ?? 0;

    const group =
      groupedNodes.get(level) ?? [];

    group.push(node);
    groupedNodes.set(level, group);
  }

  const positions = new Map<
    string,
    {
      x: number;
      y: number;
    }
  >();

  const sortedLevels = Array.from(
    groupedNodes.keys()
  ).sort(
    (first, second) =>
      first - second
  );

  for (const level of sortedLevels) {
    const group =
      groupedNodes.get(level) ?? [];

    group.forEach((node, index) => {
      positions.set(node.id, {
        x: 100 + level * 340,
        y: 100 + index * 180,
      });
    });
  }

  return nodes.map((node) => ({
    ...node,
    position:
      positions.get(node.id) ??
      node.position,
  }));
}

export function WorkflowBuilder({
  workflowId,
  workspaceId,
  canEdit,
  canExecute,
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
            initialDefinition?.nodes ??
            [],
          edges:
            initialDefinition?.edges ??
            [],
        }
      );

    if (!result.success) {
      return {
        nodes: structuredClone(
          defaultNodes
        ),
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

  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState<string | null>(null);

  const [
    validationError,
    setValidationError,
  ] = useState<string | null>(null);

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

  const [
    shortcutsOpen,
    setShortcutsOpen,
  ] = useState(false);

  const [
    history,
    setHistory,
  ] = useState<CanvasSnapshot[]>([]);

  const [
    future,
    setFuture,
  ] = useState<CanvasSnapshot[]>([]);

  const [
    savedSignature,
    setSavedSignature,
  ] = useState(() =>
    getDefinitionSignature(
      buildDefinitionInput(
        workflowId,
        initialCanvas.nodes,
        initialCanvas.edges
      )
    )
  );

  const definitionInput = useMemo(
    () =>
      buildDefinitionInput(
        workflowId,
        nodes,
        edges
      ),
    [
      workflowId,
      nodes,
      edges,
    ]
  );

  const currentSignature = useMemo(
    () =>
      getDefinitionSignature(
        definitionInput
      ),
    [definitionInput]
  );

  const isDirty =
    currentSignature !==
    savedSignature;

  const selectedNode =
    nodes.find(
      (node) =>
        node.id === selectedNodeId
    ) ?? null;

  const saveDefinition = useMutation(
    trpc.workflow.saveDefinition.mutationOptions(
      {
        onSuccess: async (
          _result,
          variables
        ) => {
          setValidationError(null);

          setSavedSignature(
            getDefinitionSignature({
              id: variables.id,
              nodes: variables.nodes,
              edges: variables.edges,
            })
          );

          await Promise.all([
            queryClient.invalidateQueries(
              trpc.workflow.getById.queryFilter(
                {
                  id: workflowId,
                }
              )
            ),

            queryClient.invalidateQueries(
              trpc.workflow.list.queryFilter(
                {
                  workspaceId,
                  includeArchived: true,
                }
              )
            ),
          ]);

          toast.success(
            "Workflow draft saved."
          );
        },

        onError: (error) => {
          toast.error(
            error.message ||
              "Unable to save workflow."
          );
        },
      }
    )
  );

  const rememberSnapshot =
    useCallback(() => {
      if (!canEdit) {
        return;
      }

      const snapshot =
        cloneSnapshot(
          nodes,
          edges
        );

      setHistory(
        (currentHistory) => [
          ...currentHistory.slice(
            -(MAX_HISTORY_LENGTH - 1)
          ),
          snapshot,
        ]
      );

      setFuture([]);
    }, [
      canEdit,
      nodes,
      edges,
    ]);

  const restoreSnapshot =
    useCallback(
      (snapshot: CanvasSnapshot) => {
        const restored =
          cloneSnapshot(
            snapshot.nodes,
            snapshot.edges
          );

        setNodes(restored.nodes);
        setEdges(restored.edges);
        setValidationError(null);

        if (
          selectedNodeId &&
          !restored.nodes.some(
            (node) =>
              node.id ===
              selectedNodeId
          )
        ) {
          setSelectedNodeId(null);
          setConfigurationOpen(false);
        }
      },
      [
        selectedNodeId,
        setNodes,
        setEdges,
      ]
    );

  const handleUndo =
    useCallback(() => {
      if (
        !canEdit ||
        history.length === 0
      ) {
        return;
      }

      const previousSnapshot =
        history[
          history.length - 1
        ];

      const currentSnapshot =
        cloneSnapshot(
          nodes,
          edges
        );

      setHistory(
        (currentHistory) =>
          currentHistory.slice(0, -1)
      );

      setFuture(
        (currentFuture) => [
          ...currentFuture.slice(
            -(MAX_HISTORY_LENGTH - 1)
          ),
          currentSnapshot,
        ]
      );

      restoreSnapshot(
        previousSnapshot
      );
    }, [
      canEdit,
      history,
      nodes,
      edges,
      restoreSnapshot,
    ]);

  const handleRedo =
    useCallback(() => {
      if (
        !canEdit ||
        future.length === 0
      ) {
        return;
      }

      const nextSnapshot =
        future[
          future.length - 1
        ];

      const currentSnapshot =
        cloneSnapshot(
          nodes,
          edges
        );

      setFuture(
        (currentFuture) =>
          currentFuture.slice(0, -1)
      );

      setHistory(
        (currentHistory) => [
          ...currentHistory.slice(
            -(MAX_HISTORY_LENGTH - 1)
          ),
          currentSnapshot,
        ]
      );

      restoreSnapshot(nextSnapshot);
    }, [
      canEdit,
      future,
      nodes,
      edges,
      restoreSnapshot,
    ]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) {
        return;
      }

      rememberSnapshot();
      setValidationError(null);

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
      rememberSnapshot,
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

      rememberSnapshot();

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
      rememberSnapshot,
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

      rememberSnapshot();
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
    [
      canEdit,
      rememberSnapshot,
      setNodes,
    ]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!canEdit) {
        return;
      }

      const nodeToDelete =
        nodes.find(
          (node) =>
            node.id === nodeId
        );

      if (
        !nodeToDelete ||
        nodeToDelete.type ===
          "trigger"
      ) {
        return;
      }

      rememberSnapshot();
      setValidationError(null);

      setNodes((currentNodes) =>
        currentNodes.filter(
          (node) =>
            node.id !== nodeId
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
      nodes,
      rememberSnapshot,
      setEdges,
      setNodes,
    ]
  );

  const handleTidyLayout =
    useCallback(() => {
      if (
        !canEdit ||
        nodes.length === 0
      ) {
        return;
      }

      rememberSnapshot();

      setNodes(
        createTidyLayout(
          nodes,
          edges
        )
      );

      setValidationError(null);
    }, [
      canEdit,
      nodes,
      edges,
      rememberSnapshot,
      setNodes,
    ]);

  const handleSave =
    useCallback(() => {
      if (
        !canEdit ||
        saveDefinition.isPending
      ) {
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

      saveDefinition.mutate(
        definitionInput
      );
    }, [
      canEdit,
      nodes,
      edges,
      definitionInput,
      saveDefinition,
    ]);

  const handleNodesChange =
    useCallback(
      (
        changes: NodeChange<
          WorkflowCanvasNode
        >[]
      ) => {
        const meaningfulChange =
          changes.some(
            (change) =>
              change.type ===
                "remove" ||
              change.type === "add" ||
              change.type === "replace"
          );

        if (
          canEdit &&
          meaningfulChange
        ) {
          rememberSnapshot();
          setValidationError(null);
        }

        onNodesChange(changes);
      },
      [
        canEdit,
        rememberSnapshot,
        onNodesChange,
      ]
    );

  const handleEdgesChange =
    useCallback(
      (
        changes: EdgeChange<Edge>[]
      ) => {
        const meaningfulChange =
          changes.some(
            (change) =>
              change.type !== "select"
          );

        if (
          canEdit &&
          meaningfulChange
        ) {
          rememberSnapshot();
          setValidationError(null);
        }

        onEdgesChange(changes);
      },
      [
        canEdit,
        rememberSnapshot,
        onEdgesChange,
      ]
    );

  const handleNodeClick =
    useCallback(
      (node: WorkflowCanvasNode) => {
        const clickedSameNode =
          node.id ===
          selectedNodeId;

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

  const handlePublished =
    useCallback(() => {
      setSavedSignature(
        currentSignature
      );

      setValidationError(null);
    }, [currentSignature]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function handleBeforeUnload(
      event: BeforeUnloadEvent
    ) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      );
    };
  }, [isDirty]);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      const modifierPressed =
        event.metaKey ||
        event.ctrlKey;

      const key =
        event.key.toLowerCase();

      if (
        canEdit &&
        modifierPressed &&
        key === "s"
      ) {
        event.preventDefault();
        handleSave();

        return;
      }

      if (
        canEdit &&
        modifierPressed &&
        key === "z" &&
        !event.shiftKey &&
        !isEditableTarget(
          event.target
        )
      ) {
        event.preventDefault();
        handleUndo();

        return;
      }

      if (
        canEdit &&
        modifierPressed &&
        ((key === "z" &&
          event.shiftKey) ||
          key === "y") &&
        !isEditableTarget(
          event.target
        )
      ) {
        event.preventDefault();
        handleRedo();

        return;
      }

      if (
        modifierPressed &&
        key === "/"
      ) {
        event.preventDefault();
        setShortcutsOpen(true);

        return;
      }

      if (event.key === "Escape") {
        setConfigurationOpen(false);
        setShortcutsOpen(false);
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
    handleUndo,
    handleRedo,
  ]);

  return (
    <>
      <div className="flex h-[calc(100vh-16rem)] min-h-[560px] max-h-[800px] flex-col overflow-hidden rounded-xl border bg-muted/20">
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
              aria-pressed={
                libraryOpen
              }
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
                  {nodes.length}{" "}
                  {nodes.length === 1
                    ? "step"
                    : "steps"}
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
                Select a step to
                configure it. Press
                Ctrl+S to save.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {canEdit && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Undo"
                  aria-label="Undo"
                  disabled={
                    history.length === 0
                  }
                  onClick={handleUndo}
                >
                  <Undo2 className="size-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Redo"
                  aria-label="Redo"
                  disabled={
                    future.length === 0
                  }
                  onClick={handleRedo}
                >
                  <Redo2 className="size-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Tidy layout"
                  aria-label="Tidy layout"
                  disabled={
                    nodes.length === 0
                  }
                  onClick={
                    handleTidyLayout
                  }
                >
                  <LayoutGrid className="size-4" />
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title="Keyboard shortcuts"
              aria-label="Keyboard shortcuts"
              onClick={() =>
                setShortcutsOpen(true)
              }
            >
              <Keyboard className="size-4" />
            </Button>

            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() =>
                  addActionNode(
                    "NO_OP"
                  )
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
                  (current) =>
                    !current
                )
              }
            >
              {configurationOpen ? (
                <PanelBottomClose className="size-4" />
              ) : (
                <PanelBottomOpen className="size-4" />
              )}
            </Button>

            <RunWorkflowControl
              workflowId={workflowId}
              workspaceId={
                workspaceId
              }
              canExecute={
                canExecute
              }
            />

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
                  onPublished={
                    handlePublished
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
                    {saveDefinition.isPending
                      ? "Saving..."
                      : "Save draft"}
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
                onNodeDragStart={() => {
                  if (canEdit) {
                    rememberSnapshot();
                  }
                }}
                nodesDraggable={
                  canEdit
                }
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

      <Dialog
        open={shortcutsOpen}
        onOpenChange={
          setShortcutsOpen
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Keyboard shortcuts
            </DialogTitle>

            <DialogDescription>
              Use these shortcuts while
              editing the workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="divide-y rounded-lg border">
            <ShortcutRow
              label="Save draft"
              shortcut="Ctrl / ⌘ + S"
            />

            <ShortcutRow
              label="Undo"
              shortcut="Ctrl / ⌘ + Z"
            />

            <ShortcutRow
              label="Redo"
              shortcut="Ctrl / ⌘ + Shift + Z"
            />

            <ShortcutRow
              label="Delete selected step"
              shortcut="Delete"
            />

            <ShortcutRow
              label="Close configuration"
              shortcut="Esc"
            />

            <ShortcutRow
              label="Open shortcuts"
              shortcut="Ctrl / ⌘ + /"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShortcutRow({
  label,
  shortcut,
}: {
  label: string;
  shortcut: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm">
        {label}
      </span>

      <kbd className="rounded border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
        {shortcut}
      </kbd>
    </div>
  );
}
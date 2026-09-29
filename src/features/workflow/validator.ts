import { z } from "zod";

export const workflowStatusSchema =
  z.enum([
    "DRAFT",
    "ACTIVE",
    "ARCHIVED",
  ]);

export const workflowIdSchema =
  z.object({
    id: z
      .string()
      .uuid(
        "Invalid workflow ID."
      ),
  });

export const listWorkflowsSchema =
  z.object({
    workspaceId: z
      .string()
      .uuid(
        "Invalid workspace ID."
      ),

    includeArchived: z
      .boolean()
      .optional()
      .default(false),
  });

export const listAllWorkflowsSchema =
  z.object({
    includeArchived: z
      .boolean()
      .optional()
      .default(false),

    favoritesOnly: z
      .boolean()
      .optional()
      .default(false),
  });

export const createWorkflowSchema =
  z.object({
    workspaceId: z
      .string()
      .uuid(
        "Invalid workspace ID."
      ),

    name: z
      .string()
      .trim()
      .min(
        2,
        "Workflow name must contain at least 2 characters."
      )
      .max(
        100,
        "Workflow name cannot exceed 100 characters."
      ),

    description: z
      .string()
      .trim()
      .max(
        500,
        "Description cannot exceed 500 characters."
      )
      .optional(),
  });

export const updateWorkflowSchema =
  z
    .object({
      id: z
        .string()
        .uuid(
          "Invalid workflow ID."
        ),

      name: z
        .string()
        .trim()
        .min(
          2,
          "Workflow name must contain at least 2 characters."
        )
        .max(
          100,
          "Workflow name cannot exceed 100 characters."
        )
        .optional(),

      description: z
        .string()
        .trim()
        .max(
          500,
          "Description cannot exceed 500 characters."
        )
        .nullable()
        .optional(),
    })
    .refine(
      (input) =>
        input.name !==
          undefined ||
        input.description !==
          undefined,
      {
        message:
          "Provide at least one field to update.",
      }
    );

const workflowPositionSchema =
  z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  });

export const workflowNodeSchema =
  z.object({
    id: z
      .string()
      .min(
        1,
        "Node ID is required."
      )
      .max(
        100,
        "Node ID cannot exceed 100 characters."
      ),

    type: z.enum([
      "trigger",
      "action",
    ]),

    position:
      workflowPositionSchema,

    data: z.object({
      label: z
        .string()
        .trim()
        .min(
          1,
          "Node label is required."
        )
        .max(
          100,
          "Node label cannot exceed 100 characters."
        ),

      description: z
        .string()
        .trim()
        .max(
          500,
          "Node description cannot exceed 500 characters."
        )
        .optional(),

      configuration: z
        .record(
          z.string(),
          z.unknown()
        )
        .optional(),
    }),
  });

export const workflowEdgeSchema =
  z.object({
    id: z
      .string()
      .min(
        1,
        "Connection ID is required."
      )
      .max(
        200,
        "Connection ID cannot exceed 200 characters."
      ),

    source: z
      .string()
      .min(
        1,
        "Connection source is required."
      )
      .max(
        100,
        "Connection source cannot exceed 100 characters."
      ),

    target: z
      .string()
      .min(
        1,
        "Connection target is required."
      )
      .max(
        100,
        "Connection target cannot exceed 100 characters."
      ),

    sourceHandle: z
      .string()
      .nullable()
      .optional(),

    targetHandle: z
      .string()
      .nullable()
      .optional(),

    animated: z
      .boolean()
      .optional(),
  });

const workflowDefinitionShape = {
  nodes: z
    .array(
      workflowNodeSchema
    )
    .min(
      1,
      "The workflow requires a trigger."
    )
    .max(
      100,
      "A workflow cannot exceed 100 nodes."
    ),

  edges: z
    .array(
      workflowEdgeSchema
    )
    .max(
      200,
      "A workflow cannot exceed 200 connections."
    ),
};

type WorkflowDefinitionValue = {
  nodes: z.infer<
    typeof workflowNodeSchema
  >[];

  edges: z.infer<
    typeof workflowEdgeSchema
  >[];
};

function validateWorkflowDefinition(
  definition: WorkflowDefinitionValue,
  refinementContext: z.RefinementCtx
) {
  const nodeIds =
    new Set<string>();

  for (const [
    index,
    node,
  ] of definition.nodes.entries()) {
    if (nodeIds.has(node.id)) {
      refinementContext.addIssue({
        code: "custom",

        path: [
          "nodes",
          index,
          "id",
        ],

        message:
          "Node IDs must be unique.",
      });
    }

    nodeIds.add(node.id);
  }

  const triggerCount =
    definition.nodes.filter(
      (node) =>
        node.type === "trigger"
    ).length;

  if (triggerCount !== 1) {
    refinementContext.addIssue({
      code: "custom",

      path: ["nodes"],

      message:
        "A workflow must contain exactly one trigger.",
    });
  }

  const edgeIds =
    new Set<string>();

  const connections =
    new Set<string>();

  for (const [
    index,
    edge,
  ] of definition.edges.entries()) {
    if (edgeIds.has(edge.id)) {
      refinementContext.addIssue({
        code: "custom",

        path: [
          "edges",
          index,
          "id",
        ],

        message:
          "Connection IDs must be unique.",
      });
    }

    edgeIds.add(edge.id);

    if (
      !nodeIds.has(edge.source)
    ) {
      refinementContext.addIssue({
        code: "custom",

        path: [
          "edges",
          index,
          "source",
        ],

        message:
          "Connection source does not exist.",
      });
    }

    if (
      !nodeIds.has(edge.target)
    ) {
      refinementContext.addIssue({
        code: "custom",

        path: [
          "edges",
          index,
          "target",
        ],

        message:
          "Connection target does not exist.",
      });
    }

    if (
      edge.source === edge.target
    ) {
      refinementContext.addIssue({
        code: "custom",

        path: [
          "edges",
          index,
        ],

        message:
          "A node cannot connect to itself.",
      });
    }

    const connectionKey = [
      edge.source,
      edge.sourceHandle ?? "",
      edge.target,
      edge.targetHandle ?? "",
    ].join(":");

    if (
      connections.has(
        connectionKey
      )
    ) {
      refinementContext.addIssue({
        code: "custom",

        path: [
          "edges",
          index,
        ],

        message:
          "Duplicate connections are not allowed.",
      });
    }

    connections.add(
      connectionKey
    );
  }
}

export const workflowDefinitionSchema =
  z
    .object(
      workflowDefinitionShape
    )
    .superRefine(
      validateWorkflowDefinition
    );

export const saveWorkflowDefinitionSchema =
  z
    .object({
      id: z
        .string()
        .uuid(
          "Invalid workflow ID."
        ),

      ...workflowDefinitionShape,
    })
    .superRefine(
      validateWorkflowDefinition
    );

export const generateWorkflowDraftSchema =
  z.object({
    workspaceId: z
      .string()
      .uuid(
        "Invalid workspace ID."
      ),

    prompt: z
      .string()
      .trim()
      .min(
        10,
        "Describe the automation in at least 10 characters."
      )
      .max(
        2_000,
        "The automation request cannot exceed 2000 characters."
      ),
  });

export const createAssistantWorkflowSchema =
  z.object({
    workspaceId: z
      .string()
      .uuid(
        "Invalid workspace ID."
      ),

    name: z
      .string()
      .trim()
      .min(
        2,
        "Workflow name must contain at least 2 characters."
      )
      .max(
        100,
        "Workflow name cannot exceed 100 characters."
      ),

    description: z
      .string()
      .trim()
      .max(
        500,
        "Description cannot exceed 500 characters."
      )
      .optional(),

    definition:
      workflowDefinitionSchema,
  });

export const setWorkflowFavoriteSchema =
  z.object({
    workflowId: z
      .string()
      .uuid(
        "Invalid workflow ID."
      ),

    favorite: z.boolean(),
  });

export const executeWorkflowSchema =
  z.object({
    id: z
      .string()
      .uuid(
        "Invalid workflow ID."
      ),

    input: z
      .record(
        z.string(),
        z.unknown()
      )
      .optional()
      .default({}),
  });

export const listWorkflowRunsSchema =
  z.object({
    workflowId: z
      .string()
      .uuid(
        "Invalid workflow ID."
      ),

    limit: z
      .number()
      .int()
      .min(
        1,
        "Run limit must be at least 1."
      )
      .max(
        100,
        "Run limit cannot exceed 100."
      )
      .optional()
      .default(20),
  });

export const listAllWorkflowRunsSchema =
  z.object({
    limit: z
      .number()
      .int()
      .min(
        1,
        "Run limit must be at least 1."
      )
      .max(
        100,
        "Run limit cannot exceed 100."
      )
      .optional()
      .default(50),

    status: z
      .enum([
        "PENDING",
        "RUNNING",
        "SUCCESS",
        "FAILED",
        "CANCELLED",
      ])
      .optional(),

    triggerType: z
      .enum([
        "MANUAL",
        "WEBHOOK",
        "SCHEDULE",
        "INTEGRATION",
      ])
      .optional(),
  });

export const workflowRunIdSchema =
  z.object({
    id: z
      .string()
      .uuid(
        "Invalid workflow run ID."
      ),
  });

export const archiveWorkflowSchema =
  workflowIdSchema;

export const deleteWorkflowSchema =
  workflowIdSchema;

export type CreateWorkflowInput =
  z.infer<
    typeof createWorkflowSchema
  >;

export type UpdateWorkflowInput =
  z.infer<
    typeof updateWorkflowSchema
  >;

export type ListWorkflowsInput =
  z.infer<
    typeof listWorkflowsSchema
  >;

export type ListAllWorkflowsInput =
  z.infer<
    typeof listAllWorkflowsSchema
  >;

export type WorkflowDefinitionInput =
  z.infer<
    typeof workflowDefinitionSchema
  >;

export type SaveWorkflowDefinitionInput =
  z.infer<
    typeof saveWorkflowDefinitionSchema
  >;

export type GenerateWorkflowDraftInput =
  z.infer<
    typeof generateWorkflowDraftSchema
  >;

export type CreateAssistantWorkflowInput =
  z.infer<
    typeof createAssistantWorkflowSchema
  >;

export type SetWorkflowFavoriteInput =
  z.infer<
    typeof setWorkflowFavoriteSchema
  >;

export type ExecuteWorkflowInput =
  z.infer<
    typeof executeWorkflowSchema
  >;

export type ListWorkflowRunsInput =
  z.infer<
    typeof listWorkflowRunsSchema
  >;

export type ListAllWorkflowRunsInput =
  z.infer<
    typeof listAllWorkflowRunsSchema
  >;

export type WorkflowRunIdInput =
  z.infer<
    typeof workflowRunIdSchema
  >;
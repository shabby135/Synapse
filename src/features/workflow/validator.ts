import { z } from "zod";

export const workflowStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
]);

export const workflowIdSchema = z.object({
  id: z
    .string()
    .uuid("Invalid workflow ID."),
});

export const listWorkflowsSchema = z.object({
  workspaceId: z
    .string()
    .uuid("Invalid workspace ID."),

  includeArchived: z
    .boolean()
    .optional()
    .default(false),
});

export const createWorkflowSchema = z.object({
  workspaceId: z
    .string()
    .uuid("Invalid workspace ID."),

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

export const updateWorkflowSchema = z
  .object({
    id: z
      .string()
      .uuid("Invalid workflow ID."),

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
      input.name !== undefined ||
      input.description !== undefined,
    {
      message:
        "Provide at least one field to update.",
    }
  );

const workflowPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const workflowNodeSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100),

  type: z.enum([
    "trigger",
    "action",
  ]),

  position: workflowPositionSchema,

  data: z.object({
    label: z
      .string()
      .trim()
      .min(1)
      .max(100),

    description: z
      .string()
      .trim()
      .max(500)
      .optional(),

    configuration: z
      .record(
        z.string(),
        z.unknown()
      )
      .optional(),
  }),
});

const workflowEdgeSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(200),

  source: z
    .string()
    .min(1)
    .max(100),

  target: z
    .string()
    .min(1)
    .max(100),

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

export const saveWorkflowDefinitionSchema = z
  .object({
    id: z
      .string()
      .uuid("Invalid workflow ID."),

    nodes: z
      .array(workflowNodeSchema)
      .min(
        1,
        "The workflow requires a trigger."
      )
      .max(
        100,
        "A workflow cannot exceed 100 nodes."
      ),

    edges: z
      .array(workflowEdgeSchema)
      .max(
        200,
        "A workflow cannot exceed 200 connections."
      ),
  })
  .superRefine(
    (
      definition,
      refinementContext
    ) => {
      const nodeIds = new Set<string>();

      for (const [
        index,
        node,
      ] of definition.nodes.entries()) {
        if (nodeIds.has(node.id)) {
          refinementContext.addIssue({
            code: "custom",
            path: ["nodes", index, "id"],
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

      for (const [
        index,
        edge,
      ] of definition.edges.entries()) {
        if (!nodeIds.has(edge.source)) {
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

        if (!nodeIds.has(edge.target)) {
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

        if (edge.source === edge.target) {
          refinementContext.addIssue({
            code: "custom",
            path: ["edges", index],
            message:
              "A node cannot connect to itself.",
          });
        }
      }
    }
  );

export const executeWorkflowSchema = z.object({
  id: z
    .string()
    .uuid("Invalid workflow ID."),

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
      .uuid("Invalid workflow ID."),

    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20),
  });

export const workflowRunIdSchema = z.object({
  id: z
    .string()
    .uuid("Invalid workflow run ID."),
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

export type SaveWorkflowDefinitionInput =
  z.infer<
    typeof saveWorkflowDefinitionSchema
  >;

export type ExecuteWorkflowInput =
  z.infer<
    typeof executeWorkflowSchema
  >;

export type ListWorkflowRunsInput =
  z.infer<
    typeof listWorkflowRunsSchema
  >;

export type WorkflowRunIdInput =
  z.infer<
    typeof workflowRunIdSchema
  >;
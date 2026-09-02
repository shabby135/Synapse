import { z } from "zod";

export const workflowStatusSchema =
  z.enum([
    "DRAFT",
    "ACTIVE",
    "ARCHIVED",
  ]);

export const workflowIdSchema = z.object({
  id: z.string().uuid(
    "Invalid workflow ID."
  ),
});

export const listWorkflowsSchema =
  z.object({
    workspaceId: z.string().uuid(
      "Invalid workspace ID."
    ),

    includeArchived: z
      .boolean()
      .optional()
      .default(false),
  });

export const createWorkflowSchema =
  z.object({
    workspaceId: z.string().uuid(
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
      id: z.string().uuid(
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
        input.name !== undefined ||
        input.description !== undefined,
      {
        message:
          "Provide at least one field to update.",
      }
    );

export const archiveWorkflowSchema =
  workflowIdSchema;

export const deleteWorkflowSchema =
  workflowIdSchema;

export type CreateWorkflowInput =
  z.infer<typeof createWorkflowSchema>;

export type UpdateWorkflowInput =
  z.infer<typeof updateWorkflowSchema>;
  
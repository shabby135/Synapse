import { z } from "zod";

const workflowFolderNameSchema =
  z
    .string()
    .trim()
    .min(
      1,
      "Folder name is required."
    )
    .max(
      60,
      "Folder name cannot exceed 60 characters."
    );

export const listWorkflowFoldersSchema =
  z.object({
    workspaceId: z
      .string()
      .uuid(
        "Invalid workspace ID."
      ),
  });

export const createWorkflowFolderSchema =
  z.object({
    workspaceId: z
      .string()
      .uuid(
        "Invalid workspace ID."
      ),

    name:
      workflowFolderNameSchema,
  });

export const renameWorkflowFolderSchema =
  z.object({
    id: z
      .string()
      .uuid(
        "Invalid folder ID."
      ),

    name:
      workflowFolderNameSchema,
  });

export const deleteWorkflowFolderSchema =
  z.object({
    id: z
      .string()
      .uuid(
        "Invalid folder ID."
      ),
  });

export const moveWorkflowToFolderSchema =
  z.object({
    workflowId: z
      .string()
      .uuid(
        "Invalid workflow ID."
      ),

    folderId: z
      .string()
      .uuid(
        "Invalid folder ID."
      )
      .nullable(),
  });

export type ListWorkflowFoldersInput =
  z.infer<
    typeof listWorkflowFoldersSchema
  >;

export type CreateWorkflowFolderInput =
  z.infer<
    typeof createWorkflowFolderSchema
  >;

export type RenameWorkflowFolderInput =
  z.infer<
    typeof renameWorkflowFolderSchema
  >;

export type DeleteWorkflowFolderInput =
  z.infer<
    typeof deleteWorkflowFolderSchema
  >;

export type MoveWorkflowToFolderInput =
  z.infer<
    typeof moveWorkflowToFolderSchema
  >;
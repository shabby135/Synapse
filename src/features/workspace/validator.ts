import { z } from "zod";

export const workspaceRoleSchema =
  z.enum([
    "OWNER",
    "ADMIN",
    "EDITOR",
    "VIEWER",
  ]);

export const assignableWorkspaceRoleSchema =
  z.enum([
    "ADMIN",
    "EDITOR",
    "VIEWER",
  ]);

export const createWorkspaceSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        3,
        "Workspace name must contain at least 3 characters."
      )
      .max(
        50,
        "Workspace name cannot exceed 50 characters."
      ),
  });

export const updateWorkspaceSchema =
  z.object({
    id: z.string().uuid(),

    name: z
      .string()
      .trim()
      .min(
        3,
        "Workspace name must contain at least 3 characters."
      )
      .max(
        50,
        "Workspace name cannot exceed 50 characters."
      ),
  });

export const workspaceIdSchema =
  z.object({
    id: z.string().uuid(),
  });

export const addWorkspaceMemberSchema =
  z.object({
    workspaceId: z.string().uuid(),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address."),

    role: assignableWorkspaceRoleSchema,
  });

export const updateWorkspaceMemberRoleSchema =
  z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().min(1),

    role: assignableWorkspaceRoleSchema,
  });

export const removeWorkspaceMemberSchema =
  z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().min(1),
  });

export type CreateWorkspaceInput =
  z.infer<
    typeof createWorkspaceSchema
  >;

export type UpdateWorkspaceInput =
  z.infer<
    typeof updateWorkspaceSchema
  >;

export type AddWorkspaceMemberInput =
  z.infer<
    typeof addWorkspaceMemberSchema
  >;

export type UpdateWorkspaceMemberRoleInput =
  z.infer<
    typeof updateWorkspaceMemberRoleSchema
  >;

export type RemoveWorkspaceMemberInput =
  z.infer<
    typeof removeWorkspaceMemberSchema
  >;
export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "EDITOR"
  | "VIEWER";

export type WorkspacePermission =
  | "workspace:update"
  | "workspace:delete"
  | "member:read"
  | "member:manage"
  | "workflow:read"
  | "workflow:create"
  | "workflow:update"
  | "workflow:delete"
  | "workflow:execute";

const permissionsByRole: Record<
  WorkspaceRole,
  readonly WorkspacePermission[]
> = {
  OWNER: [
    "workspace:update",
    "workspace:delete",
    "member:read",
    "member:manage",
    "workflow:read",
    "workflow:create",
    "workflow:update",
    "workflow:delete",
    "workflow:execute",
  ],

  ADMIN: [
    "workspace:update",
    "member:read",
    "member:manage",
    "workflow:read",
    "workflow:create",
    "workflow:update",
    "workflow:delete",
    "workflow:execute",
  ],

  EDITOR: [
    "member:read",
    "workflow:read",
    "workflow:create",
    "workflow:update",
    "workflow:execute",
  ],

  VIEWER: [
    "member:read",
    "workflow:read",
  ],
};

export function hasWorkspacePermission(
  role: WorkspaceRole,
  permission: WorkspacePermission
) {
  return permissionsByRole[
    role
  ].includes(permission);
}
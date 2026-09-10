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
  | "workflow:execute"
  | "integration:read"
  | "integration:manage"
  | "billing:read"
  | "billing:manage";

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
    "integration:read",
    "integration:manage",
    "billing:read",
    "billing:manage",
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
    "integration:read",
    "integration:manage",
    "billing:read",
  ],

  EDITOR: [
    "member:read",
    "workflow:read",
    "workflow:create",
    "workflow:update",
    "workflow:execute",
    "integration:read",
  ],

  VIEWER: [
    "member:read",
    "workflow:read",
  ],
};

export function hasWorkspacePermission(
  role: WorkspaceRole,
  permission: WorkspacePermission
): boolean {
  return permissionsByRole[
    role
  ].includes(permission);
}
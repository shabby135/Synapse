import { TRPCError } from "@trpc/server";

import {
  and,
  eq,
} from "drizzle-orm";

import { db } from "@/lib/db";

import { workspaceMember } from "@/lib/db/schema";

import {
  hasWorkspacePermission,
  type WorkspacePermission,
  type WorkspaceRole,
} from "./permissions";

type RequireWorkspacePermissionOptions = {
  database: typeof db;
  workspaceId: string;
  userId: string;
  permission: WorkspacePermission;
};

export async function requireWorkspacePermission({
  database,
  workspaceId,
  userId,
  permission,
}: RequireWorkspacePermissionOptions) {
  const [membership] =
    await database
      .select({
        role: workspaceMember.role,
      })
      .from(workspaceMember)
      .where(
        and(
          eq(
            workspaceMember.workspaceId,
            workspaceId
          ),
          eq(
            workspaceMember.userId,
            userId
          )
        )
      )
      .limit(1);

  if (!membership) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message:
        "Workspace not found or access denied.",
    });
  }

  const role =
    membership.role as WorkspaceRole;

  if (
    !hasWorkspacePermission(
      role,
      permission
    )
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "You do not have permission to perform this action.",
    });
  }

  return {
    role,
  };
}
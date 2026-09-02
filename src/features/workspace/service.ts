import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";

import {
  workspace,
} from "@/lib/db/schema/workspace";

import {
  workspaceMember,
} from "@/lib/db/schema/workspace-member";

export class WorkspaceService {
  static async create({
    userId,
    name,
  }: {
    userId: string;
    name: string;
  }) {
    return db.transaction(async (tx) => {
      const workspaceId = randomUUID();

      const slug = name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

      await tx.insert(workspace).values({
        id: workspaceId,
        name,
        slug,
        ownerId: userId,
      });

      await tx.insert(workspaceMember).values({
        workspaceId,
        userId,
        role: "OWNER",
      });

      const created = await tx.query.workspace.findFirst({
        where: (workspace, { eq }) =>
          eq(workspace.id, workspaceId),
      });

      return created;
    });
  }
}
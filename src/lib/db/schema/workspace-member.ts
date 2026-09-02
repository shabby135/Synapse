import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { workspace } from "./workspace";


export const workspaceMember = pgTable(
  "workspace_member",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, {
        onDelete: "cascade",
      }),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    role: text("role")
      .notNull()
      .$type<"OWNER" | "ADMIN" | "EDITOR" | "VIEWER">(),

    joinedAt: timestamp("joined_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.userId],
    }),

    index("workspace_member_workspace_idx")
      .on(table.workspaceId),

    index("workspace_member_user_idx")
      .on(table.userId),
  ]
);

export const workspaceMemberRelations = relations(
  workspaceMember,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [workspaceMember.workspaceId],
      references: [workspace.id],
    }),

    user: one(user, {
      fields: [workspaceMember.userId],
      references: [user.id],
    }),
  })
);
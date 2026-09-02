import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/auth";

export const workspace = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    slug: text("slug").notNull().unique(),

    icon: text("icon"),

    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workspace_owner_idx").on(table.ownerId),
  ]
);

export const workspaceRelations = relations(
  workspace,
  ({ one }) => ({
    owner: one(user, {
      fields: [workspace.ownerId],
      references: [user.id],
    }),
  })
);
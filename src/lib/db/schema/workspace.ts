import {
  pgTable,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { workspaceMember } from "./workspace-member";
import { relations } from "drizzle-orm";


export const workspace = pgTable("workspace", {
 id: text("id").primaryKey(),
  name: text("name").notNull(),

  slug: text("slug").notNull().unique(),

  image: text("image"),

  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, {
      onDelete: "cascade",
    }),

  isPersonal: boolean("is_personal")
    .default(false)
    .notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const workspaceRelations = relations(
  workspace,
  ({ one, many }) => ({
    owner: one(user, {
      fields: [workspace.ownerId],
      references: [user.id],
    }),

    members: many(workspaceMember),
  })
);
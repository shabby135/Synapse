import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { workflow } from "./workflow";

export const workflowFavorite = pgTable(
  "workflow_favorite",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflow.id, {
        onDelete: "cascade",
      }),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.userId,
        table.workflowId,
      ],
    }),

    index(
      "workflow_favorite_workflow_idx"
    ).on(table.workflowId),
  ]
);

export const workflowFavoriteRelations =
  relations(
    workflowFavorite,
    ({ one }) => ({
      user: one(user, {
        fields: [
          workflowFavorite.userId,
        ],
        references: [user.id],
      }),

      workflow: one(workflow, {
        fields: [
          workflowFavorite.workflowId,
        ],
        references: [workflow.id],
      }),
    })
  );
import {
  relations,
} from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { workspace } from "./workspace";

export const workflowFolder =
  pgTable(
    "workflow_folder",
    {
      id: text("id").primaryKey(),

      workspaceId: text(
        "workspace_id"
      )
        .notNull()
        .references(
          () => workspace.id,
          {
            onDelete: "cascade",
          }
        ),

      name: text("name").notNull(),

      createdBy: text(
        "created_by"
      ).references(
        () => user.id,
        {
          onDelete: "set null",
        }
      ),

      createdAt: timestamp(
        "created_at"
      )
        .defaultNow()
        .notNull(),

      updatedAt: timestamp(
        "updated_at"
      )
        .defaultNow()
        .$onUpdate(
          () => new Date()
        )
        .notNull(),
    },
    (table) => [
      index(
        "workflow_folder_workspace_id_idx"
      ).on(table.workspaceId),

      uniqueIndex(
        "workflow_folder_workspace_name_idx"
      ).on(
        table.workspaceId,
        table.name
      ),
    ]
  );

export const workflowFolderRelations =
  relations(
    workflowFolder,
    ({ one }) => ({
      workspace: one(workspace, {
        fields: [
          workflowFolder.workspaceId,
        ],
        references: [
          workspace.id,
        ],
      }),

      creator: one(user, {
        fields: [
          workflowFolder.createdBy,
        ],
        references: [user.id],
      }),
    })
  );
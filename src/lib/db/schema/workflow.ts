import { relations } from "drizzle-orm";

import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { workspace } from "./workspace";

export const workflowStatus = pgEnum(
  "workflow_status",
  [
    "DRAFT",
    "ACTIVE",
    "ARCHIVED",
  ]
);

export const workflowVersionStatus = pgEnum(
  "workflow_version_status",
  [
    "DRAFT",
    "PUBLISHED",
  ]
);

export type WorkflowDefinition = {
  nodes: unknown[];
  edges: unknown[];
  variables?: Record<string, unknown>;
};

export const workflow = pgTable(
  "workflow",
  {
    id: text("id").primaryKey(),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),

    description: text("description"),

    status: workflowStatus("status")
      .default("DRAFT")
      .notNull(),

    createdBy: text("created_by").references(
      () => user.id,
      {
        onDelete: "set null",
      }
    ),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workflow_workspace_id_idx").on(
      table.workspaceId
    ),

    index("workflow_workspace_status_idx").on(
      table.workspaceId,
      table.status
    ),
  ]
);

export const workflowVersion = pgTable(
  "workflow_version",
  {
    id: text("id").primaryKey(),

    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflow.id, {
        onDelete: "cascade",
      }),

    version: integer("version").notNull(),

    status: workflowVersionStatus("status")
      .default("DRAFT")
      .notNull(),

    definition: jsonb("definition")
      .$type<WorkflowDefinition>()
      .default({
        nodes: [],
        edges: [],
      })
      .notNull(),

    createdBy: text("created_by").references(
      () => user.id,
      {
        onDelete: "set null",
      }
    ),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex(
      "workflow_version_workflow_version_idx"
    ).on(
      table.workflowId,
      table.version
    ),

    index(
      "workflow_version_workflow_id_idx"
    ).on(table.workflowId),
  ]
);

export const workflowRelations = relations(
  workflow,
  ({ one, many }) => ({
    workspace: one(workspace, {
      fields: [workflow.workspaceId],
      references: [workspace.id],
    }),

    creator: one(user, {
      fields: [workflow.createdBy],
      references: [user.id],
    }),

    versions: many(workflowVersion),
  })
);

export const workflowVersionRelations =
  relations(
    workflowVersion,
    ({ one }) => ({
      workflow: one(workflow, {
        fields: [
          workflowVersion.workflowId,
        ],
        references: [workflow.id],
      }),

      creator: one(user, {
        fields: [
          workflowVersion.createdBy,
        ],
        references: [user.id],
      }),
    })
  );
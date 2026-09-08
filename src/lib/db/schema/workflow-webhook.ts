import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workflow } from "./workflow";
import { workflowRun } from "./workflow-execution";

export const workflowWebhook = pgTable(
  "workflow_webhook",
  {
    id: text("id").primaryKey(),

    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflow.id, {
        onDelete: "cascade",
      }),

    // Store only the hash, never the raw webhook secret.
    secretHash: text("secret_hash").notNull(),

    enabled: boolean("enabled")
      .default(false)
      .notNull(),

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
      "workflow_webhook_workflow_id_idx"
    ).on(table.workflowId),
  ]
);

export const workflowWebhookRequest = pgTable(
  "workflow_webhook_request",
  {
    id: text("id").primaryKey(),

    webhookId: text("webhook_id")
      .notNull()
      .references(() => workflowWebhook.id, {
        onDelete: "cascade",
      }),

    // Supplied by the caller and reused for retries.
    idempotencyKey: text("idempotency_key")
      .notNull(),

    // Detect reuse of the same key with different input.
    payloadHash: text("payload_hash")
      .notNull(),

    runId: text("run_id")
      .notNull()
      .references(() => workflowRun.id, {
        onDelete: "restrict",
      }),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex(
      "workflow_webhook_request_webhook_key_idx"
    ).on(
      table.webhookId,
      table.idempotencyKey
    ),

    uniqueIndex(
      "workflow_webhook_request_run_id_idx"
    ).on(table.runId),

    index(
      "workflow_webhook_request_created_at_idx"
    ).on(table.createdAt),
  ]
);

export const workflowWebhookRelations = relations(
  workflowWebhook,
  ({ one, many }) => ({
    workflow: one(workflow, {
      fields: [workflowWebhook.workflowId],
      references: [workflow.id],
    }),

    requests: many(workflowWebhookRequest),
  })
);

export const workflowWebhookRequestRelations =
  relations(
    workflowWebhookRequest,
    ({ one }) => ({
      webhook: one(workflowWebhook, {
        fields: [
          workflowWebhookRequest.webhookId,
        ],
        references: [workflowWebhook.id],
      }),

      run: one(workflowRun, {
        fields: [
          workflowWebhookRequest.runId,
        ],
        references: [workflowRun.id],
      }),
    })
  );
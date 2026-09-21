import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  workflow,
  workflowVersion,
} from "./workflow";
import {
  workflowRun,
} from "./workflow-execution";

export type IntegrationTriggerCursor =
  Record<string, unknown>;

export const workflowIntegrationTrigger =
  pgTable(
    "workflow_integration_trigger",
    {
      id: text("id").primaryKey(),

      workflowId: text(
        "workflow_id"
      )
        .notNull()
        .references(
          () => workflow.id,
          {
            onDelete: "cascade",
          }
        ),

      workflowVersionId: text(
        "workflow_version_id"
      )
        .notNull()
        .references(
          () => workflowVersion.id,
          {
            onDelete: "cascade",
          }
        ),

      nodeId: text(
        "node_id"
      ).notNull(),

      triggerType: text(
        "trigger_type"
      ).notNull(),

      configurationHash: text(
        "configuration_hash"
      ).notNull(),

      cursor: jsonb("cursor").$type<
        IntegrationTriggerCursor
      >(),

      lastPolledAt: timestamp(
        "last_polled_at"
      ),

      nextPollAt: timestamp(
        "next_poll_at"
      )
        .defaultNow()
        .notNull(),

      leaseExpiresAt: timestamp(
        "lease_expires_at"
      ),

      consecutiveFailures: integer(
        "consecutive_failures"
      )
        .default(0)
        .notNull(),

      lastError: text(
        "last_error"
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
        .$onUpdate(() => new Date())
        .notNull(),
    },
    (table) => [
      uniqueIndex(
        "workflow_integration_trigger_workflow_idx"
      ).on(table.workflowId),

      index(
        "workflow_integration_trigger_due_idx"
      ).on(table.nextPollAt),

      index(
        "workflow_integration_trigger_version_idx"
      ).on(
        table.workflowVersionId
      ),
    ]
  );

export const workflowIntegrationTriggerEvent =
  pgTable(
    "workflow_integration_trigger_event",
    {
      id: text("id").primaryKey(),

      triggerId: text(
        "trigger_id"
      )
        .notNull()
        .references(
          () =>
            workflowIntegrationTrigger.id,
          {
            onDelete: "cascade",
          }
        ),

      eventKey: text(
        "event_key"
      ).notNull(),

      payloadHash: text(
        "payload_hash"
      ).notNull(),

      runId: text("run_id")
        .notNull()
        .references(
          () => workflowRun.id,
          {
            onDelete: "cascade",
          }
        ),

      createdAt: timestamp(
        "created_at"
      )
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex(
        "workflow_integration_trigger_event_key_idx"
      ).on(
        table.triggerId,
        table.eventKey
      ),

      uniqueIndex(
        "workflow_integration_trigger_event_run_idx"
      ).on(table.runId),

      index(
        "workflow_integration_trigger_event_created_idx"
      ).on(table.createdAt),
    ]
  );

export const workflowIntegrationTriggerRelations =
  relations(
    workflowIntegrationTrigger,
    ({ one, many }) => ({
      workflow: one(workflow, {
        fields: [
          workflowIntegrationTrigger.workflowId,
        ],
        references: [workflow.id],
      }),

      version: one(workflowVersion, {
        fields: [
          workflowIntegrationTrigger
            .workflowVersionId,
        ],
        references: [
          workflowVersion.id,
        ],
      }),

      events: many(
        workflowIntegrationTriggerEvent
      ),
    })
  );

export const workflowIntegrationTriggerEventRelations =
  relations(
    workflowIntegrationTriggerEvent,
    ({ one }) => ({
      trigger: one(
        workflowIntegrationTrigger,
        {
          fields: [
            workflowIntegrationTriggerEvent
              .triggerId,
          ],
          references: [
            workflowIntegrationTrigger.id,
          ],
        }
      ),

      run: one(workflowRun, {
        fields: [
          workflowIntegrationTriggerEvent
            .runId,
        ],
        references: [workflowRun.id],
      }),
    })
  );
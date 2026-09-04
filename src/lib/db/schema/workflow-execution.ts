import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import {
  workflow,
  workflowVersion,
} from "./workflow";

export const workflowRunStatus =
  pgEnum("workflow_run_status", [
    "PENDING",
    "RUNNING",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
  ]);

export const workflowStepStatus =
  pgEnum("workflow_step_status", [
    "PENDING",
    "RUNNING",
    "SUCCESS",
    "FAILED",
    "SKIPPED",
  ]);

export const workflowLogLevel =
  pgEnum("workflow_log_level", [
    "INFO",
    "WARN",
    "ERROR",
  ]);

export const workflowTriggerType =
  pgEnum("workflow_trigger_type", [
    "MANUAL",
    "WEBHOOK",
    "SCHEDULE",
  ]);

export const workflowRun = pgTable(
  "workflow_run",
  {
    id: text("id").primaryKey(),

    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflow.id, {
        onDelete: "cascade",
      }),

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

    status: workflowRunStatus("status")
      .default("PENDING")
      .notNull(),

    triggerType:
      workflowTriggerType(
        "trigger_type"
      )
        .default("MANUAL")
        .notNull(),

    input: jsonb("input")
      .$type<
        Record<string, unknown>
      >()
      .default({})
      .notNull(),

    output: jsonb("output").$type<
      Record<string, unknown>
    >(),

    error: text("error"),

    triggeredBy: text(
      "triggered_by"
    ).references(() => user.id, {
      onDelete: "set null",
    }),

    startedAt: timestamp(
      "started_at"
    ),

    completedAt: timestamp(
      "completed_at"
    ),

    createdAt: timestamp(
      "created_at"
    )
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index(
      "workflow_run_workflow_id_idx"
    ).on(table.workflowId),

    index(
      "workflow_run_version_id_idx"
    ).on(table.workflowVersionId),

    index(
      "workflow_run_workflow_status_idx"
    ).on(
      table.workflowId,
      table.status
    ),

    index(
      "workflow_run_created_at_idx"
    ).on(table.createdAt),
  ]
);

export const workflowRunStep =
  pgTable(
    "workflow_run_step",
    {
      id: text("id").primaryKey(),

      runId: text("run_id")
        .notNull()
        .references(
          () => workflowRun.id,
          {
            onDelete: "cascade",
          }
        ),

      nodeId: text("node_id")
        .notNull(),

      nodeType: text("node_type")
        .notNull(),

      status:
        workflowStepStatus("status")
          .default("PENDING")
          .notNull(),

      input: jsonb("input")
        .$type<
          Record<string, unknown>
        >()
        .default({})
        .notNull(),

      output: jsonb("output").$type<
        Record<string, unknown>
      >(),

      error: text("error"),

      startedAt: timestamp(
        "started_at"
      ),

      completedAt: timestamp(
        "completed_at"
      ),

      createdAt: timestamp(
        "created_at"
      )
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex(
        "workflow_run_step_run_node_idx"
      ).on(
        table.runId,
        table.nodeId
      ),

      index(
        "workflow_run_step_run_id_idx"
      ).on(table.runId),

      index(
        "workflow_run_step_run_status_idx"
      ).on(
        table.runId,
        table.status
      ),
    ]
  );

export const workflowLog = pgTable(
  "workflow_log",
  {
    id: text("id").primaryKey(),

    runId: text("run_id")
      .notNull()
      .references(
        () => workflowRun.id,
        {
          onDelete: "cascade",
        }
      ),

    nodeId: text("node_id"),

    level: workflowLogLevel("level")
      .default("INFO")
      .notNull(),

    message: text("message")
      .notNull(),

    metadata: jsonb("metadata")
      .$type<
        Record<string, unknown>
      >()
      .default({})
      .notNull(),

    createdAt: timestamp(
      "created_at"
    )
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index(
      "workflow_log_run_id_idx"
    ).on(table.runId),

    index(
      "workflow_log_run_created_at_idx"
    ).on(
      table.runId,
      table.createdAt
    ),
  ]
);

export const workflowRunRelations =
  relations(
    workflowRun,
    ({ one, many }) => ({
      workflow: one(workflow, {
        fields: [
          workflowRun.workflowId,
        ],
        references: [workflow.id],
      }),

      version: one(
        workflowVersion,
        {
          fields: [
            workflowRun
              .workflowVersionId,
          ],
          references: [
            workflowVersion.id,
          ],
        }
      ),

      triggerUser: one(user, {
        fields: [
          workflowRun.triggeredBy,
        ],
        references: [user.id],
      }),

      steps: many(
        workflowRunStep
      ),

      logs: many(workflowLog),
    })
  );

export const workflowRunStepRelations =
  relations(
    workflowRunStep,
    ({ one }) => ({
      run: one(workflowRun, {
        fields: [
          workflowRunStep.runId,
        ],
        references: [
          workflowRun.id,
        ],
      }),
    })
  );

export const workflowLogRelations =
  relations(
    workflowLog,
    ({ one }) => ({
      run: one(workflowRun, {
        fields: [
          workflowLog.runId,
        ],
        references: [
          workflowRun.id,
        ],
      }),
    })
  );
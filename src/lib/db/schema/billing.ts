import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspace } from "./workspace";

export const subscriptionPlan =
  pgEnum("subscription_plan", [
    "FREE",
    "PRO",
  ]);

export const subscriptionStatus =
  pgEnum("subscription_status", [
    "INCOMPLETE",
    "INCOMPLETE_EXPIRED",
    "TRIALING",
    "ACTIVE",
    "PAST_DUE",
    "CANCELED",
    "UNPAID",
    "PAUSED",
  ]);

export const workspaceSubscription =
  pgTable(
    "workspace_subscription",
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

      plan: subscriptionPlan("plan")
        .notNull(),

      status:
        subscriptionStatus(
          "status"
        ).notNull(),

      stripeCustomerId: text(
        "stripe_customer_id"
      ),

      stripeSubscriptionId: text(
        "stripe_subscription_id"
      ),

      stripePriceId: text(
        "stripe_price_id"
      ),

      currentPeriodStart: timestamp(
        "current_period_start"
      ),

      currentPeriodEnd: timestamp(
        "current_period_end"
      ),

      cancelAtPeriodEnd: boolean(
        "cancel_at_period_end"
      )
        .default(false)
        .notNull(),

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
        "workspace_subscription_workspace_id_idx"
      ).on(table.workspaceId),

      uniqueIndex(
        "workspace_subscription_stripe_customer_id_idx"
      ).on(table.stripeCustomerId),

      uniqueIndex(
        "workspace_subscription_stripe_subscription_id_idx"
      ).on(
        table.stripeSubscriptionId
      ),

      index(
        "workspace_subscription_status_idx"
      ).on(table.status),
    ]
  );

export const workspaceUsage =
  pgTable(
    "workspace_usage",
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

      periodStart: timestamp(
        "period_start"
      ).notNull(),

      workflowRuns: integer(
        "workflow_runs"
      )
        .default(0)
        .notNull(),

      actionExecutions: integer(
        "action_executions"
      )
        .default(0)
        .notNull(),

      aiInputTokens: integer(
        "ai_input_tokens"
      )
        .default(0)
        .notNull(),

      aiOutputTokens: integer(
        "ai_output_tokens"
      )
        .default(0)
        .notNull(),

      aiOtherTokens: integer(
        "ai_other_tokens"
      )
        .default(0)
        .notNull(),

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
        "workspace_usage_workspace_period_idx"
      ).on(
        table.workspaceId,
        table.periodStart
      ),

      index(
        "workspace_usage_workspace_id_idx"
      ).on(table.workspaceId),

      index(
        "workspace_usage_period_start_idx"
      ).on(table.periodStart),
    ]
  );

export const workspaceSubscriptionRelations =
  relations(
    workspaceSubscription,
    ({ one }) => ({
      workspace: one(workspace, {
        fields: [
          workspaceSubscription
            .workspaceId,
        ],
        references: [workspace.id],
      }),
    })
  );

export const workspaceUsageRelations =
  relations(
    workspaceUsage,
    ({ one }) => ({
      workspace: one(workspace, {
        fields: [
          workspaceUsage.workspaceId,
        ],
        references: [workspace.id],
      }),
    })
  );
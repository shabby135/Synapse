CREATE TYPE "public"."subscription_plan" AS ENUM('FREE', 'PRO');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED');--> statement-breakpoint
CREATE TABLE "workspace_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"plan" "subscription_plan" NOT NULL,
	"status" "subscription_status" NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"workflow_runs" integer DEFAULT 0 NOT NULL,
	"action_executions" integer DEFAULT 0 NOT NULL,
	"ai_input_tokens" integer DEFAULT 0 NOT NULL,
	"ai_output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_subscription" ADD CONSTRAINT "workspace_subscription_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_usage" ADD CONSTRAINT "workspace_usage_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_subscription_workspace_id_idx" ON "workspace_subscription" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_subscription_stripe_customer_id_idx" ON "workspace_subscription" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_subscription_stripe_subscription_id_idx" ON "workspace_subscription" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "workspace_subscription_status_idx" ON "workspace_subscription" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_usage_workspace_period_idx" ON "workspace_usage" USING btree ("workspace_id","period_start");--> statement-breakpoint
CREATE INDEX "workspace_usage_workspace_id_idx" ON "workspace_usage" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_usage_period_start_idx" ON "workspace_usage" USING btree ("period_start");
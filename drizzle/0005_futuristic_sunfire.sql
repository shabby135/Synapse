CREATE TYPE "public"."workflow_log_level" AS ENUM('INFO', 'WARN', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."workflow_run_status" AS ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."workflow_step_status" AS ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."workflow_trigger_type" AS ENUM('MANUAL', 'WEBHOOK', 'SCHEDULE');--> statement-breakpoint
CREATE TABLE "workflow_log" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"node_id" text,
	"level" "workflow_log_level" DEFAULT 'INFO' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"workflow_version_id" text NOT NULL,
	"status" "workflow_run_status" DEFAULT 'PENDING' NOT NULL,
	"trigger_type" "workflow_trigger_type" DEFAULT 'MANUAL' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"triggered_by" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run_step" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"node_id" text NOT NULL,
	"node_type" text NOT NULL,
	"status" "workflow_step_status" DEFAULT 'PENDING' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_log" ADD CONSTRAINT "workflow_log_run_id_workflow_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_workflow_version_id_workflow_version_id_fk" FOREIGN KEY ("workflow_version_id") REFERENCES "public"."workflow_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_triggered_by_user_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_step" ADD CONSTRAINT "workflow_run_step_run_id_workflow_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_log_run_id_idx" ON "workflow_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workflow_log_run_created_at_idx" ON "workflow_log" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "workflow_run_workflow_id_idx" ON "workflow_run" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_run_version_id_idx" ON "workflow_run" USING btree ("workflow_version_id");--> statement-breakpoint
CREATE INDEX "workflow_run_workflow_status_idx" ON "workflow_run" USING btree ("workflow_id","status");--> statement-breakpoint
CREATE INDEX "workflow_run_created_at_idx" ON "workflow_run" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_run_step_run_node_idx" ON "workflow_run_step" USING btree ("run_id","node_id");--> statement-breakpoint
CREATE INDEX "workflow_run_step_run_id_idx" ON "workflow_run_step" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workflow_run_step_run_status_idx" ON "workflow_run_step" USING btree ("run_id","status");
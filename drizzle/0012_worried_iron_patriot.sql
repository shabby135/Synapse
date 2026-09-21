ALTER TYPE "public"."workflow_trigger_type" ADD VALUE 'INTEGRATION';--> statement-breakpoint
CREATE TABLE "workflow_integration_trigger" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"workflow_version_id" text NOT NULL,
	"node_id" text NOT NULL,
	"trigger_type" text NOT NULL,
	"configuration_hash" text NOT NULL,
	"cursor" jsonb,
	"last_polled_at" timestamp,
	"next_poll_at" timestamp DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_integration_trigger_event" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger_id" text NOT NULL,
	"event_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"run_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_integration_trigger" ADD CONSTRAINT "workflow_integration_trigger_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_integration_trigger" ADD CONSTRAINT "workflow_integration_trigger_workflow_version_id_workflow_version_id_fk" FOREIGN KEY ("workflow_version_id") REFERENCES "public"."workflow_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_integration_trigger_event" ADD CONSTRAINT "workflow_integration_trigger_event_trigger_id_workflow_integration_trigger_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."workflow_integration_trigger"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_integration_trigger_event" ADD CONSTRAINT "workflow_integration_trigger_event_run_id_workflow_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_integration_trigger_workflow_idx" ON "workflow_integration_trigger" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_integration_trigger_due_idx" ON "workflow_integration_trigger" USING btree ("next_poll_at");--> statement-breakpoint
CREATE INDEX "workflow_integration_trigger_version_idx" ON "workflow_integration_trigger" USING btree ("workflow_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_integration_trigger_event_key_idx" ON "workflow_integration_trigger_event" USING btree ("trigger_id","event_key");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_integration_trigger_event_run_idx" ON "workflow_integration_trigger_event" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workflow_integration_trigger_event_created_idx" ON "workflow_integration_trigger_event" USING btree ("created_at");
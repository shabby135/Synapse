CREATE TABLE "workflow_webhook" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_webhook_request" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"run_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_webhook" ADD CONSTRAINT "workflow_webhook_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_webhook_request" ADD CONSTRAINT "workflow_webhook_request_webhook_id_workflow_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."workflow_webhook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_webhook_request" ADD CONSTRAINT "workflow_webhook_request_run_id_workflow_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_webhook_workflow_id_idx" ON "workflow_webhook" USING btree ("workflow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_webhook_request_webhook_key_idx" ON "workflow_webhook_request" USING btree ("webhook_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_webhook_request_run_id_idx" ON "workflow_webhook_request" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workflow_webhook_request_created_at_idx" ON "workflow_webhook_request" USING btree ("created_at");
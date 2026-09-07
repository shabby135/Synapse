CREATE TYPE "public"."integration_provider" AS ENUM('SLACK', 'DISCORD');--> statement-breakpoint
CREATE TABLE "workspace_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"name" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"initialization_vector" text NOT NULL,
	"authentication_tag" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD CONSTRAINT "workspace_integration_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD CONSTRAINT "workspace_integration_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_integration_workspace_provider_name_idx" ON "workspace_integration" USING btree ("workspace_id","provider","name");--> statement-breakpoint
CREATE INDEX "workspace_integration_workspace_id_idx" ON "workspace_integration" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_integration_workspace_provider_idx" ON "workspace_integration" USING btree ("workspace_id","provider");
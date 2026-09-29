CREATE TABLE "workflow_folder" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow" ADD COLUMN "folder_id" text;--> statement-breakpoint
ALTER TABLE "workflow_folder" ADD CONSTRAINT "workflow_folder_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_folder" ADD CONSTRAINT "workflow_folder_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_folder_workspace_id_idx" ON "workflow_folder" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_folder_workspace_name_idx" ON "workflow_folder" USING btree ("workspace_id","name");--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_folder_id_workflow_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."workflow_folder"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_folder_id_idx" ON "workflow" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "workflow_workspace_folder_idx" ON "workflow" USING btree ("workspace_id","folder_id");
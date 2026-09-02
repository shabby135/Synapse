CREATE TYPE "public"."workflow_status" AS ENUM(
  'DRAFT',
  'ACTIVE',
  'ARCHIVED'
);
--> statement-breakpoint

CREATE TYPE "public"."workflow_version_status" AS ENUM(
  'DRAFT',
  'PUBLISHED'
);
--> statement-breakpoint

CREATE TABLE "workflow" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" "workflow_status" DEFAULT 'DRAFT' NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "workflow_version" (
  "id" text PRIMARY KEY NOT NULL,
  "workflow_id" text NOT NULL,
  "version" integer NOT NULL,
  "status" "workflow_version_status" DEFAULT 'DRAFT' NOT NULL,
  "definition" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "workflow"
ADD CONSTRAINT "workflow_workspace_id_workspace_id_fk"
FOREIGN KEY ("workspace_id")
REFERENCES "public"."workspace"("id")
ON DELETE cascade
ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "workflow"
ADD CONSTRAINT "workflow_created_by_user_id_fk"
FOREIGN KEY ("created_by")
REFERENCES "public"."user"("id")
ON DELETE set null
ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "workflow_version"
ADD CONSTRAINT "workflow_version_workflow_id_workflow_id_fk"
FOREIGN KEY ("workflow_id")
REFERENCES "public"."workflow"("id")
ON DELETE cascade
ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "workflow_version"
ADD CONSTRAINT "workflow_version_created_by_user_id_fk"
FOREIGN KEY ("created_by")
REFERENCES "public"."user"("id")
ON DELETE set null
ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "workflow_workspace_id_idx"
ON "workflow" USING btree ("workspace_id");
--> statement-breakpoint

CREATE INDEX "workflow_workspace_status_idx"
ON "workflow" USING btree ("workspace_id", "status");
--> statement-breakpoint

CREATE UNIQUE INDEX "workflow_version_workflow_version_idx"
ON "workflow_version" USING btree ("workflow_id", "version");
--> statement-breakpoint

CREATE INDEX "workflow_version_workflow_id_idx"
ON "workflow_version" USING btree ("workflow_id");
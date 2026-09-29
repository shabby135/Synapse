CREATE TABLE "workflow_favorite" (
	"user_id" text NOT NULL,
	"workflow_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_favorite_user_id_workflow_id_pk" PRIMARY KEY("user_id","workflow_id")
);
--> statement-breakpoint
ALTER TABLE "workflow_favorite" ADD CONSTRAINT "workflow_favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_favorite" ADD CONSTRAINT "workflow_favorite_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_favorite_workflow_idx" ON "workflow_favorite" USING btree ("workflow_id");
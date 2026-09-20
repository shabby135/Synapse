CREATE TABLE "integration_oauth_state" (
	"id" text PRIMARY KEY NOT NULL,
	"state_hash" text NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"connection_name" text NOT NULL,
	"integration_id" text,
	"user_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"encrypted_code_verifier" text NOT NULL,
	"initialization_vector" text NOT NULL,
	"authentication_tag" text NOT NULL,
	"key_version" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_oauth_state" ADD CONSTRAINT "integration_oauth_state_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_state" ADD CONSTRAINT "integration_oauth_state_integration_id_workspace_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."workspace_integration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_state" ADD CONSTRAINT "integration_oauth_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_oauth_state_hash_idx" ON "integration_oauth_state" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "integration_oauth_state_expiry_idx" ON "integration_oauth_state" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "integration_oauth_state_workspace_idx" ON "integration_oauth_state" USING btree ("workspace_id");
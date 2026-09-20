CREATE TYPE "public"."integration_connection_status" AS ENUM('ACTIVE', 'NEEDS_REAUTH', 'ERROR', 'DISABLED');--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'OPENAI' BEFORE 'SLACK';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'ANTHROPIC' BEFORE 'SLACK';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'GEMINI' BEFORE 'SLACK';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'GROQ' BEFORE 'SLACK';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'DEEPSEEK' BEFORE 'SLACK';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'OPENROUTER' BEFORE 'SLACK';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'TELEGRAM';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'MICROSOFT_TEAMS';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'GMAIL';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'GOOGLE_SHEETS';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'GOOGLE_CALENDAR';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'AIRTABLE';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'GITHUB';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'STRIPE';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'RESEND';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'CUSTOM_API';--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD COLUMN "status" "integration_connection_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD COLUMN "credential_format_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD COLUMN "external_account_id" text;--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD COLUMN "external_account_name" text;--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD COLUMN "last_tested_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD COLUMN "disabled_at" timestamp;--> statement-breakpoint
CREATE INDEX "workspace_integration_workspace_status_idx" ON "workspace_integration" USING btree ("workspace_id","status");

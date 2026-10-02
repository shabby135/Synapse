ALTER TABLE "workspace_subscription" ADD COLUMN "razorpay_customer_id" text;--> statement-breakpoint
ALTER TABLE "workspace_subscription" ADD COLUMN "razorpay_subscription_id" text;--> statement-breakpoint
ALTER TABLE "workspace_subscription" ADD COLUMN "razorpay_plan_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_subscription_razorpay_customer_id_idx" ON "workspace_subscription" USING btree ("razorpay_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_subscription_razorpay_subscription_id_idx" ON "workspace_subscription" USING btree ("razorpay_subscription_id");
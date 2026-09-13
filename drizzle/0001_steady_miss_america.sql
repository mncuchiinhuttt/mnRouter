ALTER TABLE "models" ADD COLUMN "price_in" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "price_out" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_daily" ADD COLUMN "credits" numeric(14, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_requests" ADD COLUMN "credits" numeric(12, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "monthly_credit_budget" bigint;
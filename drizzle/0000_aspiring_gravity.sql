CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT 'default' NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by" uuid,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"upstream_model" text NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"context_window" integer DEFAULT 200000 NOT NULL,
	"max_output" integer DEFAULT 8192 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"auth_type" text DEFAULT 'oauth' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"base_url_override" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"date" date NOT NULL,
	"user_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"prompt_tokens" bigint DEFAULT 0 NOT NULL,
	"completion_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_read_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_write_tokens" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_daily_date_user_id_provider_model_pk" PRIMARY KEY("date","user_id","provider","model")
);
--> statement-breakpoint
CREATE TABLE "usage_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"api_key_id" uuid,
	"provider" text NOT NULL,
	"connection_id" uuid,
	"model" text NOT NULL,
	"endpoint" text NOT NULL,
	"status" text NOT NULL,
	"http_status" integer,
	"prompt_tokens" bigint DEFAULT 0 NOT NULL,
	"completion_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_read_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_write_tokens" bigint DEFAULT 0 NOT NULL,
	"reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"ttft_ms" integer,
	"error_code" text,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"display_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"max_api_keys" integer DEFAULT 1 NOT NULL,
	"monthly_token_budget" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_requests" ADD CONSTRAINT "usage_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_requests" ADD CONSTRAINT "usage_requests_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_uq" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_user_ix" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_keys_prefix_ix" ON "api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "audit_logs_ts_ix" ON "audit_logs" USING btree ("ts");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_links_token_uq" ON "magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "magic_links_email_ix" ON "magic_links" USING btree ("email");--> statement-breakpoint
CREATE INDEX "provider_connections_provider_ix" ON "provider_connections" USING btree ("provider","is_active","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_ix" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_requests_ts_ix" ON "usage_requests" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "usage_requests_user_ts_ix" ON "usage_requests" USING btree ("user_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");
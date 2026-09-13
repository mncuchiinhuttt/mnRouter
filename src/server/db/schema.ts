import {
	pgTable,
	uuid,
	text,
	timestamp,
	integer,
	bigint,
	boolean,
	jsonb,
	bigserial,
	date,
	numeric,
	primaryKey,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
	"users",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		email: text("email").notNull(),
		role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
		displayName: text("display_name"),
		status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
		maxApiKeys: integer("max_api_keys").notNull().default(1),
		monthlyTokenBudget: bigint("monthly_token_budget", { mode: "number" }),
		/** Budget theo AI credits (1 credit = $0.01 giá API niêm yết). null = unlimited. */
		monthlyCreditBudget: bigint("monthly_credit_budget", { mode: "number" }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		disabledAt: timestamp("disabled_at", { withTimezone: true }),
	},
	(t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const magicLinks = pgTable(
	"magic_links",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		email: text("email").notNull(),
		tokenHash: text("token_hash").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		usedAt: timestamp("used_at", { withTimezone: true }),
		ip: text("ip"),
		userAgent: text("user_agent"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("magic_links_token_uq").on(t.tokenHash), index("magic_links_email_ix").on(t.email)],
);

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tokenHash: text("token_hash").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
		ip: text("ip"),
		userAgent: text("user_agent"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_ix").on(t.userId)],
);

export const apiKeys = pgTable(
	"api_keys",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull().default("default"),
		prefix: text("prefix").notNull(),
		keyHash: text("key_hash").notNull(),
		createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("api_keys_hash_uq").on(t.keyHash), index("api_keys_user_ix").on(t.userId), index("api_keys_prefix_ix").on(t.prefix)],
);

/** data: { accessToken, refreshToken, expiresAt, accountId, projectId, scope,
 *          backoffLevel, cooldownUntil, lastError, lastErrorAt, lastUsedAt, consecutiveUseCount } */
export const providerConnections = pgTable(
	"provider_connections",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		provider: text("provider", { enum: ["claude", "codex", "antigravity", "kiro", "grok", "opencode"] }).notNull(),
		label: text("label").notNull(),
		authType: text("auth_type", { enum: ["oauth", "api_key", "none"] }).notNull().default("oauth"),
		priority: integer("priority").notNull().default(100),
		isActive: boolean("is_active").notNull().default(true),
		status: text("status", { enum: ["active", "cooldown", "expired", "error"] }).notNull().default("active"),
		data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
		baseUrlOverride: text("base_url_override"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("provider_connections_provider_ix").on(t.provider, t.isActive, t.priority)],
);

export const models = pgTable("models", {
	id: text("id").primaryKey(), // public model name, e.g. "claude-sonnet-4-5"
	provider: text("provider", { enum: ["claude", "codex", "antigravity", "kiro", "grok", "opencode"] }).notNull(),
	upstreamModel: text("upstream_model").notNull(),
	displayName: text("display_name").notNull(),
	enabled: boolean("enabled").notNull().default(true),
	priority: integer("priority").notNull().default(100),
	contextWindow: integer("context_window").notNull().default(200000),
	maxOutput: integer("max_output").notNull().default(8192),
	/** Giá nội bộ theo AI credits (1 credit = $0.01 giá API niêm yết), tính trên 1M tokens. */
	priceIn: integer("price_in").notNull().default(0),
	priceOut: integer("price_out").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
	key: text("key").primaryKey(),
	value: jsonb("value").$type<unknown>().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageRequests = pgTable(
	"usage_requests",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
		userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
		apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
		provider: text("provider").notNull(),
		connectionId: uuid("connection_id"),
		model: text("model").notNull(),
		endpoint: text("endpoint").notNull(),
		status: text("status", { enum: ["ok", "error", "budget_exceeded", "rate_limited"] }).notNull(),
		httpStatus: integer("http_status"),
		promptTokens: bigint("prompt_tokens", { mode: "number" }).notNull().default(0),
		completionTokens: bigint("completion_tokens", { mode: "number" }).notNull().default(0),
		cacheReadTokens: bigint("cache_read_tokens", { mode: "number" }).notNull().default(0),
		cacheWriteTokens: bigint("cache_write_tokens", { mode: "number" }).notNull().default(0),
		reasoningTokens: bigint("reasoning_tokens", { mode: "number" }).notNull().default(0),
		/** AI credits đã trừ cho request này (numeric 12,4). */
		credits: numeric("credits", { precision: 12, scale: 4 }).notNull().default("0"),
		latencyMs: integer("latency_ms"),
		ttftMs: integer("ttft_ms"),
		errorCode: text("error_code"),
		meta: jsonb("meta").$type<Record<string, unknown>>(),
	},
	(t) => [index("usage_requests_ts_ix").on(t.ts), index("usage_requests_user_ts_ix").on(t.userId, t.ts)],
);

export const usageDaily = pgTable(
	"usage_daily",
	{
		date: date("date").notNull(),
		userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		model: text("model").notNull(),
		requests: integer("requests").notNull().default(0),
		errors: integer("errors").notNull().default(0),
		promptTokens: bigint("prompt_tokens", { mode: "number" }).notNull().default(0),
		completionTokens: bigint("completion_tokens", { mode: "number" }).notNull().default(0),
		cacheReadTokens: bigint("cache_read_tokens", { mode: "number" }).notNull().default(0),
		cacheWriteTokens: bigint("cache_write_tokens", { mode: "number" }).notNull().default(0),
		credits: numeric("credits", { precision: 14, scale: 4 }).notNull().default("0"),
	},
	(t) => [primaryKey({ columns: [t.date, t.userId, t.provider, t.model] })],
);

export const auditLogs = pgTable(
	"audit_logs",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
		actorUserId: uuid("actor_user_id"),
		action: text("action").notNull(),
		target: text("target"),
		data: jsonb("data").$type<Record<string, unknown>>(),
	},
	(t) => [index("audit_logs_ts_ix").on(t.ts)],
);

export type User = typeof users.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type ProviderConnection = typeof providerConnections.$inferSelect;
export type ModelRow = typeof models.$inferSelect;

import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
	displayName: text("display_name"),
	username: text("username").unique(),
	department: text("department"),
	avatarUrl: text("avatar_url"),
	packageName: text("package_name"),
	status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
	maxApiKeys: integer("max_api_keys").notNull().default(1),
	weeklyTokenBudget: integer("weekly_token_budget"),
	weeklyCreditBudget: integer("weekly_credit_budget"),
	monthlyTokenBudget: integer("monthly_token_budget"),
	monthlyCreditBudget: integer("monthly_credit_budget"),
	allModels: integer("all_models", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
	disabledAt: integer("disabled_at", { mode: "timestamp_ms" }),
	onboardedAt: integer("onboarded_at", { mode: "timestamp_ms" }),
});

export const invitations = sqliteTable("invitations", {
	id: text("id").primaryKey(),
	email: text("email").notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	invitedBy: text("invited_by"),
	maxApiKeys: integer("max_api_keys").notNull().default(1),
	packageName: text("package_name"),
	weeklyTokenBudget: integer("weekly_token_budget"),
	weeklyCreditBudget: integer("weekly_credit_budget"),
	monthlyTokenBudget: integer("monthly_token_budget"),
	monthlyCreditBudget: integer("monthly_credit_budget"),
	allModels: integer("all_models", { mode: "boolean" }).notNull().default(true),
	allowedModels: text("allowed_models", { mode: "json" }).$type<string[]>().notNull().default([]),
	status: text("status", { enum: ["pending", "accepted", "revoked"] }).notNull().default("pending"),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const magicLinks = sqliteTable("magic_links", {
	id: text("id").primaryKey(),
	email: text("email").notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	usedAt: integer("used_at", { mode: "timestamp_ms" }),
	ip: text("ip"),
	userAgent: text("user_agent"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	tokenHash: text("token_hash").notNull().unique(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
	ip: text("ip"),
	userAgent: text("user_agent"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const apiKeys = sqliteTable("api_keys", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull().default("default"),
	prefix: text("prefix").notNull(),
	keyHash: text("key_hash").notNull().unique(),
	createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
	lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
	revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const providerConnections = sqliteTable("provider_connections", {
	id: text("id").primaryKey(),
	provider: text("provider", { enum: ["claude", "codex", "antigravity", "kiro", "grok", "opencode"] }).notNull(),
	label: text("label").notNull(),
	authType: text("auth_type", { enum: ["oauth", "api_key", "none"] }).notNull().default("oauth"),
	priority: integer("priority").notNull().default(100),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	status: text("status", { enum: ["active", "cooldown", "expired", "error"] }).notNull().default("active"),
	data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
	baseUrlOverride: text("base_url_override"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const models = sqliteTable("models", {
	id: text("id").primaryKey(),
	provider: text("provider", { enum: ["claude", "codex", "antigravity", "kiro", "grok", "opencode"] }).notNull(),
	upstreamModel: text("upstream_model").notNull(),
	displayName: text("display_name").notNull(),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	priority: integer("priority").notNull().default(100),
	contextWindow: integer("context_window").notNull().default(200000),
	maxOutput: integer("max_output").notNull().default(8192),
	priceIn: integer("price_in").notNull().default(0),
	priceOut: integer("price_out").notNull().default(0),
	priceCacheRead: integer("price_cache_read").notNull().default(0),
	priceCacheWrite: integer("price_cache_write").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const userModels = sqliteTable(
	"user_models",
	{
		userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
		modelId: text("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
	},
	(t) => [primaryKey({ columns: [t.userId, t.modelId] })],
);

export const settings = sqliteTable("settings", {
	key: text("key").primaryKey(),
	value: text("value", { mode: "json" }).$type<unknown>().notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const usageRequests = sqliteTable(
	"usage_requests",
	{
		id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
		ts: integer("ts", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
		userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
		apiKeyId: text("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
		provider: text("provider").notNull(),
		connectionId: text("connection_id"),
		model: text("model").notNull(),
		endpoint: text("endpoint").notNull(),
		status: text("status", { enum: ["ok", "error", "budget_exceeded", "rate_limited", "forbidden"] }).notNull(),
		httpStatus: integer("http_status"),
		promptTokens: integer("prompt_tokens").notNull().default(0),
		completionTokens: integer("completion_tokens").notNull().default(0),
		cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
		cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
		reasoningTokens: integer("reasoning_tokens").notNull().default(0),
		credits: text("credits").notNull().default("0"),
		latencyMs: integer("latency_ms"),
		ttftMs: integer("ttft_ms"),
		errorCode: text("error_code"),
		meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
	},
	(t) => [
		index("usage_requests_ts_ix").on(t.ts),
		index("usage_requests_user_ts_ix").on(t.userId, t.ts),
		index("usage_requests_user_id_ix").on(t.userId, t.id),
		index("usage_requests_status_id_ix").on(t.status, t.id),
	],
);

export const usageDaily = sqliteTable(
	"usage_daily",
	{
		date: text("date").notNull(),
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		model: text("model").notNull(),
		requests: integer("requests").notNull().default(0),
		errors: integer("errors").notNull().default(0),
		promptTokens: integer("prompt_tokens").notNull().default(0),
		completionTokens: integer("completion_tokens").notNull().default(0),
		cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
		cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
		credits: text("credits").notNull().default("0"),
	},
	(t) => [primaryKey({ columns: [t.date, t.userId, t.provider, t.model] })],
);

export const auditLogs = sqliteTable(
	"audit_logs",
	{
		id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
		ts: integer("ts", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
		actorUserId: text("actor_user_id"),
		action: text("action").notNull(),
		target: text("target"),
		data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
	},
	(t) => [index("audit_logs_ts_ix").on(t.ts)],
);

export const announcements = sqliteTable(
	"announcements",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		content: text("content").notNull(),
		type: text("type", { enum: ["info", "warning", "maintenance", "success"] }).notNull().default("info"),
		active: integer("active", { mode: "boolean" }).notNull().default(true),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
		createdBy: text("created_by"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
	},
	(t) => [index("announcements_active_ix").on(t.active, t.expiresAt)],
);

export type User = typeof users.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type ProviderConnection = typeof providerConnections.$inferSelect;
export type ModelRow = typeof models.$inferSelect;
export type UsageDailyRow = typeof usageDaily.$inferSelect;
export type UsageRequestRow = typeof usageRequests.$inferSelect;
export type Announcement = typeof announcements.$inferSelect; export type NewAnnouncement = typeof announcements.$inferInsert;
export * from "./chat-schema.js";
export * from "./mcp-schema.js";

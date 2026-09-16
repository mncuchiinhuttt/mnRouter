import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./schema.js";

export const mcpServers = sqliteTable(
	"mcp_servers",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		transport: text("transport", { enum: ["sse", "http", "stdio"] })
			.notNull()
			.default("sse"),
		url: text("url"),
		command: text("command"),
		args: text("args"),
		env: text("env"),
		status: text("status", { enum: ["connected", "disconnected", "error"] })
			.notNull()
			.default("disconnected"),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		toolsCount: integer("tools_count").notNull().default(0),
		lastPingAt: integer("last_ping_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("mcp_servers_user_ix").on(t.userId)],
);

export const customSkills = sqliteTable(
	"custom_skills",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		description: text("description"),
		prompt: text("prompt").notNull(),
		rawMarkdown: text("raw_markdown").notNull(),
		icon: text("icon").notNull().default("Sparkles"),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("custom_skills_user_ix").on(t.userId)],
);

export type McpServer = typeof mcpServers.$inferSelect;
export type NewMcpServer = typeof mcpServers.$inferInsert;
export type CustomSkill = typeof customSkills.$inferSelect;
export type NewCustomSkill = typeof customSkills.$inferInsert;

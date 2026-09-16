import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./schema.js";

export const chatThreads = sqliteTable(
	"chat_threads",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
		title: text("title").notNull().default("New conversation"),
		model: text("model").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
	},
	(t) => [index("chat_threads_user_ix").on(t.userId, t.updatedAt)],
);

export const chatMessages = sqliteTable(
	"chat_messages",
	{
		id: text("id").primaryKey(),
		threadId: text("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
		role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
		content: text("content").notNull(),
		fileIds: text("file_ids", { mode: "json" }).$type<string[]>(),
		meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
	},
	(t) => [index("chat_messages_thread_ix").on(t.threadId, t.createdAt)],
);

export const chatFiles = sqliteTable(
	"chat_files",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
		threadId: text("thread_id"),
		filename: text("filename").notNull(),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		storagePath: text("storage_path").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
	},
	(t) => [
		index("chat_files_user_ix").on(t.userId),
		index("chat_files_expires_ix").on(t.expiresAt),
	],
);

export const chatArtifacts = sqliteTable(
	"chat_artifacts",
	{
		id: text("id").primaryKey(),
		messageId: text("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
		threadId: text("thread_id").notNull(),
		identifier: text("identifier").notNull(),
		type: text("type", { enum: ["html", "code", "svg", "markdown"] }).notNull().default("code"),
		title: text("title").notNull(),
		content: text("content").notNull(),
		language: text("language"),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
	},
	(t) => [
		index("chat_artifacts_message_ix").on(t.messageId),
		index("chat_artifacts_thread_ix").on(t.threadId),
		index("chat_artifacts_expires_ix").on(t.expiresAt),
	],
);

export const chatShares = sqliteTable(
	"chat_shares",
	{
		id: text("id").primaryKey(),
		threadId: text("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
		token: text("token").notNull().unique(),
		title: text("title").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
	},
	(t) => [
		index("chat_shares_token_ix").on(t.token),
		index("chat_shares_thread_ix").on(t.threadId),
		index("chat_shares_expires_ix").on(t.expiresAt),
	],
);
export const chatFeedbacks = sqliteTable(
	"chat_feedbacks",
	{
		id: text("id").primaryKey(),
		messageId: text("message_id").notNull(),
		threadId: text("thread_id").notNull(),
		userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
		userEmail: text("user_email"),
		model: text("model"),
		reason: text("reason").notNull(),
		comment: text("comment"),
		messagePreview: text("message_preview"),
		status: text("status", { enum: ["new", "reviewed", "resolved"] }).notNull().default("new"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
	},
	(t) => [
		index("chat_feedbacks_user_ix").on(t.userId),
		index("chat_feedbacks_status_ix").on(t.status, t.createdAt),
	],
);

export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ChatFile = typeof chatFiles.$inferSelect;
export type ChatArtifact = typeof chatArtifacts.$inferSelect;
export type ChatShare = typeof chatShares.$inferSelect;
export type ChatFeedback = typeof chatFeedbacks.$inferSelect;

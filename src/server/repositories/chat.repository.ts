import { and, desc, eq, lte, count, notInArray } from "drizzle-orm";
import { db } from "@db";
import { chatThreads, chatMessages, chatArtifacts, chatShares, type ChatThread, type ChatMessage, type ChatArtifact, type ChatShare } from "@db/schema";

export class ChatRepository {
	async createThread(data: { id?: string; userId: string; title?: string; model: string }): Promise<ChatThread> {
		const now = new Date();
		const [created] = await db
			.insert(chatThreads)
			.values({
				id: data.id ?? crypto.randomUUID(),
				userId: data.userId,
				title: (data.title || "New conversation").trim().slice(0, 150),
				model: data.model,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return created!;
	}

	async findThreadById(id: string, userId?: string): Promise<ChatThread | null> {
		const conditions = [eq(chatThreads.id, id)];
		if (userId) conditions.push(eq(chatThreads.userId, userId));
		const [thread] = await db.select().from(chatThreads).where(and(...conditions));
		return thread ?? null;
	}

	async listThreadsByUser(userId: string): Promise<(ChatThread & { messageCount: number; totalTokens: number })[]> {
		const threads = await db.select().from(chatThreads).where(eq(chatThreads.userId, userId)).orderBy(desc(chatThreads.updatedAt));
		const messages = await db
			.select({ threadId: chatMessages.threadId, meta: chatMessages.meta })
			.from(chatMessages);

		const statsMap = new Map<string, { count: number; tokens: number }>();
		for (const m of messages) {
			const s = statsMap.get(m.threadId) || { count: 0, tokens: 0 };
			s.count += 1;
			const meta = m.meta as { tokens?: number } | null;
			if (meta?.tokens) s.tokens += Number(meta.tokens) || 0;
			statsMap.set(m.threadId, s);
		}

		return threads.map((t) => {
			const s = statsMap.get(t.id) || { count: 0, tokens: 0 };
			return { ...t, messageCount: s.count, totalTokens: s.tokens };
		});
	}

	async updateThread(id: string, data: Partial<Pick<ChatThread, "title" | "model">>): Promise<ChatThread | null> {
		const [updated] = await db
			.update(chatThreads)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(chatThreads.id, id))
			.returning();
		return updated ?? null;
	}

	async deleteThread(id: string, userId?: string): Promise<boolean> {
		const conditions = [eq(chatThreads.id, id)];
		if (userId) conditions.push(eq(chatThreads.userId, userId));
		const [deleted] = await db.delete(chatThreads).where(and(...conditions)).returning();
		return !!deleted;
	}

	async createMessage(data: {
		id?: string;
		threadId: string;
		role: "user" | "assistant" | "system";
		content: string;
		fileIds?: string[];
		meta?: Record<string, unknown>;
	}): Promise<ChatMessage> {
		const now = new Date();
		const [created] = await db
			.insert(chatMessages)
			.values({
				id: data.id ?? crypto.randomUUID(),
				threadId: data.threadId,
				role: data.role,
				content: data.content,
				fileIds: data.fileIds ?? null,
				meta: data.meta ?? null,
				createdAt: now,
			})
			.returning();

		// touch thread's updatedAt
		await db.update(chatThreads).set({ updatedAt: now }).where(eq(chatThreads.id, data.threadId));
		return created!;
	}

	async listMessagesByThread(threadId: string): Promise<ChatMessage[]> {
		return db.select().from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(chatMessages.createdAt);
	}

	async deleteMessagesByThread(threadId: string, keepMessageIds: string[] = []): Promise<number> {
		if (keepMessageIds.length === 0) {
			const deleted = await db.delete(chatMessages).where(eq(chatMessages.threadId, threadId)).returning();
			return deleted.length;
		}
		const deleted = await db
			.delete(chatMessages)
			.where(and(eq(chatMessages.threadId, threadId), notInArray(chatMessages.id, keepMessageIds)))
			.returning();
		return deleted.length;
	}
	async createArtifact(data: {
		id?: string;
		messageId: string;
		threadId: string;
		identifier: string;
		type?: "html" | "code" | "svg" | "markdown";
		title: string;
		content: string;
		language?: string | null;
		expiresAt: Date;
	}): Promise<ChatArtifact> {
		const [created] = await db
			.insert(chatArtifacts)
			.values({
				id: data.id ?? crypto.randomUUID(),
				messageId: data.messageId,
				threadId: data.threadId,
				identifier: data.identifier,
				type: data.type ?? "code",
				title: data.title,
				content: data.content,
				language: data.language ?? null,
				expiresAt: data.expiresAt,
				createdAt: new Date(),
			})
			.returning();
		return created!;
	}

	async listArtifactsByThread(threadId: string, now = new Date()): Promise<ChatArtifact[]> {
		const rows = await db.select().from(chatArtifacts).where(eq(chatArtifacts.threadId, threadId)).orderBy(desc(chatArtifacts.createdAt));
		return rows.filter((r) => r.expiresAt > now);
	}

	async findArtifactById(id: string, now = new Date()): Promise<ChatArtifact | null> {
		const [artifact] = await db.select().from(chatArtifacts).where(eq(chatArtifacts.id, id));
		if (!artifact || artifact.expiresAt <= now) return null;
		return artifact;
	}

	async deleteExpiredArtifacts(now = new Date()): Promise<number> {
		const deleted = await db.delete(chatArtifacts).where(lte(chatArtifacts.expiresAt, now)).returning();
		return deleted.length;
	}

	async createShare(data: { id?: string; threadId: string; userId: string; token: string; title: string; expiresAt: Date }): Promise<ChatShare> {
		const [created] = await db.insert(chatShares).values({
			id: data.id ?? crypto.randomUUID(), threadId: data.threadId, userId: data.userId, token: data.token, title: data.title, expiresAt: data.expiresAt, createdAt: new Date(),
		}).returning();
		return created!;
	}

	async listSharesByThread(threadId: string, now = new Date()): Promise<ChatShare[]> {
		const rows = await db.select().from(chatShares).where(eq(chatShares.threadId, threadId)).orderBy(desc(chatShares.createdAt));
		return rows.filter((r) => r.expiresAt > now);
	}

	async findShareByToken(token: string, now = new Date()): Promise<ChatShare | null> {
		const [share] = await db.select().from(chatShares).where(eq(chatShares.token, token));
		return !share || share.expiresAt <= now ? null : share;
	}

	async deleteShare(id: string, userId?: string): Promise<boolean> {
		const conditions = [eq(chatShares.id, id)];
		if (userId) conditions.push(eq(chatShares.userId, userId));
		const [deleted] = await db.delete(chatShares).where(and(...conditions)).returning();
		return !!deleted;
	}

	async deleteExpiredShares(now = new Date()): Promise<number> {
		const deleted = await db.delete(chatShares).where(lte(chatShares.expiresAt, now)).returning();
		return deleted.length;
	}
}

export const chatRepo = new ChatRepository();

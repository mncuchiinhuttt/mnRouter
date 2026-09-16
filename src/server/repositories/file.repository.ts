import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@db";
import { chatFiles, type ChatFile } from "@db/schema";

export class FileRepository {
	async createFile(data: {
		id?: string;
		userId: string;
		threadId?: string | null;
		filename: string;
		mimeType: string;
		sizeBytes: number;
		storagePath: string;
		expiresAt: Date;
	}): Promise<ChatFile> {
		const [created] = await db
			.insert(chatFiles)
			.values({
				id: data.id ?? crypto.randomUUID(),
				userId: data.userId,
				threadId: data.threadId ?? null,
				filename: data.filename,
				mimeType: data.mimeType,
				sizeBytes: data.sizeBytes,
				storagePath: data.storagePath,
				expiresAt: data.expiresAt,
				createdAt: new Date(),
			})
			.returning();
		return created!;
	}

	async findById(id: string, now = new Date()): Promise<ChatFile | null> {
		const [file] = await db.select().from(chatFiles).where(eq(chatFiles.id, id));
		if (!file || file.expiresAt <= now) return null;
		return file;
	}

	async findByIds(ids: string[], now = new Date()): Promise<ChatFile[]> {
		if (ids.length === 0) return [];
		const rows = await db.select().from(chatFiles).where(inArray(chatFiles.id, ids));
		return rows.filter((f) => f.expiresAt > now);
	}

	async listByUser(userId: string, now = new Date()): Promise<ChatFile[]> {
		const rows = await db.select().from(chatFiles).where(eq(chatFiles.userId, userId)).orderBy(desc(chatFiles.createdAt));
		return rows.filter((f) => f.expiresAt > now);
	}

	async delete(id: string, userId?: string): Promise<boolean> {
		const conditions = [eq(chatFiles.id, id)];
		if (userId) conditions.push(eq(chatFiles.userId, userId));
		const [deleted] = await db.delete(chatFiles).where(and(...conditions)).returning();
		return !!deleted;
	}

	async findExpired(now = new Date()): Promise<ChatFile[]> {
		return db.select().from(chatFiles).where(lte(chatFiles.expiresAt, now));
	}

	async deleteExpired(now = new Date()): Promise<number> {
		const deleted = await db.delete(chatFiles).where(lte(chatFiles.expiresAt, now)).returning();
		return deleted.length;
	}
}

export const fileRepo = new FileRepository();

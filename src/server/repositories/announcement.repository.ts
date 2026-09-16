import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@db";
import { announcements, type Announcement, type NewAnnouncement } from "@db/schema";

export class AnnouncementRepository {
	async listActive(now = new Date()): Promise<Announcement[]> {
		return db
			.select()
			.from(announcements)
			.where(
				and(
					eq(announcements.active, true),
					or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
				),
			)
			.orderBy(desc(announcements.createdAt));
	}

	async listAll(): Promise<Announcement[]> {
		return db.select().from(announcements).orderBy(desc(announcements.createdAt));
	}

	async findById(id: string): Promise<Announcement | null> {
		const [found] = await db.select().from(announcements).where(eq(announcements.id, id));
		return found ?? null;
	}

	async create(data: {
		id?: string;
		title: string;
		content: string;
		type?: "info" | "warning" | "maintenance" | "success";
		active?: boolean;
		expiresAt?: Date | null;
		createdBy?: string | null;
	}): Promise<Announcement> {
		const now = new Date();
		const [created] = await db
			.insert(announcements)
			.values({
				id: data.id ?? crypto.randomUUID(),
				title: data.title.trim(),
				content: data.content.trim(),
				type: data.type ?? "info",
				active: data.active ?? true,
				expiresAt: data.expiresAt ?? null,
				createdBy: data.createdBy ?? null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return created!;
	}

	async update(id: string, data: Partial<Omit<Announcement, "id" | "createdAt">>): Promise<Announcement | null> {
		const [updated] = await db
			.update(announcements)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(eq(announcements.id, id))
			.returning();
		return updated ?? null;
	}

	async delete(id: string): Promise<boolean> {
		const [deleted] = await db.delete(announcements).where(eq(announcements.id, id)).returning();
		return !!deleted;
	}
}

export const announcementRepo = new AnnouncementRepository();

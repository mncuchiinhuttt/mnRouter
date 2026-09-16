import { announcementRepo } from "../repositories/announcement.repository.js";
import { auditRepo } from "../repositories/usage.repository.js";
import type { Announcement } from "@db/schema";

export class AnnouncementService {
	async getActiveAnnouncements(): Promise<Announcement[]> {
		return announcementRepo.listActive();
	}

	async listAllAnnouncements(): Promise<Announcement[]> {
		return announcementRepo.listAll();
	}

	async createAnnouncement(
		data: {
			title: string;
			content: string;
			type?: "info" | "warning" | "maintenance" | "success";
			active?: boolean;
			expiresAt?: Date | null;
		},
		actorId?: string,
	): Promise<Announcement> {
		const created = await announcementRepo.create({
			title: data.title,
			content: data.content,
			type: data.type ?? "info",
			active: data.active ?? true,
			expiresAt: data.expiresAt ?? null,
			createdBy: actorId ?? null,
		});

		if (actorId) {
			await auditRepo.record(actorId, "announcement.create", created.id, {
				title: created.title,
				type: created.type,
				expiresAt: created.expiresAt,
			});
		}

		return created;
	}

	async updateAnnouncement(
		id: string,
		data: {
			title?: string;
			content?: string;
			type?: "info" | "warning" | "maintenance" | "success";
			active?: boolean;
			expiresAt?: Date | null;
		},
		actorId?: string,
	): Promise<Announcement | null> {
		const updated = await announcementRepo.update(id, data);
		if (updated && actorId) {
			await auditRepo.record(actorId, "announcement.update", id, data);
		}
		return updated;
	}

	async deleteAnnouncement(id: string, actorId?: string): Promise<boolean> {
		const target = await announcementRepo.findById(id);
		if (!target) return false;

		const deleted = await announcementRepo.delete(id);
		if (deleted && actorId) {
			await auditRepo.record(actorId, "announcement.delete", id, { title: target.title });
		}
		return deleted;
	}
}

export const announcementService = new AnnouncementService();

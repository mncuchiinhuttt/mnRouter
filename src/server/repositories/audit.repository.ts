import { desc } from "drizzle-orm";
import { db } from "@db";
import { auditLogs } from "@db/schema";

export class AuditRepository {
	async record(actorUserId: string | null, action: string, target?: string, data?: unknown): Promise<void> {
		await db.insert(auditLogs).values({
			actorUserId,
			action,
			target,
			data: (data as Record<string, unknown>) ?? null,
		});
	}

	async list(limit = 200) {
		return db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(limit);
	}
}

export const auditRepo = new AuditRepository();

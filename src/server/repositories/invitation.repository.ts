import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@db";
import { invitations, sessions, magicLinks, users, type Invitation, type User } from "@db/schema";

export class InvitationRepository {
	async create(data: {
		id?: string;
		email: string;
		tokenHash: string;
		invitedBy?: string | null;
		maxApiKeys?: number;
		packageName?: string | null;
		monthlyTokenBudget?: number | null;
		monthlyCreditBudget?: number | null;
		allModels?: boolean;
		allowedModels?: string[];
		expiresAt: Date;
	}): Promise<Invitation> {
		const [created] = await db
			.insert(invitations)
			.values({
				id: data.id ?? crypto.randomUUID(),
				email: data.email.toLowerCase(),
				tokenHash: data.tokenHash,
				invitedBy: data.invitedBy,
				maxApiKeys: data.maxApiKeys ?? 1,
				packageName: data.packageName,
				monthlyTokenBudget: data.monthlyTokenBudget,
				monthlyCreditBudget: data.monthlyCreditBudget,
				allModels: data.allModels ?? true,
				allowedModels: data.allowedModels ?? [],
				expiresAt: data.expiresAt,
			})
			.returning();
		return created!;
	}

	async findById(id: string): Promise<Invitation | null> {
		const [inv] = await db.select().from(invitations).where(eq(invitations.id, id));
		return inv ?? null;
	}

	async findPendingByEmail(email: string): Promise<Invitation | null> {
		const [inv] = await db
			.select()
			.from(invitations)
			.where(and(eq(invitations.email, email.toLowerCase()), eq(invitations.status, "pending"), gt(invitations.expiresAt, new Date())));
		return inv ?? null;
	}

	async findPendingByHash(tokenHash: string): Promise<Invitation | null> {
		const [inv] = await db
			.select()
			.from(invitations)
			.where(and(eq(invitations.tokenHash, tokenHash), eq(invitations.status, "pending"), gt(invitations.expiresAt, new Date())));
		return inv ?? null;
	}

	async markAccepted(id: string): Promise<Invitation | null> {
		const [updated] = await db
			.update(invitations)
			.set({ status: "accepted", acceptedAt: new Date() })
			.where(and(eq(invitations.id, id), eq(invitations.status, "pending")))
			.returning();
		return updated ?? null;
	}

	async revoke(id: string): Promise<boolean> {
		const [updated] = await db
			.update(invitations)
			.set({ status: "revoked" })
			.where(and(eq(invitations.id, id), eq(invitations.status, "pending")))
			.returning({ id: invitations.id });
		return Boolean(updated);
	}

	async listAll(limit = 100): Promise<Invitation[]> {
		return db.select().from(invitations).orderBy(desc(invitations.createdAt)).limit(limit);
	}
}

export class SessionRepository {
	async create(data: { id?: string; userId: string; tokenHash: string; expiresAt: Date; ip?: string; userAgent?: string }) {
		const [s] = await db
			.insert(sessions)
			.values({
				id: data.id ?? crypto.randomUUID(),
				userId: data.userId,
				tokenHash: data.tokenHash,
				expiresAt: data.expiresAt,
				ip: data.ip,
				userAgent: data.userAgent,
			})
			.returning();
		return s!;
	}

	async findValidByHash(tokenHash: string): Promise<{ session: typeof sessions.$inferSelect; user: User } | null> {
		const [row] = await db
			.select()
			.from(sessions)
			.innerJoin(users, eq(users.id, sessions.userId))
			.where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date()), eq(users.status, "active")));
		if (!row) return null;
		return { session: row.sessions, user: row.users };
	}

	async updateLastUsed(id: string): Promise<void> {
		await db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, id));
	}

	async deleteByUserId(userId: string): Promise<void> {
		await db.delete(sessions).where(eq(sessions.userId, userId));
	}

	async delete(id: string): Promise<void> {
		await db.delete(sessions).where(eq(sessions.id, id));
	}
}

export class MagicLinkRepository {
	async create(data: { id?: string; email: string; tokenHash: string; expiresAt: Date; ip?: string; userAgent?: string }) {
		const [m] = await db
			.insert(magicLinks)
			.values({
				id: data.id ?? crypto.randomUUID(),
				email: data.email.toLowerCase(),
				tokenHash: data.tokenHash,
				expiresAt: data.expiresAt,
				ip: data.ip,
				userAgent: data.userAgent,
			})
			.returning();
		return m!;
	}

	async findValidByHash(tokenHash: string) {
		const [row] = await db
			.select()
			.from(magicLinks)
			.where(and(eq(magicLinks.tokenHash, tokenHash), isNull(magicLinks.usedAt), gt(magicLinks.expiresAt, new Date())));
		return row ?? null;
	}

	async markUsed(id: string): Promise<void> {
		await db.update(magicLinks).set({ usedAt: new Date() }).where(eq(magicLinks.id, id));
	}
}

export const invitationRepo = new InvitationRepository();
export const sessionRepo = new SessionRepository();
export const magicLinkRepo = new MagicLinkRepository();

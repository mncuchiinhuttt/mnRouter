import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { magicLinks, sessions, users, auditLogs } from "../db/schema.js";
import { hashToken, randomToken } from "./crypto.js";
import { env } from "../env.js";
import { sendMagicLink } from "../mail/index.js";

const MAGIC_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

export const SESSION_COOKIE = "mn_session";

export async function createMagicLink(email: string, ip?: string, userAgent?: string) {
	const token = randomToken(32);
	await db.insert(magicLinks).values({
		email: email.toLowerCase(),
		tokenHash: hashToken(token),
		expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
		ip,
		userAgent,
	});
	const url = `${env.APP_URL}/auth/verify?token=${token}`;
	await sendMagicLink(email, url);
}

/** Consume a magic-link token and create a session. Returns session token or null. */
export async function consumeMagicLink(
	token: string,
	ip?: string,
	userAgent?: string,
): Promise<{ sessionToken: string; user: typeof users.$inferSelect } | null> {
	const [link] = await db
		.update(magicLinks)
		.set({ usedAt: new Date() })
		.where(and(eq(magicLinks.tokenHash, hashToken(token)), isNull(magicLinks.usedAt), gt(magicLinks.expiresAt, new Date())))
		.returning();
	if (!link) return null;

	const [user] = await db.select().from(users).where(eq(users.email, link.email));
	if (!user || user.status !== "active") return null;

	const sessionToken = await createSession(user.id, ip, userAgent);
	return { sessionToken, user };
}

export async function createSession(userId: string, ip?: string, userAgent?: string): Promise<string> {
	const token = randomToken(32);
	await db.insert(sessions).values({
		userId,
		tokenHash: hashToken(token),
		expiresAt: new Date(Date.now() + SESSION_TTL_MS),
		ip,
		userAgent,
	});
	return token;
}

export async function getSessionUser(token: string) {
	const [row] = await db
		.select({ user: users, sessionId: sessions.id })
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
	if (!row || row.user.status !== "active") return null;
	// touch lastUsedAt at most once per minute to avoid write amplification
	void db
		.update(sessions)
		.set({ lastUsedAt: new Date() })
		.where(and(eq(sessions.id, row.sessionId), sql`${sessions.lastUsedAt} < now() - interval '1 minute'`))
		.catch(() => {});
	return row.user;
}

export async function destroySession(token: string) {
	await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function audit(actorUserId: string | null, action: string, target?: string, data?: Record<string, unknown>) {
	await db.insert(auditLogs).values({ actorUserId, action, target, data });
}

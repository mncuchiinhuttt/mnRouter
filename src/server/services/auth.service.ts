import { hashToken, randomToken } from "../auth/crypto.js";
import { env } from "../env.js";
import { sendMagicLink } from "../mail/index.js";
import { userRepo, keyRepo } from "../repositories/user.repository.js";
import { magicLinkRepo, sessionRepo } from "../repositories/invitation.repository.js";
import type { User, ApiKey } from "@db/schema";

const MAGIC_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

export const SESSION_COOKIE = "mn_session";

export class AuthService {
	async createMagicLink(email: string, ip?: string, userAgent?: string): Promise<boolean> {
		const normEmail = email.toLowerCase().trim();
		const user = await userRepo.findByEmail(normEmail);
		if (!user || user.status !== "active") return false;

		const token = randomToken(32);
		await magicLinkRepo.create({
			email: normEmail,
			tokenHash: hashToken(token),
			expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
			ip,
			userAgent,
		});

		const url = `${env.APP_URL}/auth/verify?token=${token}`;
		await sendMagicLink(normEmail, url);
		return true;
	}

	async consumeMagicLink(
		token: string,
		ip?: string,
		userAgent?: string,
	): Promise<{ sessionToken: string; user: User } | null> {
		const tokenHash = hashToken(token);
		const link = await magicLinkRepo.findValidByHash(tokenHash);
		if (!link) return null;

		await magicLinkRepo.markUsed(link.id);

		const user = await userRepo.findByEmail(link.email);
		if (!user || user.status !== "active") return null;

		const sessionToken = randomToken(32);
		await sessionRepo.create({
			userId: user.id,
			tokenHash: hashToken(sessionToken),
			expiresAt: new Date(Date.now() + SESSION_TTL_MS),
			ip,
			userAgent,
		});

		return { sessionToken, user };
	}

	async authenticateSession(sessionToken: string): Promise<User | null> {
		if (!sessionToken) return null;
		const tokenHash = hashToken(sessionToken);
		const row = await sessionRepo.findValidByHash(tokenHash);
		if (!row) return null;

		void sessionRepo.updateLastUsed(row.session.id);
		return row.user;
	}

	async authenticateApiKey(authHeader?: string): Promise<{ apiKey: ApiKey; user: User } | null> {
		if (!authHeader) return null;
		const match = authHeader.match(/Bearer\s+([A-Za-z0-9_-]+)/i);
		const rawKey = match ? match[1] : (authHeader.startsWith("mr_") ? authHeader.trim() : null);
		if (!rawKey) return null;
		const keyHash = hashToken(rawKey);
		const row = await keyRepo.findByHash(keyHash);
		if (!row || row.user.status !== "active") return null;

		void keyRepo.updateLastUsed(row.id);
		return { apiKey: row, user: row.user };
	}

	async logout(sessionToken: string): Promise<void> {
		if (!sessionToken) return;
		const tokenHash = hashToken(sessionToken);
		const row = await sessionRepo.findValidByHash(tokenHash);
		if (row) {
			await sessionRepo.delete(row.session.id);
		}
	}
}

export const authService = new AuthService();

import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiKeys, users } from "../db/schema.js";
import { hashToken } from "./crypto.js";
import { getSessionUser, SESSION_COOKIE } from "./service.js";
import type { User } from "../db/schema.js";

export function sessionMiddleware() {
	return async (c: Context, next: Next) => {
		const token = getCookie(c, SESSION_COOKIE);
		if (token) {
			const user = await getSessionUser(token);
			if (user) {
				c.set("user", user);
				c.set("sessionToken", token);
			}
		}
		await next();
	};
}

export function requireAuth() {
	return async (c: Context, next: Next) => {
		const user = c.get("user");
		if (!user) return c.json({ error: "unauthorized" }, 401);
		await next();
	};
}

export function requireAdmin() {
	return async (c: Context, next: Next) => {
		const user = c.get("user");
		if (!user) return c.json({ error: "unauthorized" }, 401);
		if (user.role !== "admin") return c.json({ error: "forbidden" }, 403);
		await next();
	};
}

export function setSessionCookie(c: Context, token: string) {
	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "Lax",
		path: "/",
		maxAge: 15 * 24 * 60 * 60,
	});
}

export function clearSessionCookie(c: Context) {
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

declare module "hono" {
	interface ContextVariableMap {
		user: User;
		sessionToken: string;
		apiKeyId: string;
	}
}

/** Gateway auth: Bearer mr_… → resolve key row + owning user. */
export async function authenticateApiKey(authHeader: string | undefined) {
	if (!authHeader?.startsWith("Bearer ")) return null;
	const key = authHeader.slice(7).trim();
	if (!key.startsWith("mr_")) return null;
	const [row] = await db
		.select({ key: apiKeys, user: users })
		.from(apiKeys)
		.innerJoin(users, eq(users.id, apiKeys.userId))
		.where(and(eq(apiKeys.keyHash, hashToken(key)), isNull(apiKeys.revokedAt)));
	if (!row || row.user.status !== "active") return null;
	void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.key.id)).catch(() => {});
	return row;
}

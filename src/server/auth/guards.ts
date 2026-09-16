import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { authService, SESSION_COOKIE } from "../services/auth.service.js";
import type { User, ApiKey } from "@db/schema";

export { SESSION_COOKIE };

export function sessionMiddleware() {
	return async (c: Context, next: Next) => {
		const token = getCookie(c, SESSION_COOKIE);
		if (token) {
			const user = await authService.authenticateSession(token);
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
export async function authenticateApiKey(authHeader: string | undefined): Promise<{ key: ApiKey; user: User } | null> {
	const res = await authService.authenticateApiKey(authHeader);
	if (!res) return null;
	return { key: res.apiKey, user: res.user };
}

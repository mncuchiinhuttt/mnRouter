import { Hono } from "hono";
import { z } from "zod";
import { createMagicLink, consumeInvitation, consumeMagicLink, destroySession, InvitationError } from "../auth/service.js";
import { setSessionCookie, clearSessionCookie, sessionMiddleware } from "../auth/guards.js";

const emailSchema = z.string().email();

export function authRoutes() {
	const app = new Hono();
	app.use("/api/*", sessionMiddleware());

	app.post("/api/auth/magic-link", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const parsed = emailSchema.safeParse(body.email);
		if (!parsed.success) return c.json({ error: "invalid_email" }, 400);
		const ip = c.req.header("x-forwarded-for") ?? undefined;
		const ua = c.req.header("user-agent") ?? undefined;
		await createMagicLink(parsed.data, ip, ua);
		// always OK — không leak email tồn tại hay không
		return c.json({ ok: true, message: "Nếu email tồn tại, magic link đã được gửi. Kiểm tra hộp thư." });
	});

	app.post("/api/auth/verify", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const token = String(body.token ?? "");
		if (!token) return c.json({ error: "missing_token" }, 400);
		const ip = c.req.header("x-forwarded-for") ?? undefined;
		const ua = c.req.header("user-agent") ?? undefined;
		const result = await consumeMagicLink(token, ip, ua);
		if (!result) return c.json({ error: "invalid_or_expired" }, 401);
		setSessionCookie(c, result.sessionToken);
		return c.json({
			ok: true,
			user: { id: result.user.id, email: result.user.email, role: result.user.role, displayName: result.user.displayName },
		});
	});

	app.post("/api/auth/invitations/accept", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const token = String(body.token ?? "");
		if (!token) return c.json({ error: "missing_token" }, 400);
		const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : undefined;
		try {
			const result = await consumeInvitation(token, displayName, c.req.header("x-forwarded-for") ?? undefined, c.req.header("user-agent") ?? undefined);
			if (!result) return c.json({ error: "invalid_or_expired_invitation" }, 401);
			setSessionCookie(c, result.sessionToken);
			return c.json({
				ok: true,
				user: {
					id: result.user.id,
					email: result.user.email,
					role: result.user.role,
					displayName: result.user.displayName,
					packageName: result.user.packageName,
				},
			});
		} catch (err) {
			if (err instanceof InvitationError) return c.json({ error: err.code }, 409);
			throw err;
		}
	});

	app.post("/api/auth/logout", async (c) => {
		const token = c.get("sessionToken");
		if (token) await destroySession(token);
		clearSessionCookie(c);
		return c.json({ ok: true });
	});

	app.get("/api/auth/me", (c) => {
		const user = c.get("user");
		if (!user) return c.json({ error: "unauthorized" }, 401);
		return c.json({
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
				displayName: user.displayName,
				username: user.username,
				department: user.department,
				avatarUrl: user.avatarUrl,
				packageName: user.packageName,
				monthlyTokenBudget: user.monthlyTokenBudget,
				monthlyCreditBudget: user.monthlyCreditBudget,
				allModels: user.allModels,
				onboardedAt: user.onboardedAt,
			},
		});
	});

	return app;
}

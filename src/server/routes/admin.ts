import { Hono } from "hono";
import { z } from "zod";
import { requireAdmin } from "../auth/guards.js";
import { userService } from "../services/user.service.js";
import { invitationService } from "../services/invitation.service.js";
import { modelService } from "../services/model.service.js";
import { connectionService } from "../services/connection.service.js";
import { usageRepo, settingsRepo, auditRepo } from "../repositories/usage.repository.js";
import { modelRepo } from "../repositories/model.repository.js";
import { telegramService } from "../services/telegram.service.js";
import { env } from "../env.js";
import type { ProviderId } from "../gateway/registry.js";
const modelIdsSchema = z.array(z.string().min(1).max(200)).max(200).default([]);

export function adminRoutes() {
	const app = new Hono();
	app.use("/api/admin/*", requireAdmin());

	// ---------- users & keys ----------
	app.get("/api/admin/users", async (c) => c.json({ users: await userService.listAllUsers() }));

	app.post("/api/admin/users", async (c) => {
		const schema = z.object({
			email: z.string().email(),
			displayName: z.string().trim().max(120).optional(),
			packageName: z.string().trim().max(80).optional(),
			maxApiKeys: z.number().int().min(0).max(50).default(1),
			weeklyCreditBudget: z.number().int().min(0).nullable().optional(),
			monthlyCreditBudget: z.number().int().min(0).nullable().optional(),
			allModels: z.boolean().default(true),
			allowedModels: modelIdsSchema,
		});
		const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
		try {
			const user = await userService.createUser(parsed.data, c.get("user").id);
			return c.json({ user }, 201);
		} catch (err) {
			const msg = (err as Error).message;
			return c.json({ error: msg }, msg === "email_exists" ? 409 : 400);
		}
	});

	app.patch("/api/admin/users/:id", async (c) => {
		const schema = z.object({
			maxApiKeys: z.number().int().min(0).max(50).optional(),
			weeklyCreditBudget: z.number().int().min(0).nullable().optional(),
			monthlyCreditBudget: z.number().int().min(0).nullable().optional(),
			packageName: z.string().trim().max(80).nullable().optional(),
			status: z.enum(["active", "disabled"]).optional(),
			displayName: z.string().trim().max(120).nullable().optional(),
		});
		const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
		const user = await userService.updateUser(c.req.param("id"), parsed.data, c.get("user").id);
		return user ? c.json({ user }) : c.json({ error: "not_found" }, 404);
	});

	app.delete("/api/admin/users/:id", async (c) => {
		const targetId = c.req.param("id");
		const currentUserId = c.get("user").id;
		if (targetId === currentUserId) {
			return c.json({ error: "cannot_delete_self" }, 400);
		}
		const ok = await userService.deleteUser(targetId, currentUserId);
		return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
	});

	app.get("/api/admin/users/:id/keys", async (c) => c.json({ keys: await userService.listUserKeys(c.req.param("id")) }));

	app.post("/api/admin/users/:id/keys", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		try {
			const key = await userService.adminCreateApiKey(c.req.param("id"), body.name, c.get("user").id);
			return c.json({ ...key, message: "Chỉ hiện 1 lần — gửi cho user qua kênh an toàn." });
		} catch (err) {
			const msg = (err as Error).message;
			return c.json({ error: msg }, msg === "user_not_found" ? 404 : msg === "max_keys_reached" ? 409 : 400);
		}
	});

	app.get("/api/admin/keys", async (c) => c.json({ keys: await userService.listAllKeys() }));
	app.delete("/api/admin/keys/:id", async (c) => {
		await userService.revokeApiKey(c.req.param("id"), undefined, c.get("user").id);
		return c.json({ ok: true });
	});

	// ---------- invitations ----------
	app.get("/api/admin/invitations", async (c) => c.json({ invitations: await invitationService.listInvitations() }));

	app.post("/api/admin/invitations", async (c) => {
		const schema = z.object({
			email: z.string().email(),
			packageName: z.string().trim().max(80).optional(),
			maxApiKeys: z.number().int().min(0).max(50).default(1),
			weeklyCreditBudget: z.number().int().min(0).nullable().optional(),
			monthlyCreditBudget: z.number().int().min(0).nullable().optional(),
			allModels: z.boolean().default(true),
			allowedModels: modelIdsSchema,
		});
		const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
		try {
			const invitation = await invitationService.createInvitation(parsed.data, c.get("user").id);
			return c.json({ invitation, message: "Invitation sent" }, 201);
		} catch (err) {
			const msg = (err as Error).message;
			return c.json({ error: msg }, msg === "email_exists" || msg === "invitation_pending" ? 409 : 400);
		}
	});

	app.delete("/api/admin/invitations/:id", async (c) => {
		const ok = await invitationService.revokeInvitation(c.req.param("id"), c.get("user").id);
		return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
	});

	// ---------- user model permissions ----------
	app.get("/api/admin/users/:id/models", async (c) => {
		const access = await modelService.getUserModelAccess(c.req.param("id"));
		return access ? c.json(access) : c.json({ error: "not_found" }, 404);
	});

	app.put("/api/admin/users/:id/models", async (c) => {
		const schema = z.object({ allModels: z.boolean(), modelIds: modelIdsSchema });
		const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
		try {
			const ok = await modelService.setUserModelAccess(c.req.param("id"), parsed.data.allModels, parsed.data.modelIds);
			return ok ? c.json({ ok: true, ...parsed.data }) : c.json({ error: "not_found" }, 404);
		} catch (err) {
			return c.json({ error: (err as Error).message }, 400);
		}
	});

	// ---------- connections & oauth ----------
	app.get("/api/admin/connections", async (c) => c.json({ connections: await connectionService.listConnections() }));

	app.post("/api/admin/connections", async (c) => {
		const schema = z.object({
			provider: z.enum(["claude", "codex", "antigravity", "kiro", "grok", "opencode"]),
			label: z.string().trim().max(80).optional(),
			priority: z.number().int().min(1).max(1000).default(100),
			baseUrlOverride: z.string().trim().url().optional(),
			tokens: z.record(z.unknown()).default({}),
		});
		const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
		const conn = await connectionService.importConnection(parsed.data, c.get("user").id);
		return c.json({ connection: conn }, 201);
	});

	app.patch("/api/admin/connections/:id", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const conn = await connectionService.updateConnection(c.req.param("id"), body, c.get("user").id);
		return conn ? c.json({ connection: conn }) : c.json({ error: "not_found" }, 404);
	});

	app.delete("/api/admin/connections/:id", async (c) => {
		const ok = await connectionService.deleteConnection(c.req.param("id"), c.get("user").id);
		return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
	});

	app.post("/api/admin/connections/:id/test", async (c) => c.json(await connectionService.testConnection(c.req.param("id"))));

	app.get("/api/admin/oauth/:provider/start", async (c) => {
		try {
			return c.json(await connectionService.startOauth(c.req.param("provider") as ProviderId));
		} catch (err) {
			return c.json({ error: (err as Error).message }, 502);
		}
	});

	app.post("/api/admin/oauth/:provider/exchange", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		try {
			const res = await connectionService.exchangeOauth(c.req.param("provider") as ProviderId, body.state, body.code, c.get("user").id);
			return c.json(res);
		} catch (err) {
			const msg = (err as Error).message;
			return c.json({ error: msg }, msg === "invalid_state" ? 400 : 502);
		}
	});

	// ---------- models, settings, logs ----------
	app.get("/api/admin/models", async (c) => c.json({ models: await modelService.listAllModels() }));

	app.patch("/api/admin/models/:id", async (c) => {
		const schema = z.object({
			enabled: z.boolean().optional(),
			upstreamModel: z.string().trim().min(1).max(200).optional(),
			displayName: z.string().trim().min(1).max(200).optional(),
			priority: z.number().int().min(1).max(1000).optional(),
			contextWindow: z.number().int().min(1000).max(10_000_000).optional(),
			maxOutput: z.number().int().min(256).max(1_000_000).optional(),
			priceIn: z.number().int().min(0).max(1_000_000).optional(),
			priceOut: z.number().int().min(0).max(1_000_000).optional(),
			priceCacheRead: z.number().int().min(0).max(1_000_000).optional(),
			priceCacheWrite: z.number().int().min(0).max(1_000_000).optional(),
		});
		const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
		const model = await modelService.updateModel(c.req.param("id"), parsed.data);
		if (model) await auditRepo.record(c.get("user").id, "model.update", c.req.param("id"), parsed.data);
		return model ? c.json({ model }) : c.json({ error: "not_found" }, 404);
	});

	app.get("/api/admin/settings", async (c) => {
		const routing = await settingsRepo.get("routing");
		const rateLimit = await settingsRepo.get("rateLimit");
		return c.json({ settings: { routing, rateLimit } });
	});

	app.put("/api/admin/settings", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		if (body.key) await settingsRepo.set(body.key, body.value);
		await auditRepo.record(c.get("user").id, "settings.update", body.key, body.value);
		return c.json({ ok: true });
	});

	app.get("/api/admin/logs", async (c) => {
		const page = Math.max(1, Number(c.req.query("page") ?? 1));
		const requested = Number(c.req.query("limit") ?? 100);
		const limit = Number.isFinite(requested) ? Math.min(200, Math.max(1, Math.floor(requested))) : 100;
		const status = c.req.query("status")?.trim() || undefined;
		const result = await usageRepo.getAllLogsPaged(page, limit, status);
		return c.json(result);
	});

	app.get("/api/admin/audit", async (c) => c.json({ audit: await auditRepo.list(200) }));

	// ---------- telegram bot monitoring ----------
	app.get("/api/admin/telegram", async (c) => {
		const cfg = await telegramService.getConfig();
		return c.json({ config: cfg });
	});

	app.put("/api/admin/telegram", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const updated = await telegramService.saveConfig(body);
		await auditRepo.record(c.get("user").id, "telegram.update", "settings", { enabled: updated.enabled });
		return c.json({ config: updated });
	});

	app.post("/api/admin/telegram/test", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const res = await telegramService.sendTest(body.botToken, body.chatId);
		return c.json(res);
	});

	app.post("/api/admin/telegram/detect-chat-id", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const res = await telegramService.detectChatId(body.botToken);
		return c.json(res);
	});
	app.post("/api/admin/telegram/webhook/set", async (c) => {
		const body = (await c.req.json().catch(() => ({}))) as { botToken?: string };
		const cfg = await telegramService.getConfig();
		const botToken = (body.botToken || cfg.botToken)?.trim();
		if (!botToken) return c.json({ ok: false, error: "Missing Bot Token" }, 400);

		// Always enforce HTTPS public origin for Telegram webhook
		let origin = env.APP_URL?.replace(/\/+$/, "");
		if (!origin || !origin.startsWith("https://")) {
			const proto = c.req.header("x-forwarded-proto") || "https";
			const host = c.req.header("x-forwarded-host") || c.req.header("host") || "mnrouter.mncuchiinhuttt.dev";
			origin = `${proto}://${host}`;
		}
		if (origin.startsWith("http://")) {
			origin = origin.replace("http://", "https://");
		}
		if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
			origin = "https://mnrouter.mncuchiinhuttt.dev";
		}

		const webhookUrl = `${origin}/api/telegram/webhook`;
		try {
			const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
			const data = (await res.json()) as any;
			if (!data.ok) {
				return c.json({ ok: false, error: data.description || "Failed to set Telegram webhook" }, 400);
			}
			await telegramService.registerCommands(botToken);
			return c.json(data);
		} catch (e) {
			return c.json({ ok: false, error: (e as Error).message }, 500);
		}
	});

	app.post("/api/telegram/webhook", async (c) => {
		const body = await c.req.json().catch(() => null);
		if (body) {
			void telegramService.handleWebhookUpdate(body);
		}
		return c.json({ ok: true });
	});

	return app;
}

export async function seedModels(): Promise<void> {
	return modelService.seedModels();
}

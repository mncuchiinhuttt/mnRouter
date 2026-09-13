import { Hono } from "hono";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { apiKeys, auditLogs, models as modelsTable, providerConnections, settings as settingsTable, usageRequests, users } from "../db/schema.js";
import { requireAdmin } from "../auth/guards.js";
import { generateApiKey } from "../auth/crypto.js";
import { audit } from "../auth/service.js";
import { usageSummary } from "../usage/index.js";
import { ensureFreshToken } from "../gateway/router.js";
import { DEFAULT_MODELS, PROVIDERS, type ProviderId } from "../gateway/registry.js";
import { authorizeUrl, exchangeCode, pkcePair, decodeJwtClaims, kiroDeviceStart, kiroDevicePoll } from "../gateway/oauth.js";

export function adminRoutes() {
	const app = new Hono();
	app.use("/api/admin/*", requireAdmin());

	/** giữ tạm PKCE verifier theo state (single instance → in-memory OK) */
	const pendingOauth = new Map<string, { provider: ProviderId; verifier: string; expires: number }>();

	// ---------- users ----------
	app.get("/api/admin/users", async (c) => {
		const rows = await db
			.select({
				id: users.id,
				email: users.email,
				role: users.role,
				displayName: users.displayName,
				status: users.status,
				maxApiKeys: users.maxApiKeys,
				monthlyTokenBudget: users.monthlyTokenBudget,
				monthlyCreditBudget: users.monthlyCreditBudget,
				createdAt: users.createdAt,
				activeKeys: sql<number>`(SELECT COUNT(*) FROM api_keys k WHERE k.user_id = ${users.id} AND k.revoked_at IS NULL)`,
				totalTokens: sql<number>`COALESCE((SELECT SUM(prompt_tokens + completion_tokens) FROM usage_daily u WHERE u.user_id = ${users.id}), 0)`,
				totalCredits: sql<number>`COALESCE((SELECT SUM(credits) FROM usage_daily u WHERE u.user_id = ${users.id}), 0)`,
			})
			.from(users)
			.orderBy(users.createdAt);
		return c.json({ users: rows });
	});

	const createUserSchema = z.object({
		email: z.string().email(),
		displayName: z.string().optional(),
		maxApiKeys: z.number().int().min(0).max(50).default(1),
		monthlyTokenBudget: z.number().int().nullable().default(null),
		monthlyCreditBudget: z.number().int().nullable().default(null),
		role: z.enum(["admin", "user"]).default("user"),
	});

	app.post("/api/admin/users", async (c) => {
		const body = createUserSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!body.success) return c.json({ error: "invalid_input", details: body.error.flatten() }, 400);
		const email = body.data.email.toLowerCase();
		const [existing] = await db.select().from(users).where(eq(users.email, email));
		if (existing) return c.json({ error: "email_exists" }, 409);
		const [user] = await db
			.insert(users)
			.values({
				email,
				displayName: body.data.displayName,
				maxApiKeys: body.data.maxApiKeys,
				monthlyTokenBudget: body.data.monthlyTokenBudget,
				monthlyCreditBudget: body.data.monthlyCreditBudget,
				role: body.data.role,
			})
			.returning();
		await audit(c.get("user").id, "user.create", email, { maxApiKeys: body.data.maxApiKeys });
		return c.json({ user });
	});

	app.patch("/api/admin/users/:id", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json().catch(() => ({}));
		const patch: Record<string, unknown> = {};
		if (body.maxApiKeys !== undefined) patch.maxApiKeys = Number(body.maxApiKeys);
		if (body.monthlyTokenBudget !== undefined) patch.monthlyTokenBudget = body.monthlyTokenBudget === null ? null : Number(body.monthlyTokenBudget);
		if (body.monthlyCreditBudget !== undefined) patch.monthlyCreditBudget = body.monthlyCreditBudget === null ? null : Number(body.monthlyCreditBudget);
		if (body.status !== undefined && ["active", "disabled"].includes(body.status)) patch.status = body.status;
		if (body.displayName !== undefined) patch.displayName = body.displayName;
		const [user] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
		if (!user) return c.json({ error: "not_found" }, 404);
		if (patch.status === "disabled") {
			// kill sessions + revoke keys
			await db.execute(sql`DELETE FROM sessions WHERE user_id = ${id}`);
			await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.userId, id), isNull(apiKeys.revokedAt)));
		}
		await audit(c.get("user").id, "user.update", id, patch);
		return c.json({ user });
	});

	// ---------- api keys ----------
	app.post("/api/admin/users/:id/keys", async (c) => {
		const userId = c.req.param("id");
		const [target] = await db.select().from(users).where(eq(users.id, userId));
		if (!target) return c.json({ error: "user_not_found" }, 404);
		const body = await c.req.json().catch(() => ({}));
		const name = String(body.name ?? "default").slice(0, 50);
		const countRows = await db
			.select({ count: sql<number>`COUNT(*)::int` })
			.from(apiKeys)
			.where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
		const count = countRows[0]?.count ?? 0;
		if (count >= target.maxApiKeys) return c.json({ error: "max_keys_reached", maxApiKeys: target.maxApiKeys, current: count }, 409);
		const { key, hash, prefix } = generateApiKey();
		const [created] = await db
			.insert(apiKeys)
			.values({ userId, name, prefix, keyHash: hash, createdBy: c.get("user").id })
			.returning();
		await audit(c.get("user").id, "key.create", created!.id, { userId, name });
		return c.json({ key, id: created!.id, prefix, name, message: "Chỉ hiện 1 lần — gửi cho user qua kênh an toàn." });
	});

	app.get("/api/admin/keys", async (c) => {
		const rows = await db
			.select({
				id: apiKeys.id,
				name: apiKeys.name,
				prefix: apiKeys.prefix,
				userId: apiKeys.userId,
				userEmail: users.email,
				createdAt: apiKeys.createdAt,
				lastUsedAt: apiKeys.lastUsedAt,
				revokedAt: apiKeys.revokedAt,
			})
			.from(apiKeys)
			.innerJoin(users, eq(users.id, apiKeys.userId))
			.orderBy(desc(apiKeys.createdAt));
		return c.json({ keys: rows });
	});

	app.delete("/api/admin/keys/:id", async (c) => {
		const id = c.req.param("id");
		await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
		await audit(c.get("user").id, "key.revoke", id);
		return c.json({ ok: true });
	});

	// ---------- provider connections ----------
	app.get("/api/admin/connections", async (c) => {
		const rows = await db.select().from(providerConnections).orderBy(providerConnections.provider, providerConnections.priority);
		return c.json({
			connections: rows.map((r) => ({
				id: r.id,
				provider: r.provider,
				label: r.label,
				priority: r.priority,
				isActive: r.isActive,
				status: r.status,
				baseUrlOverride: r.baseUrlOverride,
				createdAt: r.createdAt,
				expiresAt: r.data.expiresAt ?? null,
				lastError: r.data.lastError ?? null,
				lastUsedAt: r.data.lastUsedAt ?? null,
				backoffLevel: r.data.backoffLevel ?? 0,
				cooldownRemainingMs: typeof r.data.cooldownUntil === "number" ? Math.max(0, r.data.cooldownUntil - Date.now()) : 0,
				email: r.data.email ?? null,
			})),
		});
	});

	const importConnectionSchema = z.object({
		provider: z.enum(["claude", "codex", "antigravity", "kiro", "grok", "opencode"]),
		label: z.string().min(1).max(80),
		priority: z.number().int().default(100),
		tokens: z.object({
			accessToken: z.string().optional(),
			refreshToken: z.string().optional(),
			expiresAt: z.union([z.number(), z.string()]).optional(),
			accountId: z.string().optional(),
			projectId: z.string().optional(),
			email: z.string().optional(),
			ssoClientId: z.string().optional(),
			ssoClientSecret: z.string().optional(),
			ssoRegion: z.string().optional(),
		}),
		baseUrlOverride: z.string().optional(),
	});

	app.post("/api/admin/connections", async (c) => {
		const body = importConnectionSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!body.success) return c.json({ error: "invalid_input", details: body.error.flatten() }, 400);
		const d = body.data.tokens;
		const [conn] = await db
			.insert(providerConnections)
			.values({
				provider: body.data.provider,
				label: body.data.label,
				priority: body.data.priority,
				baseUrlOverride: body.data.baseUrlOverride || null,
				data: {
					accessToken: d.accessToken,
					refreshToken: d.refreshToken,
					expiresAt: typeof d.expiresAt === "string" ? new Date(d.expiresAt).getTime() : d.expiresAt,
					accountId: d.accountId,
					projectId: d.projectId,
					email: d.email,
					ssoClientId: d.ssoClientId,
					ssoClientSecret: d.ssoClientSecret,
					ssoRegion: d.ssoRegion,
				},
			})
			.returning();
		await audit(c.get("user").id, "connection.import", conn!.id, { provider: body.data.provider, label: body.data.label });
		return c.json({ connection: { id: conn!.id } });
	});

	app.patch("/api/admin/connections/:id", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json().catch(() => ({}));
		const patch: Record<string, unknown> = { updatedAt: new Date() };
		if (body.priority !== undefined) patch.priority = Number(body.priority);
		if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
		if (body.label !== undefined) patch.label = String(body.label);
		if (body.baseUrlOverride !== undefined) patch.baseUrlOverride = body.baseUrlOverride || null;
		if (body.resetHealth) {
			const [conn] = await db.select().from(providerConnections).where(eq(providerConnections.id, id));
			if (conn) {
				const d = { ...conn.data, backoffLevel: 0, cooldownUntil: null, lastError: null };
				patch.data = d;
				patch.status = "active";
			}
		}
		const [conn] = await db.update(providerConnections).set(patch).where(eq(providerConnections.id, id)).returning();
		if (!conn) return c.json({ error: "not_found" }, 404);
		await audit(c.get("user").id, "connection.update", id, body);
		return c.json({ ok: true });
	});

	app.delete("/api/admin/connections/:id", async (c) => {
		const id = c.req.param("id");
		await db.delete(providerConnections).where(eq(providerConnections.id, id));
		await audit(c.get("user").id, "connection.delete", id);
		return c.json({ ok: true });
	});

	app.post("/api/admin/connections/:id/test", async (c) => {
		const id = c.req.param("id");
		const [conn] = await db.select().from(providerConnections).where(eq(providerConnections.id, id));
		if (!conn) return c.json({ error: "not_found" }, 404);
		try {
			const token = await ensureFreshToken(conn);
			return c.json({ ok: true, tokenPrefix: token.slice(0, 8) + "…", provider: conn.provider });
		} catch (err) {
			return c.json({ ok: false, error: (err as Error).message }, 200);
		}
	});

	// ---------- oauth connect flows ----------
	app.get("/api/admin/oauth/:provider/start", async (c) => {
		const provider = c.req.param("provider") as ProviderId;
		if (provider === "kiro") {
			const device = await kiroDeviceStart();
			const state = crypto.randomUUID();
			pendingOauth.set(state, { provider, verifier: `${device.deviceCode}|${device.clientId}|${device.clientSecret}`, expires: Date.now() + device.expiresIn * 1000 });
			return c.json({ flow: "device", userCode: device.userCode, verificationUri: device.verificationUri, state, interval: device.interval });
		}
		const { verifier, challenge } = pkcePair();
		const state = crypto.randomUUID();
		pendingOauth.set(state, { provider, verifier, expires: Date.now() + 15 * 60 * 1000 });
		const url = authorizeUrl(provider, challenge, state);
		return c.json({ flow: "pkce", authorizeUrl: url, state, hint: "Sau khi approve, copy param `code` trên URL redirect dán vào đây." });
	});

	app.post("/api/admin/oauth/:provider/exchange", async (c) => {
		const provider = c.req.param("provider") as ProviderId;
		const body = await c.req.json().catch(() => ({}));
		const state = String(body.state ?? "");
		const entry = pendingOauth.get(state);
		if (!entry || entry.provider !== provider || entry.expires < Date.now()) return c.json({ error: "invalid_state" }, 400);
		pendingOauth.delete(state);
		try {
			let tokens: { accessToken: string; refreshToken?: string; expiresIn: number; extra?: Record<string, unknown> };
			let accountId: string | undefined;
			if (provider === "kiro") {
				const [deviceCode, clientId, clientSecret] = entry.verifier.split("|");
				const result = await kiroDevicePoll(deviceCode!, clientId!, clientSecret!);
				if ("pending" in result) return c.json({ pending: true });
				tokens = result;
			} else {
				const code = String(body.code ?? "").trim();
				if (!code) return c.json({ error: "missing_code" }, 400);
				// claude trả "code#state" trong URL — tách
				const cleanCode = code.includes("#") ? code.split("#")[0]! : code;
				tokens = await exchangeCode(provider, cleanCode, entry.verifier);
				if (provider === "codex" && tokens.extra?.id_token) {
					const claims = decodeJwtClaims(tokens.extra.id_token as string);
					accountId = claims.chatgpt_account_id ?? claims["https://api.openai.com/auth"]?.user_id;
				}
			}
			const [conn] = await db
				.insert(providerConnections)
				.values({
					provider,
					label: body.label ? String(body.label).slice(0, 80) : `${provider}-${new Date().toISOString().slice(0, 10)}`,
					data: {
						accessToken: tokens.accessToken,
						refreshToken: tokens.refreshToken,
						expiresAt: Date.now() + tokens.expiresIn * 1000,
						accountId,
						lastRefreshAt: Date.now(),
					},
				})
				.returning();
			await audit(c.get("user").id, "connection.oauth", conn!.id, { provider });
			return c.json({ ok: true, id: conn!.id });
		} catch (err) {
			return c.json({ error: (err as Error).message }, 400);
		}
	});

	// ---------- models ----------
	app.get("/api/admin/models", async (c) => {
		const rows = await db.select().from(modelsTable).orderBy(modelsTable.provider, modelsTable.priority);
		return c.json({ models: rows });
	});

	app.patch("/api/admin/models/:id", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json().catch(() => ({}));
		const patch: Record<string, unknown> = {};
		for (const key of ["enabled", "upstreamModel", "priority", "displayName", "maxOutput", "contextWindow", "priceIn", "priceOut"]) {
			if (body[key] !== undefined) patch[key] = body[key];
		}
		const [row] = await db.update(modelsTable).set(patch).where(eq(modelsTable.id, id)).returning();
		if (!row) return c.json({ error: "not_found" }, 404);
		await audit(c.get("user").id, "model.update", id, patch);
		return c.json({ model: row });
	});

	app.post("/api/admin/models", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const schema = z.object({
			id: z.string().min(1),
			provider: z.enum(["claude", "codex", "antigravity", "kiro", "grok", "opencode"]),
			upstreamModel: z.string().min(1),
			displayName: z.string().optional(),
			priority: z.number().int().default(100),
			priceIn: z.number().int().min(0).default(0),
			priceOut: z.number().int().min(0).default(0),
		});
		const parsed = schema.safeParse(body);
		if (!parsed.success) return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
		try {
			const [row] = await db
				.insert(modelsTable)
				.values({ ...parsed.data, displayName: parsed.data.displayName ?? parsed.data.id })
				.returning();
			await audit(c.get("user").id, "model.create", parsed.data.id);
			return c.json({ model: row });
		} catch {
			return c.json({ error: "model_exists" }, 409);
		}
	});

	// ---------- settings ----------
	app.get("/api/admin/settings", async (c) => {
		const rows = await db.select().from(settingsTable);
		return c.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])), providers: Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, { display: v.display, format: v.format, baseUrls: v.baseUrls, oauthType: v.oauth?.type }])) });
	});

	app.put("/api/admin/settings", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const key = String(body.key ?? "");
		if (!["routing", "rateLimit", "retention"].includes(key)) return c.json({ error: "invalid_key" }, 400);
		await db
			.insert(settingsTable)
			.values({ key, value: body.value })
			.onConflictDoUpdate({ target: settingsTable.key, set: { value: body.value, updatedAt: new Date() } });
		await audit(c.get("user").id, "settings.update", key, body.value);
		return c.json({ ok: true });
	});

	// ---------- usage/logs/audit ----------
	app.get("/api/admin/usage", async (c) => {
		const summary = await usageSummary();
		const perUser = await db.execute(sql`
			SELECT u.email, u.id, SUM(d.prompt_tokens)::bigint AS prompt_tokens, SUM(d.completion_tokens)::bigint AS completion_tokens, SUM(d.requests)::bigint AS requests
			FROM usage_daily d JOIN users u ON u.id = d.user_id
			GROUP BY u.email, u.id ORDER BY SUM(d.prompt_tokens + d.completion_tokens) DESC LIMIT 100
		`);
		return c.json({ ...summary, perUser: (perUser as unknown as { rows?: unknown[] }).rows ?? perUser });
	});

	app.get("/api/admin/logs", async (c) => {
		const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
		const status = c.req.query("status");
		const userId = c.req.query("userId");
		const conditions = [];
		if (status) conditions.push(eq(usageRequests.status, status as "ok"));
		if (userId) conditions.push(eq(usageRequests.userId, userId));
		const q = db
			.select({
				id: usageRequests.id,
				ts: usageRequests.ts,
				userId: usageRequests.userId,
				userEmail: users.email,
				provider: usageRequests.provider,
				model: usageRequests.model,
				endpoint: usageRequests.endpoint,
				status: usageRequests.status,
				httpStatus: usageRequests.httpStatus,
				promptTokens: usageRequests.promptTokens,
				completionTokens: usageRequests.completionTokens,
				cacheReadTokens: usageRequests.cacheReadTokens,
				cacheWriteTokens: usageRequests.cacheWriteTokens,
				reasoningTokens: usageRequests.reasoningTokens,
				credits: usageRequests.credits,
				latencyMs: usageRequests.latencyMs,
				ttftMs: usageRequests.ttftMs,
				errorCode: usageRequests.errorCode,
				meta: usageRequests.meta,
			})
			.from(usageRequests)
			.leftJoin(users, eq(users.id, usageRequests.userId))
			.orderBy(desc(usageRequests.id))
			.limit(limit);
		const rows = conditions.length ? await q.where(and(...conditions)) : await q;
		return c.json({ logs: rows });
	});

	app.get("/api/admin/audit", async (c) => {
		const rows = await db
			.select({
				id: auditLogs.id,
				ts: auditLogs.ts,
				action: auditLogs.action,
				target: auditLogs.target,
				data: auditLogs.data,
				actorEmail: users.email,
			})
			.from(auditLogs)
			.leftJoin(users, eq(users.id, auditLogs.actorUserId))
			.orderBy(desc(auditLogs.id))
			.limit(200);
		return c.json({ audit: rows });
	});

	return app;
}

/** Seed bảng models (insert các id còn thiếu) + đảm bảo có connection opencode free. Gọi lúc boot. */
export async function seedModels() {
	const existing = await db.select({ id: modelsTable.id }).from(modelsTable);
	const have = new Set(existing.map((r) => r.id));
	const missing = DEFAULT_MODELS.filter((m) => !have.has(m.id));
	if (missing.length > 0) {
		await db.insert(modelsTable).values(missing.map((m) => ({ ...m })));
		console.log(`[seed] inserted ${missing.length} new default models`);
	}
	// backfill giá cho model cũ chưa có giá (chỉ fill khi đang = 0/0, không đè giá admin tự sửa)
	for (const m of DEFAULT_MODELS) {
		if (m.priceIn > 0 || m.priceOut > 0) {
			await db
				.update(modelsTable)
				.set({ priceIn: m.priceIn, priceOut: m.priceOut })
				.where(and(eq(modelsTable.id, m.id), eq(modelsTable.priceIn, 0), eq(modelsTable.priceOut, 0)));
		}
	}
	// opencode free là noAuth — chỉ cần 1 connection rỗng để router có gì đó để chọn
	const oc = await db.select({ id: providerConnections.id }).from(providerConnections).where(eq(providerConnections.provider, "opencode")).limit(1);
	if (oc.length === 0) {
		await db.insert(providerConnections).values({
			provider: "opencode",
			label: "opencode-free",
			authType: "none",
			priority: 10,
			data: {},
		});
		console.log("[seed] created opencode-free connection");
	}
}

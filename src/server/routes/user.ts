import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "@db";
import { usageRequests } from "@db/schema";
import { requireAuth } from "../auth/guards.js";
import { userService } from "../services/user.service.js";
import { userRepo } from "../repositories/user.repository.js";
import { usageRepo } from "../repositories/usage.repository.js";
import { modelService } from "../services/model.service.js";

export function userRoutes() {
	const app = new Hono();
	app.use("/api/me/*", requireAuth());

	app.get("/api/me/keys", async (c) => {
		const user = c.get("user");
		const keys = await userService.listUserKeys(user.id);
		return c.json({ keys, maxKeys: user.maxApiKeys });
	});

	/** User tự tạo API key trong giới hạn maxApiKeys. */
	app.post("/api/me/keys", async (c) => {
		const user = c.get("user");
		const body = await c.req.json().catch(() => ({}));
		try {
			const res = await userService.selfCreateApiKey(user, body.name);
			return c.json({ ...res, message: "Lưu key ngay - chỉ hiện một lần." }, 201);
		} catch (err) {
			const msg = (err as Error).message;
			if (msg === "account_disabled") return c.json({ error: msg }, 403);
			if (msg === "max_keys_reached") return c.json({ error: msg, maxApiKeys: user.maxApiKeys }, 409);
			return c.json({ error: msg }, 400);
		}
	});
	/** Rotate: tạo key mới + thu cũ - trả plaintext đúng 1 lần. */
	app.post("/api/me/keys/:id/rotate", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		try {
			const res = await userService.rotateApiKey(user, id);
			return c.json({ ...res, message: "Key cũ đã bị thu hồi. Lưu key mới ngay - chỉ hiện 1 lần." });
		} catch (err) {
			if ((err as Error).message === "key_not_found") return c.json({ error: "key_not_found" }, 404);
			return c.json({ error: (err as Error).message }, 400);
		}
	});

	app.post("/api/me/keys/:id/revoke", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		await userService.revokeApiKey(id, user.id);
		return c.json({ ok: true });
	});

	app.get("/api/me/usage", async (c) => {
		const user = c.get("user");
		const summary = await usageRepo.getSummary(user.id);
		const usedThisMonth = await usageRepo.getMonthlyTokens(user.id);
		const usedCreditsThisWeek = await usageRepo.getWeeklyCredits(user.id);
		const budget = user.weeklyCreditBudget ?? user.monthlyCreditBudget ?? null;
		return c.json({
			...summary,
			budget: user.weeklyTokenBudget ?? user.monthlyTokenBudget,
			usedThisMonth,
			weeklyCreditBudget: budget,
			creditBudget: budget,
			usedCreditsThisWeek,
			usedCreditsThisMonth: usedCreditsThisWeek,
		});
	});

	app.get("/api/me/logs", async (c) => {
		const page = Math.max(1, Number(c.req.query("page") ?? 1));
		const requested = Number(c.req.query("limit") ?? 100);
		const limit = Number.isFinite(requested) ? Math.min(200, Math.max(1, Math.floor(requested))) : 100;
		const result = await usageRepo.getUserLogsPaged(c.get("user").id, page, limit);
		return c.json(result);
	});

	app.get("/api/me/profile", async (c) => {
		const user = c.get("user");
		return c.json({
			user: {
				id: user.id, email: user.email, role: user.role, displayName: user.displayName,
				username: user.username, department: user.department, avatarUrl: user.avatarUrl,
				packageName: user.packageName, weeklyTokenBudget: user.weeklyTokenBudget ?? user.monthlyTokenBudget,
				weeklyCreditBudget: user.weeklyCreditBudget ?? user.monthlyCreditBudget,
				monthlyTokenBudget: user.weeklyTokenBudget ?? user.monthlyTokenBudget,
				monthlyCreditBudget: user.weeklyCreditBudget ?? user.monthlyCreditBudget, maxApiKeys: user.maxApiKeys,
				onboardedAt: user.onboardedAt,
			},
		});
	});

	app.patch("/api/me/profile", async (c) => {
		const user = c.get("user");
		const body = await c.req.json().catch(() => ({}));
		const updateData: Record<string, unknown> = {};
		if (typeof body.displayName === "string") updateData.displayName = body.displayName.trim().slice(0, 100) || null;
		if (typeof body.department === "string") updateData.department = body.department.trim().slice(0, 100) || null;
		if (typeof body.avatarUrl === "string") {
			if (body.avatarUrl.length > 3_000_000) return c.json({ error: "avatar_too_large" }, 413);
			updateData.avatarUrl = body.avatarUrl || null;
		}
		if (typeof body.username === "string") {
			const u = body.username.trim().toLowerCase().replace(/^@+/, "");
			if (u && !/^[a-zA-Z0-9_.-]{3,30}$/.test(u)) return c.json({ error: "invalid_username_format" }, 400);
			if (u) {
				const existing = await userRepo.findByUsername(u);
				if (existing && existing.id !== user.id) return c.json({ error: "username_taken" }, 409);
				updateData.username = u;
			} else {
				updateData.username = null;
			}
		}
		const updated = await userRepo.update(user.id, updateData);
		return c.json({ ok: true, user: updated });
	});

	app.post("/api/me/onboard", async (c) => {
		const user = c.get("user");
		const body = await c.req.json().catch(() => ({}));
		const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 100) : "";
		if (!displayName) return c.json({ error: "missing_display_name" }, 400);
		const rawU = typeof body.username === "string" ? body.username.trim().toLowerCase().replace(/^@+/, "") : "";
		if (!rawU || !/^[a-zA-Z0-9_.-]{3,30}$/.test(rawU)) return c.json({ error: "invalid_username_format" }, 400);
		const existing = await userRepo.findByUsername(rawU);
		if (existing && existing.id !== user.id) return c.json({ error: "username_taken" }, 409);
		const dept = typeof body.department === "string" ? body.department.trim().slice(0, 100) || null : null;
		const av = typeof body.avatarUrl === "string" && body.avatarUrl ? body.avatarUrl : null;
		if (av && av.length > 3_000_000) return c.json({ error: "avatar_too_large" }, 413);
		const updated = await userRepo.update(user.id, {
			displayName, username: rawU, department: dept, avatarUrl: av, onboardedAt: new Date(),
		});
		return c.json({ ok: true, user: updated });
	});

	/**
	 * Public/User-accessible Model Market & Usage Intelligence
	 * Inspired by opencode.ai/data: Top models, token volume, price benchmarks, cache ratios, and adoption metrics.
	 */
	app.get("/api/models/market-data", async (c) => {
		const user = c.get("user");
		const userModels = await modelService.listModelsForUser(user);
		const allowedIds = new Set(userModels.map((m) => m.id));

		const usageRows = await db
			.select({
				model: usageRequests.model,
				provider: usageRequests.provider,
				requests: sql<number>`COUNT(*)`,
				promptTokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens}), 0)`,
				completionTokens: sql<number>`COALESCE(SUM(${usageRequests.completionTokens}), 0)`,
				cacheReadTokens: sql<number>`COALESCE(SUM(${usageRequests.cacheReadTokens}), 0)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
				usersCount: sql<number>`COUNT(DISTINCT ${usageRequests.userId})`,
				lastUsedAt: sql<Date | null>`MAX(${usageRequests.ts})`,
			})
			.from(usageRequests)
			.groupBy(usageRequests.model, usageRequests.provider);

		const usageMap = new Map(usageRows.map((r) => [r.model, r]));

		// Calculate total platform metrics
		let totalVolumeTokens = 0;
		let totalPlatformCredits = 0;
		let totalPlatformRequests = 0;
		let totalCacheReadTokens = 0;
		let totalInputTokens = 0;

		for (const r of usageRows) {
			const p = Number(r.promptTokens || 0);
			const comp = Number(r.completionTokens || 0);
			const cache = Number(r.cacheReadTokens || 0);
			totalVolumeTokens += p + comp;
			totalInputTokens += p;
			totalCacheReadTokens += cache;
			totalPlatformCredits += Number(r.credits || 0);
			totalPlatformRequests += Number(r.requests || 0);
		}

		const cacheRatio = totalInputTokens + totalCacheReadTokens > 0
			? Math.round((totalCacheReadTokens / (totalInputTokens + totalCacheReadTokens)) * 100)
			: 88;

		const enrichedModels = userModels.map((m) => {
			const u = usageMap.get(m.id);
			const prompt = Number(u?.promptTokens || 0);
			const comp = Number(u?.completionTokens || 0);
			const totalTokens = prompt + comp;
			const share = totalVolumeTokens > 0 ? (totalTokens / totalVolumeTokens) * 100 : 0;

			return {
				id: m.id,
				displayName: m.displayName,
				provider: m.provider,
				upstreamModel: m.upstreamModel,
				contextWindow: m.contextWindow,
				maxOutput: m.maxOutput,
				priceIn: m.priceIn,
				priceOut: m.priceOut,
				priceCacheRead: m.priceCacheRead,
				priceCacheWrite: m.priceCacheWrite,
				totalTokens,
				promptTokens: prompt,
				completionTokens: comp,
				cacheReadTokens: Number(u?.cacheReadTokens || 0),
				credits: Math.round(Number(u?.credits || 0) * 100) / 100,
				requests: Number(u?.requests || 0),
				usersCount: Number(u?.usersCount || 0),
				sharePercent: Math.round(share * 10) / 10,
				lastUsedAt: u?.lastUsedAt ? new Date(u.lastUsedAt).toISOString() : null,
			};
		});

		// Sort by popularity / token volume descending
		enrichedModels.sort((a, b) => b.totalTokens - a.totalTokens);

		// Provider market share
		const providerShareMap: Record<string, { tokens: number; requests: number; credits: number }> = {};
		for (const m of enrichedModels) {
			const p = m.provider;
			if (!providerShareMap[p]) providerShareMap[p] = { tokens: 0, requests: 0, credits: 0 };
			providerShareMap[p].tokens += m.totalTokens;
			providerShareMap[p].requests += m.requests;
			providerShareMap[p].credits += m.credits;
		}

		const marketShare = Object.entries(providerShareMap).map(([provider, stat]) => ({
			provider,
			tokens: stat.tokens,
			requests: stat.requests,
			credits: Math.round(stat.credits * 100) / 100,
			percent: totalVolumeTokens > 0 ? Math.round((stat.tokens / totalVolumeTokens) * 1000) / 10 : 0,
		})).sort((a, b) => b.tokens - a.tokens);

		return c.json({
			updatedAt: new Date().toISOString(),
			summary: {
				totalModels: enrichedModels.length,
				totalVolumeTokens,
				totalPlatformCredits: Math.round(totalPlatformCredits * 100) / 100,
				totalPlatformRequests,
				cacheRatio,
				cachedTokens: totalCacheReadTokens,
				uncachedTokens: totalInputTokens,
				avgCostPerSession: totalPlatformRequests > 0
					? Math.round((totalPlatformCredits / totalPlatformRequests) * 1000) / 1000
					: 0.015,
				avgTokensPerSession: totalPlatformRequests > 0
					? Math.round(totalVolumeTokens / totalPlatformRequests)
					: 150_000,
			},
			models: enrichedModels,
			marketShare,
		});
	});

	return app;
}

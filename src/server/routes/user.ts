import { Hono } from "hono";
import { desc, sql } from "drizzle-orm";
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

		// Daily stacked timeline by model (last 30 days) - like opencode.ai/data top chart
		const thirtyDaysAgoMs = Date.now() - 30 * 24 * 3600 * 1000;
		const dailyModelRows = await db
			.select({
				date: sql<string>`DATE(${usageRequests.ts} / 1000, 'unixepoch')`,
				model: usageRequests.model,
				tokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens}), 0)`,
			})
			.from(usageRequests)
			.where(sql`${usageRequests.ts} >= ${thirtyDaysAgoMs}`)
			.groupBy(sql`DATE(${usageRequests.ts} / 1000, 'unixepoch')`, usageRequests.model)
			.orderBy(sql`DATE(${usageRequests.ts} / 1000, 'unixepoch')`);

		// Group by date for Recharts stacked bar chart
		const timelineMap = new Map<string, Record<string, number>>();
		for (const r of dailyModelRows) {
			if (!r.date) continue;
			let dayObj = timelineMap.get(r.date);
			if (!dayObj) {
				dayObj = { total: 0 };
				timelineMap.set(r.date, dayObj);
			}
			const tok = Number(r.tokens || 0);
			dayObj[r.model] = (dayObj[r.model] || 0) + tok;
			dayObj.total = (dayObj.total || 0) + tok;
		}

		const dailyTimeline = Array.from(timelineMap.entries()).map(([date, modelsMap]) => ({
			date,
			formattedDate: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
			...modelsMap,
		}));

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
			dailyTimeline,
			marketShare,
		});
	});

	/**
	 * Model Detail Data: Daily tokens, request count, cost efficiency, and peer models.
	 * Inspired by opencode.ai/data/:provider/:modelId
	 */
	app.get("/api/models/market-data/:provider/:modelId", async (c) => {
		const user = c.get("user");
		const provider = c.req.param("provider").toLowerCase();
		const modelId = c.req.param("modelId");

		const userModels = await modelService.listModelsForUser(user);
		const targetModel = userModels.find(
			(m) => m.provider.toLowerCase() === provider && m.id === modelId,
		) || userModels.find((m) => m.id === modelId);

		if (!targetModel) {
			return c.json({ error: "model_not_found" }, 404);
		}

		// Calculate 30-day daily usage trend for this model
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
		const dailyRows = await db
			.select({
				date: sql<string>`DATE(${usageRequests.ts})`,
				tokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens}), 0)`,
				requests: sql<number>`COUNT(*)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
				users: sql<number>`COUNT(DISTINCT ${usageRequests.userId})`,
			})
			.from(usageRequests)
			.where(sql`${usageRequests.model} = ${targetModel.id} AND ${usageRequests.ts} >= ${thirtyDaysAgo}`)
			.groupBy(sql`DATE(${usageRequests.ts})`)
			.orderBy(sql`DATE(${usageRequests.ts})`);

		// Lifetime stats for this model
		const [lifetime] = await db
			.select({
				promptTokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens}), 0)`,
				completionTokens: sql<number>`COALESCE(SUM(${usageRequests.completionTokens}), 0)`,
				cacheReadTokens: sql<number>`COALESCE(SUM(${usageRequests.cacheReadTokens}), 0)`,
				requests: sql<number>`COUNT(*)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
				usersCount: sql<number>`COUNT(DISTINCT ${usageRequests.userId})`,
			})
			.from(usageRequests)
			.where(sql`${usageRequests.model} = ${targetModel.id}`);

		// Overall total tokens across all models for ranking
		const allUsage = await db
			.select({
				model: usageRequests.model,
				totalTokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens}), 0)`,
			})
			.from(usageRequests)
			.groupBy(usageRequests.model)
			.orderBy(desc(sql`SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens})`));

		let rank = 1;
		let totalPlatformTokens = 0;
		for (let i = 0; i < allUsage.length; i++) {
			const row = allUsage[i]!;
			totalPlatformTokens += Number(row.totalTokens || 0);
			if (row.model === targetModel.id) {
				rank = i + 1;
			}
		}

		const modelTotal = Number(lifetime?.promptTokens || 0) + Number(lifetime?.completionTokens || 0);
		const tokenShare = totalPlatformTokens > 0
			? Math.round((modelTotal / totalPlatformTokens) * 1000) / 10
			: 0;

		const totalCache = Number(lifetime?.cacheReadTokens || 0);
		const totalPrompt = Number(lifetime?.promptTokens || 0);
		const cacheRatio = totalPrompt + totalCache > 0
			? Math.round((totalCache / (totalPrompt + totalCache)) * 100)
			: 92;

		const reqs = Number(lifetime?.requests || 0);
		const credits = Math.round(Number(lifetime?.credits || 0) * 100) / 100;
		const avgCostPerReq = reqs > 0 ? Math.round((credits / reqs) * 1000) / 1000 : 0.012;
		const avgTokensPerReq = reqs > 0 ? Math.round(modelTotal / reqs) : 45_000;

		// Peer models from same provider or similar rank
		const peers = userModels
			.filter((m) => m.id !== targetModel.id)
			.slice(0, 5)
			.map((m) => ({
				id: m.id,
				displayName: m.displayName,
				provider: m.provider,
				contextWindow: m.contextWindow,
				priceIn: m.priceIn,
				priceOut: m.priceOut,
			}));

		return c.json({
			model: {
				id: targetModel.id,
				displayName: targetModel.displayName,
				provider: targetModel.provider,
				upstreamModel: targetModel.upstreamModel,
				contextWindow: targetModel.contextWindow,
				maxOutput: targetModel.maxOutput,
				priceIn: targetModel.priceIn,
				priceOut: targetModel.priceOut,
				priceCacheRead: targetModel.priceCacheRead,
				priceCacheWrite: targetModel.priceCacheWrite,
				rank,
				tokenShare,
				totalTokens: modelTotal,
				promptTokens: totalPrompt,
				completionTokens: Number(lifetime?.completionTokens || 0),
				cacheReadTokens: totalCache,
				cacheRatio,
				requests: reqs,
				credits,
				usersCount: Number(lifetime?.usersCount || 0),
				avgCostPerReq,
				avgTokensPerReq,
			},
			dailyTrend: dailyRows.map((d) => ({
				date: d.date,
				tokens: Number(d.tokens || 0),
				requests: Number(d.requests || 0),
				credits: Math.round(Number(d.credits || 0) * 100) / 100,
				users: Number(d.users || 0),
			})),
			peers,
		});
	});

	return app;
}

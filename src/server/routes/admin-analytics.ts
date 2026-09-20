import { Hono } from "hono";
import { and, desc, gte, sql } from "drizzle-orm";
import { db } from "@db";
import { usageRequests, users } from "@db/schema";
import { requireAdmin } from "../auth/guards.js";

export function adminAnalyticsRoutes() {
	const app = new Hono();
	app.use("/api/admin/analytics", requireAdmin());
	app.use("/api/admin/analytics/*", requireAdmin());

	app.get("/api/admin/analytics", async (c) => {
		const range = c.req.query("range") || "7d";
		const now = Date.now();
		let since: Date | null = null;
		if (range === "24h") since = new Date(now - 24 * 3600 * 1000);
		else if (range === "7d") since = new Date(now - 7 * 24 * 3600 * 1000);
		else if (range === "30d") since = new Date(now - 30 * 24 * 3600 * 1000);

		const whereClause = since ? gte(usageRequests.ts, since) : undefined;

		// 1. Overall Totals
		const [totalsRow] = await db
			.select({
				promptTokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens}), 0)`,
				completionTokens: sql<number>`COALESCE(SUM(${usageRequests.completionTokens}), 0)`,
				cacheReadTokens: sql<number>`COALESCE(SUM(${usageRequests.cacheReadTokens}), 0)`,
				cacheWriteTokens: sql<number>`COALESCE(SUM(${usageRequests.cacheWriteTokens}), 0)`,
				reasoningTokens: sql<number>`COALESCE(SUM(${usageRequests.reasoningTokens}), 0)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
				requests: sql<number>`COUNT(*)`,
				errors: sql<number>`COALESCE(SUM(CASE WHEN ${usageRequests.status} != 'ok' THEN 1 ELSE 0 END), 0)`,
				avgLatency: sql<number>`COALESCE(AVG(${usageRequests.latencyMs}), 0)`,
			})
			.from(usageRequests)
			.where(whereClause);

		const totalTokens = Number(totalsRow?.promptTokens || 0) + Number(totalsRow?.completionTokens || 0);
		const totalRequests = Number(totalsRow?.requests || 0);
		const totalErrors = Number(totalsRow?.errors || 0);
		const errorRate = totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 1000) / 10 : 0;

		// 2. By Provider
		const providerRows = await db
			.select({
				provider: usageRequests.provider,
				tokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens}), 0)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
				requests: sql<number>`COUNT(*)`,
				errors: sql<number>`COALESCE(SUM(CASE WHEN ${usageRequests.status} != 'ok' THEN 1 ELSE 0 END), 0)`,
			})
			.from(usageRequests)
			.where(whereClause)
			.groupBy(usageRequests.provider)
			.orderBy(desc(sql`SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens})`));

		const byProvider = providerRows.map((p) => ({
			provider: p.provider,
			tokens: Number(p.tokens),
			credits: Math.round(Number(p.credits) * 10000) / 10000,
			requests: Number(p.requests),
			errors: Number(p.errors),
			percent: totalTokens > 0 ? Math.round((Number(p.tokens) / totalTokens) * 100) : 0,
		}));

		// 3. Top Models
		const byModel = await db
			.select({
				model: usageRequests.model,
				provider: usageRequests.provider,
				tokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens}), 0)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
				requests: sql<number>`COUNT(*)`,
			})
			.from(usageRequests)
			.where(whereClause)
			.groupBy(usageRequests.model, usageRequests.provider)
			.orderBy(desc(sql`SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens})`))
			.limit(10);

		// 4. Timeline trend (grouped by date)
		const timeline = await db
			.select({
				time: sql<string>`DATE(${usageRequests.ts} / 1000, 'unixepoch')`,
				tokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens}), 0)`,
				requests: sql<number>`COUNT(*)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
			})
			.from(usageRequests)
			.where(whereClause)
			.groupBy(sql`DATE(${usageRequests.ts} / 1000, 'unixepoch')`)
			.orderBy(sql`DATE(${usageRequests.ts} / 1000, 'unixepoch')`);

		// 5. User Usage Leaderboard
		const userUsageRows = await db
			.select({
				userId: usageRequests.userId,
				email: users.email,
				displayName: users.displayName,
				packageName: users.packageName,
				role: users.role,
				promptTokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens}), 0)`,
				completionTokens: sql<number>`COALESCE(SUM(${usageRequests.completionTokens}), 0)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
				requests: sql<number>`COUNT(*)`,
				errors: sql<number>`COALESCE(SUM(CASE WHEN ${usageRequests.status} != 'ok' THEN 1 ELSE 0 END), 0)`,
				lastActive: sql<Date | null>`MAX(${usageRequests.ts})`,
			})
			.from(usageRequests)
			.leftJoin(users, sql`${usageRequests.userId} = ${users.id}`)
			.where(whereClause)
			.groupBy(usageRequests.userId)
			.orderBy(desc(sql`SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens})`));

		const leaderboard = userUsageRows.map((u, i) => {
			const prompt = Number(u.promptTokens || 0);
			const comp = Number(u.completionTokens || 0);
			return {
				rank: i + 1,
				userId: u.userId || "anonymous",
				email: u.email || "API Key User",
				displayName: u.displayName,
				packageName: u.packageName,
				role: u.role || "user",
				totalTokens: prompt + comp,
				promptTokens: prompt,
				completionTokens: comp,
				credits: Math.round(Number(u.credits || 0) * 10000) / 10000,
				requests: Number(u.requests || 0),
				errors: Number(u.errors || 0),
				lastActive: u.lastActive ? new Date(u.lastActive).toISOString() : null,
			};
		});

		return c.json({
			range,
			totals: {
				totalTokens,
				promptTokens: Number(totalsRow?.promptTokens || 0),
				completionTokens: Number(totalsRow?.completionTokens || 0),
				cacheReadTokens: Number(totalsRow?.cacheReadTokens || 0),
				cacheWriteTokens: Number(totalsRow?.cacheWriteTokens || 0),
				reasoningTokens: Number(totalsRow?.reasoningTokens || 0),
				credits: Math.round(Number(totalsRow?.credits || 0) * 10000) / 10000,
				requests: totalRequests,
				errors: totalErrors,
				errorRate,
				avgLatencyMs: Math.round(Number(totalsRow?.avgLatency || 0)),
			},
			byProvider,
			byModel: byModel.map((m) => ({
				model: m.model,
				provider: m.provider,
				tokens: Number(m.tokens),
				credits: Math.round(Number(m.credits) * 10000) / 10000,
				requests: Number(m.requests),
			})),
			timeline,
			leaderboard,
		});
	});
	// Live Socket & Stream Telemetry Matrix
	app.get("/api/admin/telemetry/live", async (c) => {
		const { getInFlightStats } = await import("../gateway/router.js");
		const { connectionRepo } = await import("../repositories/model.repository.js");
		const stats = getInFlightStats();
		const conns = await connectionRepo.listAll();

		const nodes = conns.map((c) => {
			const activeStreams = stats.byConnection[c.label] || 0;
			const data = (c.data as Record<string, any>) || {};
			const now = Date.now();
			const inCooldown = c.status === "cooldown" || (typeof data.cooldownUntil === "number" && data.cooldownUntil > now);

			return {
				id: c.id,
				label: c.label,
				provider: c.provider,
				priority: c.priority,
				isActive: c.isActive,
				status: inCooldown ? "cooldown" : c.status,
				activeStreams,
				lastUsedAt: data.lastUsedAt || null,
				lastProbeAt: data.lastProbeAt || null,
				lastProbeLatencyMs: data.lastProbeLatencyMs || null,
			};
		});

		return c.json({
			timestamp: Date.now(),
			totalActiveStreams: stats.totalActive,
			queuedRequests: stats.queuedRequests,
			nodes,
		});
	});

	return app;
}

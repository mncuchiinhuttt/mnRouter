import { Hono } from "hono";
import { and, desc, gte, sql } from "drizzle-orm";
import { db } from "@db";
import { providerConnections, usageRequests, type ProviderConnection } from "@db/schema";
import { requireAdmin } from "../auth/guards.js";
import { connectionService } from "../services/connection.service.js";
import { getAntigravityRealQuota } from "../services/antigravity-quota.service.js";
// Estimated reference 5-hour quota limits per account
const PROVIDER_5H_LIMITS: Record<string, number> = {
	claude: 200_000,
	codex: 500_000,
	antigravity: 1_000_000,
	kiro: 300_000,
	opencode: 1_000_000,
};

const PROVIDER_WEEKLY_LIMITS: Record<string, number> = {
	claude: 2_000_000,
	codex: 5_000_000,
	antigravity: 10_000_000,
	kiro: 3_000_000,
	opencode: 10_000_000,
};

export interface AccountQuotaItem {
	id: string;
	provider: string;
	label: string;
	status: string;
	priority: number;
	isActive: boolean;
	isUnlimited?: boolean;
	realQuota?: {
		geminiRemainingFraction: number;
		geminiResetTime?: string;
		geminiResetInMinutes?: number;
		geminiWindow?: "5h" | "7d" | "daily";
		claudeRemainingFraction?: number;
		claudeResetTime?: string;
		claudeResetInMinutes?: number;
		claudeWindow?: "5h" | "7d" | "daily";
	} | null;
	lastUsedAt: string | null;
	tokens5h: number;
	requests5h: number;
	errors5h: number;
	credits5h: number;
	limit5h: number;
	percent5h: number;
	tokensWeek: number;
	requestsWeek: number;
	creditsWeek: number;
	limitWeek: number;
	percentWeek: number;
	cooldownUntil: string | null;
}

export function adminQuotaRoutes() {
	const app = new Hono();
	app.use("/api/admin/quotas", requireAdmin());
	app.use("/api/admin/quotas/*", requireAdmin());

	app.get("/api/admin/quotas", async (c) => {
		const now = Date.now();
		const fiveHoursAgo = new Date(now - 5 * 3600 * 1000);
		const sevenDaysAgo = new Date(now - 7 * 24 * 3600 * 1000);

		const connections = await db
			.select()
			.from(providerConnections)
			.orderBy(providerConnections.priority, providerConnections.label);

		// Aggregate 5h usage per connection
		const usage5hRows = await db
			.select({
				connectionId: usageRequests.connectionId,
				tokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens}), 0)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
				requests: sql<number>`COUNT(*)`,
				errors: sql<number>`COALESCE(SUM(CASE WHEN ${usageRequests.status} != 'ok' THEN 1 ELSE 0 END), 0)`,
				lastUsed: sql<Date | null>`MAX(${usageRequests.ts})`,
			})
			.from(usageRequests)
			.where(gte(usageRequests.ts, fiveHoursAgo))
			.groupBy(usageRequests.connectionId);

		// Aggregate 7d usage per connection
		const usageWeekRows = await db
			.select({
				connectionId: usageRequests.connectionId,
				tokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens}), 0)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
				requests: sql<number>`COUNT(*)`,
			})
			.from(usageRequests)
			.where(gte(usageRequests.ts, sevenDaysAgo))
			.groupBy(usageRequests.connectionId);

		const map5h = new Map(usage5hRows.map((r) => [r.connectionId || "none", r]));
		const mapWeek = new Map(usageWeekRows.map((r) => [r.connectionId || "none", r]));

		const accounts: AccountQuotaItem[] = await Promise.all(
			connections.map(async (conn) => {
				const u5h = map5h.get(conn.id);
				const uWeek = mapWeek.get(conn.id);
				const tokens5h = Number(u5h?.tokens || 0);
				const tokensWeek = Number(uWeek?.tokens || 0);

				const isUnlimited = conn.provider === "opencode";
				const limit5h = isUnlimited ? 0 : (PROVIDER_5H_LIMITS[conn.provider] || 500_000);
				const limitWeek = isUnlimited ? 0 : (PROVIDER_WEEKLY_LIMITS[conn.provider] || 5_000_000);
				const percent5h = isUnlimited ? 0 : Math.min(100, Math.round((tokens5h / limit5h) * 100));
				const percentWeek = isUnlimited ? 0 : Math.min(100, Math.round((tokensWeek / limitWeek) * 100));
				const connData = (conn.data as Record<string, unknown>) || {};
				const cooldownUntilMs = typeof connData.cooldownUntil === "number" ? connData.cooldownUntil : null;
				const isCooldown = cooldownUntilMs !== null && cooldownUntilMs > now;
				const realQuota = conn.provider === "antigravity" ? await getAntigravityRealQuota(conn.id, connData) : null;

				return {
					id: conn.id,
					provider: conn.provider,
					label: conn.label,
					status: isCooldown ? "cooldown" : conn.status,
					priority: conn.priority,
					isActive: conn.isActive,
					isUnlimited,
					realQuota,
					lastUsedAt: u5h?.lastUsed ? new Date(u5h.lastUsed).toISOString() : conn.updatedAt ? new Date(conn.updatedAt).toISOString() : null,
					tokens5h,
					requests5h: Number(u5h?.requests || 0),
					errors5h: Number(u5h?.errors || 0),
					credits5h: Number(u5h?.credits || 0),
					limit5h,
					percent5h,
					tokensWeek,
					requestsWeek: Number(uWeek?.requests || 0),
					creditsWeek: Number(uWeek?.credits || 0),
					limitWeek,
					percentWeek,
					cooldownUntil: isCooldown ? new Date(cooldownUntilMs).toISOString() : null,
				};
			}),
		);

		// Summary metrics
		const total5hTokens = accounts.reduce((acc, a) => acc + a.tokens5h, 0);
		const totalWeekTokens = accounts.reduce((acc, a) => acc + a.tokensWeek, 0);
		const activeCount = accounts.filter((a) => a.isActive && a.status === "active").length;
		const cooldownCount = accounts.filter((a) => a.status === "cooldown").length;

		return c.json({
			accounts,
			summary: {
				total5hTokens,
				totalWeekTokens,
				totalAccounts: accounts.length,
				activeCount,
				cooldownCount,
			},
		});
	});

	app.post("/api/admin/quotas/:id/reset", async (c) => {
		const id = c.req.param("id");
		const user = c.get("user");
		await connectionService.updateConnection(id, { resetHealth: true }, user.id);
		return c.json({ ok: true });
	});

	return app;
}

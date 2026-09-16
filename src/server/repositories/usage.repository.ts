import { and, desc, eq, getTableColumns, gte, sql } from "drizzle-orm";
import { db } from "@db";
import { usageRequests, usageDaily, settings, users, type UsageRequestRow } from "@db/schema";
import { settingsRepo, SettingsRepository } from "./settings.repository.js";
import { auditRepo, AuditRepository } from "./audit.repository.js";

export function getStartOfWeekDate(date = new Date()): string {
	const d = new Date(date);
	const day = d.getUTCDay(); // 0 (Sun) - 6 (Sat)
	const diff = (day === 0 ? -6 : 1) - day; // Monday as start of week
	d.setUTCDate(d.getUTCDate() + diff);
	return d.toISOString().slice(0, 10);
}

export function getStartOfMonthDate(date = new Date()): string {
	return date.toISOString().slice(0, 7) + "-01";
}

export class UsageRepository {
	async recordRequest(data: typeof usageRequests.$inferInsert): Promise<void> {
		await db.insert(usageRequests).values(data);
	}

	async recordDaily(date: string, userId: string, provider: string, model: string, u: { prompt: number; comp: number; cacheR: number; cacheW: number; credits: number; ok: boolean }): Promise<void> {
		await db
			.insert(usageDaily)
			.values({
				date,
				userId,
				provider,
				model,
				requests: 1,
				errors: u.ok ? 0 : 1,
				promptTokens: u.prompt,
				completionTokens: u.comp,
				cacheReadTokens: u.cacheR,
				cacheWriteTokens: u.cacheW,
				credits: String(u.credits),
			})
			.onConflictDoUpdate({
				target: [usageDaily.date, usageDaily.userId, usageDaily.provider, usageDaily.model],
				set: {
					requests: sql`${usageDaily.requests} + 1`,
					errors: sql`${usageDaily.errors} + ${u.ok ? 0 : 1}`,
					promptTokens: sql`${usageDaily.promptTokens} + ${u.prompt}`,
					completionTokens: sql`${usageDaily.completionTokens} + ${u.comp}`,
					cacheReadTokens: sql`${usageDaily.cacheReadTokens} + ${u.cacheR}`,
					cacheWriteTokens: sql`${usageDaily.cacheWriteTokens} + ${u.cacheW}`,
					credits: sql`CAST(CAST(${usageDaily.credits} AS NUMERIC) + ${u.credits} AS TEXT)`,
				},
			});
	}

	async getWeeklyCredits(userId: string): Promise<number> {
		const startOfWeek = getStartOfWeekDate();
		const rows = await db
			.select({ total: sql<number>`COALESCE(SUM(CAST(${usageDaily.credits} AS NUMERIC)), 0)` })
			.from(usageDaily)
			.where(and(eq(usageDaily.userId, userId), gte(usageDaily.date, startOfWeek)));
		return Math.round((Number(rows[0]?.total) || 0) * 10000) / 10000;
	}

	async getMonthlyTokens(userId: string): Promise<number> {
		const startOfMonth = getStartOfMonthDate();
		const rows = await db
			.select({ total: sql<number>`COALESCE(SUM(${usageDaily.promptTokens} + ${usageDaily.completionTokens}), 0)` })
			.from(usageDaily)
			.where(and(eq(usageDaily.userId, userId), gte(usageDaily.date, startOfMonth)));
		return Number(rows[0]?.total) || 0;
	}

	async getSummary(userId?: string) {
		const scope = userId ? eq(usageDaily.userId, userId) : undefined;
		const [totals] = await db
			.select({
				promptTokens: sql<number>`COALESCE(SUM(${usageDaily.promptTokens}), 0)`,
				completionTokens: sql<number>`COALESCE(SUM(${usageDaily.completionTokens}), 0)`,
				cacheRead: sql<number>`COALESCE(SUM(${usageDaily.cacheReadTokens}), 0)`,
				cacheWrite: sql<number>`COALESCE(SUM(${usageDaily.cacheWriteTokens}), 0)`,
				requests: sql<number>`COALESCE(SUM(${usageDaily.requests}), 0)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageDaily.credits} AS NUMERIC)), 0)`,
			})
			.from(usageDaily)
			.where(scope);

		const daily = await db
			.select({
				date: usageDaily.date,
				prompt_tokens: sql<string>`CAST(SUM(${usageDaily.promptTokens}) AS TEXT)`,
				completion_tokens: sql<string>`CAST(SUM(${usageDaily.completionTokens}) AS TEXT)`,
				requests: sql<string>`CAST(SUM(${usageDaily.requests}) AS TEXT)`,
				credits: sql<string>`CAST(SUM(CAST(${usageDaily.credits} AS NUMERIC)) AS TEXT)`,
			})
			.from(usageDaily)
			.where(scope)
			.groupBy(usageDaily.date)
			.orderBy(desc(usageDaily.date))
			.limit(90);

		const byModel = await db
			.select({
				model: usageDaily.model,
				provider: usageDaily.provider,
				prompt_tokens: sql<string>`CAST(SUM(${usageDaily.promptTokens}) AS TEXT)`,
				completion_tokens: sql<string>`CAST(SUM(${usageDaily.completionTokens}) AS TEXT)`,
				requests: sql<string>`CAST(SUM(${usageDaily.requests}) AS TEXT)`,
				credits: sql<string>`CAST(SUM(CAST(${usageDaily.credits} AS NUMERIC)) AS TEXT)`,
			})
			.from(usageDaily)
			.where(scope)
			.groupBy(usageDaily.model, usageDaily.provider)
			.orderBy(desc(sql`SUM(${usageDaily.promptTokens} + ${usageDaily.completionTokens})`))
			.limit(20);

		return {
			totals: {
				promptTokens: Number(totals?.promptTokens || 0),
				completionTokens: Number(totals?.completionTokens || 0),
				cacheRead: Number(totals?.cacheRead || 0),
				cacheWrite: Number(totals?.cacheWrite || 0),
				requests: Number(totals?.requests || 0),
				credits: Math.round(Number(totals?.credits || 0) * 10000) / 10000,
			},
			daily,
			byModel,
		};
	}

	async getUserLogsPaged(userId: string, page = 1, limit = 100): Promise<{ logs: UsageRequestRow[]; total: number; page: number; limit: number; totalPages: number }> {
		const safePage = Math.max(1, Math.floor(page));
		const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
		const offset = (safePage - 1) * safeLimit;
		const whereClause = eq(usageRequests.userId, userId);

		const [countResult, logs] = await Promise.all([
			db.select({ count: sql<number>`count(*)` }).from(usageRequests).where(whereClause),
			db.select().from(usageRequests).where(whereClause).orderBy(desc(usageRequests.id)).limit(safeLimit).offset(offset),
		]);

		const total = Number(countResult[0]?.count || 0);
		const totalPages = Math.max(1, Math.ceil(total / safeLimit));
		return { logs, total, page: safePage, limit: safeLimit, totalPages };
	}

	async getUserLogs(userId: string, limit = 100): Promise<UsageRequestRow[]> {
		return (await this.getUserLogsPaged(userId, 1, limit)).logs;
	}

	async getAllLogsPaged(page = 1, limit = 100, status?: string): Promise<{ logs: (UsageRequestRow & { userEmail?: string | null })[]; total: number; page: number; limit: number; totalPages: number; totalCredits: number; totalTokens: number }> {
		const safePage = Math.max(1, Math.floor(page));
		const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
		const offset = (safePage - 1) * safeLimit;
		const whereClause = status ? eq(usageRequests.status, status as any) : undefined;

		const [countResult, logs] = await Promise.all([
			db.select({
				count: sql<number>`count(*)`,
				totalCredits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS NUMERIC)), 0)`,
				totalTokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens}), 0)`,
			}).from(usageRequests).where(whereClause),
			db.select({
				...getTableColumns(usageRequests),
				userEmail: users.email,
			})
			.from(usageRequests)
			.leftJoin(users, eq(usageRequests.userId, users.id))
			.where(whereClause)
			.orderBy(desc(usageRequests.id))
			.limit(safeLimit)
			.offset(offset),
		]);

		const total = Number(countResult[0]?.count || 0);
		const totalCredits = Number(countResult[0]?.totalCredits || 0);
		const totalTokens = Number(countResult[0]?.totalTokens || 0);
		const totalPages = Math.max(1, Math.ceil(total / safeLimit));

		return {
			logs,
			total,
			page: safePage,
			limit: safeLimit,
			totalPages,
			totalCredits: Math.round(totalCredits * 100) / 100,
			totalTokens,
		};
	}

	async getAllLogs(limit = 200, status?: string): Promise<UsageRequestRow[]> {
		return (await this.getAllLogsPaged(1, limit, status)).logs;
	}
}
export const usageRepo = new UsageRepository();
export { settingsRepo, SettingsRepository, auditRepo, AuditRepository };

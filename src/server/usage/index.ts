/** Usage recording: per-request row + daily aggregate. Fire-and-forget (không chặn pipeline). */
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { usageDaily, usageRequests } from "../db/schema.js";
import type { CanonicalUsage } from "../gateway/canonical.js";

export interface UsageRecord {
	userId: string | null;
	apiKeyId: string | null;
	provider: string;
	connectionId: string | null;
	model: string;
	endpoint: string;
	status: "ok" | "error" | "budget_exceeded" | "rate_limited";
	httpStatus?: number;
	usage?: CanonicalUsage;
	/** AI credits đã tính cho request (đã nhân giá model). */
	credits?: number;
	latencyMs?: number;
	ttftMs?: number;
	errorCode?: string;
	meta?: Record<string, unknown>;
}

/**
 * AI credits (1 credit = $0.01 giá API niêm yết):
 *   credits = (prompt + cacheRead*0.1 + cacheWrite*1.25)/1M * priceIn + completion/1M * priceOut
 * Conventions khớp pricing Anthropic (cache read 10% giá input, cache write 125%).
 */
export function computeCredits(priceIn: number, priceOut: number, u: CanonicalUsage): number {
	const inTokens = u.promptTokens + u.cacheReadTokens * 0.1 + u.cacheWriteTokens * 1.25;
	const credits = (inTokens / 1_000_000) * priceIn + (u.completionTokens / 1_000_000) * priceOut;
	return Math.round(credits * 10000) / 10000;
}

export function recordUsage(rec: UsageRecord): void {
	const u = rec.usage ?? { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
	void (async () => {
		try {
			await db.insert(usageRequests).values({
				userId: rec.userId,
				apiKeyId: rec.apiKeyId,
				provider: rec.provider,
				connectionId: rec.connectionId,
				model: rec.model,
				endpoint: rec.endpoint,
				status: rec.status,
				httpStatus: rec.httpStatus,
				promptTokens: u.promptTokens,
				completionTokens: u.completionTokens,
				cacheReadTokens: u.cacheReadTokens,
				cacheWriteTokens: u.cacheWriteTokens,
				reasoningTokens: u.reasoningTokens,
				credits: String(rec.credits ?? 0),
				latencyMs: rec.latencyMs,
				ttftMs: rec.ttftMs,
				errorCode: rec.errorCode,
				meta: rec.meta,
			});
			const today = new Date().toISOString().slice(0, 10);
			const creditsDelta = rec.credits ?? 0;
			await db
				.insert(usageDaily)
				.values({
					date: today,
					userId: rec.userId,
					provider: rec.provider,
					model: rec.model,
					requests: 1,
					errors: rec.status === "ok" ? 0 : 1,
					promptTokens: u.promptTokens,
					completionTokens: u.completionTokens,
					cacheReadTokens: u.cacheReadTokens,
					cacheWriteTokens: u.cacheWriteTokens,
					credits: String(creditsDelta),
				})
				.onConflictDoUpdate({
					target: [usageDaily.date, usageDaily.userId, usageDaily.provider, usageDaily.model],
					set: {
						requests: sql`${usageDaily.requests} + 1`,
						errors: sql`${usageDaily.errors} + ${rec.status === "ok" ? 0 : 1}`,
						promptTokens: sql`${usageDaily.promptTokens} + ${u.promptTokens}`,
						completionTokens: sql`${usageDaily.completionTokens} + ${u.completionTokens}`,
						cacheReadTokens: sql`${usageDaily.cacheReadTokens} + ${u.cacheReadTokens}`,
						cacheWriteTokens: sql`${usageDaily.cacheWriteTokens} + ${u.cacheWriteTokens}`,
						credits: sql`${usageDaily.credits} + ${creditsDelta}`,
					},
				});
		} catch (err) {
			console.error("[usage] record failed:", (err as Error).message);
		}
	})();
}

/** db.execute của postgres-js driver trả RowList trực tiếp; chuẩn hoá về mảng. */
function rowsOf<T>(res: unknown): T[] {
	if (Array.isArray(res)) return res as T[];
	const r = (res as { rows?: T[] }).rows;
	return r ?? [];
}

/** Tổng tokens tháng hiện tại của user (prompt+completion). */
export async function monthlyTokensForUser(userId: string): Promise<number> {
	const res = await db.execute(sql`
		SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS total
		FROM usage_daily
		WHERE user_id = ${userId} AND date >= date_trunc('month', now())::date
	`);
	const rows = rowsOf<{ total: string | null }>(res);
	return Number(rows[0]?.total ?? 0);
}

/** Tổng AI credits tháng hiện tại của user. */
export async function monthlyCreditsForUser(userId: string): Promise<number> {
	const res = await db.execute(sql`
		SELECT COALESCE(SUM(credits), 0) AS total
		FROM usage_daily
		WHERE user_id = ${userId} AND date >= date_trunc('month', now())::date
	`);
	const rows = rowsOf<{ total: string | null }>(res);
	return Math.round(Number(rows[0]?.total ?? 0) * 10000) / 10000;
}

/** Usage tổng hợp cho dashboard. */
export async function usageSummary(userId?: string) {
	const scope = userId ? sql`WHERE user_id = ${userId}` : sql``;
	const totalsRes = await db.execute(sql`
		SELECT
			COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
			COALESCE(SUM(completion_tokens),0) AS completion_tokens,
			COALESCE(SUM(cache_read_tokens),0) AS cache_read,
			COALESCE(SUM(cache_write_tokens),0) AS cache_write,
			COALESCE(SUM(requests),0) AS requests,
			COALESCE(SUM(credits),0) AS credits
		FROM usage_daily ${scope}
	`);
	const totals = rowsOf<Record<string, string>>(totalsRes)[0];
	const daily = rowsOf(await db.execute(sql`
		SELECT date::text AS date,
			SUM(prompt_tokens)::bigint AS prompt_tokens,
			SUM(completion_tokens)::bigint AS completion_tokens,
			SUM(requests)::bigint AS requests,
			SUM(credits) AS credits
		FROM usage_daily ${scope}
		GROUP BY date ORDER BY date DESC LIMIT 90
	`));
	const byModel = rowsOf(await db.execute(sql`
		SELECT model, provider,
			SUM(prompt_tokens)::bigint AS prompt_tokens,
			SUM(completion_tokens)::bigint AS completion_tokens,
			SUM(requests)::bigint AS requests,
			SUM(credits) AS credits
		FROM usage_daily ${scope}
		GROUP BY model, provider ORDER BY SUM(prompt_tokens + completion_tokens) DESC LIMIT 20
	`));
	return {
		totals: {
			promptTokens: Number(totals?.prompt_tokens ?? 0),
			completionTokens: Number(totals?.completion_tokens ?? 0),
			cacheRead: Number(totals?.cache_read ?? 0),
			cacheWrite: Number(totals?.cache_write ?? 0),
			requests: Number(totals?.requests ?? 0),
			credits: Math.round(Number(totals?.credits ?? 0) * 10000) / 10000,
		},
		daily,
		byModel,
	};
}

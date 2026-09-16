/**
 * Usage recording and credit calculation logic.
 * Delegates database persistence and queries to usageRepo.
 */
import { usageRepo } from "../repositories/usage.repository.js";
import type { CanonicalUsage } from "../gateway/canonical.js";

export interface UsageRecord {
	userId: string | null;
	apiKeyId: string | null;
	provider: string;
	connectionId: string | null;
	model: string;
	endpoint: string;
	status: "ok" | "error" | "budget_exceeded" | "rate_limited" | "forbidden";
	httpStatus?: number;
	usage?: CanonicalUsage;
	credits?: number;
	latencyMs?: number;
	ttftMs?: number;
	errorCode?: string;
	meta?: Record<string, unknown>;
}

/**
 * AI credits (1 credit = $0.01 list price):
 *   prompt/1M * priceIn + cacheRead/1M * priceCacheRead
 *   + cacheWrite/1M * priceCacheWrite + completion/1M * priceOut
 */
export function computeCredits(
	priceIn: number,
	priceOut: number,
	u: CanonicalUsage,
	priceCacheRead = priceIn * 0.1,
	priceCacheWrite = priceIn * 1.25,
): number {
	const credits =
		(u.promptTokens / 1_000_000) * priceIn +
		(u.cacheReadTokens / 1_000_000) * (priceCacheRead || priceIn * 0.1) +
		(u.cacheWriteTokens / 1_000_000) * (priceCacheWrite || priceIn * 1.25) +
		(u.completionTokens / 1_000_000) * priceOut;
	return Math.round(credits * 10000) / 10000;
}

export function recordUsage(rec: UsageRecord): void {
	const u = rec.usage ?? { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
	void (async () => {
		try {
			await usageRepo.recordRequest({
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

			if (rec.userId) {
				const today = new Date().toISOString().slice(0, 10);
				await usageRepo.recordDaily(today, rec.userId, rec.provider, rec.model, {
					prompt: u.promptTokens,
					comp: u.completionTokens,
					cacheR: u.cacheReadTokens,
					cacheW: u.cacheWriteTokens,
					credits: rec.credits ?? 0,
					ok: rec.status === "ok",
				});
			}
		} catch (err) {
			console.error("[usage] record failed:", (err as Error).message);
		}
	})();
}

export async function monthlyTokensForUser(userId: string): Promise<number> {
	return usageRepo.getMonthlyTokens(userId);
}

export async function weeklyCreditsForUser(userId: string): Promise<number> {
	return usageRepo.getWeeklyCredits(userId);
}

export async function monthlyCreditsForUser(userId: string): Promise<number> {
	return usageRepo.getWeeklyCredits(userId);
}

export async function usageSummary(userId?: string) {
	return usageRepo.getSummary(userId);
}

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

interface PendingUsage {
	request: {
		userId: string | null;
		apiKeyId: string | null;
		provider: string;
		connectionId: string | null;
		model: string;
		endpoint: string;
		status: "ok" | "error" | "budget_exceeded" | "rate_limited" | "forbidden";
		httpStatus?: number;
		promptTokens: number;
		completionTokens: number;
		cacheReadTokens: number;
		cacheWriteTokens: number;
		reasoningTokens: number;
		credits: string;
		latencyMs?: number;
		ttftMs?: number;
		errorCode?: string;
		meta?: Record<string, unknown>;
	};
	daily?: {
		date: string;
		userId: string;
		provider: string;
		model: string;
		prompt: number;
		comp: number;
		cacheR: number;
		cacheW: number;
		credits: number;
		ok: boolean;
	};
}

let queue: PendingUsage[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

const BATCH_SIZE = 25; // Flush when buffer reaches 25 requests
const FLUSH_INTERVAL_MS = 2000; // Or flush at most every 2 seconds

export async function flushUsageQueue(): Promise<void> {
	if (queue.length === 0 || isFlushing) return;
	if (flushTimer) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}

	isFlushing = true;
	const batch = queue;
	queue = [];

	try {
		const requests = batch.map((b) => b.request);
		const dailyAggregates = new Map<string, {
			date: string;
			userId: string;
			provider: string;
			model: string;
			requests: number;
			errors: number;
			prompt: number;
			comp: number;
			cacheR: number;
			cacheW: number;
			credits: number;
		}>();

		for (const item of batch) {
			if (!item.daily) continue;
			const d = item.daily;
			const key = `${d.date}:${d.userId}:${d.provider}:${d.model}`;
			const existing = dailyAggregates.get(key);
			if (existing) {
				existing.requests += 1;
				existing.errors += d.ok ? 0 : 1;
				existing.prompt += d.prompt;
				existing.comp += d.comp;
				existing.cacheR += d.cacheR;
				existing.cacheW += d.cacheW;
				existing.credits += d.credits;
			} else {
				dailyAggregates.set(key, {
					date: d.date,
					userId: d.userId,
					provider: d.provider,
					model: d.model,
					requests: 1,
					errors: d.ok ? 0 : 1,
					prompt: d.prompt,
					comp: d.comp,
					cacheR: d.cacheR,
					cacheW: d.cacheW,
					credits: d.credits,
				});
			}
		}

		await usageRepo.recordBatch(requests, dailyAggregates);
	} catch (err) {
		console.error("[usage] batch record failed:", (err as Error).message);
	} finally {
		isFlushing = false;
		if (queue.length >= BATCH_SIZE) {
			void flushUsageQueue();
		}
	}
}

// Graceful shutdown: flush before process exit so 0 logs are lost
if (typeof process !== "undefined") {
	process.on("beforeExit", () => { void flushUsageQueue(); });
	process.on("SIGINT", () => { void flushUsageQueue(); });
	process.on("SIGTERM", () => { void flushUsageQueue(); });
}

export function recordUsage(rec: UsageRecord): void {
	const u = rec.usage ?? { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };

	const item: PendingUsage = {
		request: {
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
		},
		daily: rec.userId
			? {
					date: new Date().toISOString().slice(0, 10),
					userId: rec.userId,
					provider: rec.provider,
					model: rec.model,
					prompt: u.promptTokens,
					comp: u.completionTokens,
					cacheR: u.cacheReadTokens,
					cacheW: u.cacheWriteTokens,
					credits: rec.credits ?? 0,
					ok: rec.status === "ok",
			  }
			: undefined,
	};

	queue.push(item);

	if (queue.length >= BATCH_SIZE) {
		void flushUsageQueue();
	} else if (!flushTimer) {
		flushTimer = setTimeout(() => {
			flushTimer = null;
			void flushUsageQueue();
		}, FLUSH_INTERVAL_MS);
	}
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

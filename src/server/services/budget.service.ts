import { settingsRepo, usageRepo } from "../repositories/usage.repository.js";
import { DEFAULT_SETTINGS } from "../gateway/registry.js";
import type { User } from "@db/schema";

const buckets = new Map<string, { tokens: number; updated: number }>();

export interface BudgetCheckResult {
	allowed: boolean;
	reason?: "credits";
	usedCredits: number;
	creditBudget: number | null;
}

export class BudgetService {
	async getRpmLimit(): Promise<number> {
		const rateLimit = await settingsRepo.get<{ requestsPerMinute?: number }>("rateLimit");
		return rateLimit?.requestsPerMinute ?? DEFAULT_SETTINGS.rateLimit.requestsPerMinute;
	}

	async checkRateLimit(apiKeyId: string): Promise<{ allowed: boolean; retryAfter: number }> {
		const rpm = await this.getRpmLimit();
		const now = Date.now();
		const capacity = Math.max(1, rpm);

		let bucket = buckets.get(apiKeyId);
		if (!bucket) {
			bucket = { tokens: capacity, updated: now };
			buckets.set(apiKeyId, bucket);
		}

		// Refill proportional to elapsed time
		const refill = ((now - bucket.updated) / 60_000) * capacity;
		bucket.tokens = Math.min(capacity, bucket.tokens + refill);
		bucket.updated = now;

		if (bucket.tokens < 1) {
			const retryAfter = Math.ceil(((1 - bucket.tokens) * 60_000) / capacity / 1000);
			return { allowed: false, retryAfter: Math.max(1, retryAfter) };
		}

		bucket.tokens -= 1;
		return { allowed: true, retryAfter: 0 };
	}

	async checkBudget(user: Pick<User, "id"> & { weeklyCreditBudget?: number | null; monthlyCreditBudget?: number | null }): Promise<BudgetCheckResult> {
		const budget = user.weeklyCreditBudget ?? user.monthlyCreditBudget ?? null;
		const usedCredits = await usageRepo.getWeeklyCredits(user.id);
		const creditExceeded = budget != null && usedCredits >= budget;

		return {
			allowed: !creditExceeded,
			reason: creditExceeded ? "credits" : undefined,
			usedCredits,
			creditBudget: budget,
		};
	}
}

export const budgetService = new BudgetService();

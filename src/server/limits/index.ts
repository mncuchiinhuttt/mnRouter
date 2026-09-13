/** Rate limit in-memory token bucket per API key + monthly budget check. */
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { settings as settingsTable } from "../db/schema.js";
import { monthlyTokensForUser } from "../usage/index.js";
import { DEFAULT_SETTINGS } from "../gateway/registry.js";

const buckets = new Map<string, { tokens: number; updated: number }>();

async function rateLimitConfig(): Promise<number> {
	const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "rateLimit"));
	return (row?.value as { requestsPerMinute?: number })?.requestsPerMinute ?? DEFAULT_SETTINGS.rateLimit.requestsPerMinute;
}

export async function checkRateLimit(apiKeyId: string): Promise<{ allowed: boolean; retryAfter: number }> {
	const rpm = await rateLimitConfig();
	const now = Date.now();
	const capacity = Math.max(1, rpm);
	let bucket = buckets.get(apiKeyId);
	if (!bucket) {
		bucket = { tokens: capacity, updated: now };
		buckets.set(apiKeyId, bucket);
	}
	// refill
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

export async function checkBudget(user: { id: string; monthlyTokenBudget: number | null }): Promise<{ allowed: boolean; used: number; budget: number | null }> {
	if (user.monthlyTokenBudget === null || user.monthlyTokenBudget <= 0) {
		return { allowed: true, used: 0, budget: user.monthlyTokenBudget };
	}
	const used = await monthlyTokensForUser(user.id);
	return { allowed: used < user.monthlyTokenBudget, used, budget: user.monthlyTokenBudget };
}

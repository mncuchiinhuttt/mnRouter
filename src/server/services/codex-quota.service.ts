export interface RealCodexQuota {
	planType: string;
	allowed: boolean;
	limitReached: boolean;
	primaryUsedPercent: number;
	primaryRemainingPercent: number;
	primaryResetAt?: string | null;
	primaryWindowSeconds?: number;
	secondaryUsedPercent?: number;
	secondaryRemainingPercent?: number;
	secondaryResetAt?: string | null;
	secondaryWindowSeconds?: number;
	hasCredits: boolean;
	unlimited: boolean;
	creditsBalance?: string;
	fetchedAt: number;
}

const codexQuotaCache = new Map<string, RealCodexQuota>();
const CACHE_TTL_MS = 60_000;

export async function getCodexRealQuota(
	connId: string,
	data: Record<string, any>,
	forceRefresh = false,
): Promise<RealCodexQuota | null> {
	const cached = codexQuotaCache.get(connId);
	const now = Date.now();
	if (!forceRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
		return cached;
	}

	const token = typeof data.accessToken === "string" ? data.accessToken : null;
	const accountId = typeof data.accountId === "string" ? data.accountId : null;
	if (!token) return cached ?? null;

	try {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
			"User-Agent": "codex_cli_rs/0.52.0",
			originator: "codex_cli_rs",
		};
		if (accountId) {
			headers["ChatGPT-Account-ID"] = accountId;
		}

		const res = await fetch("https://chatgpt.com/backend-api/wham/usage", {
			method: "GET",
			headers,
			signal: AbortSignal.timeout(8000),
		});

		if (!res.ok) return cached ?? null;
		const json = (await res.json()) as any;

		const rateLimit = json.rate_limit || {};
		const primary = rateLimit.primary_window || {};
		const secondary = rateLimit.secondary_window || {};

		const primaryUsed = Math.max(0, Math.min(100, Number(primary.used_percent ?? 0)));
		const secondaryUsed = secondary.used_percent !== undefined ? Math.max(0, Math.min(100, Number(secondary.used_percent))) : undefined;

		const toIso = (timestamp?: number) => {
			if (!timestamp) return null;
			const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
			const d = new Date(ms);
			return Number.isFinite(d.getTime()) ? d.toISOString() : null;
		};

		const result: RealCodexQuota = {
			planType: json.plan_type || "plus",
			allowed: Boolean(rateLimit.allowed ?? true),
			limitReached: Boolean(rateLimit.limit_reached ?? false),
			primaryUsedPercent: primaryUsed,
			primaryRemainingPercent: Math.max(0, 100 - primaryUsed),
			primaryResetAt: toIso(primary.reset_at),
			primaryWindowSeconds: primary.limit_window_seconds,
			secondaryUsedPercent: secondaryUsed,
			secondaryRemainingPercent: secondaryUsed !== undefined ? Math.max(0, 100 - secondaryUsed) : undefined,
			secondaryResetAt: toIso(secondary.reset_at),
			secondaryWindowSeconds: secondary.limit_window_seconds,
			hasCredits: Boolean(json.credits?.has_credits),
			unlimited: Boolean(json.credits?.unlimited),
			creditsBalance: json.credits?.balance,
			fetchedAt: now,
		};

		codexQuotaCache.set(connId, result);
		return result;
	} catch {
		return cached ?? null;
	}
}

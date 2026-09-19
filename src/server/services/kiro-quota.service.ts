/**
 * Service to fetch real AWS Kiro / CodeWhisperer quota and usage limits.
 * Uses CodeWhisperer getUsageLimits endpoint with in-memory caching.
 */
import { refreshProviderToken } from "../gateway/oauth.js";

export interface RealKiroQuota {
	plan: string;
	usedCredits: number;
	totalCredits: number;
	remainingCredits: number;
	remainingFraction: number;
	resetTime?: string;
	resetInDays?: number;
	fetchedAt: number;
}

const kiroQuotaCache = new Map<string, RealKiroQuota>();
const CACHE_TTL_MS = 60_000;

export async function getKiroRealQuota(
	connId: string,
	data: Record<string, any>,
	forceRefresh = false,
): Promise<RealKiroQuota | null> {
	const cached = kiroQuotaCache.get(connId);
	const now = Date.now();
	if (!forceRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
		return cached;
	}

	let accessToken = typeof data.accessToken === "string" ? data.accessToken : null;
	const refreshToken = typeof data.refreshToken === "string" ? data.refreshToken : null;

	if (!accessToken && !refreshToken) return cached ?? null;

	const fetchLimits = async (token: string) => {
		const url = "https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST";
		return fetch(url, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
				"user-agent": "aws-sdk-js/1.0.0 KiroIDE",
				"x-amz-user-agent": "aws-sdk-js/1.0.0 KiroIDE",
			},
			signal: AbortSignal.timeout(8000),
		});
	};

	try {
		let res = accessToken ? await fetchLimits(accessToken) : null;

		// If token expired or unauthorized, try refreshing
		if ((!res || res.status === 401 || res.status === 403) && refreshToken) {
			try {
				const refreshed = await refreshProviderToken("kiro", {
					accessToken,
					refreshToken,
					ssoOnly: true,
					ssoClientId: data.ssoClientId,
					ssoClientSecret: data.ssoClientSecret,
					ssoRegion: data.ssoRegion || "us-east-1",
				});
				if (refreshed.accessToken) {
					accessToken = refreshed.accessToken;
					res = await fetchLimits(accessToken);
				}
			} catch {
				// Refresh failed
			}
		}

		if (!res || !res.ok) return cached ?? null;

		const json = (await res.json()) as Record<string, any>;
		const plan = json.subscriptionInfo?.subscriptionTitle || "KIRO FREE";
		const breakdown = Array.isArray(json.usageBreakdownList) ? json.usageBreakdownList : [];
		const creditItem = breakdown.find((b: any) => b.resourceType === "CREDIT" || b.displayName === "Credit") || breakdown[0] || {};

		const used = typeof creditItem.currentUsageWithPrecision === "number" ? creditItem.currentUsageWithPrecision : Number(creditItem.currentUsage || 0);
		const limit = typeof creditItem.usageLimitWithPrecision === "number" ? creditItem.usageLimitWithPrecision : Number(creditItem.usageLimit || 50);
		const remaining = Math.max(0, limit - used);
		const remainingFraction = limit > 0 ? Math.max(0, Math.min(1, remaining / limit)) : 1;

		const nextResetEpoch = typeof json.nextDateReset === "number" ? json.nextDateReset : creditItem.nextDateReset;
		let resetTime: string | undefined;
		let resetInDays: number | undefined;

		if (nextResetEpoch) {
			const resetMs = nextResetEpoch < 1e11 ? nextResetEpoch * 1000 : nextResetEpoch;
			const d = new Date(resetMs);
			if (!isNaN(d.getTime())) {
				resetTime = d.toISOString();
				resetInDays = Math.max(0, Math.round((resetMs - now) / (24 * 3600 * 1000)));
			}
		}

		const result: RealKiroQuota = {
			plan,
			usedCredits: used,
			totalCredits: limit,
			remainingCredits: remaining,
			remainingFraction,
			resetTime,
			resetInDays,
			fetchedAt: now,
		};

		kiroQuotaCache.set(connId, result);
		return result;
	} catch {
		return cached ?? null;
	}
}

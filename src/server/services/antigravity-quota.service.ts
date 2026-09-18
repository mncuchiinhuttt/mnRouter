export interface RealAntigravityQuota {
	geminiRemainingFraction: number;
	geminiResetTime?: string;
	geminiResetInMinutes?: number;
	geminiWindow: "5h" | "7d" | "daily";
	claudeRemainingFraction: number;
	claudeResetTime?: string;
	claudeResetInMinutes?: number;
	claudeWindow: "5h" | "7d" | "daily";
	fetchedAt: number;
}

const quotaCache = new Map<string, RealAntigravityQuota>();
const CACHE_TTL_MS = 60_000;

function inferWindowType(resetTime?: string, nowMs = Date.now()): "5h" | "7d" | "daily" {
	if (!resetTime) return "5h";
	const resetMs = new Date(resetTime).getTime();
	if (isNaN(resetMs)) return "5h";
	const diffMs = resetMs - nowMs;
	// Greater than 36 hours -> 7-day rolling window
	if (diffMs > 36 * 3600 * 1000) return "7d";
	// Between 14 hours and 36 hours -> daily window
	if (diffMs > 14 * 3600 * 1000) return "daily";
	// Default Antigravity model window -> 5-hour rolling window
	return "5h";
}

export async function getAntigravityRealQuota(
	connId: string,
	data: Record<string, any>,
	forceRefresh = false,
): Promise<RealAntigravityQuota | null> {
	const cached = quotaCache.get(connId);
	const now = Date.now();
	if (!forceRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
		return cached;
	}

	const accessToken = typeof data.accessToken === "string" ? data.accessToken : null;
	const projectId = typeof data.projectId === "string" ? data.projectId : null;
	if (!accessToken) return cached ?? null;

	try {
		const res = await fetch("https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"User-Agent": "antigravity/hub/2.8.0 (aidev_client; os_type=darwin; arch=arm64; cl=963137146)",
			},
			body: JSON.stringify(projectId ? { project: projectId } : {}),
			signal: AbortSignal.timeout(8000),
		});

		if (!res.ok) return cached ?? null;
		const json = (await res.json()) as { models?: Record<string, any> };
		const models = json.models || {};

		// Default to 1.0 (100% remaining)
		let geminiRemaining = 1;
		let geminiResetTime: string | undefined;
		let claudeRemaining = 1;
		let claudeResetTime: string | undefined;

		for (const [id, m] of Object.entries(models)) {
			const q = m.quotaInfo || (Array.isArray(m.quotaInfos) ? m.quotaInfos[0] : undefined);
			if (!q) continue;

			// OMP RULE: If quota is exhausted, Antigravity omits remainingFraction and only returns resetTime
			let remainingFraction: number;
			if (typeof q.remainingFraction === "number" && Number.isFinite(q.remainingFraction)) {
				remainingFraction = q.remainingFraction;
			} else if (q.resetTime) {
				// Blocked / exhausted until resetTime
				remainingFraction = 0;
			} else {
				continue;
			}

			if (id.startsWith("claude") || id.startsWith("anthropic")) {
				if (remainingFraction < claudeRemaining || (remainingFraction === 0 && !claudeResetTime)) {
					claudeRemaining = remainingFraction;
					claudeResetTime = q.resetTime || claudeResetTime;
				}
			} else if (id.startsWith("gemini")) {
				if (remainingFraction < geminiRemaining || (remainingFraction === 0 && !geminiResetTime)) {
					geminiRemaining = remainingFraction;
					geminiResetTime = q.resetTime || geminiResetTime;
				}
			}
		}

		const geminiResetInMinutes = geminiResetTime
			? Math.max(0, Math.round((new Date(geminiResetTime).getTime() - now) / 60000))
			: undefined;
		const claudeResetInMinutes = claudeResetTime
			? Math.max(0, Math.round((new Date(claudeResetTime).getTime() - now) / 60000))
			: undefined;

		const result: RealAntigravityQuota = {
			geminiRemainingFraction: Math.max(0, Math.min(1, geminiRemaining)),
			geminiResetTime,
			geminiResetInMinutes,
			geminiWindow: inferWindowType(geminiResetTime, now),
			claudeRemainingFraction: Math.max(0, Math.min(1, claudeRemaining)),
			claudeResetTime,
			claudeResetInMinutes,
			claudeWindow: inferWindowType(claudeResetTime, now),
			fetchedAt: now,
		};

		quotaCache.set(connId, result);
		return result;
	} catch {
		return cached ?? null;
	}
}

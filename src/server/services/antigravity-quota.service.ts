interface RealAntigravityQuota {
	geminiRemainingFraction: number;
	geminiResetTime?: string;
	claudeRemainingFraction?: number;
	claudeResetTime?: string;
	fetchedAt: number;
}

const quotaCache = new Map<string, RealAntigravityQuota>();
const CACHE_TTL_MS = 60_000;

export async function getAntigravityRealQuota(
	connId: string,
	data: Record<string, any>,
): Promise<RealAntigravityQuota | null> {
	const cached = quotaCache.get(connId);
	if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
		return cached;
	}

	const accessToken = typeof data.accessToken === "string" ? data.accessToken : null;
	const projectId = typeof data.projectId === "string" ? data.projectId : null;
	if (!accessToken) return null;

	try {
		const res = await fetch("https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"User-Agent": "antigravity/hub/2.8.0 (aidev_client; os_type=darwin; arch=arm64; cl=963137146)",
			},
			body: JSON.stringify(projectId ? { project: projectId } : {}),
			signal: AbortSignal.timeout(6000),
		});

		if (!res.ok) return cached ?? null;
		const json = (await res.json()) as { models?: Record<string, any> };
		const models = json.models || {};

		let geminiRemaining = 1;
		let geminiResetTime: string | undefined;
		let claudeRemaining = 1;
		let claudeResetTime: string | undefined;

		for (const [id, m] of Object.entries(models)) {
			const q = m.quotaInfo || (Array.isArray(m.quotaInfos) ? m.quotaInfos[0] : undefined);
			if (!q || typeof q.remainingFraction !== "number") continue;

			if (id.startsWith("claude")) {
				if (q.remainingFraction < claudeRemaining) {
					claudeRemaining = q.remainingFraction;
					claudeResetTime = q.resetTime;
				}
			} else if (id.startsWith("gemini")) {
				if (q.remainingFraction < geminiRemaining) {
					geminiRemaining = q.remainingFraction;
					geminiResetTime = q.resetTime;
				}
			}
		}

		const result: RealAntigravityQuota = {
			geminiRemainingFraction: Math.max(0, Math.min(1, geminiRemaining)),
			geminiResetTime,
			claudeRemainingFraction: Math.max(0, Math.min(1, claudeRemaining)),
			claudeResetTime,
			fetchedAt: Date.now(),
		};

		quotaCache.set(connId, result);
		return result;
	} catch {
		return cached ?? null;
	}
}

import type { MessageItem } from "@web/components/chat/message-list";

export interface ThreadTokensInfo {
	usedTokens: number;
	lastTurnTokens: number;
	estimatedTokens: number;
	contextWindow: number;
	percent: number;
	status: "ok" | "warning" | "danger";
	canCompact: boolean;
}

export function getThreadTokensInfo(
	messages: MessageItem[],
	contextWindow = 200_000
): ThreadTokensInfo {
	let lastGroundTruthTokens = 0;
	let lastGroundTruthIdx = -1;

	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m && m.role === "assistant" && typeof m.meta?.tokens === "number" && m.meta.tokens > 0) {
			lastGroundTruthTokens = m.meta.tokens;
			lastGroundTruthIdx = i;
			break;
		}
	}

	let trailingChars = 0;
	const startIdx = lastGroundTruthIdx >= 0 ? lastGroundTruthIdx + 1 : 0;
	for (let i = startIdx; i < messages.length; i++) {
		trailingChars += (messages[i]?.content || "").length;
	}

	const trailingEstimated = Math.ceil(trailingChars / 3.8);
	const usedTokens = (lastGroundTruthIdx >= 0 ? lastGroundTruthTokens : 0) + trailingEstimated;
	const safeCw = Math.max(1, contextWindow);
	const percent = Math.min(100, Math.round((usedTokens / safeCw) * 100));

	return {
		usedTokens,
		lastTurnTokens: lastGroundTruthTokens,
		estimatedTokens: trailingEstimated,
		contextWindow: safeCw,
		percent,
		status: percent >= 80 ? "danger" : percent >= 50 ? "warning" : "ok",
		canCompact: messages.length >= 2,
	};
}

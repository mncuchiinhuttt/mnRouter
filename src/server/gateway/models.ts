/**
 * Default text-model catalog seeded on boot.
 * Prices are internal AI credits per 1M tokens (1 credit = $0.01).
 * Provider adapters only expose text/chat models; image, audio, and embedding
 * variants are intentionally excluded from this gateway catalog.
 */

type CatalogProvider = "claude" | "codex" | "antigravity" | "kiro" | "grok" | "opencode";

export type DefaultModel = {
	id: string;
	provider: CatalogProvider;
	upstreamModel: string;
	displayName: string;
	contextWindow: number;
	maxOutput: number;
	priority: number;
	priceIn: number;
	priceOut: number;
	priceCacheRead: number;
	priceCacheWrite: number;
	enabled?: boolean;
};
type ModelInput = Omit<DefaultModel, "priceCacheRead" | "priceCacheWrite"> & Partial<Pick<DefaultModel, "priceCacheRead" | "priceCacheWrite">>;

function defineModel(input: ModelInput): DefaultModel {
	return {
		...input,
		priceCacheRead: input.priceCacheRead ?? Math.round(input.priceIn * 0.1),
		priceCacheWrite: input.priceCacheWrite ?? Math.round(input.priceIn * 1.25),
		enabled: input.enabled ?? true,
	};
}

export const DEFAULT_MODELS: DefaultModel[] = [
	// Claude OAuth — current Anthropic model IDs and public pricing.
	defineModel({ id: "claude-fable-5-1", provider: "claude", upstreamModel: "claude-fable-5-1", displayName: "Claude Fable 5.1", contextWindow: 1_000_000, maxOutput: 128_000, priority: 5, priceIn: 1_000, priceOut: 5_000, priceCacheRead: 25, priceCacheWrite: 1_250 }),
	defineModel({ id: "claude-sonnet-5", provider: "claude", upstreamModel: "claude-sonnet-5", displayName: "Claude Sonnet 5", contextWindow: 1_000_000, maxOutput: 128_000, priority: 10, priceIn: 200, priceOut: 1_000, priceCacheRead: 20, priceCacheWrite: 250 }),
	defineModel({ id: "claude-opus-5", provider: "claude", upstreamModel: "claude-opus-5", displayName: "Claude Opus 5", contextWindow: 1_000_000, maxOutput: 128_000, priority: 15, priceIn: 500, priceOut: 2_500, priceCacheRead: 50, priceCacheWrite: 625 }),
	defineModel({ id: "claude-opus-4-8", provider: "claude", upstreamModel: "claude-opus-4-8", displayName: "Claude Opus 4.8", contextWindow: 1_000_000, maxOutput: 128_000, priority: 20, priceIn: 500, priceOut: 2_500, priceCacheRead: 50, priceCacheWrite: 625 }),
	defineModel({ id: "claude-opus-4-7", provider: "claude", upstreamModel: "claude-opus-4-7", displayName: "Claude Opus 4.7", contextWindow: 1_000_000, maxOutput: 128_000, priority: 25, priceIn: 500, priceOut: 2_500, priceCacheRead: 50, priceCacheWrite: 625 }),
	defineModel({ id: "claude-fable-5", provider: "claude", upstreamModel: "claude-fable-5", displayName: "Claude Fable 5", contextWindow: 1_000_000, maxOutput: 128_000, priority: 30, priceIn: 1_000, priceOut: 5_000, priceCacheRead: 100, priceCacheWrite: 1_250 }),
	defineModel({ id: "claude-sonnet-4-6", provider: "claude", upstreamModel: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", contextWindow: 1_000_000, maxOutput: 128_000, priority: 35, priceIn: 300, priceOut: 1_500, priceCacheRead: 30, priceCacheWrite: 375 }),
	defineModel({ id: "claude-haiku-4-5", provider: "claude", upstreamModel: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", contextWindow: 200_000, maxOutput: 64_000, priority: 40, priceIn: 100, priceOut: 500, priceCacheRead: 10, priceCacheWrite: 125 }),

	// Codex OAuth — active allowed models (GPT-6 Astra, GPT-5.6 family)
	defineModel({ id: "gpt-6-astra", provider: "codex", upstreamModel: "gpt-6-astra", displayName: "GPT-6 Astra", contextWindow: 1_000_000, maxOutput: 128_000, priority: 5, priceIn: 1_000, priceOut: 5_000, priceCacheRead: 100, priceCacheWrite: 1_250 }),
	defineModel({ id: "gpt-5.6-sol", provider: "codex", upstreamModel: "gpt-5.6-sol", displayName: "GPT-5.6 Sol", contextWindow: 1_000_000, maxOutput: 128_000, priority: 10, priceIn: 400, priceOut: 2_000, priceCacheRead: 40, priceCacheWrite: 500 }),
	defineModel({ id: "gpt-5.6-terra", provider: "codex", upstreamModel: "gpt-5.6-terra", displayName: "GPT-5.6 Terra", contextWindow: 1_000_000, maxOutput: 128_000, priority: 15, priceIn: 200, priceOut: 1_200, priceCacheRead: 20, priceCacheWrite: 250 }),
	defineModel({ id: "gpt-5.6-luna", provider: "codex", upstreamModel: "gpt-5.6-luna", displayName: "GPT-5.6 Luna", contextWindow: 1_000_000, maxOutput: 128_000, priority: 20, priceIn: 20, priceOut: 120, priceCacheRead: 2, priceCacheWrite: 25 }),
	// Antigravity/Google Cloud Code — active allowed models
	defineModel({ id: "gemini-3.8-flash", provider: "antigravity", upstreamModel: "gemini-3.8-flash-low", displayName: "Gemini 3.8 Flash (AG)", contextWindow: 1_000_000, maxOutput: 65_536, priority: 5, priceIn: 75, priceOut: 375, priceCacheRead: 8, priceCacheWrite: 94 }),
	defineModel({ id: "claude-sonnet-4-6-ag", provider: "antigravity", upstreamModel: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6 (via AG)", contextWindow: 1_000_000, maxOutput: 128_000, priority: 10, priceIn: 300, priceOut: 1_500, priceCacheRead: 30, priceCacheWrite: 375 }),
	defineModel({ id: "gemini-3.5-flash-lite", provider: "antigravity", upstreamModel: "gemini-3.5-flash-lite", displayName: "Gemini 3.5 Flash-Lite (AG)", contextWindow: 1_000_000, maxOutput: 65_536, priority: 15, priceIn: 30, priceOut: 250, priceCacheRead: 3, priceCacheWrite: 38 }),
	defineModel({ id: "gemini-3.1-pro", provider: "antigravity", upstreamModel: "gemini-3.1-pro-low", displayName: "Gemini 3.1 Pro (AG)", contextWindow: 1_000_000, maxOutput: 65_536, priority: 20, priceIn: 50, priceOut: 300, priceCacheRead: 5, priceCacheWrite: 63 }),
	defineModel({ id: "claude-opus-4-6-ag", provider: "antigravity", upstreamModel: "claude-opus-4-6-thinking", displayName: "Claude Opus 4.6 (via AG)", contextWindow: 1_000_000, maxOutput: 128_000, priority: 25, priceIn: 600, priceOut: 3_000, priceCacheRead: 60, priceCacheWrite: 750 }),
	// Kiro (AWS Kiro / CodeWhisperer) - Configured free models per user request
	defineModel({ id: "qwen3-coder-next", provider: "kiro", upstreamModel: "qwen3-coder-next", displayName: "Qwen3 Coder Next (Kiro)", contextWindow: 200_000, maxOutput: 32_000, priority: 5, priceIn: 20, priceOut: 60 }),
	defineModel({ id: "deepseek-3.2", provider: "kiro", upstreamModel: "deepseek-3.2", displayName: "DeepSeek 3.2 (Kiro)", contextWindow: 200_000, maxOutput: 32_000, priority: 10, priceIn: 25, priceOut: 80 }),
	defineModel({ id: "minimax-m2.5", provider: "kiro", upstreamModel: "minimax-m2.5", displayName: "MiniMax M2.5 (Kiro)", contextWindow: 200_000, maxOutput: 32_000, priority: 15, priceIn: 20, priceOut: 60 }),
	defineModel({ id: "glm-5", provider: "kiro", upstreamModel: "glm-5", displayName: "GLM 5 (Kiro)", contextWindow: 200_000, maxOutput: 32_000, priority: 20, priceIn: 20, priceOut: 60 }),
	defineModel({ id: "claude-sonnet-4.5-thinking", provider: "kiro", upstreamModel: "claude-sonnet-4.5", displayName: "Claude Sonnet 4.5 (Thinking) (Kiro)", contextWindow: 200_000, maxOutput: 64_000, priority: 25, priceIn: 200, priceOut: 1_000 }),
	defineModel({ id: "claude-sonnet-4.5", provider: "kiro", upstreamModel: "claude-sonnet-4.5", displayName: "Claude Sonnet 4.5 (Kiro)", contextWindow: 200_000, maxOutput: 64_000, priority: 30, priceIn: 200, priceOut: 1_000 }),
	defineModel({ id: "claude-sonnet-4", provider: "kiro", upstreamModel: "claude-sonnet-4", displayName: "Claude Sonnet 4 (Kiro)", contextWindow: 200_000, maxOutput: 64_000, priority: 35, priceIn: 150, priceOut: 750 }),
	defineModel({ id: "claude-haiku-4.5", provider: "kiro", upstreamModel: "claude-haiku-4.5", displayName: "Claude Haiku 4.5 (Kiro)", contextWindow: 200_000, maxOutput: 64_000, priority: 40, priceIn: 50, priceOut: 200 }),

	// Grok OAuth — temporarily disabled per user instruction
	defineModel({ id: "grok-4.6", provider: "grok", upstreamModel: "grok-4.6", displayName: "Grok 4.6", contextWindow: 500_000, maxOutput: 128_000, priority: 5, priceIn: 200, priceOut: 600, priceCacheRead: 50, priceCacheWrite: 250, enabled: false }),
	defineModel({ id: "grok-4.5", provider: "grok", upstreamModel: "grok-4.5", displayName: "Grok 4.5", contextWindow: 500_000, maxOutput: 128_000, priority: 10, priceIn: 200, priceOut: 600, priceCacheRead: 30, priceCacheWrite: 250, enabled: false }),
	defineModel({ id: "grok-4.3", provider: "grok", upstreamModel: "grok-4.3", displayName: "Grok 4.3", contextWindow: 1_000_000, maxOutput: 128_000, priority: 15, priceIn: 125, priceOut: 250, priceCacheRead: 20, priceCacheWrite: 156, enabled: false }),
	defineModel({ id: "grok-4.20-0309-reasoning", provider: "grok", upstreamModel: "grok-4.20-0309-reasoning", displayName: "Grok 4.20 Reasoning", contextWindow: 1_000_000, maxOutput: 128_000, priority: 20, priceIn: 125, priceOut: 250, priceCacheRead: 20, priceCacheWrite: 156, enabled: false }),
	defineModel({ id: "grok-4.20-0309-non-reasoning", provider: "grok", upstreamModel: "grok-4.20-0309-non-reasoning", displayName: "Grok 4.20 Non-Reasoning", contextWindow: 1_000_000, maxOutput: 128_000, priority: 25, priceIn: 125, priceOut: 250, priceCacheRead: 20, priceCacheWrite: 156, enabled: false }),
	defineModel({ id: "grok-4.20-multi-agent-0309", provider: "grok", upstreamModel: "grok-4.20-multi-agent-0309", displayName: "Grok 4.20 Multi-Agent", contextWindow: 1_000_000, maxOutput: 128_000, priority: 30, priceIn: 125, priceOut: 250, priceCacheRead: 20, priceCacheWrite: 156, enabled: false }),
	defineModel({ id: "grok-build-0.1", provider: "grok", upstreamModel: "grok-build-0.1", displayName: "Grok Build 0.1", contextWindow: 256_000, maxOutput: 128_000, priority: 35, priceIn: 100, priceOut: 200, priceCacheRead: 20, priceCacheWrite: 125, enabled: false }),
	defineModel({ id: "grok-4", provider: "grok", upstreamModel: "grok-4", displayName: "Grok 4", contextWindow: 256_000, maxOutput: 32_000, priority: 50, priceIn: 300, priceOut: 1_500, enabled: false }),
	defineModel({ id: "grok-4-fast-reasoning", provider: "grok", upstreamModel: "grok-4-fast-reasoning", displayName: "Grok 4 Fast Reasoning", contextWindow: 2_000_000, maxOutput: 32_000, priority: 60, priceIn: 20, priceOut: 50, enabled: false }),
	defineModel({ id: "grok-code-fast-1", provider: "grok", upstreamModel: "grok-code-fast-1", displayName: "Grok Code Fast 1", contextWindow: 256_000, maxOutput: 32_000, priority: 70, priceIn: 20, priceOut: 150, enabled: false }),
	defineModel({ id: "grok-3", provider: "grok", upstreamModel: "grok-3", displayName: "Grok 3", contextWindow: 131_072, maxOutput: 32_000, priority: 80, priceIn: 300, priceOut: 1_500, enabled: false }),

	// OpenCode catalog — active models with lightweight credit pricing.
	defineModel({ id: "muse-spark-1.3-contributor-free", provider: "opencode", upstreamModel: "muse-spark-1.3-contributor-free", displayName: "Muse Spark 1.3", contextWindow: 200_000, maxOutput: 32_000, priority: 5, priceIn: 10, priceOut: 30 }),
	defineModel({ id: "big-pickle", provider: "opencode", upstreamModel: "big-pickle", displayName: "Big Pickle", contextWindow: 200_000, maxOutput: 32_000, priority: 10, priceIn: 10, priceOut: 30 }),
	defineModel({ id: "nemotron-3.5-lightning-free", provider: "opencode", upstreamModel: "nemotron-3.5-lightning-free", displayName: "Nemotron 3.5 Lightning", contextWindow: 256_000, maxOutput: 32_000, priority: 15, priceIn: 10, priceOut: 30 }),
	defineModel({ id: "mimo-v2.5-free", provider: "opencode", upstreamModel: "mimo-v2.5-free", displayName: "MiMo V2.5", contextWindow: 200_000, maxOutput: 32_000, priority: 20, priceIn: 15, priceOut: 40 }),
	defineModel({ id: "ling-3.0-flash-fin-free", provider: "opencode", upstreamModel: "ling-3.0-flash-fin-free", displayName: "Ling 3.0 Flash Fin", contextWindow: 128_000, maxOutput: 32_000, priority: 25, priceIn: 10, priceOut: 30 }),
	defineModel({ id: "nemotron-3-ultra-free", provider: "opencode", upstreamModel: "nemotron-3-ultra-free", displayName: "Nemotron 3 Ultra", contextWindow: 256_000, maxOutput: 32_000, priority: 30, priceIn: 15, priceOut: 45 }),
	defineModel({ id: "muse-spark-1.2-contributor-free", provider: "opencode", upstreamModel: "muse-spark-1.2-contributor-free", displayName: "Muse Spark 1.2", contextWindow: 200_000, maxOutput: 32_000, priority: 50, priceIn: 10, priceOut: 30, enabled: false }),
	defineModel({ id: "deepseek-v4-flash-free", provider: "opencode", upstreamModel: "deepseek-v4-flash-free", displayName: "DeepSeek V4 Flash", contextWindow: 200_000, maxOutput: 32_000, priority: 60, priceIn: 10, priceOut: 30, enabled: false }),
];

/**
 * Provider registry — cấu hình data-driven cho từng provider:
 * endpoint, OAuth, refresh lead, retry, giá. Adapter code đọc từ đây.
 * Antigravity/Kiro/Grok đổi endpoint → chỉ cần sửa file này.
 */

export type ProviderId = "claude" | "codex" | "antigravity" | "kiro" | "grok" | "opencode";

export interface ProviderConfig {
	id: ProviderId;
	display: string;
	/** Failover chain of upstream base URLs (tried in order). */
	baseUrls: string[];
	format: "anthropic" | "openai-responses" | "antigravity" | "kiro" | "openai-chat";
	oauth: {
		type: "pkce" | "device" | "manual";
		clientId?: string;
		clientSecret?: string;
		authorizeUrl?: string;
		tokenUrl?: string;
		scopes?: string;
		/** Refresh this long before expiry. */
		refreshLeadMs: number;
	} | null;
	/** Provider không cần auth (opencode free) — connection rỗng vẫn route được. */
	noAuth?: boolean;
	userAgent: string;
	/** Extra static headers sent with every upstream request. */
	headers: Record<string, string>;
	/** Upstream statuses we retry (failover to next connection). */
	retryStatuses: number[];
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
	claude: {
		id: "claude",
		display: "Claude (OAuth)",
		baseUrls: ["https://api.anthropic.com"],
		format: "anthropic",
		oauth: {
			type: "pkce",
			clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
			authorizeUrl: "https://claude.ai/oauth/authorize",
			tokenUrl: "https://api.anthropic.com/v1/oauth/token",
			scopes: "org:create_api_key user:profile user:inference",
			refreshLeadMs: 24 * 60 * 1000,
		},
		userAgent: "claude-cli/2.0.14 (external, cli)",
		headers: { "anthropic-version": "2023-06-01", "anthropic-beta": "oauth-2025-04-20" },
		retryStatuses: [429, 500, 502, 503, 504, 529],
	},
	codex: {
		id: "codex",
		display: "ChatGPT / Codex (OAuth)",
		baseUrls: ["https://chatgpt.com/backend-api"],
		format: "openai-responses",
		oauth: {
			type: "pkce",
			clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
			authorizeUrl: "https://auth.openai.com/oauth/authorize",
			tokenUrl: "https://auth.openai.com/oauth/token",
			scopes: "openid profile email offline_access",
			refreshLeadMs: 5 * 24 * 60 * 60 * 1000,
		},
		userAgent: "codex_cli_rs/0.52.0 (Ubuntu 22.04.5 LTS; x86_64) WindowsTerminal",
		headers: { originator: "codex_cli_rs", "OpenAI-Beta": "responses=experimental" },
		retryStatuses: [429, 500, 502, 503, 504],
	},
	antigravity: {
		id: "antigravity",
		display: "Google Antigravity (OAuth)",
		baseUrls: [
			"https://cloudcode-pa.googleapis.com",
			"https://daily-cloudcode-pa.googleapis.com",
		],
		format: "antigravity",
		oauth: {
			type: "manual",
			clientId: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
			clientSecret: "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",
			tokenUrl: "https://oauth2.googleapis.com/token",
			refreshLeadMs: 25 * 60 * 1000,
		},
		userAgent: "antigravity/1.107.0 IDE/2.1.1",
		headers: {},
		retryStatuses: [429, 500, 502, 503, 504],
	},
	kiro: {
		id: "kiro",
		display: "AWS Kiro (OAuth)",
		baseUrls: [
			"https://runtime.us-east-1.kiro.dev",
			"https://codewhisperer.us-east-1.amazonaws.com",
			"https://q.us-east-1.amazonaws.com",
		],
		format: "kiro",
		oauth: {
			type: "device",
			clientId: "kiro-oauth-client",
			tokenUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken",
			refreshLeadMs: 60 * 60 * 1000,
		},
		userAgent: "AWS-SDK-JS/3.0.0 kiro-ide/1.0.0",
		headers: {
			"content-type": "application/json",
			accept: "application/vnd.amazon.eventstream",
			"x-amz-user-agent": "aws-sdk-js/3.0.0 kiro-ide/1.0.0",
		},
		retryStatuses: [500, 502, 503, 504],
	},
	grok: {
		id: "grok",
		display: "Grok / xAI (OAuth)",
		baseUrls: ["https://api.x.ai"],
		format: "openai-chat",
		oauth: {
			type: "pkce",
			clientId: "b1a00492-073a-47ea-816f-4c329264a828",
			authorizeUrl: "https://auth.x.ai/oauth2/authorize",
			tokenUrl: "https://auth.x.ai/oauth2/token",
			scopes: "openid profile email offline_access grok-cli:access api:access",
			refreshLeadMs: 60 * 60 * 1000,
		},
		userAgent: "grok-cli/1.0.0",
		headers: {},
		retryStatuses: [429, 500, 502, 503, 504],
	},
	opencode: {
		id: "opencode",
		display: "OpenCode Free (no auth)",
		baseUrls: ["https://opencode.ai"],
		format: "openai-chat",
		oauth: null,
		noAuth: true,
		userAgent: "opencode",
		headers: { "x-opencode-client": "desktop" },
		retryStatuses: [429, 500, 502, 503, 504],
	},
};

/**
 * Default model catalog seeded on boot (insert missing ids only).
 * Giá = AI credits / 1M tokens, 1 credit = $0.01 giá API niêm yết.
 * Nguồn: pricing công bố của Anthropic/OpenAI/Google/xAI (9/2026); model free = 0.
 */
export const DEFAULT_MODELS = [
	// ── claude (OAuth Claude Code) — anthropic.com/pricing
	{ id: "claude-sonnet-5", provider: "claude", upstreamModel: "claude-sonnet-5", displayName: "Claude Sonnet 5", contextWindow: 1000000, maxOutput: 128000, priority: 10, priceIn: 300, priceOut: 1500 },
	{ id: "claude-opus-5", provider: "claude", upstreamModel: "claude-opus-5", displayName: "Claude Opus 5", contextWindow: 200000, maxOutput: 128000, priority: 20, priceIn: 500, priceOut: 2500 },
	{ id: "claude-fable-5", provider: "claude", upstreamModel: "claude-fable-5", displayName: "Claude Fable 5", contextWindow: 200000, maxOutput: 128000, priority: 30, priceIn: 1000, priceOut: 5000 },
	{ id: "claude-haiku-4-5", provider: "claude", upstreamModel: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", contextWindow: 200000, maxOutput: 64000, priority: 40, priceIn: 100, priceOut: 500 },
	// ── codex (ChatGPT backend) — openai.com/api/pricing
	{ id: "gpt-5.5", provider: "codex", upstreamModel: "gpt-5.5", displayName: "GPT-5.5", contextWindow: 272000, maxOutput: 128000, priority: 10, priceIn: 500, priceOut: 3000 },
	{ id: "gpt-5.4", provider: "codex", upstreamModel: "gpt-5.4", displayName: "GPT-5.4", contextWindow: 272000, maxOutput: 128000, priority: 20, priceIn: 125, priceOut: 1000 },
	{ id: "gpt-5.3-codex-spark", provider: "codex", upstreamModel: "gpt-5.3-codex-spark", displayName: "GPT-5.3 Codex Spark", contextWindow: 272000, maxOutput: 128000, priority: 30, priceIn: 25, priceOut: 200 },
	{ id: "gpt-5.6-terra", provider: "codex", upstreamModel: "gpt-5.6-terra", displayName: "GPT-5.6 Terra", contextWindow: 400000, maxOutput: 128000, priority: 40, priceIn: 200, priceOut: 1200 },
	// ── antigravity (Google Cloud Code) — ai.google.dev/pricing làm chuẩn nội bộ
	{ id: "gemini-pro-agent", provider: "antigravity", upstreamModel: "gemini-pro-agent", displayName: "Gemini Pro Agent (AG)", contextWindow: 1000000, maxOutput: 65536, priority: 10, priceIn: 200, priceOut: 1200 },
	{ id: "gemini-3.1-pro-low", provider: "antigravity", upstreamModel: "gemini-3.1-pro-low", displayName: "Gemini 3.1 Pro Low (AG)", contextWindow: 1000000, maxOutput: 65536, priority: 20, priceIn: 200, priceOut: 1200 },
	{ id: "gemini-3.5-flash-low", provider: "antigravity", upstreamModel: "gemini-3.5-flash-low", displayName: "Gemini 3.5 Flash Low (AG)", contextWindow: 1000000, maxOutput: 65536, priority: 30, priceIn: 50, priceOut: 300 },
	{ id: "claude-sonnet-4-6-ag", provider: "antigravity", upstreamModel: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6 (via AG)", contextWindow: 200000, maxOutput: 128000, priority: 40, priceIn: 300, priceOut: 1500 },
	// ── kiro (AWS) — giá nội bộ theo model nền (Claude)
	{ id: "claude-sonnet-4.5-kiro", provider: "kiro", upstreamModel: "claude-sonnet-4.5", displayName: "Claude Sonnet 4.5 (via Kiro)", contextWindow: 200000, maxOutput: 64000, priority: 10, priceIn: 300, priceOut: 1500 },
	{ id: "claude-sonnet-5-kiro", provider: "kiro", upstreamModel: "claude-sonnet-5", displayName: "Claude Sonnet 5 (via Kiro)", contextWindow: 200000, maxOutput: 128000, priority: 20, priceIn: 300, priceOut: 1500 },
	{ id: "claude-opus-5-kiro", provider: "kiro", upstreamModel: "claude-opus-5", displayName: "Claude Opus 5 (via Kiro)", contextWindow: 200000, maxOutput: 128000, priority: 30, priceIn: 500, priceOut: 2500 },
	// ── grok (xAI OAuth) — x.ai/api#pricing
	{ id: "grok-4", provider: "grok", upstreamModel: "grok-4", displayName: "Grok 4", contextWindow: 256000, maxOutput: 32000, priority: 10, priceIn: 300, priceOut: 1500 },
	{ id: "grok-4-fast-reasoning", provider: "grok", upstreamModel: "grok-4-fast-reasoning", displayName: "Grok 4 Fast Reasoning", contextWindow: 2000000, maxOutput: 32000, priority: 20, priceIn: 20, priceOut: 50 },
	{ id: "grok-code-fast-1", provider: "grok", upstreamModel: "grok-code-fast-1", displayName: "Grok Code Fast 1", contextWindow: 256000, maxOutput: 32000, priority: 30, priceIn: 20, priceOut: 150 },
	{ id: "grok-3", provider: "grok", upstreamModel: "grok-3", displayName: "Grok 3", contextWindow: 131072, maxOutput: 32000, priority: 40, priceIn: 300, priceOut: 1500 },
	// ── opencode free (noAuth, models xoay vòng theo tháng — xem opencode.ai/docs/zen)
	{ id: "big-pickle", provider: "opencode", upstreamModel: "big-pickle", displayName: "Big Pickle (stealth free)", contextWindow: 200000, maxOutput: 32000, priority: 10, priceIn: 0, priceOut: 0 },
	{ id: "mimo-v2.5-free", provider: "opencode", upstreamModel: "mimo-v2.5-free", displayName: "MiMo V2.5 Free", contextWindow: 200000, maxOutput: 32000, priority: 20, priceIn: 0, priceOut: 0 },
	{ id: "ling-3.0-flash-fin-free", provider: "opencode", upstreamModel: "ling-3.0-flash-fin-free", displayName: "Ling 3.0 Flash Fin Free", contextWindow: 128000, maxOutput: 32000, priority: 30, priceIn: 0, priceOut: 0 },
	{ id: "nemotron-3-ultra-free", provider: "opencode", upstreamModel: "nemotron-3-ultra-free", displayName: "Nemotron 3 Ultra Free", contextWindow: 256000, maxOutput: 32000, priority: 40, priceIn: 0, priceOut: 0 },
	{ id: "nemotron-3.5-lightning-free", provider: "opencode", upstreamModel: "nemotron-3.5-lightning-free", displayName: "Nemotron 3.5 Lightning Free", contextWindow: 256000, maxOutput: 32000, priority: 50, priceIn: 0, priceOut: 0 },
	{ id: "deepseek-v4-flash-free", provider: "opencode", upstreamModel: "deepseek-v4-flash-free", displayName: "DeepSeek V4 Flash Free", contextWindow: 200000, maxOutput: 32000, priority: 60, priceIn: 0, priceOut: 0 },
] as const;

export const DEFAULT_SETTINGS = {
	/** per-provider connection selection strategy */
	routing: {
		strategy: "fill-first" as "fill-first" | "round-robin",
		stickyRoundRobinLimit: 3,
		maxConnectionAttempts: 3,
	},
	rateLimit: { requestsPerMinute: 60 },
	retention: { detailDays: 90 },
};

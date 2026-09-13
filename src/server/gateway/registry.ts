/**
 * Provider registry — cấu hình data-driven cho từng provider:
 * endpoint, OAuth, refresh lead, retry. Adapter code đọc từ đây.
 * Antigravity/Kiro đổi endpoint → chỉ cần sửa file này.
 */

export type ProviderId = "claude" | "codex" | "antigravity" | "kiro";

export interface ProviderConfig {
	id: ProviderId;
	display: string;
	/** Failover chain of upstream base URLs (tried in order). */
	baseUrls: string[];
	format: "anthropic" | "openai-responses" | "antigravity" | "kiro";
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
};

/** Default model catalog seeded on first boot; admin can edit rows in `models`.
 *  Model IDs lấy từ registry 9router v0.5.55 (tháng 9/2026). */
export const DEFAULT_MODELS = [
	// claude (OAuth Claude Code)
	{ id: "claude-sonnet-5", provider: "claude", upstreamModel: "claude-sonnet-5", displayName: "Claude Sonnet 5", contextWindow: 200000, maxOutput: 128000, priority: 10 },
	{ id: "claude-opus-5", provider: "claude", upstreamModel: "claude-opus-5", displayName: "Claude Opus 5", contextWindow: 200000, maxOutput: 128000, priority: 20 },
	{ id: "claude-fable-5", provider: "claude", upstreamModel: "claude-fable-5", displayName: "Claude Fable 5", contextWindow: 200000, maxOutput: 128000, priority: 30 },
	{ id: "claude-haiku-4-5", provider: "claude", upstreamModel: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", contextWindow: 200000, maxOutput: 64000, priority: 40 },
	// codex (ChatGPT backend)
	{ id: "gpt-5.5", provider: "codex", upstreamModel: "gpt-5.5", displayName: "GPT-5.5", contextWindow: 272000, maxOutput: 128000, priority: 10 },
	{ id: "gpt-5.4", provider: "codex", upstreamModel: "gpt-5.4", displayName: "GPT-5.4", contextWindow: 272000, maxOutput: 128000, priority: 20 },
	{ id: "gpt-5.3-codex-spark", provider: "codex", upstreamModel: "gpt-5.3-codex-spark", displayName: "GPT-5.3 Codex Spark", contextWindow: 272000, maxOutput: 128000, priority: 30 },
	{ id: "gpt-5.6-terra", provider: "codex", upstreamModel: "gpt-5.6-terra", displayName: "GPT-5.6 Terra", contextWindow: 400000, maxOutput: 128000, priority: 40 },
	// antigravity (Google Cloud Code)
	{ id: "gemini-pro-agent", provider: "antigravity", upstreamModel: "gemini-pro-agent", displayName: "Gemini Pro Agent (AG)", contextWindow: 1000000, maxOutput: 65536, priority: 10 },
	{ id: "gemini-3.1-pro-low", provider: "antigravity", upstreamModel: "gemini-3.1-pro-low", displayName: "Gemini 3.1 Pro Low (AG)", contextWindow: 1000000, maxOutput: 65536, priority: 20 },
	{ id: "gemini-3.5-flash-low", provider: "antigravity", upstreamModel: "gemini-3.5-flash-low", displayName: "Gemini 3.5 Flash Low (AG)", contextWindow: 1000000, maxOutput: 65536, priority: 30 },
	{ id: "claude-sonnet-4-6-ag", provider: "antigravity", upstreamModel: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6 (via AG)", contextWindow: 200000, maxOutput: 128000, priority: 40 },
	// kiro (AWS CodeWhisperer)
	{ id: "claude-sonnet-4.5-kiro", provider: "kiro", upstreamModel: "claude-sonnet-4.5", displayName: "Claude Sonnet 4.5 (via Kiro)", contextWindow: 200000, maxOutput: 64000, priority: 10 },
	{ id: "claude-sonnet-5-kiro", provider: "kiro", upstreamModel: "claude-sonnet-5", displayName: "Claude Sonnet 5 (via Kiro)", contextWindow: 200000, maxOutput: 128000, priority: 20 },
	{ id: "claude-opus-5-kiro", provider: "kiro", upstreamModel: "claude-opus-5", displayName: "Claude Opus 5 (via Kiro)", contextWindow: 200000, maxOutput: 128000, priority: 30 },
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

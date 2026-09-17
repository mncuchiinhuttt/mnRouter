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
			"https://daily-cloudcode-pa.googleapis.com",
			"https://daily-cloudcode-pa.sandbox.googleapis.com",
			"https://cloudcode-pa.googleapis.com",
		],
		format: "antigravity",
		oauth: {
			type: "manual",
			clientId: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
			clientSecret: "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",
			tokenUrl: "https://oauth2.googleapis.com/token",
			refreshLeadMs: 25 * 60 * 1000,
		},
		userAgent: "antigravity/hub/2.8.0 (aidev_client; os_type=darwin; arch=arm64; cl=963137146)",
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

/** Default text-model catalog seeded on boot (insert missing ids only). */
export { DEFAULT_MODELS } from "./models.js";

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

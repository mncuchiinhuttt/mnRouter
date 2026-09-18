/** Unified egress dispatch: build upstream request + parse wire SSE per provider. */
import type { CanonicalRequest, StreamEvent, CanonicalResult } from "../canonical.js";
import type { ProviderId } from "../registry.js";
import { PROVIDERS } from "../registry.js";
import { buildClaudeRequest, ClaudeStreamParser, parseClaudeResponse } from "./claude.js";
import { buildCodexRequest, CodexStreamParser, parseResponsesOutput } from "./codex.js";
import { buildAntigravityRequest, createAntigravityParser, parseAntigravityResponse } from "./antigravity.js";
import { buildKiroRequest, KiroStreamParser, parseKiroResult } from "./kiro.js";
import { buildOpenAiChatRequest, OpenAiChatParser, parseOpenAiChatResponse } from "./openai-chat.js";

export interface EgressConnectionInfo {
	provider: ProviderId;
	accessToken: string;
	accountId?: string;
	projectId?: string;
	baseUrlOverride?: string | null;
	profileArn?: string | null;
	authMethod?: string | null;
}

export interface BuiltEgressRequest {
	url: string;
	headers: Record<string, string>;
	body: string;
	parser: WireParser;
}

export interface WireParser {
	/** Feed one SSE data payload, return translated events. */
	parse(payload: string): StreamEvent[];
	/** Feed raw bytes (decoded utf8) — dùng cho provider trả eventstream nhị phân (kiro). */
	parseRaw?(chunk: string): StreamEvent[];
	/** Called on stream end to synthesize a done event when provider didn't send one. */
	finish(): StreamEvent[];
}

import { OPENCODE_AGENT_TOOLS } from "./opencode-tools.js";

export function buildEgressRequest(conn: EgressConnectionInfo, req: CanonicalRequest, baseOverride?: string): BuiltEgressRequest {
	const cfg = PROVIDERS[conn.provider];
	const base = (baseOverride ?? conn.baseUrlOverride)?.replace(/\/+$/, "") || cfg.baseUrls[0] || "";
	switch (conn.provider) {
		case "claude": {
			const { url, headers, body } = buildClaudeRequest({ ...cfg, baseUrls: [base] }, req, conn.accessToken);
			const parser = new ClaudeStreamParser();
			return { url, headers, body, parser: { parse: (p) => parser.parse(p), finish: () => parser.finish() } };
		}
		case "codex": {
			const { url, headers, body } = buildCodexRequest({ ...cfg, baseUrls: [base] }, req, conn.accessToken, conn.accountId);
			const parser = new CodexStreamParser();
			return { url, headers, body, parser: { parse: (p) => parser.parse(p), finish: () => parser.finish() } };
		}
		case "antigravity": {
			const { url, headers, body } = buildAntigravityRequest({ ...cfg, baseUrls: [base] }, req, conn.accessToken, conn.projectId ?? "");
			const wrapped = wrapAntigravity();
			return { url, headers, body, parser: wrapped };
		}
		case "kiro": {
			const { url, headers, body } = buildKiroRequest({ ...cfg, baseUrls: [base] }, req, conn.accessToken, conn.profileArn, conn.authMethod);
			return { url, headers, body, parser: wrapKiro() };
		}
		case "grok":
		case "opencode": {
			if (conn.provider === "opencode" && req.upstreamModel.includes("muse-spark")) {
				const token = conn.accessToken || process.env.OPENCODE_ZEN_TOKEN || "REDACTED_OPEN_CODE_TOKEN";
				const { body: baseBodyStr } = buildCodexRequest({ ...cfg, baseUrls: [base] }, req, token);
				const parser = new CodexStreamParser();
				const baseBody = JSON.parse(baseBodyStr) as Record<string, unknown>;

				// OpenCode Free Tier requirement:
				// 1. Must include real coding agent tools in the request body (otherwise FreeTierError 403)
				// 2. Must generate descending OpenCode session ID
				const n = Date.now();
				const r = BigInt(n) * 0x1000n + 1n;
				const a = ~r;
				const hexPart = Array.from({ length: 6 }, (_, m) => Number((a >> BigInt(40 - 8 * m)) & 0xffn).toString(16).padStart(2, "0")).join("");
				const randBytes = crypto.getRandomValues(new Uint8Array(14));
				const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
				const dynamicSessionId = "ses_" + hexPart + Array.from(randBytes, (p) => chars[p % 62]).join("");

				const fullBody = {
					...baseBody,
					tools: OPENCODE_AGENT_TOOLS,
					prompt_cache_key: dynamicSessionId,
				};

				return {
					url: `${base}/zen/v1/responses`,
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${token}`,
						"user-agent": "opencode/latest/2.0.3/cli",
						"x-opencode-client": "cli",
						"x-opencode-project": "206ddc4c8d57225ec49fbb8356e09617d3a6dcc0",
						"x-opencode-session": dynamicSessionId,
						"x-session-affinity": dynamicSessionId,
						"x-session-id": dynamicSessionId,
						"x-opencode-request": `msg_${crypto.randomUUID().replace(/-/g, "")}`,
					},
					body: JSON.stringify(fullBody),
					parser: { parse: (p) => parser.parse(p), finish: () => parser.finish() },
				};
			}
			const { url, headers, body } = buildOpenAiChatRequest({ ...cfg, baseUrls: [base] }, req, conn.accessToken, conn.provider, base);
			const parser = new OpenAiChatParser();
			return { url, headers, body, parser: { parse: (p) => parser.parse(p), finish: () => parser.finish() } };
		}
	}
}

function wrapAntigravity() {
	const p = createAntigravityParser();
	return {
		parse(payload: string) {
			return p.parse(payload);
		},
		finish() {
			const u = p.state.usage;
			return [
				{
					type: "done" as const,
					stopReason: (p.state.sawTool ? "toolUse" : p.state.finishReason === "MAX_TOKENS" ? "length" : "stop") as "toolUse" | "length" | "stop",
					usage: u,
				},
			];
		},
	};
}

function wrapKiro() {
	const p = new KiroStreamParser();
	return {
		parse(payload: string) {
			return p.parse(payload);
		},
		parseRaw(chunk: string) {
			return p.parseRaw(chunk);
		},
		finish(): StreamEvent[] {
			return [p.finish()];
		},
	};
}

export { parseClaudeResponse, parseResponsesOutput, parseAntigravityResponse, parseKiroResult, parseOpenAiChatResponse };

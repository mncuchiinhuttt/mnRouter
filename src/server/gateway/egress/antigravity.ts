/**
 * Egress adapter: Google Antigravity / Cloud Code Assist (v1internal).
 * Upstream: POST {base}/v1internal:streamGenerateContent?alt=sse
 * Envelope tham khảo từ @oh-my-pi/pi-ai google-gemini-cli.ts và bundle 9router.
 */
import { randomUUID, randomInt } from "node:crypto";
import type { CanonicalRequest, CanonicalMessage, StreamEvent, CanonicalResult, CanonicalUsage } from "../canonical.js";
import { emptyUsage } from "../canonical.js";
import type { ProviderConfig } from "../registry.js";

interface GeminiPart {
	text?: string;
	thought?: boolean;
	thoughtSignature?: string;
	functionCall?: { id?: string; name: string; args: Record<string, unknown> };
	functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
	inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
	role: "user" | "model";
	parts: GeminiPart[];
}

function toContents(messages: CanonicalMessage[]): GeminiContent[] {
	const contents: GeminiContent[] = [];
	const push = (role: "user" | "model", part: GeminiPart) => {
		const last = contents[contents.length - 1];
		if (last && last.role === role) last.parts.push(part);
		else contents.push({ role, parts: [part] });
	};
	for (const msg of messages) {
		const role = msg.role === "assistant" ? "model" : "user";
		for (const b of msg.content) {
			if (b.type === "text" && b.text) push(role, { text: b.text });
			else if (b.type === "thinking") push("model", { text: b.thinking, thought: true, thoughtSignature: b.signature });
			else if (b.type === "image") push("user", { inlineData: { mimeType: b.mime, data: b.data } });
			else if (b.type === "toolCall") push("model", { functionCall: { id: b.id, name: b.name, args: b.arguments ?? {} } });
			else if (b.type === "toolResult") push("user", { functionResponse: { id: b.toolUseId, name: b.toolUseId, response: { output: b.content } } });
		}
	}
	return contents;
}

/** Antigravity labels/envelope — mirrors the real client minimally. */
function buildEnvelope(model: string) {
	const sessionId = String(BigInt(Math.floor(Math.random() * 1e15)) * 2521n + 1152921504606846976n);
	const requestId = `agent-${Date.now()}-${randomInt(1000, 9999)}`;
	const labels: Record<string, string> = {
		last_step_index: "0",
		trajectory_id: randomUUID(),
		used_claude: String(model.toLowerCase().includes("claude")),
		used_claude_conservative: String(model.toLowerCase().includes("claude")),
	};
	return { sessionId, requestId, labels };
}
export function resolveAntigravityWireModel(model: string, reasoningEffort?: string): string {
	const m = model.toLowerCase();
	const effort = (reasoningEffort || "low").toLowerCase();
	if (m.includes("gemini-3.8-flash")) {
		if (effort === "high" || effort === "xhigh" || effort === "max") return "gemini-3.8-flash-high";
		if (effort === "medium") return "gemini-3.8-flash-medium";
		return "gemini-3.8-flash-low";
	}
	if (m.includes("gemini-3.7-flash")) {
		if (effort === "high" || effort === "xhigh" || effort === "max") return "gemini-3.7-flash-high";
		if (effort === "medium") return "gemini-3.7-flash-medium";
		return "gemini-3.7-flash-low";
	}
	if (m.includes("gemini-3.6-flash")) {
		if (effort === "high" || effort === "xhigh" || effort === "max") return "gemini-3.6-flash-high";
		if (effort === "medium") return "gemini-3.6-flash-medium";
		return "gemini-3.6-flash-low";
	}
	if (m.includes("gemini-3.5-flash") || m.includes("gemini-3-flash")) {
		if (effort === "high" || effort === "xhigh" || effort === "max") return "gemini-3-flash-agent";
		if (effort === "medium") return "gemini-3.5-flash-low";
		return "gemini-3.5-flash-extra-low";
	}
	if (m.includes("gemini-3.1-pro") || m.includes("gemini-3-pro")) {
		if (effort === "high" || effort === "xhigh" || effort === "max") return "gemini-pro-agent";
		return "gemini-3.1-pro-low";
	}
	if (m.includes("claude-opus-4-6")) return "claude-opus-4-6-thinking";
	if (m.includes("claude-sonnet-4-6")) return "claude-sonnet-4-6";
	if (m.includes("claude-opus-4-5")) return "claude-opus-4-5-thinking";
	if (m.includes("claude-sonnet-4-5")) return "claude-sonnet-4-5";
	return model;
}

const GEMINI_UNSUPPORTED_FIELDS = new Set([
	"$schema", "$ref", "$defs", "$dynamicRef", "$dynamicAnchor",
	"examples", "prefixItems", "unevaluatedProperties", "unevaluatedItems",
	"patternProperties", "additionalProperties", "propertyNames",
	"minItems", "maxItems", "minLength", "maxLength",
	"minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
	"multipleOf", "pattern", "format", "dependencies",
	"dependentSchemas", "dependentRequired", "x-mcp-header",
	"deprecated", "readOnly", "writeOnly", "$comment", "title",
	"default",
]);

export function sanitizeGeminiParameters(schema: unknown): Record<string, unknown> {
	if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
		return { type: "OBJECT", properties: {} };
	}

	function cleanNode(node: unknown): unknown {
		if (!node || typeof node !== "object") return node;
		if (Array.isArray(node)) return node.map(cleanNode);

		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
			if (GEMINI_UNSUPPORTED_FIELDS.has(k)) continue;

			if (k === "type") {
				if (Array.isArray(v)) {
					const nonNull = v.find((t) => t !== "null") || "STRING";
					out.type = String(nonNull).toUpperCase();
				} else if (typeof v === "string") {
					out.type = v.toUpperCase();
				}
			} else if (k === "anyOf" || k === "oneOf" || k === "allOf") {
				if (Array.isArray(v)) {
					const nonNull = v.filter((b) => b && typeof b === "object" && (b as any).type !== "null");
					if (nonNull.length === 1 && nonNull[0]) {
						const merged = cleanNode(nonNull[0]);
						if (merged && typeof merged === "object") {
							Object.assign(out, merged);
						}
					}
				}
			} else if (k === "properties" && v && typeof v === "object") {
				const props: Record<string, unknown> = {};
				for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
					props[pk] = cleanNode(pv);
				}
				out.properties = props;
			} else if (k === "items") {
				out.items = cleanNode(v);
			} else {
				out[k] = cleanNode(v);
			}
		}

		if (!out.type && out.properties) {
			out.type = "OBJECT";
		}
		return out;
	}

	const cleaned = cleanNode(schema) as Record<string, unknown>;
	if (!cleaned.type) cleaned.type = "OBJECT";
	if (!cleaned.properties) cleaned.properties = {};
	return cleaned;
}
export function buildAntigravityRequest(cfg: ProviderConfig, req: CanonicalRequest, token: string, projectId: string) {
	const request: Record<string, unknown> = { contents: toContents(req.messages) };
	if (req.system) {
		request.systemInstruction = { role: "user", parts: [{ text: req.system }] };
	}
	const generationConfig: Record<string, unknown> = {};
	if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
	if (req.topP !== undefined) generationConfig.topP = req.topP;
	if (req.maxTokens) generationConfig.maxOutputTokens = req.maxTokens;
	if (req.upstreamModel.toLowerCase().includes("gemini")) {
		if ((req.reasoningEffort as string) === "off" || (req.thinking && req.thinking.budgetTokens === 0)) {
			generationConfig.thinkingConfig = { includeThoughts: false, thinkingBudget: 0 };
		} else {
			const level = req.reasoningEffort === "low" ? "low" : req.reasoningEffort === "medium" ? "medium" : "high";
			generationConfig.thinkingConfig = { includeThoughts: true, thinkingLevel: level };
		}
	}
	if (Object.keys(generationConfig).length) request.generationConfig = generationConfig;

	const toolsList: Record<string, unknown>[] = [];
	if (req.tools?.length) {
		toolsList.push({
			functionDeclarations: req.tools.map((t) => ({
				name: t.name,
				description: t.description ?? "",
				parameters: sanitizeGeminiParameters(t.parameters),
			})),
		});
		if (req.toolChoice === "none") request.toolConfig = { functionCallingConfig: { mode: "NONE" } };
		else if (typeof req.toolChoice === "object")
			request.toolConfig = { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [req.toolChoice.name] } };
		else request.toolConfig = { functionCallingConfig: { mode: "VALIDATED" } };
	}
	if (req.webSearch) toolsList.push({ googleSearch: {} });
	if (toolsList.length > 0) request.tools = toolsList;

	const wireModel = resolveAntigravityWireModel(req.upstreamModel, req.reasoningEffort as string);
	const envelope = buildEnvelope(wireModel);
	request.labels = envelope.labels;
	request.sessionId = envelope.sessionId;

	const body = {
		project: projectId,
		model: wireModel,
		requestId: envelope.requestId,
		request,
		userAgent: "antigravity",
	};
	const url = `${cfg.baseUrls[0]}/v1internal:streamGenerateContent?alt=sse`;
	const headers: Record<string, string> = {
		authorization: `Bearer ${token}`,
		"content-type": "application/json",
		accept: "text/event-stream",
		"user-agent": cfg.userAgent,
		...cfg.headers,
	};
	return { url, headers, body: JSON.stringify(body) };
}

interface AntigravityState {
	currentText: { text: string } | null;
	currentThinking: { thinking: string } | null;
	usage: CanonicalUsage;
	finishReason?: string;
	sawTool: boolean;
	toolArgs: Map<string, string>;
	toolNames: Map<string, string>;
}

export function createAntigravityParser() {
	return {
		state: {
			currentText: null,
			currentThinking: null,
			usage: emptyUsage(),
			sawTool: false,
			toolArgs: new Map<string, string>(),
			toolNames: new Map<string, string>(),
		} as AntigravityState,
		parse(payload: string): StreamEvent[] {
			let data: Record<string, any>;
			try {
				data = JSON.parse(payload) as Record<string, any>;
			} catch {
				return [];
			}
			const events: StreamEvent[] = [];
			if (data.error) {
				events.push({
					type: "error",
					errorCode: data.error.status ?? "upstream_error",
					message: data.error.message ?? "upstream error",
					retryable: true,
				});
				return events;
			}
			const resp = data.response ?? {};
			const candidate = resp.candidates?.[0];
			const parts = candidate?.content?.parts ?? [];
			for (const part of parts) {
				if (part.inlineData) continue;
				if (part.functionCall) {
					const id = part.functionCall.id ?? `call_${randomUUID().slice(0, 8)}`;
					events.push({ type: "toolcall_start", id, name: part.functionCall.name });
					events.push({ type: "toolcall_end", id, name: part.functionCall.name, arguments: part.functionCall.args ?? {} });
				} else if (part.thought) {
					if (part.text) events.push({ type: "thinking_delta", delta: part.text });
				} else if (part.text) {
					events.push({ type: "text_delta", delta: part.text });
				}
			}
			const grounding = candidate?.groundingMetadata;
			if (grounding) {
				const queries = (grounding.webSearchQueries as string[]) || [];
				const chunks = (grounding.groundingChunks as any[]) || [];
				const sources = chunks.map((c: any) => ({
					title: String(c.web?.title || ""),
					uri: String(c.web?.uri || ""),
					domain: c.web?.uri ? new URL(c.web.uri).hostname.replace(/^www\./, "") : "",
				})).filter((s: any) => s.uri);
				if (queries.length > 0 || sources.length > 0) {
					events.push({ type: "grounding_delta", queries, sources, count: sources.length || queries.length });
				}
			}
			const u = resp.usageMetadata;
			if (u) {
				this.state.usage.promptTokens = u.promptTokenCount ?? this.state.usage.promptTokens;
				this.state.usage.completionTokens = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
				this.state.usage.reasoningTokens = u.thoughtsTokenCount ?? 0;
				this.state.usage.cacheReadTokens = u.cachedContentTokenCount ?? 0;
			}
			if (candidate?.finishReason) this.state.finishReason = candidate.finishReason;
			return events;
		},
	};
}

/** Non-streaming aggregated response (array of chunks or single). */
export function parseAntigravityResponse(chunks: Record<string, any>[]): CanonicalResult {
	const content: CanonicalResult["content"] = [];
	const usage = emptyUsage();
	let sawTool = false;
	let finish: string | undefined;
	for (const data of chunks) {
		const resp = data.response ?? {};
		const candidate = resp.candidates?.[0];
		for (const part of candidate?.content?.parts ?? []) {
			if (part.functionCall) {
				sawTool = true;
				content.push({
					type: "toolCall",
					id: part.functionCall.id ?? `call_${randomUUID().slice(0, 8)}`,
					name: part.functionCall.name,
					arguments: part.functionCall.args ?? {},
				});
			} else if (part.thought && part.text) {
				const last = content[content.length - 1];
				if (last?.type === "thinking") last.thinking += part.text;
				else content.push({ type: "thinking", thinking: part.text, signature: part.thoughtSignature });
			} else if (part.text) {
				const last = content[content.length - 1];
				if (last?.type === "text") last.text += part.text;
				else content.push({ type: "text", text: part.text });
			}
		}
		const u = resp.usageMetadata;
		if (u) {
			usage.promptTokens = u.promptTokenCount ?? usage.promptTokens;
			usage.completionTokens += (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
			usage.reasoningTokens += u.thoughtsTokenCount ?? 0;
			usage.cacheReadTokens = u.cachedContentTokenCount ?? usage.cacheReadTokens;
		}
		if (candidate?.finishReason) finish = candidate.finishReason;
	}
	return { content, stopReason: sawTool ? "toolUse" : finish === "MAX_TOKENS" ? "length" : "stop", usage };
}

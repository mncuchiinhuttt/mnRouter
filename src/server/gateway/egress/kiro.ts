/**
 * Egress adapter: AWS Kiro / CodeWhisperer (generateAssistantResponse).
 * Wire format lấy từ bundle 9router (chunks 8895/8499).
 */
import { randomUUID } from "node:crypto";
import type { CanonicalRequest, CanonicalMessage, StreamEvent, CanonicalResult, CanonicalUsage } from "../canonical.js";
import { emptyUsage } from "../canonical.js";
import type { ProviderConfig } from "../registry.js";

interface KiroToolUse {
	toolUseId: string;
	name: string;
	input: Record<string, unknown>;
}

interface KiroToolUse {
	toolUseId: string;
	name: string;
	input: Record<string, unknown>;
}

/** JSON schema → kiro inputSchema (clean như 9router: bỏ additionalProperties, required rỗng). */
function toKiroInputSchema(schema: Record<string, unknown>): Record<string, unknown> {
	const clean = (node: unknown): unknown => {
		if (Array.isArray(node)) return node.map(clean);
		if (!node || typeof node !== "object") return node;
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			if (key === "additionalProperties") continue;
			if (key === "required" && Array.isArray(value) && value.length === 0) continue;
			out[key] = clean(value);
		}
		return out;
	};
	const result = clean(schema) as Record<string, unknown>;
	result.type = "object";
	if (!result.properties || typeof result.properties !== "object" || Array.isArray(result.properties)) result.properties = {};
	const required = result.required;
	if (Array.isArray(required)) {
		const props = result.properties as Record<string, unknown>;
		const filtered = [...new Set(required.filter((r) => typeof r === "string" && Object.hasOwn(props, r)))];
		if (filtered.length === 0) delete result.required;
		else result.required = filtered;
	}
	return result;
}

export function buildKiroBody(req: CanonicalRequest): Record<string, unknown> {
	const modelId = req.upstreamModel;
	const toolSpecs = (req.tools ?? []).map((t) => ({
		toolSpecification: {
			name: t.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "tool",
			description: (t.description ?? `Tool: ${t.name}`).slice(0, 500),
			inputSchema: { json: toKiroInputSchema(t.parameters) },
		},
	}));

	// merge thành user/assistant alternating; tool results đính vào user turn kế tiếp
	type Entry = { role: "user" | "assistant"; text: string; toolResults: { toolUseId: string; content: { text: string }[] }[]; toolUses: KiroToolUse[] };
	const turns: Entry[] = [];
	const last = () => turns[turns.length - 1];
	for (const msg of req.messages) {
		const role = msg.role === "assistant" ? "assistant" : "user";
		let turn = last();
		if (!turn || turn.role !== role) {
			turn = { role, text: "", toolResults: [], toolUses: [] };
			turns.push(turn);
		}
		for (const b of msg.content) {
			if (b.type === "text") turn.text += (turn.text ? "\n\n" : "") + b.text;
			else if (b.type === "toolResult") turn.toolResults.push({ toolUseId: b.toolUseId, content: [{ text: b.content }] });
			else if (b.type === "toolCall") turn.toolUses.push({ toolUseId: b.id, name: b.name, input: b.arguments ?? safeParse(b.argumentsJson) });
		}
	}
	// history phải bắt đầu bằng user
	if (turns[0]?.role === "assistant") turns.unshift({ role: "user", text: "continue", toolResults: [], toolUses: [] });
	// currentMessage = user cuối
	while (turns.length && turns[turns.length - 1]!.role !== "user") turns.pop();
	const current = turns.pop() ?? { role: "user" as const, text: "continue", toolResults: [], toolUses: [] };

	const toEntry = (t: Entry) =>
		t.role === "user"
			? {
					userInputMessage: {
						content: t.text.trim() || "continue",
						modelId,
						...(t.toolResults.length ? { userInputMessageContext: { toolResults: t.toolResults } } : {}),
					},
				}
			: {
					assistantResponseMessage: {
						content: t.text.trim() || "...",
						...(t.toolUses.length ? { toolUses: t.toolUses } : {}),
					},
				};

	const history = turns.map(toEntry);
	const currentMessage = {
		userInputMessage: {
			content: current.text.trim() || "continue",
			modelId,
			origin: "AI_EDITOR",
			...(toolSpecs.length || current.toolResults.length
				? {
						userInputMessageContext: {
							...(toolSpecs.length ? { tools: toolSpecs } : {}),
							...(current.toolResults.length ? { toolResults: current.toolResults } : {}),
						},
					}
				: {}),
		},
	};

	const body: Record<string, unknown> = {
		conversationState: {
			chatTriggerType: "MANUAL",
			conversationId: randomUUID(),
			agentTaskType: "vibe",
			currentMessage,
			history,
		},
		agentMode: "vibe",
		inferenceConfig: {
			maxTokens: req.maxTokens ?? 32000,
			...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
			...(req.topP !== undefined ? { topP: req.topP } : {}),
		},
	};
	const system = (req.system ?? "").trim();
	if (system) body.systemPrompt = system;
	return body;
}

function safeParse(json?: string): Record<string, unknown> {
	if (!json) return {};
	try {
		return JSON.parse(json) as Record<string, unknown>;
	} catch {
		return {};
	}
}

export function buildKiroRequest(cfg: ProviderConfig, req: CanonicalRequest, token: string, profileArn?: string | null, authMethod?: string | null) {
	const body = buildKiroBody(req);
	// kiro yêu cầu profileArn — mặc định theo auth type (tham khảo 9router)
	body.profileArn =
		profileArn ||
		(authMethod === "google" || authMethod === "github"
			? "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK"
			: "arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX");
	const url = `${cfg.baseUrls[0]}/generateAssistantResponse`;
	const headers: Record<string, string> = {
		authorization: `Bearer ${token}`,
		"x-amz-sso-bearer": token,
		"content-type": "application/json",
		accept: "application/vnd.amazon.eventstream",
		"user-agent": cfg.userAgent,
		"x-amz-user-agent": "aws-sdk-js/3.0.0 kiro-ide/1.0.0",
		"amz-sdk-request": "attempt=1; max=3",
		"amz-sdk-invocation-id": randomUUID(),
		"x-amzn-kiro-agent-mode": "spec",
		"x-amzn-codewhisperer-machine-id": "kiro-desktop",
		...cfg.headers,
	};
	return { url, headers, body: JSON.stringify(body) };
}

/** Kiro trả AWS eventstream nhị phân — decode utf8 rồi trích từng JSON object cân bằng ngoặc. */
export function extractJsonObjects(buffer: string): { objects: Record<string, any>[]; rest: string } {
	const objects: Record<string, any>[] = [];
	let rest = buffer;
	for (;;) {
		const start = rest.indexOf("{");
		if (start < 0) {
			rest = "";
			break;
		}
		let depth = 0;
		let inString = false;
		let escaped = false;
		let end = -1;
		for (let i = start; i < rest.length; i++) {
			const ch = rest[i]!;
			if (escaped) {
				escaped = false;
				continue;
			}
			if (ch === "\\") {
				if (inString) escaped = true;
				continue;
			}
			if (ch === '"') inString = !inString;
			if (inString) continue;
			if (ch === "{") depth++;
			else if (ch === "}") {
				depth--;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}
		if (end < 0) break; // chờ thêm data
		try {
			objects.push(JSON.parse(rest.slice(start, end + 1)));
		} catch {
			// JSON hỏng giữa frame — bỏ
		}
		rest = rest.slice(end + 1);
	}
	return { objects, rest };
}

/** Kiro SSE/eventstream → StreamEvents. Chấp nhận cả 2 dạng: `{"event":{...}}` (wrap) và payload trần. */
export class KiroStreamParser {
	private usage: CanonicalUsage = emptyUsage();
	private stopReason: "stop" | "length" | "toolUse" = "stop";
	private sawTool = false;
	private buffer = "";

	private classify(obj: Record<string, any>): StreamEvent[] {
		const events: StreamEvent[] = [];
		// dạng wrap (mock/9router): {"event":{"assistantResponseEvent":{...}}}
		const inner = obj.event && typeof obj.event === "object" ? obj.event : null;
		const event = inner ?? obj;
		if (event.assistantResponseEvent) {
			const text = event.assistantResponseEvent.content;
			if (text) events.push({ type: "text_delta", delta: text });
		} else if (event.reasoningContentEvent) {
			const t = typeof event.reasoningContentEvent === "string" ? event.reasoningContentEvent : event.reasoningContentEvent.text ?? event.reasoningContentEvent.content;
			if (t) events.push({ type: "thinking_delta", delta: t });
		} else if (event.toolUseEvent) {
			events.push(...this.handleToolUse(event.toolUseEvent));
		} else if (event.modelUsage || event.usage) {
			const u = event.modelUsage ?? event.usage;
			this.usage.promptTokens = u.inputTokens ?? u.promptTokens ?? this.usage.promptTokens;
			this.usage.completionTokens = u.outputTokens ?? u.completionTokens ?? this.usage.completionTokens;
		} else if (event.error) {
			const err = event.error;
			events.push({ type: "error", errorCode: err?.code ?? "upstream_error", message: err?.message ?? String(err), retryable: true });
		} else if (inner) {
			// event lạ có wrap — bỏ qua
		} else if (typeof obj.content === "string") {
			// payload trần assistantResponseEvent: {"content":"...","modelId":...}
			events.push({ type: "text_delta", delta: obj.content });
		} else if (obj.toolUseId !== undefined) {
			events.push(...this.handleToolUse(obj));
		} else if (obj.stopReason !== undefined) {
			// metadataEvent: {"stopReason":"END_TURN"}
			this.stopReason = obj.stopReason === "TOOL_USE" ? "toolUse" : obj.stopReason === "MAX_TOKENS" ? "length" : "stop";
			events.push({ type: "done", stopReason: this.stopReason, usage: this.usage });
		}
		// còn lại (contextUsageEvent, meteringEvent, assistantToolResultEvent...) — bỏ qua
		return events;
	}

	private handleToolUse(tu: Record<string, any>): StreamEvent[] {
		if (tu.stop === true || tu.type === "stop") return [];
		const id = tu.toolUseId ?? `call_${randomUUID().slice(0, 8)}`;
		this.sawTool = true;
		const events: StreamEvent[] = [{ type: "toolcall_start", id, name: tu.name ?? "" }];
		let args: Record<string, unknown> = {};
		if (typeof tu.input === "string") {
			try {
				args = JSON.parse(tu.input);
			} catch {
				args = {};
			}
		} else if (tu.input && typeof tu.input === "object") {
			args = tu.input;
		}
		events.push({ type: "toolcall_end", id, name: tu.name ?? "", arguments: args });
		return events;
	}

	/** Feed raw chunk (binary eventstream decoded utf8) — tự giữ buffer cho JSON cắt ngang. */
	parseRaw(chunk: string): StreamEvent[] {
		this.buffer += chunk;
		const { objects, rest } = extractJsonObjects(this.buffer);
		this.buffer = rest;
		const events: StreamEvent[] = [];
		for (const obj of objects) events.push(...this.classify(obj));
		return events;
	}

	/** Feed một JSON payload hoàn chỉnh (dạng SSE data:). */
	parse(payload: string): StreamEvent[] {
		let data: Record<string, any>;
		try {
			data = JSON.parse(payload) as Record<string, any>;
		} catch {
			return [];
		}
		return this.classify(data);
	}

	finish(): StreamEvent {
		this.stopReason = this.sawTool ? "toolUse" : this.stopReason === "length" ? "length" : "stop";
		return { type: "done", stopReason: this.stopReason, usage: this.usage };
	}
}

export function parseKiroResult(events: StreamEvent[]): CanonicalResult {
	const content: CanonicalResult["content"] = [];
	let text = "";
	let thinking = "";
	const usage = emptyUsage();
	let sawTool = false;
	for (const ev of events) {
		if (ev.type === "text_delta") text += ev.delta;
		else if (ev.type === "thinking_delta") thinking += ev.delta;
		else if (ev.type === "toolcall_end") {
			sawTool = true;
			content.push({ type: "toolCall", id: ev.id, name: ev.name, arguments: ev.arguments });
		} else if (ev.type === "done") Object.assign(usage, ev.usage);
	}
	if (thinking) content.unshift({ type: "thinking", thinking });
	if (text) content.push({ type: "text", text });
	return { content, stopReason: sawTool ? "toolUse" : "stop", usage };
}

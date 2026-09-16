/**
 * Egress adapter: OpenAI Responses wire (ChatGPT/Codex OAuth accounts).
 * Upstream: POST {baseUrl}/codex/responses
 */
import type { CanonicalRequest, CanonicalMessage, StreamEvent, CanonicalResult, CanonicalUsage } from "../canonical.js";
import { emptyUsage } from "../canonical.js";
import type { ProviderConfig } from "../registry.js";

type ResponsesInputItem = Record<string, unknown>;

function contentText(c: Extract<CanonicalMessage["content"][number], { type: "text" }>): string {
	return c.text;
}

function toResponsesInput(messages: CanonicalMessage[]): ResponsesInputItem[] {
	const out: ResponsesInputItem[] = [];
	for (const msg of messages) {
		if (msg.role === "user") {
			const content: Record<string, unknown>[] = [];
			for (const b of msg.content) {
				if (b.type === "text" && b.text) content.push({ type: "input_text", text: b.text });
				else if (b.type === "image") content.push({ type: "input_image", image_url: `data:${b.mime};base64,${b.data}` });
				else if (b.type === "toolResult") {
					// tool result inside user turn (claude-style): emit as function_call_output
					out.push({ type: "function_call_output", call_id: b.toolUseId, output: b.content });
				}
			}
			if (content.length) out.push({ type: "message", role: "user", content });
		} else if (msg.role === "assistant") {
			for (const b of msg.content) {
				if (b.type === "text" && b.text) {
					out.push({ type: "message", role: "assistant", content: [{ type: "output_text", text: b.text }] });
				} else if (b.type === "thinking" && b.signature) {
					// replay encrypted reasoning item (signature stores the encrypted_content)
					out.push({ type: "reasoning", summary: [], encrypted_content: b.signature });
				} else if (b.type === "toolCall") {
					out.push({
						type: "function_call",
						call_id: b.id,
						name: b.name,
						arguments: b.argumentsJson ?? JSON.stringify(b.arguments ?? {}),
					});
				}
			}
		} else if (msg.role === "toolResult") {
			for (const b of msg.content) {
				if (b.type === "toolResult") out.push({ type: "function_call_output", call_id: b.toolUseId, output: b.content });
			}
		}
	}
	return out;
}

export function buildCodexRequest(cfg: ProviderConfig, req: CanonicalRequest, token: string, accountId?: string) {
	const body: Record<string, unknown> = {
		model: req.upstreamModel,
		instructions: req.system ?? "",
		input: toResponsesInput(req.messages),
		tools: (req.tools ?? []).map((t) => ({
			type: "function",
			name: t.name,
			description: t.description ?? "",
			parameters: t.parameters,
			strict: false,
		})),
		tool_choice: req.toolChoice === "required" ? "required" : req.toolChoice === "none" ? "none" : "auto",
		parallel_tool_calls: false,
		reasoning: {
			effort: (() => {
				const isOpencode = cfg.id === "opencode" || req.upstreamModel.includes("muse-spark");
				const eff = (req.reasoningEffort as string) ?? "medium";
				if (eff === "max") return isOpencode ? "xhigh" : "high";
				if (eff === "xhigh" && !isOpencode) return "high";
				if (eff === "off" || eff === "none") return isOpencode ? "minimal" : "low";
				return eff;
			})(),
			summary: "auto",
		},
		store: false,
		stream: true,
		include: ["reasoning.encrypted_content"],
		prompt_cache_key: `mnrouter-${req.model}`,
	};
	if (req.toolChoice && typeof req.toolChoice === "object") body.tool_choice = req.toolChoice.name;
	// same-family passthrough
	const pt = req.passthrough as Record<string, unknown> | undefined;
	if (pt) {
		for (const key of ["prompt_cache_key", "text", "truncation", "previous_response_id"]) {
			if (pt[key] !== undefined) body[key] = pt[key];
		}
	}
	const url = `${cfg.baseUrls[0]}/codex/responses`;
	const headers: Record<string, string> = {
		authorization: `Bearer ${token}`,
		"content-type": "application/json",
		accept: "text/event-stream",
		"user-agent": cfg.userAgent,
		...cfg.headers,
	};
	if (accountId) headers["chatgpt-account-id"] = accountId;
	return { url, headers, body: JSON.stringify(body) };
}

/** Responses SSE → StreamEvents. */
export class CodexStreamParser {
	private usage: CanonicalUsage = emptyUsage();
	private stopReason: "stop" | "length" | "toolUse" = "stop";
	private itemTypes = new Map<string, string>(); // item_id → item.type
	private callNames = new Map<string, string>(); // item_id → function name
	private callIds = new Map<string, string>(); // item_id → call_id
	private argsJson = new Map<string, string>();
	private sawTool = false;

	parse(payload: string, eventName?: string): StreamEvent[] {
		let data: Record<string, any>;
		try {
			data = JSON.parse(payload) as Record<string, any>;
		} catch {
			return [];
		}
		const type = (data.type as string) ?? eventName;
		const events: StreamEvent[] = [];
		switch (type) {
			case "response.created":
				events.push({ type: "start" });
				break;
			case "response.output_item.added": {
				const item = data.item ?? {};
				if (item.id) this.itemTypes.set(item.id, item.type);
				if (item.type === "function_call") {
					this.sawTool = true;
					if (item.id) {
						this.callNames.set(item.id, item.name ?? "");
						this.callIds.set(item.id, item.call_id ?? item.id);
					}
					events.push({ type: "toolcall_start", id: item.call_id ?? item.id, name: item.name ?? "" });
				}
				break;
			}
			case "response.output_text.delta":
				if (data.delta) events.push({ type: "text_delta", delta: data.delta });
				break;
			case "response.reasoning_text.delta":
			case "response.reasoning_summary_text.delta":
				if (data.delta) events.push({ type: "thinking_delta", delta: data.delta });
				break;
			case "response.function_call_arguments.delta": {
				const itemId = data.item_id as string | undefined;
				const callId = (itemId && this.callIds.get(itemId)) ?? itemId ?? "";
				if (data.delta) {
					if (itemId) this.argsJson.set(itemId, (this.argsJson.get(itemId) ?? "") + data.delta);
					events.push({ type: "toolcall_delta", id: callId, delta: data.delta });
				}
				break;
			}
			case "response.output_item.done": {
				const item = data.item ?? {};
				if (item.type === "function_call" && item.id) {
					let args: Record<string, unknown> = {};
					try {
						args = typeof item.arguments === "string" ? JSON.parse(item.arguments) : (item.arguments ?? {});
					} catch {
						args = {};
					}
					events.push({
						type: "toolcall_end",
						id: item.call_id ?? item.id,
						name: item.name ?? this.callNames.get(item.id) ?? "",
						arguments: args,
					});
				}
				break;
			}
			case "response.completed":
			case "response.done": {
				const resp = data.response ?? {};
				const u = resp.usage ?? {};
				this.usage.promptTokens = u.input_tokens ?? 0;
				this.usage.cacheReadTokens = u.input_tokens_details?.cached_tokens ?? 0;
				this.usage.completionTokens = u.output_tokens ?? 0;
				this.usage.reasoningTokens = u.output_tokens_details?.reasoning_tokens ?? 0;
				this.stopReason = this.sawTool ? "toolUse" : resp.status === "incomplete" ? "length" : "stop";
				events.push({ type: "done", stopReason: this.stopReason, usage: this.usage });
				break;
			}
			case "response.failed": {
				const err = data.response?.error;
				events.push({
					type: "error",
					errorCode: err?.code ?? "response_failed",
					message: err?.message ?? "response failed",
					retryable: true,
				});
				break;
			}
			default: {
				// error event style: {type:"error", code, message, param}
				if (type === "error") {
					events.push({
						type: "error",
						errorCode: data.code ?? "upstream_error",
						message: data.message ?? "upstream error",
						retryable: true,
					});
				}
				break;
			}
		}
		return events;
	}

	getUsage() {
		return this.usage;
	}

	finish(): StreamEvent[] {
		return [];
	}
}

/** Non-streaming (aggregated) Responses output → canonical result. */
export function parseResponsesOutput(json: Record<string, any>): CanonicalResult {
	const u = json.usage ?? {};
	const usage: CanonicalUsage = {
		promptTokens: u.input_tokens ?? 0,
		completionTokens: u.output_tokens ?? 0,
		cacheReadTokens: u.input_tokens_details?.cached_tokens ?? 0,
		cacheWriteTokens: 0,
		reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? 0,
	};
	const content: CanonicalResult["content"] = [];
	let sawTool = false;
	for (const item of json.output ?? []) {
		if (item.type === "message") {
			const text = (item.content ?? [])
				.filter((c: any) => c.type === "output_text")
				.map((c: any) => c.text ?? "")
				.join("");
			if (text) content.push({ type: "text", text });
		} else if (item.type === "reasoning") {
			if (item.encrypted_content) content.push({ type: "thinking", thinking: "", signature: item.encrypted_content });
		} else if (item.type === "function_call") {
			sawTool = true;
			let args: Record<string, unknown> = {};
			try {
				args = typeof item.arguments === "string" ? JSON.parse(item.arguments) : (item.arguments ?? {});
			} catch {
				args = {};
			}
			content.push({ type: "toolCall", id: item.call_id ?? item.id, name: item.name, arguments: args });
		}
	}
	return { content, stopReason: sawTool ? "toolUse" : json.status === "incomplete" ? "length" : "stop", usage };
}

export { contentText };

/**
 * Egress adapter: Anthropic Messages wire format (Claude OAuth accounts).
 * Upstream: POST {baseUrl}/v1/messages  (Bearer OAuth token + oauth beta header)
 */
import type { CanonicalRequest, CanonicalMessage, StreamEvent, CanonicalResult, CanonicalUsage } from "../canonical.js";
import { emptyUsage } from "../canonical.js";
import type { ProviderConfig } from "../registry.js";

type ClaudeBlock =
	| { type: "text"; text: string }
	| { type: "thinking"; thinking: string; signature?: string }
	| { type: "redacted_thinking"; data: string }
	| { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
	| { type: "tool_result"; tool_use_id: string; content: unknown[] | string; is_error?: boolean }
	| { type: "image"; source: { type: "base64"; media_type: string; data: string } };

interface ClaudeMessage {
	role: "user" | "assistant";
	content: ClaudeBlock[];
}

function toClaudeMessages(messages: CanonicalMessage[]): ClaudeMessage[] {
	const out: ClaudeMessage[] = [];
	const flush: Array<{ role: "user" | "assistant"; blocks: ClaudeBlock[] }> = [];
	for (const msg of messages) {
		const role = msg.role === "assistant" ? "assistant" : "user";
		const blocks: ClaudeBlock[] = [];
		for (const b of msg.content) {
			if (b.type === "text") {
				if (b.text) blocks.push({ type: "text", text: b.text });
			} else if (b.type === "thinking") {
				if (b.signature) blocks.push({ type: "thinking", thinking: b.thinking, signature: b.signature });
			} else if (b.type === "image") {
				blocks.push({ type: "image", source: { type: "base64", media_type: b.mime, data: b.data } });
			} else if (b.type === "toolCall") {
				blocks.push({ type: "tool_use", id: b.id, name: b.name, input: b.arguments ?? safeParse(b.argumentsJson) });
			} else if (b.type === "toolResult") {
				const content: unknown[] = [{ type: "text", text: b.content }];
				if (b.image) content.push({ type: "image", source: { type: "base64", media_type: b.image.mime, data: b.image.data } });
				blocks.push({ type: "tool_result", tool_use_id: b.toolUseId, content, is_error: b.isError || undefined });
			}
		}
		if (blocks.length === 0) continue;
		// merge consecutive same-role messages (Anthropic requires alternation-ish, merging is always safe)
		const last = flush[flush.length - 1];
		if (last && last.role === role) last.blocks.push(...blocks);
		else flush.push({ role, blocks });
	}
	for (const f of flush) out.push({ role: f.role, content: f.blocks });
	return out;
}

function safeParse(json?: string): Record<string, unknown> {
	if (!json) return {};
	try {
		return JSON.parse(json) as Record<string, unknown>;
	} catch {
		return {};
	}
}

export function buildClaudeRequest(cfg: ProviderConfig, req: CanonicalRequest, token: string) {
	const body: Record<string, unknown> = {
		model: req.upstreamModel,
		max_tokens: req.maxTokens ?? 8192,
		messages: toClaudeMessages(req.messages),
		stream: req.stream,
	};
	if (req.system) body.system = req.system;
	if (req.temperature !== undefined) body.temperature = req.temperature;
	if (req.topP !== undefined) body.top_p = req.topP;
	if (req.tools?.length) {
		body.tools = req.tools.map((t) => ({
			name: t.name,
			description: t.description ?? "",
			input_schema: t.parameters,
		}));
		if (req.toolChoice) {
			if (req.toolChoice === "auto") body.tool_choice = { type: "auto" };
			else if (req.toolChoice === "none") body.tool_choice = { type: "none" };
			else if (req.toolChoice === "required") body.tool_choice = { type: "any" };
			else body.tool_choice = { type: "tool", name: req.toolChoice.name };
		}
	}
	// same-family passthrough (anthropic ingress → claude egress)
	const pt = req.passthrough as Record<string, unknown> | undefined;
	if (pt) {
		for (const key of ["metadata", "stop_sequences", "service_tier"]) {
			if (pt[key] !== undefined) body[key] = pt[key];
		}
	}
	const url = `${cfg.baseUrls[0]}/v1/messages`;
	const headers: Record<string, string> = {
		authorization: `Bearer ${token}`,
		"content-type": "application/json",
		"user-agent": cfg.userAgent,
		...cfg.headers,
	};
	return { url, headers, body: JSON.stringify(body) };
}

/** Parser state machine for Anthropic SSE → StreamEvents. */
export class ClaudeStreamParser {
	private toolNames = new Map<string, string>();
	private currentTool: { id: string; name: string; argsJson: string } | null = null;
	private usage: CanonicalUsage = emptyUsage();
	private stopReason: "stop" | "length" | "toolUse" = "stop";

	parse(payload: string, eventName?: string): StreamEvent[] {
		let data: Record<string, any>;
		try {
			data = JSON.parse(payload) as Record<string, any>;
		} catch {
			return [];
		}
		const type = data.type ?? eventName;
		const events: StreamEvent[] = [];
		switch (type) {
			case "message_start": {
				const u = data.message?.usage;
				if (u) {
					this.usage.promptTokens = u.input_tokens ?? 0;
					this.usage.cacheReadTokens = u.cache_read_input_tokens ?? 0;
					this.usage.cacheWriteTokens = u.cache_creation_input_tokens ?? 0;
				}
				events.push({ type: "start" });
				break;
			}
			case "content_block_start": {
				const block = data.content_block;
				if (block?.type === "tool_use") {
					this.toolNames.set(block.id, block.name);
					this.currentTool = { id: block.id, name: block.name, argsJson: "" };
					events.push({ type: "toolcall_start", id: block.id, name: block.name });
				}
				break;
			}
			case "content_block_delta": {
				const d = data.delta;
				if (d?.type === "text_delta" && d.text) events.push({ type: "text_delta", delta: d.text });
				else if (d?.type === "thinking_delta" && d.thinking) events.push({ type: "thinking_delta", delta: d.thinking });
				else if (d?.type === "input_json_delta" && d.partial_json) {
					const id = this.currentTool?.id ?? "";
					this.currentTool && (this.currentTool.argsJson += d.partial_json);
					events.push({ type: "toolcall_delta", id, delta: d.partial_json });
				}
				break;
			}
			case "content_block_stop": {
				if (this.currentTool) {
					events.push({
						type: "toolcall_end",
						id: this.currentTool.id,
						name: this.currentTool.name,
						arguments: safeParse(this.currentTool.argsJson),
					});
					this.currentTool = null;
				}
				break;
			}
			case "message_delta": {
				const d = data.delta;
				if (d?.stop_reason) {
					this.stopReason = d.stop_reason === "tool_use" ? "toolUse" : d.stop_reason === "max_tokens" ? "length" : "stop";
				}
				const u = data.usage;
				if (u?.output_tokens) this.usage.completionTokens = u.output_tokens;
				break;
			}
			case "message_stop":
				events.push({ type: "done", stopReason: this.stopReason, usage: this.usage });
				break;
			case "error": {
				const err = data.error;
				events.push({
					type: "error",
					errorCode: err?.type ?? "upstream_error",
					message: err?.message ?? "upstream error",
					retryable: true,
				});
				break;
			}
			default:
				break;
		}
		return events;
	}

	getUsage(): CanonicalUsage {
		return this.usage;
	}

	finish(): StreamEvent[] {
		return [];
	}

	getStopReason() {
		return this.stopReason;
	}
}

/** Non-streaming Anthropic response → canonical result. */
export function parseClaudeResponse(json: Record<string, any>): CanonicalResult {
	const usageSrc = json.usage ?? {};
	const usage: CanonicalUsage = {
		promptTokens: usageSrc.input_tokens ?? 0,
		completionTokens: usageSrc.output_tokens ?? 0,
		cacheReadTokens: usageSrc.cache_read_input_tokens ?? 0,
		cacheWriteTokens: usageSrc.cache_creation_input_tokens ?? 0,
		reasoningTokens: 0,
	};
	const content: CanonicalResult["content"] = [];
	for (const block of json.content ?? []) {
		if (block.type === "text") content.push({ type: "text", text: block.text ?? "" });
		else if (block.type === "thinking") content.push({ type: "thinking", thinking: block.thinking ?? "", signature: block.signature });
		else if (block.type === "tool_use") content.push({ type: "toolCall", id: block.id, name: block.name, arguments: block.input ?? {} });
	}
	const stopReason = json.stop_reason === "tool_use" ? "toolUse" : json.stop_reason === "max_tokens" ? "length" : "stop";
	return { content, stopReason, usage };
}

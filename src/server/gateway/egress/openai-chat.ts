/**
 * Egress adapter: OpenAI Chat Completions wire — dùng cho Grok (api.x.ai)
 * và OpenCode Free (opencode.ai/zen, noAuth).
 */
import { randomUUID } from "node:crypto";
import type { CanonicalRequest, CanonicalMessage, StreamEvent, CanonicalResult, CanonicalUsage } from "../canonical.js";
import { emptyUsage } from "../canonical.js";
import type { ProviderId, ProviderConfig } from "../registry.js";

function toChatMessages(messages: CanonicalMessage[]): Array<{ role: string; content: unknown; tool_calls?: unknown[]; tool_call_id?: string }> {
	const out: Array<{ role: string; content: unknown; tool_calls?: unknown[]; tool_call_id?: string }> = [];
	for (const msg of messages) {
		if (msg.role === "user") {
			const text = msg.content
				.filter((b) => b.type === "text")
				.map((b) => (b as { text: string }).text)
				.join("\n");
			const image = msg.content.find((b) => b.type === "image") as { mime: string; data: string } | undefined;
			const toolResults = msg.content.filter((b) => b.type === "toolResult") as Array<{ toolUseId: string; content: string }>;
			for (const tr of toolResults) {
				out.push({ role: "tool", content: tr.content, tool_call_id: tr.toolUseId });
			}
			if (text || image) {
				const content = image
					? [
							{ type: "text", text: text || "image" },
							{ type: "image_url", image_url: { url: `data:${image.mime};base64,${image.data}` } },
						]
					: text;
				out.push({ role: "user", content });
			}
		} else if (msg.role === "assistant") {
			const text = msg.content
				.filter((b) => b.type === "text")
				.map((b) => (b as { text: string }).text)
				.join("");
			const toolCalls = msg.content
				.filter((b) => b.type === "toolCall")
				.map((b) => b as { id: string; name: string; arguments?: Record<string, unknown>; argumentsJson?: string });
			const entry: { role: string; content: unknown; tool_calls?: unknown[]; tool_call_id?: string } = { role: "assistant", content: text || null };
			if (toolCalls.length) {
				entry.tool_calls = toolCalls.map((tc) => ({
					id: tc.id,
					type: "function",
					function: { name: tc.name, arguments: tc.argumentsJson ?? JSON.stringify(tc.arguments ?? {}) },
				}));
			}
			out.push(entry);
		} else if (msg.role === "toolResult") {
			for (const b of msg.content) {
				if (b.type === "toolResult") out.push({ role: "tool", content: b.content, tool_call_id: b.toolUseId });
			}
		}
	}
	return out;
}

function endpointPath(provider: ProviderId): string {
	return provider === "opencode" ? "/zen/v1/chat/completions" : "/v1/chat/completions";
}

function authHeaders(provider: ProviderId, token: string): Record<string, string> {
	if (provider === "opencode") {
		const authToken = token || process.env.OPENCODE_ZEN_TOKEN || "REDACTED_OPEN_CODE_TOKEN";
		return {
			authorization: authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`,
			"user-agent": "opencode/latest/2.0.3/cli",
			"x-opencode-client": "cli",
			"x-opencode-session": `ses_${randomUUID().replace(/-/g, "")}`,
			"x-opencode-request": `msg_${randomUUID().replace(/-/g, "")}`,
		};
	}
	return { authorization: `Bearer ${token}` };
}

export function buildOpenAiChatRequest(cfg: ProviderConfig, req: CanonicalRequest, token: string, provider: ProviderId, base: string) {
	const body: Record<string, unknown> = {
		model: req.upstreamModel,
		messages: [
			...(req.system ? [{ role: "system", content: req.system }] : []),
			...toChatMessages(req.messages),
		],
		stream: true,
		stream_options: { include_usage: true },
	};
	if (req.maxTokens) body.max_tokens = req.maxTokens;
	if (req.temperature !== undefined) body.temperature = req.temperature;
	if (req.topP !== undefined) body.top_p = req.topP;
	if (req.tools?.length) {
		body.tools = req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description ?? "", parameters: t.parameters } }));
		if (req.toolChoice === "auto") body.tool_choice = "auto";
		else if (req.toolChoice === "none") body.tool_choice = "none";
		else if (req.toolChoice === "required") body.tool_choice = "required";
		else if (typeof req.toolChoice === "object") body.tool_choice = { type: "function", function: { name: req.toolChoice.name } };
	}
	const url = `${base}${endpointPath(provider)}`;
	return { url, headers: { "content-type": "application/json", accept: "text/event-stream", "user-agent": cfg.userAgent, ...cfg.headers, ...authHeaders(provider, token) }, body: JSON.stringify(body) };
}

/** OpenAI chat.completion.chunk SSE → StreamEvents. */
export class OpenAiChatParser {
	private usage: CanonicalUsage = emptyUsage();
	private stopReason: "stop" | "length" | "toolUse" | null = null;
	private sawTool = false;
	/** index → { id, name, args } khi stream tool_calls theo index. */
	private tools = new Map<number, { id: string; name: string; args: string }>();

	parse(payload: string): StreamEvent[] {
		if (payload === "[DONE]") {
			return [{ type: "done", stopReason: this.stopReason ?? (this.sawTool ? "toolUse" : "stop"), usage: this.usage }];
		}
		let data: Record<string, any>;
		try {
			data = JSON.parse(payload) as Record<string, any>;
		} catch {
			return [];
		}
		const events: StreamEvent[] = [];
		const choices = data.choices ?? [];
		if (choices.length > 0) {
			const delta = choices[0]?.delta ?? {};
			if (delta.content) events.push({ type: "text_delta", delta: delta.content });
			if (delta.reasoning_content) events.push({ type: "thinking_delta", delta: delta.reasoning_content });
			if (delta.reasoning) events.push({ type: "thinking_delta", delta: delta.reasoning });
			for (const tc of delta.tool_calls ?? []) {
				const index = tc.index ?? 0;
				let entry = this.tools.get(index);
				if (!entry) {
					entry = { id: tc.id ?? `call_${index}`, name: tc.function?.name ?? "", args: "" };
					this.tools.set(index, entry);
					this.sawTool = true;
					events.push({ type: "toolcall_start", id: entry.id, name: entry.name });
				}
				if (tc.id && entry.id.startsWith("call_")) entry.id = tc.id;
				if (tc.function?.name) {
					const startEv = events.find((e) => e.type === "toolcall_start" && e.id === entry!.id) as { name: string } | undefined;
					if (startEv && !entry.name) {
						entry.name = tc.function.name;
						startEv.name = tc.function.name;
					}
				}
				if (tc.function?.arguments) {
					entry.args += tc.function.arguments;
					events.push({ type: "toolcall_delta", id: entry.id, delta: tc.function.arguments });
				}
			}
			const finish = choices[0]?.finish_reason;
			if (finish) {
				this.stopReason = finish === "tool_calls" ? "toolUse" : finish === "length" ? "length" : "stop";
				// emit toolcall_end theo thứ tự index
				for (const [, t] of [...this.tools.entries()].sort((a, b) => a[0] - b[0])) {
					let args: Record<string, unknown> = {};
					try {
						args = t.args ? JSON.parse(t.args) : {};
					} catch {
						args = {};
					}
					events.push({ type: "toolcall_end", id: t.id, name: t.name, arguments: args });
				}
				this.tools.clear();
			}
		}
		const u = data.usage;
		if (u) {
			this.usage.promptTokens = u.prompt_tokens ?? 0;
			this.usage.completionTokens = u.completion_tokens ?? 0;
			this.usage.cacheReadTokens = u.prompt_tokens_details?.cached_tokens ?? 0;
			this.usage.reasoningTokens = u.completion_tokens_details?.reasoning_tokens ?? 0;
		}
		return events;
	}

	finish(): StreamEvent[] {
		return [{ type: "done", stopReason: this.stopReason ?? (this.sawTool ? "toolUse" : "stop"), usage: this.usage }];
	}
}

/** Non-stream aggregated chat.completion → canonical result. */
export function parseOpenAiChatResponse(json: Record<string, any>): CanonicalResult {
	const u = json.usage ?? {};
	const usage: CanonicalUsage = {
		promptTokens: u.prompt_tokens ?? 0,
		completionTokens: u.completion_tokens ?? 0,
		cacheReadTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
		cacheWriteTokens: 0,
		reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
	};
	const choice = json.choices?.[0] ?? {};
	const message = choice.message ?? {};
	const content: CanonicalResult["content"] = [];
	if (message.reasoning_content) content.push({ type: "thinking", thinking: message.reasoning_content });
	if (message.content) content.push({ type: "text", text: message.content });
	for (const tc of message.tool_calls ?? []) {
		let args: Record<string, unknown> = {};
		try {
			args = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function?.arguments ?? {});
		} catch {
			args = {};
		}
		content.push({ type: "toolCall", id: tc.id ?? "", name: tc.function?.name ?? "", arguments: args });
	}
	const stopReason = choice.finish_reason === "tool_calls" ? "toolUse" : choice.finish_reason === "length" ? "length" : "stop";
	return { content, stopReason, usage };
}

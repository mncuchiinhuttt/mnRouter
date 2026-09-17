/**
 * Ingress: OpenAI Chat Completions (/v1/chat/completions).
 * parse: OpenAI Chat → Canonical. format: Canonical stream events → OpenAI SSE chunks.
 */
import type { CanonicalRequest, StreamEvent, CanonicalResult } from "../canonical.js";
import { UpstreamError } from "../canonical.js";
import { aggregateEvents, randomId } from "./shared.js";

export function parseOpenAiChat(body: Record<string, any>, upstreamModel: string): CanonicalRequest {
	if (!Array.isArray(body.messages)) throw new UpstreamError("messages must be an array", 400, "invalid_request", false);

	let system = "";
	const messages: CanonicalRequest["messages"] = [];
	const tools: NonNullable<CanonicalRequest["tools"]> = (body.tools ?? [])
		.filter((t: any) => t?.type === "function" && t.function?.name)
		.map((t: any) => ({ name: t.function.name, description: t.function.description ?? "", parameters: t.function.parameters ?? { type: "object", properties: {} } }));

	let toolChoice: CanonicalRequest["toolChoice"] = "auto";
	if (body.tool_choice === "none") toolChoice = "none";
	else if (body.tool_choice === "required") toolChoice = "required";
	else if (typeof body.tool_choice === "object" && body.tool_choice?.function?.name) toolChoice = { name: body.tool_choice.function.name };
	if (tools.length === 0) toolChoice = undefined;

	for (const msg of body.messages) {
		const role = msg.role;
		if (role === "system" || role === "developer") {
			system += (system ? "\n" : "") + contentToText(msg.content);
			continue;
		}
		if (role === "user") {
			const blocks: CanonicalRequest["messages"][number]["content"] = [];
			if (typeof msg.content === "string") {
				if (msg.content) blocks.push({ type: "text", text: msg.content });
			} else if (Array.isArray(msg.content)) {
				for (const part of msg.content) {
					if (part.type === "text" && part.text) blocks.push({ type: "text", text: part.text });
					else if (part.type === "image_url" && part.image_url?.url) {
						const m = /^data:([^;]+);base64,(.*)$/s.exec(part.image_url.url);
						if (m) blocks.push({ type: "image", mime: m[1]!, data: m[2]! });
					}
				}
			}
			messages.push({ role: "user", content: blocks.length ? blocks : [{ type: "text", text: "" }] });
		} else if (role === "assistant") {
			const blocks: CanonicalRequest["messages"][number]["content"] = [];
			const text = contentToText(msg.content);
			if (text) blocks.push({ type: "text", text });
			if (msg.reasoning_content) blocks.push({ type: "thinking", thinking: msg.reasoning_content });
			for (const tc of msg.tool_calls ?? []) {
				if (tc.type === "function") {
					blocks.push({
						type: "toolCall",
						id: tc.id ?? `call_${randomId("")}`,
						name: tc.function.name,
						arguments: safeParse(tc.function.arguments),
						argumentsJson: typeof tc.function.arguments === "string" ? tc.function.arguments : undefined,
					});
				}
			}
			messages.push({ role: "assistant", content: blocks });
		} else if (role === "tool") {
			messages.push({
				role: "toolResult",
				content: [{ type: "toolResult", toolUseId: msg.tool_call_id ?? "", content: contentToText(msg.content) }],
			});
		}
	}

	return {
		model: body.model,
		upstreamModel,
		system: system || undefined,
		messages,
		tools: tools.length ? tools : undefined,
		toolChoice,
		stream: Boolean(body.stream),
		maxTokens: body.max_completion_tokens ?? body.max_tokens ?? undefined,
		temperature: body.temperature ?? undefined,
		topP: body.top_p ?? undefined,
		reasoningEffort: body.reasoning_effort ?? undefined,
		passthrough: body,
	};
}

function contentToText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((p: any) => p?.type === "text")
			.map((p: any) => p.text ?? "")
			.join("");
	}
	return "";
}

function safeParse(json: unknown): Record<string, unknown> {
	if (typeof json !== "string") return (json as Record<string, unknown>) ?? {};
	try {
		return JSON.parse(json) as Record<string, unknown>;
	} catch {
		return {};
	}
}

/** ---------- formatting (canonical → OpenAI wire) ---------- */

export class OpenAiChatFormatter {
	private completionId = randomId("chatcmpl");
	private created = Math.floor(Date.now() / 1000);
	private toolIndex = new Map<string, number>();
	private nextIndex = 0;
	private model: string;
	private sentRole = false;
	private streamedArgs = new Set<string>();
	constructor(model: string) {
		this.model = model;
	}

	private base(delta: Record<string, unknown>, finishReason: string | null = null) {
		return JSON.stringify({
			id: this.completionId,
			object: "chat.completion.chunk",
			created: this.created,
			model: this.model,
			choices: [{ index: 0, delta, finish_reason: finishReason }],
		});
	}

	format(ev: StreamEvent): string[] {
		const out: string[] = [];
		switch (ev.type) {
			case "start":
				if (!this.sentRole) {
					this.sentRole = true;
					out.push(this.base({ role: "assistant", content: "" }));
				}
				break;
			case "text_delta":
				out.push(this.base({ content: ev.delta }));
				break;
			case "thinking_delta":
				out.push(this.base({ reasoning_content: ev.delta }));
				break;
			case "toolcall_start": {
				const index = this.nextIndex++;
				this.toolIndex.set(ev.id, index);
				out.push(this.base({ tool_calls: [{ index, id: ev.id, type: "function", function: { name: ev.name, arguments: "" } }] }));
				break;
			}
			case "toolcall_delta": {
				const index = this.toolIndex.get(ev.id) ?? 0;
				this.streamedArgs.add(ev.id);
				out.push(this.base({ tool_calls: [{ index, function: { arguments: ev.delta } }] }));
				break;
			}
			case "toolcall_end": {
				const index = this.toolIndex.get(ev.id) ?? 0;
				if (!this.streamedArgs.has(ev.id) && ev.arguments) {
					const argsStr = typeof ev.arguments === "string" ? ev.arguments : JSON.stringify(ev.arguments);
					out.push(this.base({ tool_calls: [{ index, function: { arguments: argsStr } }] }));
				}
				break;
			}
			case "done": {
				const finish = ev.stopReason === "toolUse" ? "tool_calls" : ev.stopReason === "length" ? "length" : "stop";
				out.push(this.base({}, finish));
				out.push(
					JSON.stringify({
						id: this.completionId,
						object: "chat.completion.chunk",
						created: this.created,
						model: this.model,
						choices: [],
						usage: usageToOpenAi(ev.usage),
					}),
				);
				out.push("[DONE]");
				break;
			}
			case "error":
				out.push(
					JSON.stringify({
						error: { message: ev.message, type: "upstream_error", code: ev.errorCode },
					}),
				);
				out.push("data: [DONE]");
				break;
		}
		return out.map((s) => `data: ${s}\n\n`);
	}

	formatNonStream(result: CanonicalResult, model: string): Record<string, unknown> {
		const message: Record<string, unknown> = { role: "assistant", content: null };
		let text = "";
		let reasoning = "";
		const toolCalls: unknown[] = [];
		for (const block of result.content) {
			if (block.type === "text") text += block.text;
			else if (block.type === "thinking") reasoning += block.thinking;
			else if (block.type === "toolCall")
				toolCalls.push({ id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.arguments ?? {}) } });
		}
		if (reasoning) message.reasoning_content = reasoning;
		message.content = text || (toolCalls.length ? null : "");
		if (toolCalls.length) message.tool_calls = toolCalls;
		return {
			id: this.completionId,
			object: "chat.completion",
			created: this.created,
			model,
			choices: [
				{
					index: 0,
					message,
					finish_reason: result.stopReason === "toolUse" ? "tool_calls" : result.stopReason === "length" ? "length" : "stop",
				},
			],
			usage: usageToOpenAi(result.usage),
		};
	}

	errorPayload(code: string, message: string, httpStatus: number): Record<string, unknown> {
		return { error: { message, type: httpStatus >= 500 ? "server_error" : "invalid_request_error", code } };
	}
}

export function usageToOpenAi(u: CanonicalResult["usage"]) {
	return {
		prompt_tokens: u.promptTokens,
		completion_tokens: u.completionTokens,
		total_tokens: u.promptTokens + u.completionTokens,
		prompt_tokens_details: { cached_tokens: u.cacheReadTokens },
		completion_tokens_details: { reasoning_tokens: u.reasoningTokens },
		cache_read_input_tokens: u.cacheReadTokens,
		cache_creation_input_tokens: u.cacheWriteTokens,
	};
}

export { aggregateEvents };

/**
 * Ingress: Anthropic Messages (/v1/messages) — cho Claude Code & harness Anthropic.
 */
import type { CanonicalRequest, StreamEvent, CanonicalResult } from "../canonical.js";
import { UpstreamError } from "../canonical.js";
import { randomId } from "./shared.js";

export function parseAnthropic(body: Record<string, any>, upstreamModel: string): CanonicalRequest {
	if (!Array.isArray(body.messages)) throw new UpstreamError("messages must be an array", 400, "invalid_request", false);

	let system = "";
	if (typeof body.system === "string") system = body.system;
	else if (Array.isArray(body.system)) {
		system = body.system
			.filter((b: any) => b.type === "text")
			.map((b: any) => b.text ?? "")
			.join("\n");
	}

	const messages: CanonicalRequest["messages"] = [];
	for (const msg of body.messages) {
		const role = msg.role === "assistant" ? "assistant" : "user";
		const blocks: CanonicalRequest["messages"][number]["content"] = [];
		const raw = typeof msg.content === "string" ? [{ type: "text", text: msg.content }] : (msg.content ?? []);
		for (const b of raw) {
			if (b.type === "text" && b.text) blocks.push({ type: "text", text: b.text });
			else if (b.type === "image" && b.source?.type === "base64") {
				blocks.push({ type: "image", mime: b.source.media_type, data: b.source.data });
			} else if (b.type === "thinking") {
				blocks.push({ type: "thinking", thinking: b.thinking ?? "", signature: b.signature });
			} else if (b.type === "redacted_thinking") {
				blocks.push({ type: "thinking", thinking: "", signature: b.data });
			} else if (b.type === "tool_use") {
				blocks.push({ type: "toolCall", id: b.id, name: b.name, arguments: b.input ?? {} });
			} else if (b.type === "tool_result") {
				let content = "";
				let image: { mime: string; data: string } | undefined;
				if (typeof b.content === "string") content = b.content;
				else if (Array.isArray(b.content)) {
					for (const c of b.content) {
						if (c.type === "text") content += (content ? "\n" : "") + (c.text ?? "");
						else if (c.type === "image" && c.source?.type === "base64") {
							image = { mime: c.source.media_type, data: c.source.data };
						}
					}
				}
				blocks.push({ type: "toolResult", toolUseId: b.tool_use_id ?? "", content, image, isError: b.is_error || undefined });
			}
		}
		if (blocks.length) messages.push({ role, content: blocks });
	}

	const tools: NonNullable<CanonicalRequest["tools"]> = (body.tools ?? [])
		.filter((t: any) => t.name && (t.input_schema || t.type === "custom"))
		.map((t: any) => ({ name: t.name, description: t.description ?? "", parameters: t.input_schema ?? { type: "object", properties: {} } }));

	let toolChoice: CanonicalRequest["toolChoice"] = tools.length ? "auto" : undefined;
	const tc = body.tool_choice?.type;
	if (tc === "any") toolChoice = "required";
	else if (tc === "none") toolChoice = "none";
	else if (tc === "tool" && body.tool_choice.name) toolChoice = { name: body.tool_choice.name };
	else if (tc === "auto") toolChoice = "auto";

	return {
		model: body.model,
		upstreamModel,
		system: system || undefined,
		messages,
		tools: tools.length ? tools : undefined,
		toolChoice,
		stream: Boolean(body.stream),
		maxTokens: body.max_tokens ?? undefined,
		temperature: body.temperature ?? undefined,
		topP: body.top_p ?? undefined,
		passthrough: body,
	};
}

/** ---------- formatting (canonical → Anthropic SSE) ---------- */

interface OpenBlock {
	index: number;
	kind: "text" | "thinking" | "tool";
	id?: string;
	name?: string;
	args?: string;
	opened: boolean;
}

export class AnthropicFormatter {
	private messageId = randomId("msg");
	private model: string;
	private blocks: OpenBlock[] = [];
	private nextIndex = 0;

	constructor(model: string) {
		this.model = model;
	}

	private block(kind: OpenBlock["kind"], id?: string, name?: string): OpenBlock {
		const existing = this.blocks.find((b) => b.kind === kind && b.id === id);
		if (existing) return existing;
		const block: OpenBlock = { index: this.nextIndex++, kind, id, name, args: "", opened: false };
		this.blocks.push(block);
		return block;
	}

	private ensureOpen(b: OpenBlock, out: string[]) {
		if (b.opened) return;
		let cb: Record<string, unknown>;
		if (b.kind === "text") cb = { type: "text", text: "" };
		else if (b.kind === "thinking") cb = { type: "thinking", thinking: "", signature: null };
		else cb = { type: "tool_use", id: b.id, name: b.name, input: {} };
		out.push(this.ev("content_block_start", { type: "content_block_start", index: b.index, content_block: cb }));
		b.opened = true;
	}

	private ev(name: string, data: unknown): string {
		return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
	}

	format(ev: StreamEvent): string[] {
		const out: string[] = [];
		switch (ev.type) {
			case "start":
				out.push(
					this.ev("message_start", {
						type: "message_start",
						message: { id: this.messageId, type: "message", role: "assistant", model: this.model, content: [], stop_reason: null, usage: { input_tokens: 0, output_tokens: 0 } },
					}),
				);
				break;
			case "text_delta": {
				const b = this.block("text");
				this.ensureOpen(b, out);
				out.push(this.ev("content_block_delta", { type: "content_block_delta", index: b.index, delta: { type: "text_delta", text: ev.delta } }));
				break;
			}
			case "thinking_delta": {
				const b = this.block("thinking");
				this.ensureOpen(b, out);
				out.push(this.ev("content_block_delta", { type: "content_block_delta", index: b.index, delta: { type: "thinking_delta", thinking: ev.delta } }));
				break;
			}
			case "toolcall_start": {
				const b = this.block("tool", ev.id, ev.name);
				this.ensureOpen(b, out);
				break;
			}
			case "toolcall_delta": {
				const b = this.block("tool", ev.id);
				b.args = (b.args ?? "") + ev.delta;
				out.push(this.ev("content_block_delta", { type: "content_block_delta", index: b.index, delta: { type: "input_json_delta", partial_json: ev.delta } }));
				break;
			}
			case "toolcall_end": {
				const b = this.block("tool", ev.id, ev.name);
				out.push(this.ev("content_block_stop", { type: "content_block_stop", index: b.index }));
				this.blocks = this.blocks.filter((x) => x !== b);
				break;
			}
			case "done": {
				// close remaining open blocks
				for (const b of [...this.blocks]) {
					out.push(this.ev("content_block_stop", { type: "content_block_stop", index: b.index }));
				}
				this.blocks = [];
				out.push(
					this.ev("message_delta", {
						type: "message_delta",
						delta: { stop_reason: ev.stopReason === "toolUse" ? "tool_use" : ev.stopReason === "length" ? "max_tokens" : "end_turn", stop_sequence: null },
						usage: { output_tokens: ev.usage.completionTokens },
					}),
				);
				out.push(this.ev("message_stop", { type: "message_stop" }));
				break;
			}
			case "error":
				out.push(this.ev("error", { type: "error", error: { type: ev.errorCode || "api_error", message: ev.message } }));
				break;
		}
		return out;
	}

	formatNonStream(result: CanonicalResult, model: string): Record<string, unknown> {
		const content: Record<string, unknown>[] = [];
		for (const block of result.content) {
			if (block.type === "text") content.push({ type: "text", text: block.text });
			else if (block.type === "thinking") content.push({ type: "thinking", thinking: block.thinking, signature: block.signature ?? null });
			else if (block.type === "toolCall") content.push({ type: "tool_use", id: block.id, name: block.name, input: block.arguments ?? {} });
		}
		return {
			id: this.messageId,
			type: "message",
			role: "assistant",
			model,
			content,
			stop_reason: result.stopReason === "toolUse" ? "tool_use" : result.stopReason === "length" ? "max_tokens" : "end_turn",
			stop_sequence: null,
			usage: {
				input_tokens: result.usage.promptTokens,
				output_tokens: result.usage.completionTokens,
				cache_read_input_tokens: result.usage.cacheReadTokens || undefined,
				cache_creation_input_tokens: result.usage.cacheWriteTokens || undefined,
			},
		};
	}

	errorPayload(code: string, message: string): Record<string, unknown> {
		return { type: "error", error: { type: code || "api_error", message } };
	}
}

/**
 * Ingress: OpenAI Responses (/v1/responses) — cho Codex CLI.
 */
import type { CanonicalRequest, StreamEvent, CanonicalResult } from "../canonical.js";
import { UpstreamError } from "../canonical.js";
import { aggregateEvents, randomId } from "./shared.js";
import { usageToOpenAi } from "./openai-chat.js";

export function parseOpenAiResponses(body: Record<string, any>, upstreamModel: string): CanonicalRequest {
	let system = body.instructions ?? "";
	const messages: CanonicalRequest["messages"] = [];

	const input = body.input;
	const items: any[] = typeof input === "string" ? [{ type: "message", role: "user", content: [{ type: "input_text", text: input }] }] : Array.isArray(input) ? input : [];

	const pendingToolResults: CanonicalRequest["messages"][number]["content"] = [];

	const flushToolResultsAsUser = () => {
		if (pendingToolResults.length) {
			messages.push({ role: "toolResult", content: pendingToolResults.splice(0) });
		}
	};

	for (const item of items) {
		if (typeof item === "string") {
			flushToolResultsAsUser();
			messages.push({ role: "user", content: [{ type: "text", text: item }] });
			continue;
		}
		switch (item.type) {
			case "message": {
				const role = item.role === "assistant" ? "assistant" : "user";
				if (role === "assistant") flushToolResultsAsUser();
				const blocks: CanonicalRequest["messages"][number]["content"] = [];
				const content = typeof item.content === "string" ? [{ type: role === "user" ? "input_text" : "output_text", text: item.content }] : (item.content ?? []);
				for (const part of content) {
					if (part.type === "input_text" || part.type === "output_text" || part.type === "text") {
						if (part.text) blocks.push({ type: "text", text: part.text });
					} else if (part.type === "input_image") {
						const url: string = part.image_url ?? "";
						const m = /^data:([^;]+);base64,(.*)$/s.exec(url);
						if (m) blocks.push({ type: "image", mime: m[1]!, data: m[2]! });
					}
				}
				if (blocks.length) messages.push({ role, content: blocks });
				break;
			}
			case "reasoning": {
				flushToolResultsAsUser();
				const summary = (item.summary ?? []).map((s: any) => s.text ?? "").join("");
				blocksInto(messages, { type: "thinking", thinking: summary ?? "", signature: item.encrypted_content });
				break;
			}
			case "function_call": {
				flushToolResultsAsUser();
				let args: Record<string, unknown> = {};
				try {
					args = typeof item.arguments === "string" ? JSON.parse(item.arguments) : (item.arguments ?? {});
				} catch {
					args = {};
				}
				blocksInto(messages, { type: "toolCall", id: item.call_id ?? item.id ?? randomId("call"), name: item.name ?? "", arguments: args, argumentsJson: typeof item.arguments === "string" ? item.arguments : undefined });
				break;
			}
			case "function_call_output": {
				pendingToolResults.push({ type: "toolResult", toolUseId: item.call_id ?? item.id ?? "", content: typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? "") });
				break;
			}
			default:
				break;
		}
	}
	flushToolResultsAsUser();

	const tools: NonNullable<CanonicalRequest["tools"]> = (body.tools ?? [])
		.filter((t: any) => (t.type === "function" || t.name) && t.name)
		.map((t: any) => ({ name: t.name, description: t.description ?? "", parameters: t.parameters ?? { type: "object", properties: {} } }));

	let toolChoice: CanonicalRequest["toolChoice"] = tools.length ? "auto" : undefined;
	const tcChoice = body.tool_choice;
	if (tcChoice === "none" || tcChoice === "required") toolChoice = tcChoice;
	else if (typeof tcChoice === "object" && tcChoice?.name) toolChoice = { name: tcChoice.name };

	return {
		model: body.model,
		upstreamModel,
		system: system || undefined,
		messages,
		tools: tools.length ? tools : undefined,
		toolChoice,
		stream: Boolean(body.stream),
		maxTokens: body.max_output_tokens ?? undefined,
		temperature: body.temperature ?? undefined,
		topP: body.top_p ?? undefined,
		reasoningEffort: body.reasoning?.effort ?? undefined,
		passthrough: body,
	};
}

function blocksInto(messages: CanonicalRequest["messages"], block: CanonicalRequest["messages"][number]["content"][number]) {
	const last = messages[messages.length - 1];
	if (last && last.role === "assistant") last.content.push(block);
	else messages.push({ role: "assistant", content: [block] });
}

/** ---------- formatting (canonical → Responses SSE) ---------- */

export class OpenAiResponsesFormatter {
	private responseId = randomId("resp");
	private model: string;
	private created = Math.floor(Date.now() / 1000);
	private msgItemId = randomId("msg");
	private reasoningItemId = randomId("rs");
	private sentHeader = false;
	private sentReasoningAdded = false;
	private fullText = "";
	private fullThinking = "";
	private toolItems = new Map<string, { itemId: string; callId: string; name: string; args: string }>();
	private nextOutputIndex = 0;
	constructor(model: string) {
		this.model = model;
	}

	private ev(name: string, data: unknown): string {
		return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
	}

	private responseBase(extra: Record<string, unknown> = {}) {
		return {
			id: this.responseId,
			object: "response",
			created_at: this.created,
			status: "in_progress",
			model: this.model,
			output: [],
			...extra,
		};
	}

	private ensureHeader(out: string[]) {
		if (this.sentHeader) return;
		this.sentHeader = true;
		out.push(this.ev("response.created", { type: "response.created", response: this.responseBase() }));
		out.push(
			this.ev("response.output_item.added", {
				type: "response.output_item.added",
				output_index: this.nextOutputIndex++,
				item: { type: "message", id: this.msgItemId, status: "in_progress", role: "assistant", content: [] },
			}),
		);
		out.push(
			this.ev("response.content_part.added", {
				type: "response.content_part.added",
				item_id: this.msgItemId,
				output_index: this.nextOutputIndex - 1,
				content_index: 0,
				part: { type: "output_text", text: "", annotations: [] },
			}),
		);
	}

	format(ev: StreamEvent): string[] {
		const out: string[] = [];
		switch (ev.type) {
			case "start":
				this.ensureHeader(out);
				break;
			case "text_delta":
				this.ensureHeader(out);
				this.fullText += ev.delta;
				out.push(this.ev("response.output_text.delta", { type: "response.output_text.delta", item_id: this.msgItemId, output_index: 0, content_index: 0, delta: ev.delta }));
				break;
			case "thinking_delta":
				this.fullThinking += ev.delta;
				if (!this.sentReasoningAdded) {
					this.sentReasoningAdded = true;
					out.push(this.ev("response.output_item.added", {
						type: "response.output_item.added",
						output_index: this.nextOutputIndex++,
						item: { type: "reasoning", id: this.reasoningItemId, status: "in_progress", summary: [] }
					}));
				}
				out.push(this.ev("response.reasoning_summary_text.delta", { type: "response.reasoning_summary_text.delta", item_id: this.reasoningItemId, output_index: 0, summary_index: 0, delta: ev.delta }));
				break;
			case "toolcall_start": {
				const itemId = randomId("fc");
				this.toolItems.set(ev.id, { itemId, callId: ev.id, name: ev.name, args: "" });
				out.push(
					this.ev("response.output_item.added", {
						type: "response.output_item.added",
						output_index: this.nextOutputIndex++,
						item: { type: "function_call", id: itemId, call_id: ev.id, name: ev.name, arguments: "", status: "in_progress" },
					}),
				);
				break;
			}
			case "toolcall_delta": {
				const t = this.toolItems.get(ev.id);
				if (t) {
					t.args += ev.delta;
					out.push(this.ev("response.function_call_arguments.delta", { type: "response.function_call_arguments.delta", item_id: t.itemId, output_index: 0, delta: ev.delta }));
				}
				break;
			}
			case "toolcall_end": {
				const t = this.toolItems.get(ev.id);
				if (t) {
					out.push(
						this.ev("response.output_item.done", {
							type: "response.output_item.done",
							output_index: 0,
							item: { type: "function_call", id: t.itemId, call_id: t.callId, name: t.name, arguments: JSON.stringify(ev.arguments), status: "completed" },
						}),
					);
				}
				break;
			}
			case "done": {
				this.ensureHeader(out);
				if (this.sentReasoningAdded && this.fullThinking) {
					out.push(
						this.ev("response.reasoning_summary_text.done", { type: "response.reasoning_summary_text.done", item_id: this.reasoningItemId, output_index: 0, summary_index: 0, text: this.fullThinking })
					);
					out.push(
						this.ev("response.output_item.done", {
							type: "response.output_item.done",
							output_index: 0,
							item: { type: "reasoning", id: this.reasoningItemId, status: "completed", summary: [{ type: "summary_text", text: this.fullThinking }] }
						})
					);
				}
				out.push(
					this.ev("response.output_text.done", { type: "response.output_text.done", item_id: this.msgItemId, output_index: 0, content_index: 0, text: this.fullText }),
				);
				out.push(
					this.ev("response.output_item.done", {
						type: "response.output_item.done",
						output_index: 0,
						item: { type: "message", id: this.msgItemId, status: "completed", role: "assistant", content: [{ type: "output_text", text: this.fullText, annotations: [] }] },
					}),
				);
				const finalOutput: Record<string, unknown>[] = [];
				if (this.sentReasoningAdded && this.fullThinking) {
					finalOutput.push({ id: this.reasoningItemId, type: "reasoning", status: "completed", summary: [{ type: "summary_text", text: this.fullThinking }] });
				}
				finalOutput.push({
					id: this.msgItemId,
					type: "message",
					status: "completed",
					role: "assistant",
					content: [{ type: "output_text", text: this.fullText, annotations: [] }]
				});
				out.push(
					this.ev("response.completed", {
						type: "response.completed",
						response: this.responseBase({
							status: "completed",
							output: finalOutput,
							usage: {
								input_tokens: ev.usage.promptTokens,
								output_tokens: ev.usage.completionTokens,
								total_tokens: ev.usage.promptTokens + ev.usage.completionTokens,
								input_tokens_details: { cached_tokens: ev.usage.cacheReadTokens },
								output_tokens_details: { reasoning_tokens: ev.usage.reasoningTokens },
							},
						}),
					}),
				);
				break;
			}
			case "error":
				out.push(this.ev("response.failed", { type: "response.failed", response: this.responseBase({ status: "failed", error: { code: ev.errorCode, message: ev.message } }) }));
				break;
		}
		return out;
	}

	formatNonStream(result: CanonicalResult, model: string): Record<string, unknown> {
		const output: Record<string, unknown>[] = [];
		for (const block of result.content) {
			if (block.type === "text") {
				output.push({ type: "message", id: randomId("msg"), status: "completed", role: "assistant", content: [{ type: "output_text", text: block.text, annotations: [] }] });
			} else if (block.type === "thinking" && block.signature) {
				output.push({ type: "reasoning", id: randomId("rs"), summary: block.thinking ? [{ type: "summary_text", text: block.thinking }] : [], encrypted_content: block.signature });
			} else if (block.type === "toolCall") {
				output.push({ type: "function_call", id: randomId("fc"), call_id: block.id, name: block.name, arguments: JSON.stringify(block.arguments ?? {}), status: "completed" });
			}
		}
		return {
			id: this.responseId,
			object: "response",
			created_at: this.created,
			status: "completed",
			model,
			output,
			usage: usageToOpenAi(result.usage),
		};
	}

	errorPayload(code: string, message: string): Record<string, unknown> {
		return { error: { code, message, param: null } };
	}
}

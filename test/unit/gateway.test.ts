import { describe, expect, it } from "vitest";
import { parseOpenAiChat, OpenAiChatFormatter } from "../../src/server/gateway/ingress/openai-chat.js";
import { parseAnthropic, AnthropicFormatter } from "../../src/server/gateway/ingress/anthropic.js";
import { parseOpenAiResponses, OpenAiResponsesFormatter } from "../../src/server/gateway/ingress/openai-responses.js";
import { aggregateEvents } from "../../src/server/gateway/ingress/shared.js";
import { ClaudeStreamParser, parseClaudeResponse } from "../../src/server/gateway/egress/claude.js";
import { CodexStreamParser, parseResponsesOutput } from "../../src/server/gateway/egress/codex.js";
import { createAntigravityParser, parseAntigravityResponse } from "../../src/server/gateway/egress/antigravity.js";
import { KiroStreamParser } from "../../src/server/gateway/egress/kiro.js";
import { buildKiroBody } from "../../src/server/gateway/egress/kiro.js";
import { generateApiKey, hashToken } from "../../src/server/auth/crypto.js";

describe("openai-chat ingress", () => {
	it("parses system/user/assistant/tool messages", () => {
		const req = parseOpenAiChat(
			{
				model: "claude-sonnet-4-5",
				messages: [
					{ role: "system", content: "be brief" },
					{ role: "user", content: "hello" },
					{
						role: "assistant",
						content: null,
						tool_calls: [{ id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"city":"Hanoi"}' } }],
					},
					{ role: "tool", tool_call_id: "call_1", content: "sunny 30C" },
				],
				tools: [{ type: "function", function: { name: "get_weather", description: "w", parameters: { type: "object" } } }],
			},
			"claude-sonnet-4-5",
		);
		expect(req.system).toBe("be brief");
		expect(req.messages).toHaveLength(3);
		expect(req.messages[1]!.content[0]).toMatchObject({ type: "toolCall", id: "call_1", name: "get_weather" });
		expect(req.messages[2]!.content[0]).toMatchObject({ type: "toolResult", toolUseId: "call_1" });
		expect(req.tools).toHaveLength(1);
	});

	it("formats stream events to OpenAI chunks", () => {
		const f = new OpenAiChatFormatter("m");
		const chunks = [
			...f.format({ type: "start" }),
			...f.format({ type: "text_delta", delta: "hi" }),
			...f.format({ type: "toolcall_start", id: "t1", name: "fn" }),
			...f.format({ type: "toolcall_delta", id: "t1", delta: '{"a"' }),
			...f.format({ type: "toolcall_end", id: "t1", name: "fn", arguments: { a: 1 } }),
			...f.format({ type: "done", stopReason: "toolUse", usage: { promptTokens: 10, completionTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 } }),
		];
		expect(chunks.at(-1)).toBe("data: [DONE]\n\n");
		const parsed = chunks.slice(0, -1).map((c) => JSON.parse(c.replace(/^data: /, "").trim()));
		expect(parsed[0].choices[0].delta.role).toBe("assistant");
		expect(parsed[1].choices[0].delta.content).toBe("hi");
		expect(parsed[2].choices[0].delta.tool_calls[0].function.name).toBe("fn");
		const usageChunk = parsed.find((p) => p.usage);
		expect(usageChunk.usage.prompt_tokens).toBe(10);
	});
});

describe("anthropic ingress + egress roundtrip", () => {
	it("parses anthropic messages request", () => {
		const req = parseAnthropic(
			{
				model: "claude-sonnet-4-5",
				system: "sys",
				max_tokens: 100,
				messages: [
					{ role: "user", content: "hello" },
					{ role: "assistant", content: [{ type: "tool_use", id: "tu_1", name: "f", input: { x: 1 } }] },
					{ role: "user", content: [{ type: "tool_result", tool_use_id: "tu_1", content: "ok" }] },
				],
				tools: [{ name: "f", description: "d", input_schema: { type: "object" } }],
			},
			"claude-sonnet-4-5",
		);
		expect(req.system).toBe("sys");
		expect(req.messages[1]!.content[0]).toMatchObject({ type: "toolCall", id: "tu_1", name: "f" });
		expect(req.messages[2]!.content[0]).toMatchObject({ type: "toolResult", toolUseId: "tu_1" });
		expect(req.toolChoice).toBe("auto");
	});

	it("claude SSE parser produces canonical events with usage", () => {
		const parser = new ClaudeStreamParser();
		const events = [
			...parser.parse(JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 12, cache_read_input_tokens: 4, cache_creation_input_tokens: 2 } } })),
			...parser.parse(JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })),
			...parser.parse(JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "he" } })),
			...parser.parse(JSON.stringify({ type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "tu1", name: "fn" } })),
			...parser.parse(JSON.stringify({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"x":' } })),
			...parser.parse(JSON.stringify({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "1}" } })),
			...parser.parse(JSON.stringify({ type: "content_block_stop", index: 1 })),
			...parser.parse(JSON.stringify({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 7 } })),
			...parser.parse(JSON.stringify({ type: "message_stop" })),
		];
		expect(events[0]).toMatchObject({ type: "start" });
		expect(events.filter((e) => e.type === "text_delta")).toHaveLength(1);
		const end = events.find((e) => e.type === "toolcall_end");
		expect(end).toMatchObject({ type: "toolcall_end", id: "tu1", arguments: { x: 1 } });
		const done = events.at(-1)!;
		expect(done).toMatchObject({ type: "done", stopReason: "toolUse" });
		if (done.type === "done") {
			expect(done.usage).toMatchObject({ promptTokens: 12, completionTokens: 7, cacheReadTokens: 4, cacheWriteTokens: 2 });
		}
	});

	it("parses non-stream anthropic response", () => {
		const res = parseClaudeResponse({
			content: [
				{ type: "text", text: "answer" },
				{ type: "tool_use", id: "tu1", name: "fn", input: { a: 2 } },
			],
			stop_reason: "tool_use",
			usage: { input_tokens: 5, output_tokens: 9 },
		});
		expect(res.stopReason).toBe("toolUse");
		expect(res.usage.promptTokens).toBe(5);
		expect(res.content[1]).toMatchObject({ type: "toolCall", name: "fn" });
	});
});

describe("codex (responses) parser", () => {
	it("parses responses SSE into canonical events", () => {
		const parser = new CodexStreamParser();
		const evts = [
			...parser.parse(JSON.stringify({ type: "response.created", response: { id: "r1" } })),
			...parser.parse(JSON.stringify({ type: "response.output_item.added", output_index: 0, item: { type: "function_call", id: "fc1", call_id: "call_1", name: "fn", arguments: "" } })),
			...parser.parse(JSON.stringify({ type: "response.function_call_arguments.delta", item_id: "fc1", delta: '{"a":' })),
			...parser.parse(JSON.stringify({ type: "response.output_item.done", output_index: 0, item: { type: "function_call", id: "fc1", call_id: "call_1", name: "fn", arguments: '{"a":1}' } })),
			...parser.parse(
				JSON.stringify({
					type: "response.completed",
					response: { usage: { input_tokens: 20, output_tokens: 4, input_tokens_details: { cached_tokens: 8 }, output_tokens_details: { reasoning_tokens: 3 } } },
				}),
			),
		];
		expect(evts[0]!.type).toBe("start");
		const done = evts.at(-1)!;
		expect(done).toMatchObject({ type: "done", stopReason: "toolUse" });
		if (done.type === "done") expect(done.usage).toMatchObject({ promptTokens: 20, cacheReadTokens: 8, reasoningTokens: 3 });
	});

	it("parses aggregated responses output", () => {
		const res = parseResponsesOutput({
			output: [
				{ type: "message", content: [{ type: "output_text", text: "yo" }] },
				{ type: "function_call", id: "fc1", call_id: "call_1", name: "fn", arguments: '{"b":2}' },
			],
			usage: { input_tokens: 3, output_tokens: 2 },
			status: "completed",
		});
		expect(res.stopReason).toBe("toolUse");
		expect(res.content[0]).toMatchObject({ type: "text", text: "yo" });
		expect(res.content[1]).toMatchObject({ type: "toolCall", id: "call_1" });
	});

	it("responses ingress parse keeps tool loop", () => {
		const req = parseOpenAiResponses(
			{
				model: "gpt-5-codex",
				instructions: "sys",
				input: [
					{ type: "message", role: "user", content: [{ type: "input_text", text: "go" }] },
					{ type: "function_call", call_id: "call_1", name: "fn", arguments: "{}" },
					{ type: "function_call_output", call_id: "call_1", output: "done" },
				],
			},
			"gpt-5-codex",
		);
		expect(req.system).toBe("sys");
		expect(req.messages.some((m) => m.role === "toolResult")).toBe(true);
	});
});

describe("antigravity parser", () => {
	it("parses cloudcode SSE chunks", () => {
		const p = createAntigravityParser();
		const evts = [
			...p.parse(JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "he" }] } }] } })),
			...p.parse(JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: " thinking", thought: true }] } }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 2, thoughtsTokenCount: 3 } } })),
			...p.parse(JSON.stringify({ response: { candidates: [{ content: { parts: [{ functionCall: { name: "fn", args: { z: 1 } } }] }, finishReason: "STOP" }] } })),
		];
		expect(evts.some((e) => e.type === "text_delta" && e.delta === "he")).toBe(true);
		expect(evts.some((e) => e.type === "thinking_delta")).toBe(true);
		const start = evts.find((e) => e.type === "toolcall_start");
		const end = evts.find((e) => e.type === "toolcall_end");
		expect(start).toMatchObject({ name: "fn" });
		expect(end).toMatchObject({ arguments: { z: 1 } });
	});

	it("parses aggregated chunks", () => {
		const res = parseAntigravityResponse([
			{ response: { candidates: [{ content: { parts: [{ text: "a" }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } } },
			{ response: { candidates: [{ content: { parts: [{ text: "b" }] } }], usageMetadata: { candidatesTokenCount: 1 } } },
		]);
		expect(res.content[0]).toMatchObject({ type: "text", text: "ab" });
		expect(res.usage.completionTokens).toBe(2);
	});
});

describe("kiro egress", () => {
	it("builds conversationState matching real kiro wire format", () => {
		const body = buildKiroBody({
			model: "m",
			upstreamModel: "claude-sonnet-4.5",
			system: "be nice",
			stream: true,
			maxTokens: 4096,
			tools: [{ name: "read_file", description: "rf", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false } }],
			messages: [
				{ role: "user", content: [{ type: "text", text: "q1" }] },
				{ role: "assistant", content: [{ type: "text", text: "a1" }, { type: "toolCall", id: "t1", name: "read_file", arguments: { k: 1 } }] },
				{ role: "toolResult", content: [{ type: "toolResult", toolUseId: "t1", content: "res" }] },
				{ role: "user", content: [{ type: "text", text: "q2" }] },
			],
		}) as any;
		const cs = body.conversationState;
		expect(cs.currentMessage.userInputMessage).toMatchObject({
			content: "q2",
			modelId: "claude-sonnet-4.5",
			origin: "AI_EDITOR",
		});
		expect(cs.currentMessage.userInputMessage.userInputMessageContext.tools[0].toolSpecification.name).toBe("read_file");
		expect(cs.currentMessage.userInputMessage.userInputMessageContext.tools[0].toolSpecification.inputSchema.json.properties.path).toEqual({ type: "string" });
		expect(cs.currentMessage.userInputMessage.userInputMessageContext.toolResults[0].toolUseId).toBe("t1");
		expect(cs.chatTriggerType).toBe("MANUAL");
		expect(cs.agentTaskType).toBe("vibe");
		// history: [q1, a1] — toolResult hợp nhất vào currentMessage
		expect(cs.history).toHaveLength(2);
		expect(cs.history[0].userInputMessage.modelId).toBe("claude-sonnet-4.5");
		expect(cs.history[1].assistantResponseMessage.toolUses[0]).toMatchObject({ toolUseId: "t1", name: "read_file" });
		// top-level
		expect(body.systemPrompt).toBe("be nice");
		expect(body.agentMode).toBe("vibe");
		expect(body.inferenceConfig.maxTokens).toBe(4096);
	});

	it("parses kiro SSE events", () => {
		const p = new KiroStreamParser();
		const evts = [
			...p.parse(JSON.stringify({ event: { assistantResponseEvent: { content: "hi" } } })),
			...p.parse(JSON.stringify({ event: { reasoningContentEvent: { text: "think" } } })),
			...p.parse(JSON.stringify({ event: { toolUseEvent: { toolUseId: "t9", name: "fn", input: { a: 1 } } } })),
			p.finish(),
		];
		expect(evts[0]).toMatchObject({ type: "text_delta", delta: "hi" });
		expect(evts[1]).toMatchObject({ type: "thinking_delta", delta: "think" });
		expect(evts.find((e) => e.type === "toolcall_end")).toMatchObject({ id: "t9", arguments: { a: 1 } });
		expect(evts.at(-1)).toMatchObject({ type: "done", stopReason: "toolUse" });
	});
});

describe("aggregate + formatters non-stream", () => {
	it("aggregates events into a canonical result", () => {
		const { result } = aggregateEvents([
			{ type: "text_delta", delta: "x" },
			{ type: "text_delta", delta: "y" },
			{ type: "done", stopReason: "stop", usage: { promptTokens: 1, completionTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 } },
		]);
		expect(result?.content[0]).toMatchObject({ type: "text", text: "xy" });
		expect(result?.usage.completionTokens).toBe(2);
	});

	it("anthropic formatter emits message_start once and closes blocks", () => {
		const f = new AnthropicFormatter("m");
		const out = [
			...f.format({ type: "start" }),
			...f.format({ type: "text_delta", delta: "a" }),
			...f.format({ type: "text_delta", delta: "b" }),
			...f.format({ type: "done", stopReason: "stop", usage: { promptTokens: 3, completionTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 } }),
		].join("");
		expect(out.match(/event: message_start/g)).toHaveLength(1);
		expect(out.match(/event: content_block_start/g)).toHaveLength(1);
		expect(out.match(/event: content_block_stop/g)).toHaveLength(1);
		expect(out).toContain("event: message_stop");
	});
});

describe("api keys", () => {
	it("generates unique keys with stable hash + prefix", () => {
		const a = generateApiKey();
		const b = generateApiKey();
		expect(a.key).toMatch(/^mr_[A-Za-z0-9]{43}$/);
		expect(a.hash).toBe(hashToken(a.key));
		expect(a.prefix).toBe(a.key.slice(0, 11));
		expect(a.key).not.toBe(b.key);
		expect(a.hash).not.toBe(b.hash);
	});
});

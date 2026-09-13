import { describe, expect, it } from "bun:test";
import { buildOpenAiChatRequest, OpenAiChatParser, parseOpenAiChatResponse } from "../../src/server/gateway/egress/openai-chat.js";
import { computeCredits } from "../../src/server/usage/index.js";
import type { CanonicalRequest } from "../../src/server/gateway/canonical.js";
import { PROVIDERS } from "../../src/server/gateway/registry.js";

const req: CanonicalRequest = {
	model: "grok-4",
	upstreamModel: "grok-4",
	system: "sys",
	stream: true,
	maxTokens: 100,
	messages: [
		{ role: "user", content: [{ type: "text", text: "q1" }] },
		{ role: "assistant", content: [{ type: "toolCall", id: "t1", name: "fn", arguments: { a: 1 } }] },
		{ role: "toolResult", content: [{ type: "toolResult", toolUseId: "t1", content: "res" }] },
		{ role: "user", content: [{ type: "text", text: "q2" }] },
	],
	tools: [{ name: "fn", description: "d", parameters: { type: "object", properties: {} } }],
};

describe("openai-chat egress (grok + opencode)", () => {
	it("grok: builds /v1/chat/completions with bearer token + system message", () => {
		const built = buildOpenAiChatRequest(PROVIDERS.grok, req, "xai-token", "grok", "https://api.x.ai");
		expect(built.url).toBe("https://api.x.ai/v1/chat/completions");
		expect((built.headers as Record<string, string>).authorization).toBe("Bearer xai-token");
		const body = JSON.parse(built.body);
		expect(body.model).toBe("grok-4");
		expect(body.messages[0]).toMatchObject({ role: "system", content: "sys" });
		expect(body.messages.at(-1)).toMatchObject({ role: "user", content: "q2" });
		// tool result đã chuyển thành role:"tool"
		expect(body.messages.some((m: any) => m.role === "tool" && m.tool_call_id === "t1")).toBe(true);
	});

	it("opencode: builds /zen/v1/chat/completions with Bearer public + client headers", () => {
		const built = buildOpenAiChatRequest(PROVIDERS.opencode, req, "", "opencode", "https://opencode.ai");
		expect(built.url).toBe("https://opencode.ai/zen/v1/chat/completions");
		expect((built.headers as Record<string, string>).authorization).toBe("Bearer public");
		expect((built.headers as Record<string, string>)["x-opencode-client"]).toBe("desktop");
		expect((built.headers as Record<string, string>)["x-opencode-session"]).toMatch(/^ses_/);
		expect((built.headers as Record<string, string>)["x-opencode-request"]).toMatch(/^msg_/);
		expect((built.headers as Record<string, string>)["user-agent"]).toBe("opencode");
	});

	it("parses streamed chat chunks incl. tool_calls by index and usage", () => {
		const p = new OpenAiChatParser();
		const evts = [
			...p.parse(JSON.stringify({ choices: [{ delta: { role: "assistant" } }] })),
			...p.parse(JSON.stringify({ choices: [{ delta: { content: "he" } }] })),
			...p.parse(JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_9", function: { name: "fn", arguments: '{"x":' } }] } }] })),
			...p.parse(JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "1}" } }] } }] })),
			...p.parse(JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 33, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 8 } } })),
			...p.parse("[DONE]"),
		];
		expect(evts[0]).toMatchObject({ type: "text_delta", delta: "he" });
		expect(evts.find((e) => e.type === "toolcall_start")).toMatchObject({ id: "call_9", name: "fn" });
		expect(evts.find((e) => e.type === "toolcall_end")).toMatchObject({ id: "call_9", arguments: { x: 1 } });
		const done = evts.at(-1)!;
		expect(done).toMatchObject({ type: "done", stopReason: "toolUse" });
		if (done.type === "done") expect(done.usage).toMatchObject({ promptTokens: 33, completionTokens: 5, cacheReadTokens: 8 });
	});
});

describe("credits engine", () => {
	it("computes credits = in/1M*priceIn + out/1M*priceOut (1 cr = $0.01)", () => {
		// claude-sonnet-5: 300 in / 1500 out (=$3/$15 per M)
		const cr = computeCredits(300, 1500, { promptTokens: 1_000_000, completionTokens: 100_000, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 });
		expect(cr).toBe(300 + 150); // $3 + $1.5 → 450 cr
	});

	it("applies cache read 10% and cache write 125% of input price", () => {
		const cr = computeCredits(300, 1500, { promptTokens: 0, completionTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000, reasoningTokens: 0 });
		expect(cr).toBe(30 + 375);
	});

	it("free models cost 0", () => {
		const cr = computeCredits(0, 0, { promptTokens: 999_999, completionTokens: 999_999, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 });
		expect(cr).toBe(0);
	});

	it("parses non-stream chat completion", () => {
		const res = parseOpenAiChatResponse({
			choices: [{ message: { role: "assistant", content: "yo", tool_calls: [{ id: "c1", type: "function", function: { name: "fn", arguments: '{"a":2}' } }] }, finish_reason: "tool_calls" }],
			usage: { prompt_tokens: 10, completion_tokens: 3 },
		});
		expect(res.stopReason).toBe("toolUse");
		expect(res.content[0]).toMatchObject({ type: "text", text: "yo" });
		expect(res.content[1]).toMatchObject({ type: "toolCall", id: "c1", arguments: { a: 2 } });
	});
});

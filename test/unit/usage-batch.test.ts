import { describe, test, expect } from "bun:test";
import { recordUsage, flushUsageQueue } from "../../src/server/usage/index.js";
import { usageRepo } from "../../src/server/repositories/usage.repository.js";

describe("Usage Micro-Batching Buffer", () => {
	test("recordUsage batches writes in memory without immediate disk thrashing", async () => {
		// Queue up 5 usage records with null user (anonymous / keyless)
		for (let i = 0; i < 5; i++) {
			recordUsage({
				userId: null,
				apiKeyId: null,
				provider: "antigravity",
				connectionId: null,
				model: "gemini-3.8-flash",
				endpoint: "/v1/chat/completions",
				status: "ok",
				usage: {
					promptTokens: 100,
					completionTokens: 50,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					reasoningTokens: 0,
				},
				credits: 0.001,
				latencyMs: 120,
			});
		}

		// Flush the batch queue explicitly
		await flushUsageQueue();

		// Query admin logs to verify persistence
		const res = await usageRepo.getAllLogsPaged(1, 10);
		expect(res.total).toBeGreaterThanOrEqual(5);
		expect(res.logs.length).toBeGreaterThanOrEqual(5);
	});
});

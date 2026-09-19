import "dotenv/config";
import { modelRepo } from "../src/server/repositories/model.repository.js";
import { openUpstreamWithFailover, translateUpstreamStream } from "../src/server/gateway/router.js";
import type { CanonicalRequest } from "../src/server/gateway/canonical.js";

console.log("Testing Kiro models live through mnRouter router...");

const testModels = [
    "qwen3-coder-next",
    "deepseek-3.2",
    "minimax-m2.5",
    "glm-5",
    "claude-sonnet-4.5",
    "claude-sonnet-4",
    "claude-haiku-4.5",
];

for (const modelId of testModels) {
    const model = await modelRepo.findEnabledById(modelId);
    if (!model) {
        console.error(`Model not found or not enabled: ${modelId}`);
        continue;
    }

    const req: CanonicalRequest = {
        model: model.id,
        upstreamModel: model.upstreamModel,
        messages: [{ role: "user", content: [{ type: "text", text: "Say 'OK' and nothing else." }] }],
        temperature: 0.2,
        maxTokens: 10,
        stream: true,
    };

    try {
        const { attempt, connectionLabel } = await openUpstreamWithFailover("kiro", req);
        let output = "";
        for await (const ev of translateUpstreamStream(attempt.res.body!, attempt.parser, "kiro")) {
            if (ev.type === "text_delta") output += ev.delta;
        }
        console.log(`[PASS] ${modelId} (${connectionLabel}) -> ${output.trim()}`);
    } catch (e) {
        console.error(`[FAIL] ${modelId} ->`, (e as Error).message);
    }
}

process.exit(0);

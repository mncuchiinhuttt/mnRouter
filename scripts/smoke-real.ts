/**
 * Smoke test với provider thật (dùng connection đã import).
 * Dùng: DATABASE_URL=... pnpm tsx scripts/smoke-real.ts [model ...]
 * Mặc định thử: claude-sonnet-4-5, gpt-5-codex (max_tokens nhỏ).
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:8787";
const models = process.argv.slice(2).length ? process.argv.slice(2) : ["claude-sonnet-4-5", "gpt-5-codex"];
const key = process.env.SMOKE_KEY;
if (!key) {
	console.error("Cần SMOKE_KEY=<mr_...>");
	process.exit(1);
}

let failures = 0;
for (const model of models) {
	const started = Date.now();
	try {
		const res = await fetch(`${BASE}/v1/chat/completions`, {
			method: "POST",
			headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
			body: JSON.stringify({
				model,
				max_tokens: 64,
				messages: [{ role: "user", content: "Trả lời đúng 1 từ: ping" }],
			}),
		});
		const json = (await res.json()) as any;
		const ms = Date.now() - started;
		if (res.ok) {
			const text = json.choices?.[0]?.message?.content ?? "";
			const usage = json.usage ?? {};
			console.log(`✅ ${model}: "${String(text).slice(0, 60)}" (${ms}ms, in=${usage.prompt_tokens} out=${usage.completion_tokens})`);
		} else {
			failures++;
			console.error(`❌ ${model}: HTTP ${res.status} — ${JSON.stringify(json).slice(0, 300)}`);
		}
	} catch (err) {
		failures++;
		console.error(`❌ ${model}: ${(err as Error).message}`);
	}
}
process.exit(failures ? 1 : 0);

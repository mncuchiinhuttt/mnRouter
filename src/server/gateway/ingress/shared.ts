import type { CanonicalContentBlock, CanonicalResult, StreamEvent } from "../canonical.js";

/** Accumulate canonical stream events into a final result (for non-stream clients). */
export function aggregateEvents(events: StreamEvent[]): { result: CanonicalResult | null; error?: { code: string; message: string } } {
	const content: CanonicalContentBlock[] = [];
	let text: string | null = null;
	let thinking: string | null = null;
	const tools = new Map<string, { id: string; name: string; args: string }>();
	let usage = { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
	let stopReason: CanonicalResult["stopReason"] = "stop";
	let error: { code: string; message: string } | undefined;

	for (const ev of events) {
		switch (ev.type) {
			case "text_delta":
				text = (text ?? "") + ev.delta;
				break;
			case "thinking_delta":
				thinking = (thinking ?? "") + ev.delta;
				break;
			case "toolcall_start":
				tools.set(ev.id, { id: ev.id, name: ev.name, args: "" });
				break;
			case "toolcall_delta": {
				const t = tools.get(ev.id);
				if (t) t.args += ev.delta;
				else tools.set(ev.id, { id: ev.id, name: "", args: ev.delta });
				break;
			}
			case "toolcall_end":
				tools.set(ev.id, { id: ev.id, name: ev.name, args: JSON.stringify(ev.arguments) });
				break;
			case "done":
				usage = ev.usage;
				stopReason = ev.stopReason;
				break;
			case "error":
				error = { code: ev.errorCode, message: ev.message };
				break;
			default:
				break;
		}
	}
	if (error) return { result: null, error };
	if (thinking) content.push({ type: "thinking", thinking });
	if (text) content.push({ type: "text", text });
	for (const t of tools.values()) {
		let args: Record<string, unknown> = {};
		try {
			args = JSON.parse(t.args || "{}") as Record<string, unknown>;
		} catch {
			args = {};
		}
		content.push({ type: "toolCall", id: t.id, name: t.name, arguments: args });
	}
	return { result: { content, stopReason, usage } };
}

export function randomId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

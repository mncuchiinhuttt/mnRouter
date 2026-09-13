/**
 * Canonical internal request/response model — mọi ingress được chuẩn hoá về dạng này,
 * mọi egress adapter nhận dạng này. Tham khảo thiết kế của @oh-my-pi/pi-ai.
 */

export type CanonicalRole = "user" | "assistant" | "toolResult";

export interface CanonicalToolCall {
	type: "toolCall";
	id: string;
	name: string;
	/** Full parsed arguments (when complete). */
	arguments?: Record<string, unknown>;
	/** Partial JSON accumulated while streaming. */
	argumentsJson?: string;
	/** Opaque signature for reusing thinking context (Google/Anthropic). */
	thoughtSignature?: string;
}

export type CanonicalContentBlock =
	| { type: "text"; text: string }
	| { type: "thinking"; thinking: string; signature?: string }
	| { type: "image"; mime: string; data: string }
	| CanonicalToolCall
	| { type: "toolResult"; toolUseId: string; content: string; image?: { mime: string; data: string }; isError?: boolean };

export interface CanonicalMessage {
	role: CanonicalRole;
	content: CanonicalContentBlock[];
}

export interface CanonicalTool {
	name: string;
	description?: string;
	/** JSON schema object. */
	parameters: Record<string, unknown>;
}

export interface CanonicalRequest {
	model: string; // public model id
	upstreamModel: string;
	system?: string;
	messages: CanonicalMessage[];
	tools?: CanonicalTool[];
	toolChoice?: "auto" | "none" | "required" | { name: string };
	stream: boolean;
	maxTokens?: number;
	temperature?: number;
	topP?: number;
	/** reasoning effort hint for providers that support it */
	reasoningEffort?: "low" | "medium" | "high";
	/** Provider-specific raw fields to merge back when egress family matches ingress family. */
	passthrough?: Record<string, unknown>;
}

export interface CanonicalUsage {
	promptTokens: number;
	completionTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	reasoningTokens: number;
}

export type StopReason = "stop" | "length" | "toolUse";

export type StreamEvent =
	| { type: "start" }
	| { type: "text_delta"; delta: string }
	| { type: "thinking_delta"; delta: string }
	| { type: "toolcall_start"; id: string; name: string }
	| { type: "toolcall_delta"; id: string; delta: string }
	| { type: "toolcall_end"; id: string; name: string; arguments: Record<string, unknown> }
	| { type: "done"; stopReason: StopReason; usage: CanonicalUsage }
	| { type: "error"; errorCode: string; message: string; retryable: boolean; httpStatus?: number };

/** Result of a completed non-streaming upstream call. */
export interface CanonicalResult {
	content: CanonicalContentBlock[];
	stopReason: StopReason;
	usage: CanonicalUsage;
}

export function emptyUsage(): CanonicalUsage {
	return { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
}

export class UpstreamError extends Error {
	constructor(
		message: string,
		readonly httpStatus: number,
		readonly errorCode: string,
		readonly retryable: boolean,
	) {
		super(message);
		this.name = "UpstreamError";
	}
}

/** Map an upstream HTTP status to cooldown/retry classification (borrowed from 9router). */
export function classifyUpstreamError(status: number, message: string): { retryable: boolean; cooldownMs: number } {
	if (status === 401 || status === 403) return { retryable: true, cooldownMs: 120_000 };
	if (status === 402 || status === 404) return { retryable: false, cooldownMs: 120_000 };
	if (status === 429) return { retryable: true, cooldownMs: 30_000 };
	if (status >= 500) return { retryable: true, cooldownMs: 10_000 };
	if (status === 408) return { retryable: true, cooldownMs: 5_000 };
	return { retryable: false, cooldownMs: 0 };
}

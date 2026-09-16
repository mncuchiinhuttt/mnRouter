export interface ClarifyOption {
	id?: string;
	label: string;
	description?: string;
}

export interface ClarificationData {
	question?: string;
	type?: "single" | "multi" | "text";
	options: ClarifyOption[];
	allowChatMore?: boolean;
}

export function extractClarification(content: string): { cleaned: string; clarify: ClarificationData | null } {
	if (!content) return { cleaned: "", clarify: null };

	const match =
		content.match(/<clarify(?:\s+question="([^"]*)")?(?:\s+type="([^"]*)")?(?:\s+options=\x27([^\x27]*)\x27)?[^>]*>([\s\S]*?)<\/clarify>/i) ||
		content.match(/<clarify(?:\s+question="([^"]*)")?(?:\s+type="([^"]*)")?(?:\s+options="([^"]*)")?[^>]*\/>/i) ||
		content.match(/<ask(?:\s+question="([^"]*)")?(?:\s+type="([^"]*)")?(?:\s+options=\x27([^\x27]*)\x27)?[^>]*>([\s\S]*?)<\/ask>/i);

	if (!match) return { cleaned: content, clarify: null };

	const fullTag = match[0]!;
	const cleaned = content.replace(fullTag, "").trim();
	let question = match[1] || "";
	let type: "single" | "multi" | "text" = (match[2] as any) || "single";
	let options: ClarifyOption[] = [];

	if (match[3]) {
		try {
			options = JSON.parse(match[3]);
		} catch {}
	}

	if (options.length === 0 && match[4]) {
		try {
			const parsed = JSON.parse(match[4].trim());
			if (parsed.question && !question) question = parsed.question;
			if (parsed.type) type = parsed.type;
			if (parsed.multi) type = "multi";
			if (Array.isArray(parsed.options)) options = parsed.options;
		} catch {}
	}

	if (type !== "text" && options.length === 0) return { cleaned: content, clarify: null };
	return { cleaned, clarify: { question, type, options, allowChatMore: true } };
}

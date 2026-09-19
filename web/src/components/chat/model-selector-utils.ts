import type { ModelItem } from "./thread-sidebar";

const PROVIDER_ORDER = ["claude", "codex", "antigravity", "kiro", "opencode", "other"];
const PROVIDER_LABELS: Record<string, string> = {
	claude: "Anthropic Claude",
	codex: "OpenAI Codex",
	antigravity: "Google Antigravity",
	kiro: "AWS Kiro",
	opencode: "OpenCode",
};

export interface ModelGroup {
	provider: string;
	name: string;
	models: ModelItem[];
}

export function groupModelsByProvider(models: ModelItem[]): ModelGroup[] {
	const groups: Record<string, ModelItem[]> = {};
	for (const m of models) {
		const p = (m.provider || "other").toLowerCase();
		if (!groups[p]) groups[p] = [];
		groups[p]!.push(m);
	}
	for (const p in groups) {
		groups[p]!.sort((a, b) => (a.displayName || a.id).localeCompare(b.displayName || b.id));
	}
	return Object.keys(groups)
		.sort((a, b) => {
			const idxA = PROVIDER_ORDER.indexOf(a);
			const idxB = PROVIDER_ORDER.indexOf(b);
			return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
		})
		.map((p) => ({
			provider: p,
			name: PROVIDER_LABELS[p] || p.toUpperCase(),
			models: groups[p]!,
		}));
}

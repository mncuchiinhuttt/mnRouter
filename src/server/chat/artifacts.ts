export interface ExtractedArtifact {
	identifier: string;
	type: "html" | "code" | "svg" | "markdown";
	title: string;
	content: string;
	language?: string;
}

export function extractArtifacts(text: string): ExtractedArtifact[] {
	const artifacts: ExtractedArtifact[] = [];

	// 1. Check for explicit <artifact> tags (Claude / ChatGPT style)
	const tagRegex = /<artifact\s+([^>]*?)>([\s\S]*?)<\/artifact>/gi;
	let match: RegExpExecArray | null;

	while ((match = tagRegex.exec(text)) !== null) {
		const rawAttrs = match[1] || "";
		const content = (match[2] || "").trim();
		if (!content) continue;

		const idMatch = /identifier=["']([^"']+)["']/i.exec(rawAttrs);
		const typeMatch = /type=["']([^"']+)["']/i.exec(rawAttrs);
		const titleMatch = /title=["']([^"']+)["']/i.exec(rawAttrs);
		const langMatch = /language=["']([^"']+)["']/i.exec(rawAttrs);

		const rawType = (typeMatch?.[1] || "code").toLowerCase();
		const type = (["html", "code", "svg", "markdown"].includes(rawType) ? rawType : "code") as ExtractedArtifact["type"];

		artifacts.push({
			identifier: idMatch?.[1] || `artifact-${artifacts.length + 1}`,
			type,
			title: titleMatch?.[1] || "Artifact",
			content,
			language: langMatch?.[1] || undefined,
		});
	}

	// 2. If no explicit tags, inspect large code blocks for standalone HTML/SVG/code documents
	if (artifacts.length === 0) {
		const codeBlockRegex = /```([a-zA-Z0-9_-]*)\s*([^\n]*)\n([\s\S]*?)```/g;
		let codeMatch: RegExpExecArray | null;

		while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
			const lang = (codeMatch[1] || "").toLowerCase().trim();
			const header = (codeMatch[2] || "").trim();
			const codeContent = (codeMatch[3] || "").trim();

			// If it's HTML, SVG, or a large code block (> 12 lines)
			const isHtml = lang === "html" || codeContent.includes("<!DOCTYPE html") || codeContent.includes("<html");
			const isSvg = lang === "svg" || (codeContent.startsWith("<svg") && codeContent.endsWith("</svg>"));
			const lineCount = codeContent.split("\n").length;

			if (isHtml || isSvg || lineCount >= 12) {
				let type: ExtractedArtifact["type"] = "code";
				if (isHtml) type = "html";
				else if (isSvg) type = "svg";

				const title = header.replace(/^title=["']?|["']?$/g, "").trim() || (isHtml ? "HTML Preview" : isSvg ? "SVG Vector" : `${lang || "Code"} snippet`);

				artifacts.push({
					identifier: `artifact-${artifacts.length + 1}`,
					type,
					title,
					content: codeContent,
					language: lang || undefined,
				});
			}
		}
	}

	return artifacts;
}

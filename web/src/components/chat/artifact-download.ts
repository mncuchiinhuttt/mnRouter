import type { ArtifactItem } from "./message-list";

export function getArtifactExtension(artifact: ArtifactItem): string {
	const lang = (artifact.language || "").toLowerCase().trim();
	const type = (artifact.type || "").toLowerCase().trim();

	const map: Record<string, string> = {
		cpp: ".cpp",
		"c++": ".cpp",
		c: ".c",
		python: ".py",
		py: ".py",
		javascript: ".js",
		js: ".js",
		typescript: ".ts",
		ts: ".ts",
		jsx: ".jsx",
		tsx: ".tsx",
		html: ".html",
		htm: ".html",
		css: ".css",
		json: ".json",
		sql: ".sql",
		markdown: ".md",
		md: ".md",
		svg: ".svg",
		bash: ".sh",
		sh: ".sh",
		shell: ".sh",
		rust: ".rs",
		rs: ".rs",
		go: ".go",
		golang: ".go",
		java: ".java",
		yaml: ".yaml",
		yml: ".yaml",
		xml: ".xml",
	};

	if (map[lang]) return map[lang]!;
	if (type === "html") return ".html";
	if (type === "svg") return ".svg";
	if (type === "markdown") return ".md";
	return ".txt";
}

export function downloadArtifactFile(artifact: ArtifactItem): string {
	let filename = (artifact.title || artifact.identifier || "artifact").trim();
	const ext = getArtifactExtension(artifact);

	if (!filename.toLowerCase().endsWith(ext)) {
		filename = `${filename}${ext}`;
	}

	const cleanFilename = filename.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_");
	const mime =
		ext === ".html"
			? "text/html;charset=utf-8"
			: ext === ".svg"
			? "image/svg+xml;charset=utf-8"
			: ext === ".json"
			? "application/json;charset=utf-8"
			: "text/plain;charset=utf-8";

	const blob = new Blob([artifact.content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = cleanFilename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);

	return cleanFilename;
}

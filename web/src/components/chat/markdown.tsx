import { useMemo } from "react";
import { marked } from "marked";
import hljs from "highlight.js";

marked.use({
	renderer: {
		code({ text, lang }: { text: string; lang?: string }) {
			const validLang = lang && hljs.getLanguage(lang) ? lang : undefined;
			const highlighted = validLang
				? hljs.highlight(text, { language: validLang }).value
				: hljs.highlightAuto(text).value;
			return `<pre><code class="hljs ${validLang || ""}">${highlighted}</code></pre>`;
		},
	},
});
interface MarkdownProps {
	content: string;
	className?: string;
}

export function Markdown({ content, className = "" }: MarkdownProps) {
	const html = useMemo(() => {
		if (!content) return "";

		// Strip <artifact> and <clarify> blocks from the visible text
		let cleaned = content
			.replace(/<artifact\s+[^>]*?>[\s\S]*?<\/artifact>/gi, "")
			.replace(/<clarify[\s\S]*?<\/clarify>/gi, "")
			.replace(/<clarify[^>]*\/>/gi, "")
			.trim();

		if (!cleaned && (content.includes("<artifact") || content.includes("<clarify"))) {
			cleaned = content.includes("<clarify") ? "" : "*(Đã tạo artifact bên dưới)*";
		}

		try {
			return marked.parse(cleaned, {
				gfm: true,
				breaks: true,
			}) as string;
		} catch {
			return cleaned;
		}
	}, [content]);

	return (
		<div
			className={`markdown-body text-sm leading-relaxed text-ink space-y-2 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-paper-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-line/60 [&_pre]:bg-[#0b0b26] [&_pre]:text-[#f0f0f5] [&_pre]:p-3.5 [&_pre]:rounded-md [&_pre]:my-2.5 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:text-[#f0f0f5] [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_th]:border [&_th]:border-line [&_th]:bg-paper-2 [&_th]:p-1.5 [&_th]:text-xs [&_th]:font-semibold [&_td]:border [&_td]:border-line [&_td]:p-1.5 [&_td]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:text-ink-2 [&_blockquote]:italic ${className}`}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}

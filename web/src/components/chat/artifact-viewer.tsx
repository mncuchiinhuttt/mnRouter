import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Clock, Code2, Copy, ExternalLink, Eye, FileCode, Printer, X } from "lucide-react";
import { toast } from "sonner";
import hljs from "highlight.js";
import { Button } from "@web/components/ui/button";
import { getBeautifiedHtml } from "./artifact-html-utils";
import type { ArtifactItem } from "./message-list";

export interface ArtifactViewerProps {
	artifact: ArtifactItem | null;
	onClose: () => void;
}

export function ArtifactViewer({ artifact, onClose }: ArtifactViewerProps) {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState<"preview" | "code">(
		artifact?.type === "html" || artifact?.type === "svg" ? "preview" : "code"
	);
	const [copied, setCopied] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		if (artifact) {
			setActiveTab(artifact.type === "html" || artifact.type === "svg" ? "preview" : "code");
		}
	}, [artifact?.id, artifact?.type]);

	const isPreviewable = artifact?.type === "html" || artifact?.type === "svg";
	const effectiveTab = !isPreviewable ? "code" : activeTab;

	const { highlightedHtml, lineCount } = useMemo(() => {
		if (!artifact?.content) return { highlightedHtml: "", lineCount: 0 };
		const code = artifact.content;
		const lang = (artifact.language || "").trim().toLowerCase();

		let result = "";
		if (lang && hljs.getLanguage(lang)) {
			result = hljs.highlight(code, { language: lang }).value;
		} else {
			result = hljs.highlightAuto(code).value;
		}

		return { highlightedHtml: result, lineCount: code.split("\n").length };
	}, [artifact?.content, artifact?.language]);

	if (!artifact) return null;

	const handleCopy = async () => {
		await navigator.clipboard.writeText(artifact.content);
		setCopied(true);
		toast.success(t("chat.copied"));
		setTimeout(() => setCopied(false), 2000);
	};

	const handlePrint = () => {
		if (effectiveTab !== "preview") setActiveTab("preview");
		setTimeout(() => {
			iframeRef.current?.contentWindow?.focus();
			iframeRef.current?.contentWindow?.print();
		}, 150);
	};

	const handleOpenNewTab = () => {
		const html = artifact.type === "html" ? getBeautifiedHtml(artifact.content) : artifact.content;
		const blob = new Blob([html], {
			type: artifact.type === "html" ? "text/html" : artifact.type === "svg" ? "image/svg+xml" : "text/plain",
		});
		const url = URL.createObjectURL(blob);
		window.open(url, "_blank");
	};

	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-white select-text">
			{/* Unified Sleek Header Bar */}
			<div className="flex min-h-[42px] items-center justify-between border-b border-line bg-white px-3 py-1.5 text-xs shrink-0">
				{/* Left Info: Icon, Title, Type, TTL */}
				<div className="flex items-center gap-2 overflow-hidden mr-2">
					<div className="flex size-6 items-center justify-center rounded-md bg-paper-2 border border-line text-accent shrink-0">
						{effectiveTab === "preview" ? <Eye className="size-3.5" /> : <FileCode className="size-3.5" />}
					</div>
					<span className="font-semibold text-xs text-ink truncate max-w-[160px] sm:max-w-xs" title={artifact.title}>
						{artifact.title}
					</span>
					<span className="rounded bg-paper-2 px-1.5 py-0.2 font-mono text-[9.5px] text-ink-2 uppercase border border-line shrink-0">
						{artifact.language || artifact.type}
					</span>
					<div className="hidden sm:flex items-center gap-1 rounded bg-[#f4faf5] border border-[#bcd9c0] px-1.5 py-0.2 text-[9.5px] font-mono text-[#1d7a33] shrink-0">
						<Clock className="size-2.5" />
						<span>24h</span>
					</div>
				</div>

				{/* Right Actions: View tabs, Print, Copy, Close */}
				<div className="flex items-center gap-1 shrink-0">
					{isPreviewable && (
						<div className="flex items-center rounded-md border border-line bg-paper p-0.5 mr-1">
							<button
								type="button"
								onClick={() => setActiveTab("preview")}
								className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition ${
									effectiveTab === "preview" ? "bg-accent text-white font-medium shadow-2xs" : "text-ink-2 hover:text-ink"
								}`}
							>
								<Eye className="size-3" />
								<span>{t("chat.tabPreview")}</span>
							</button>
							<button
								type="button"
								onClick={() => setActiveTab("code")}
								className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition ${
									effectiveTab === "code" ? "bg-accent text-white font-medium shadow-2xs" : "text-ink-2 hover:text-ink"
								}`}
							>
								<Code2 className="size-3" />
								<span>{t("chat.tabCode")}</span>
							</button>
						</div>
					)}

					{isPreviewable && (
						<>
							<Button size="sm" variant="outline" className="h-6 gap-1 text-[11px] font-mono px-2" onClick={handlePrint} title="In / PDF">
								<Printer className="size-3 text-accent" />
								<span className="hidden md:inline">PDF</span>
							</Button>
							<Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-ink-2 hover:text-ink" onClick={handleOpenNewTab} title={t("chat.openInNewTab")}>
								<ExternalLink className="size-3.5" />
							</Button>
						</>
					)}

					<Button size="sm" variant="outline" className="h-6 gap-1 text-[11px] font-mono px-2" onClick={handleCopy}>
						{copied ? <Check className="size-3 text-[#1d7a33]" /> : <Copy className="size-3 text-ink-2" />}
						<span>{copied ? t("chat.copied") : t("chat.copyCode")}</span>
					</Button>

					<button
						type="button"
						onClick={onClose}
						className="size-6 flex items-center justify-center rounded p-1 text-ink-2 hover:bg-paper-2 hover:text-ink cursor-pointer transition ml-0.5"
						title={t("common.close")}
					>
						<X className="size-4" />
					</button>
				</div>
			</div>

			{/* Full-Bleed Content Area */}
			<div className="flex-1 w-full h-full overflow-hidden bg-[#0d1117]">
				{effectiveTab === "preview" ? (
					<iframe
						ref={iframeRef}
						title={artifact.title}
						srcDoc={artifact.type === "html" ? getBeautifiedHtml(artifact.content) : artifact.content}
						sandbox="allow-scripts allow-modals"
						className="h-full w-full border-none bg-white"
					/>
				) : (
					<div className="flex h-full w-full overflow-auto text-xs font-mono leading-relaxed select-text">
						{/* Line numbers gutter */}
						<div className="sticky left-0 top-0 flex flex-col py-3 px-2.5 select-none text-right bg-[#0d1117] border-r border-[#30363d] text-[#6e7681] text-[11px] tabular-nums shrink-0">
							{Array.from({ length: lineCount }, (_, i) => (
								<span key={i + 1} className="leading-5">
									{i + 1}
								</span>
							))}
						</div>

						{/* Code text with full syntax highlighting */}
						<div className="flex-1 py-3 px-3.5 overflow-x-auto">
							<pre className="!bg-transparent !p-0 !m-0 overflow-visible">
								<code
									className={`hljs !bg-transparent !p-0 text-[12px] leading-5 font-mono ${artifact.language || ""}`}
									dangerouslySetInnerHTML={{ __html: highlightedHtml }}
								/>
							</pre>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

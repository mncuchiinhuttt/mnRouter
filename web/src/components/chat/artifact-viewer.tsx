import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Clock, Code, Copy, ExternalLink, Eye, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@web/components/ui/button";
import type { ArtifactItem } from "./message-list";

const CLEAN_PRINT_STYLE = `<style id="mnrouter-clean-print">
button[style*="28a745"], button[style*="green"], .print-btn, button[onclick*="print"] {
  background: #0f172a !important;
  color: #ffffff !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(255,255,255,0.2) !important;
  font-family: ui-sans-serif, system-ui, sans-serif !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  padding: 6px 14px !important;
  box-shadow: 0 4px 14px rgba(0,0,0,0.2) !important;
  transition: all 0.2s ease !important;
  cursor: pointer !important;
}
button[style*="28a745"]:hover, button[style*="green"]:hover, .print-btn:hover, button[onclick*="print"]:hover {
  background: #1e293b !important;
  transform: translateY(-1px) !important;
}
@media print {
  button, .no-print, [onclick*="print"] { display: none !important; }
}
</style>`;
const SVG_PRINTER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1.5px;margin-right:6px;"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>`;

function getBeautifiedHtml(content: string): string {
	if (!content.includes("<html") && !content.includes("<body")) return content;
	const res = content.replace(/🖨\s*/g, SVG_PRINTER_ICON);
	if (res.includes("</head>")) {
		return res.replace("</head>", `${CLEAN_PRINT_STYLE}</head>`);
	}
	return `${CLEAN_PRINT_STYLE}${res}`;
}
interface ArtifactViewerProps {
	artifact: ArtifactItem | null;
	onClose: () => void;
}

export function ArtifactViewer({ artifact, onClose }: ArtifactViewerProps) {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState<"preview" | "code">(artifact?.type === "html" || artifact?.type === "svg" ? "preview" : "code");
	useEffect(() => {
		if (artifact) setActiveTab(artifact.type === "html" || artifact.type === "svg" ? "preview" : "code");
	}, [artifact?.id, artifact?.type]);
	const [copied, setCopied] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	const handlePrint = () => {
		if (effectiveTab !== "preview") setActiveTab("preview");
		setTimeout(() => {
			iframeRef.current?.contentWindow?.focus();
			iframeRef.current?.contentWindow?.print();
		}, 150);
	};

	if (!artifact) return null;

	const isPreviewable = artifact.type === "html" || artifact.type === "svg";
	const effectiveTab = !isPreviewable ? "code" : activeTab;

	const handleCopy = async () => {
		await navigator.clipboard.writeText(artifact.content);
		setCopied(true);
		toast.success(t("chat.copied"));
		setTimeout(() => setCopied(false), 2000);
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
		<div className="flex h-full w-full flex-col border-l border-line bg-white shadow-lg lg:w-[480px] xl:w-[560px]">
			{/* Top Bar */}
			<div className="flex items-center justify-between border-b border-line bg-paper px-4 py-3">
				<div className="flex items-center gap-2 overflow-hidden">
					<span className="font-semibold text-sm text-ink truncate">{artifact.title}</span>
					<span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-ink-2 uppercase border border-line">
						{artifact.type}
					</span>
				</div>

				<div className="flex items-center gap-1.5">
					<div className="flex items-center gap-1 rounded bg-[#f4faf5] border border-[#bcd9c0] px-2 py-0.5 text-[10.5px] font-mono text-[#1d7a33]">
						<Clock className="size-3" />
						<span>24h TTL</span>
					</div>

					<button
						type="button"
						onClick={onClose}
						className="rounded p-1 text-ink-2 hover:bg-paper-2 hover:text-ink cursor-pointer transition"
						title={t("common.close")}
					>
						<X className="size-4" />
					</button>
				</div>
			</div>

			{/* Subheader: Tabs & Action Buttons */}
			<div className="flex items-center justify-between border-b border-line bg-white px-4 py-2">
				<div className="flex items-center gap-1">
					{isPreviewable && (
						<button
							type="button"
							onClick={() => setActiveTab("preview")}
							className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono transition cursor-pointer ${
								effectiveTab === "preview" ? "bg-accent text-white font-medium" : "text-ink-2 hover:text-ink hover:bg-paper-2"
							}`}
						>
							<Eye className="size-3" />
							<span>{t("chat.tabPreview")}</span>
						</button>
					)}
					<button
						type="button"
						onClick={() => setActiveTab("code")}
						className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono transition cursor-pointer ${
							effectiveTab === "code" ? "bg-accent text-white font-medium" : "text-ink-2 hover:text-ink hover:bg-paper-2"
						}`}
					>
						<Code className="size-3" />
						<span>{t("chat.tabCode")}</span>
					</button>
				</div>

				<div className="flex items-center gap-1">
					{isPreviewable && (
						<>
							<Button size="sm" variant="outline" className="h-7 gap-1 text-xs font-mono" onClick={handlePrint} title="In tài liệu / Xuất file PDF">
								<Printer className="size-3 text-accent" />
								<span className="hidden sm:inline">In / PDF</span>
							</Button>
							<Button size="sm" variant="ghost" className="h-7 gap-1 text-xs font-mono" onClick={handleOpenNewTab}>
								<ExternalLink className="size-3" />
								<span className="hidden sm:inline">{t("chat.openInNewTab")}</span>
							</Button>
						</>
					)}
					<Button size="sm" variant="outline" className="h-7 gap-1 text-xs font-mono" onClick={handleCopy}>
						{copied ? <Check className="size-3 text-[#1d7a33]" /> : <Copy className="size-3" />}
						<span>{copied ? t("chat.copied") : t("chat.copyCode")}</span>
					</Button>
				</div>
			</div>

			{/* Content Body */}
			<div className="flex-1 overflow-auto bg-[#fafafa]">
				{effectiveTab === "preview" ? (
					<iframe
						ref={iframeRef}
						title={artifact.title}
						srcDoc={artifact.type === "html" ? getBeautifiedHtml(artifact.content) : artifact.content}
						sandbox="allow-scripts allow-modals"
						className="h-full w-full border-none bg-white"
					/>
				) : (
					<div className="p-4 font-mono text-xs leading-relaxed text-[#0b0b26]">
						<pre className="overflow-x-auto whitespace-pre rounded-md bg-[#0b0b26] p-4 text-[#f0f0f5]">
							<code>{artifact.content}</code>
						</pre>
					</div>
				)}
			</div>
		</div>
	);
}

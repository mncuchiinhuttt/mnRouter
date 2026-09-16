import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Code2, Copy, Download, FileCode2, FileText, Globe, Sparkles, ThumbsDown, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { fmtCompact } from "@web/lib/utils";
import { Markdown } from "./markdown";
import { ExecutionLogBox } from "./execution-log-box";
import { ClarificationBox, extractClarification } from "./clarification-box";
import { FeedbackDialog } from "./feedback-dialog";
import type { ExecutionStep, SearchData } from "./execution-types";
import { downloadArtifactFile } from "./artifact-download";
export interface MessageItem {
	id: string;
	threadId?: string;
	role: "user" | "assistant" | "system";
	content: string;
	fileIds?: string[] | null;
	meta?: {
		thinking?: string;
		skills?: string[];
		fileIds?: string[];
		searches?: SearchData[];
		steps?: ExecutionStep[];
		tokens?: number;
		latencyMs?: number;
	} | null;
	createdAt: string;
}

export interface ArtifactItem {
	id: string;
	messageId: string;
	identifier: string;
	type: "html" | "code" | "svg" | "markdown";
	title: string;
	content: string;
	language?: string | null;
	expiresAt: string;
}
interface MessageListProps {
	messages: MessageItem[];
	streamingContent: string;
	streamingThinking?: string;
	streamingSearches?: SearchData[];
	streamingSteps?: ExecutionStep[];
	streamingLatencyMs?: number;
	isStreaming: boolean;
	artifacts: ArtifactItem[];
	onOpenArtifact: (art: ArtifactItem) => void;
	onSelectOption?: (text: string) => void;
	filesMap?: Record<string, { id: string; filename: string; sizeBytes: number }>;
}

export function MessageList({
	messages, streamingContent, streamingThinking = "", streamingSearches = [], streamingSteps = [], streamingLatencyMs, isStreaming, artifacts, onOpenArtifact, onSelectOption, filesMap = {},
}: MessageListProps) {
	const { t } = useTranslation();
	const bottomRef = useRef<HTMLDivElement>(null);
	const [unliked, setUnliked] = useState<Record<string, boolean>>({});
	const [feedbackTarget, setFeedbackTarget] = useState<{ messageId: string; threadId: string; preview: string } | null>(null);
	const copyText = (c: string) => { void navigator.clipboard.writeText(c.replace(/<artifact\s+[^>]*?>[\s\S]*?<\/artifact>/gi, "").replace(/<clarify[\s\S]*?<\/clarify>/gi, "").replace(/[*_#`~[\]]/g, "").trim()); toast.success("Đã sao chép Text"); };
	const copyMd = (c: string) => { void navigator.clipboard.writeText(c); toast.success("Đã sao chép Markdown"); };
	const toggleUnlike = (id: string) => setUnliked((p) => { const n = !p[id]; toast(n ? "Đã ghi nhận phản hồi (Unlike)" : "Đã bỏ đánh giá"); return { ...p, [id]: n }; });

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, streamingContent, streamingThinking]);

	const artifactsByMsg = artifacts.reduce<Record<string, ArtifactItem[]>>((acc, a) => { (acc[a.messageId] ||= []).push(a); return acc; }, {});

	return (
		<div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
			{messages.length === 0 && !isStreaming && (
				<div className="flex h-full flex-col items-center justify-center text-center p-8 space-y-3">
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-paper-2 border border-line"><Sparkles className="size-6 text-accent" /></div>
					<h3 className="font-semibold text-base text-ink">{t("chat.title")}</h3>
					<p className="max-w-md text-xs text-ink-2 leading-relaxed">{t("chat.startConvo")}</p>
					<span className="font-mono text-[11px] text-ink-2/70 bg-paper px-2 py-1 rounded border border-line">{t("chat.uploadLimit")}</span>
				</div>
			)}
			{messages.map((msg, idx) => {
				if (msg.role === "system") {
					return (
						<div key={msg.id} className="my-4 flex items-center justify-center gap-3 px-2 w-full max-w-3xl mx-auto select-none">
							<div className="h-px flex-1 bg-line" /><span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-2 shrink-0"><Bot className="size-3.5 text-accent" /><span>{msg.content}</span></span><div className="h-px flex-1 bg-line" />
						</div>
					);
				}
				const isUser = msg.role === "user";
				const msgArtifacts = artifactsByMsg[msg.id] || [];
				return (
					<div key={msg.id} className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto justify-end" : "mr-auto"}`}>
						{!isUser && (
							<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-white text-xs">
								<Bot className="size-3.5" />
							</div>
						)}

						<div className={`space-y-2 ${isUser ? "items-end" : "items-start"}`}>
							{isUser && msg.fileIds && msg.fileIds.length > 0 && (
								<div className="flex flex-wrap gap-1.5 justify-end">
									{msg.fileIds.map((fid) => (
										<div key={fid} className="flex items-center gap-1.5 rounded bg-white px-2 py-1 border border-line text-[11px] font-mono shadow-2xs">
											<FileText className="size-3 text-accent" /><span className="truncate max-w-[140px]">{filesMap[fid]?.filename || "Attachment"}</span><span className="text-[9px] text-[#1d7a33] bg-[#f4faf5] px-1 rounded border border-[#bcd9c0]">24h</span>
										</div>
									))}
								</div>
							)}

							{/* Message Bubble */}
							{/* Thinking & Skills Box if assistant */}
							{!isUser && (
								<ExecutionLogBox thinking={msg.meta?.thinking} skills={msg.meta?.skills} fileIds={msg.meta?.fileIds} filesMap={filesMap} searches={msg.meta?.searches} steps={msg.meta?.steps} latencyMs={msg.meta?.latencyMs} />
							)}

							<div
								className={`rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
									isUser
										? "bg-accent text-white rounded-br-xs shadow-xs whitespace-pre-wrap"
										: "bg-white text-ink border border-line rounded-bl-xs shadow-xs"
								}`}
							>
								{isUser ? (
									<div className="whitespace-pre-wrap break-words">{msg.content}</div>
								) : (() => {
									const { cleaned, clarify } = extractClarification(msg.content);
									const isLatest = idx === messages.length - 1;
									return (
										<>
											{cleaned && <Markdown content={cleaned} />}
											{clarify && !isLatest && <ClarificationBox data={clarify} onSelect={(c) => onSelectOption?.(c)} disabled={true} />}
										</>
									);
								})()}
							</div>
							{!isUser && (
								<div className="flex items-center gap-2 font-mono text-[10.5px] text-ink-2/70 px-1 pt-0.5">
									{msg.meta?.tokens ? <span>{msg.meta.tokens.toLocaleString()} tok</span> : null}
									{msg.meta?.latencyMs ? <span>&middot; {(msg.meta.latencyMs / 1000).toFixed(1)}s</span> : null}
									<button type="button" onClick={() => copyText(msg.content)} className="hover:text-ink cursor-pointer transition flex items-center gap-0.5" title="Copy Text"><Copy className="size-3" /> Text</button>
									<button type="button" onClick={() => copyMd(msg.content)} className="hover:text-ink cursor-pointer transition flex items-center gap-0.5" title="Copy MD"><FileCode2 className="size-3" /> MD</button>
									<button type="button" onClick={() => { if (unliked[msg.id]) toggleUnlike(msg.id); else setFeedbackTarget({ messageId: msg.id, threadId: msg.threadId || "", preview: msg.content }); }} className={`cursor-pointer transition flex items-center gap-0.5 ${unliked[msg.id] ? "text-[#c6293b]" : "hover:text-[#c6293b]"}`} title="Unlike"><ThumbsDown className="size-3" /> {unliked[msg.id] ? "Unlike" : null}</button>
								</div>
							)}
							{/* Render Artifact Cards if any */}
							{msgArtifacts.length > 0 && (
								<div className="flex flex-wrap gap-2 pt-1">
									{msgArtifacts.map((art) => (
										<div key={art.id} className="inline-flex items-center rounded-md border border-[#d5daff] bg-[#f6f8ff] text-xs text-[#2323e6] shadow-2xs font-mono overflow-hidden">
											<button type="button" onClick={() => onOpenArtifact(art)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#eef0ff] transition cursor-pointer">
												<Code2 className="size-3.5" />
												<span className="font-semibold">{art.title}</span>
												<span className="rounded bg-white px-1.5 py-0.2 text-[10px] text-ink-2 border border-[#d5daff] uppercase">{art.language || art.type}</span>
												<span className="text-[10px] text-[#1d7a33]">24h</span>
											</button>
											<button type="button" onClick={(e) => { e.stopPropagation(); const fn = downloadArtifactFile(art); toast.success(`Đã tải về ${fn}`); }} className="border-l border-[#d5daff] px-2 py-1.5 hover:bg-[#eef0ff] hover:text-accent cursor-pointer transition text-[#2323e6]/80" title="Tải về file"><Download className="size-3.5" /></button>
										</div>
									))}
								</div>
							)}
						</div>

						{isUser && (
							<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-2 border border-line text-ink-2 text-xs"><UserIcon className="size-3.5" /></div>
						)}
					</div>
				);
			})}
			{isStreaming && (
				<div className="flex gap-3 max-w-3xl mr-auto w-full">
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-white text-xs animate-pulse"><Bot className="size-3.5" /></div>
					<div className="flex-1 rounded-lg rounded-bl-xs bg-white text-ink border border-line px-4 py-3 text-sm shadow-xs space-y-2">
						{(Boolean(streamingThinking) || Boolean(streamingSearches.length) || Boolean(streamingSteps.length)) && (
							<ExecutionLogBox thinking={streamingThinking} isStreaming={isStreaming} searches={streamingSearches} steps={streamingSteps} latencyMs={streamingLatencyMs} />
						)}
						{streamingContent ? (() => {
							const { cleaned, clarify } = extractClarification(streamingContent);
							return (
								<>
									{cleaned && <Markdown content={cleaned} />}
								</>
							);
						})() : !streamingThinking ? (
							<div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-2">
								<span className="size-1.5 rounded-full bg-accent animate-ping" />
								<span>Thinking...</span>
							</div>
						) : null}
					</div>
				</div>
			)}
			<div ref={bottomRef} />
			<FeedbackDialog open={feedbackTarget !== null} onOpenChange={(o) => { if (!o) setFeedbackTarget(null); }} messageId={feedbackTarget?.messageId || null} threadId={feedbackTarget?.threadId || null} messagePreview={feedbackTarget?.preview} onSuccess={() => { if (feedbackTarget) toggleUnlike(feedbackTarget.messageId); }} />
		</div>
	);
}

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { ThreadSidebar, type ThreadItem, type ModelItem } from "@web/components/chat/thread-sidebar";
import { MessageList, type MessageItem, type ArtifactItem } from "@web/components/chat/message-list";
import { ArtifactViewer } from "@web/components/chat/artifact-viewer";
import { ChatToolbar } from "@web/components/chat/chat-toolbar";
import { ShareDialog } from "@web/components/chat/share-dialog";
import { ContextRadar } from "@web/components/chat/context-radar";
import { ChatInputBar, type AttachedFile } from "@web/components/chat/chat-input-bar";
import { ClarificationBox, extractClarification } from "@web/components/chat/clarification-box";
import { ContextCompactDialog } from "@web/components/chat/context-compact-dialog";
import { getThreadTokensInfo } from "@web/lib/chat-tokens";
import type { ThinkingLevel } from "@shared/skills";
import type { ExecutionStep, SearchData } from "@web/components/chat/execution-types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function ChatPage() {
	const { t, i18n } = useTranslation(), qc = useQueryClient();
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null), [selectedModel, setSelectedModel] = useState("muse-spark-1.3-contributor-free");
	const [input, setInput] = useState(""), [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>("high");
	const [selectedSkills, setSelectedSkills] = useState<string[]>(["full-output"]), [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
	const [uploading, setUploading] = useState(false), [isStreaming, setIsStreaming] = useState(false);
	const [streamingText, setStreamingText] = useState(""), [streamingThinking, setStreamingThinking] = useState(""), [streamingSearches, setStreamingSearches] = useState<SearchData[]>([]);
	const [streamingSteps, setStreamingSteps] = useState<ExecutionStep[]>([]), [streamingLatencyMs, setStreamingLatencyMs] = useState<number | undefined>(undefined), [activeArtifact, setActiveArtifact] = useState<ArtifactItem | null>(null), [shareOpen, setShareOpen] = useState(false);
	const [compactOpen, setCompactOpen] = useState(false), [targetSwitchModel, setTargetSwitchModel] = useState<ModelItem | null>(null);
	const isSendingRef = useRef(false), [didInit, setDidInit] = useState(false);

	const { data: threadsData } = useQuery({ queryKey: ["chat-threads"], queryFn: () => api<{ threads: ThreadItem[] }>("/api/chat/threads") });
	const { data: modelsData } = useQuery({ queryKey: ["chat-models"], queryFn: () => api<{ models: ModelItem[] }>("/api/chat/models") });
	const { data: threadDetails, refetch: refetchDetails } = useQuery({ queryKey: ["chat-thread", activeThreadId], queryFn: () => api<{ thread: ThreadItem; messages: MessageItem[]; artifacts: ArtifactItem[] }>(`/api/chat/threads/${activeThreadId}`), enabled: activeThreadId !== null });
	const threads = threadsData?.threads ?? [], models = modelsData?.models ?? [{ id: "muse-spark-1.3-contributor-free", displayName: "Muse Spark 1.3" }], messages = threadDetails?.messages ?? [], artifacts = threadDetails?.artifacts ?? [];

	const curModel = models.find((m) => m.id === selectedModel);
	const tokensInfo = useMemo(() => getThreadTokensInfo(messages, curModel?.contextWindow || 200_000), [messages, curModel]);

	useEffect(() => {
		if (!didInit && threads.length > 0 && threads[0]) { setActiveThreadId(threads[0].id); setSelectedModel(threads[0].model); setDidInit(true); }
		if (models.length > 0 && !models.some((m) => m.id === selectedModel)) setSelectedModel(models[0]!.id);
	}, [threads, didInit, models, selectedModel]);

	const handleNewThread = () => { setActiveThreadId(null); setInput(""); setAttachedFiles([]); setActiveArtifact(null); setStreamingText(""); setStreamingThinking(""); setStreamingSearches([]); };
	const deleteThread = useMutation({ mutationFn: (id: string) => apiJson(`/api/chat/threads/${id}`, "DELETE", {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ["chat-threads"] }); setActiveThreadId(null); } });

	const uploadSingleFile = async (file: File) => {
		if (file.size > MAX_FILE_SIZE) { toast.error("File vượt quá 10MB. Vui lòng chọn file nhỏ hơn."); return; }
		setUploading(true);
		const formData = new FormData(); formData.append("file", file);
		if (activeThreadId) formData.append("threadId", activeThreadId);
		try {
			const res = await fetch("/api/chat/upload", { credentials: "include", method: "POST", body: formData });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "upload_failed");
			setAttachedFiles((prev) => [...prev, { id: json.file.id, filename: json.file.filename, sizeBytes: json.file.sizeBytes }]);
			toast.success(`Đã đính kèm ${file.name}`);
		} catch (err) { toast.error((err as Error).message); } finally { setUploading(false); }
	};

	const handleApplyModelSwitch = async (newModelId: string) => {
		const prev = selectedModel;
		setSelectedModel(newModelId);
		setTargetSwitchModel(null);
		if (activeThreadId) {
			const oldName = models.find((m) => m.id === prev)?.displayName || prev;
			const newName = models.find((m) => m.id === newModelId)?.displayName || newModelId;
			const notify = i18n.language?.startsWith("vi") ? `Đã đổi model từ ${oldName} sang ${newName}` : `Model changed from ${oldName} to ${newName}`;
			await apiJson(`/api/chat/threads/${activeThreadId}`, "PATCH", { model: newModelId, notifyModelChange: notify }).catch(() => {});
			void refetchDetails();
		}
	};

	const handleSelectModel = (newModelId: string) => {
		if (newModelId === selectedModel) return;
		const target = models.find((m) => m.id === newModelId);
		const targetCw = target?.contextWindow || 200_000;
		if (tokensInfo.usedTokens > targetCw) {
			setTargetSwitchModel(target || null);
			setCompactOpen(true);
			return;
		}
		void handleApplyModelSwitch(newModelId);
	};

	const sendPrompt = async (text: string) => {
		if ((!text.trim() && attachedFiles.length === 0) || isStreaming || isSendingRef.current) return;
		isSendingRef.current = true;
		let threadId = activeThreadId;
		if (!threadId) {
			const res = await apiJson<{ thread: ThreadItem }>("/api/chat/threads", "POST", { model: selectedModel });
			threadId = res.thread.id; setActiveThreadId(threadId); qc.invalidateQueries({ queryKey: ["chat-threads"] });
		}
		const prompt = text.trim(), fids = attachedFiles.map((f) => f.id);
		setInput(""); setAttachedFiles([]); setIsStreaming(true); setStreamingText(""); setStreamingThinking(""); setStreamingSearches([]); setStreamingSteps([]); setStreamingLatencyMs(undefined);
		try {
			const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
				credentials: "include", method: "POST", headers: { "content-type": "application/json" },
				body: JSON.stringify({ content: prompt, fileIds: fids, skillIds: selectedSkills, thinkingLevel }),
			});
			if (!res.ok) throw new Error("failed_to_stream");
			const reader = res.body?.getReader(), decoder = new TextDecoder();
			let accumulated = "", accumulatedThinking = "";
			while (reader) {
				const { value, done } = await reader.read();
				if (done) break;
				for (const line of decoder.decode(value, { stream: true }).split("\n")) {
					if (!line.startsWith("data: ")) continue;
					try {
						const parsed = JSON.parse(line.slice(6));
						if (parsed.step) setStreamingSteps((prev) => [...prev.filter((s) => s.id !== parsed.step.id), parsed.step]);
						if (parsed.search) setStreamingSearches((p) => [...p, parsed.search]);
						if (parsed.thinking) { accumulatedThinking += parsed.thinking; setStreamingThinking(accumulatedThinking); }
						if (parsed.delta) { accumulated += parsed.delta; setStreamingText(accumulated); }
						if (parsed.done && parsed.latencyMs) setStreamingLatencyMs(parsed.latencyMs);
					} catch {}
				}
			}
			await refetchDetails();
		} catch (err) { toast.error((err as Error).message); } finally { isSendingRef.current = false; setIsStreaming(false); setStreamingText(""); setStreamingThinking(""); setStreamingSearches([]); }
	};

	const lastAssistantMsg = messages.length > 0 ? messages[messages.length - 1] : null;
	const activeClarify = useMemo(() => {
		if (isStreaming || !lastAssistantMsg || lastAssistantMsg.role !== "assistant") return null;
		return extractClarification(lastAssistantMsg.content).clarify;
	}, [messages, isStreaming, lastAssistantMsg]);

	return (
		<div className="flex h-full w-full overflow-hidden bg-white">
			<Group orientation="horizontal" className="h-full w-full flex-1">
				<Panel id="sidebar" defaultSize="260px" minSize="220px" maxSize="380px" className="flex flex-col">
					<ThreadSidebar threads={threads} activeThreadId={activeThreadId} onSelectThread={setActiveThreadId} onNewThread={handleNewThread} onDeleteThread={(id) => deleteThread.mutate(id)} />
				</Panel>
				<Separator className="w-1.5 bg-line/60 hover:bg-accent active:bg-accent transition-colors cursor-col-resize z-10" />
				<Panel id="main" minSize="320px" className="flex flex-col flex-1 overflow-hidden bg-paper">
					{activeThreadId && (
						<div className="flex min-h-[42px] items-center justify-between border-b border-line bg-white px-4 py-1.5 text-xs shrink-0">
							<span className="font-semibold text-ink truncate max-w-md">{threadDetails?.thread.title === "New conversation" ? t("chat.newConversation") : threadDetails?.thread.title}</span>
							<Button size="sm" variant="outline" className="h-6 gap-1 font-mono text-xs px-2" onClick={() => setShareOpen(true)}>
								<Share2 className="size-3 text-accent" /> Share
							</Button>
						</div>
					)}
					<MessageList messages={messages} streamingContent={streamingText} streamingThinking={streamingThinking} streamingSearches={streamingSearches} streamingSteps={streamingSteps} streamingLatencyMs={streamingLatencyMs} isStreaming={isStreaming} artifacts={artifacts} onOpenArtifact={setActiveArtifact} onSelectOption={(c) => void sendPrompt(c)} />
					<div className="border-t border-line bg-white p-3 sm:p-4 space-y-2.5">
						{activeClarify && (
							<div className="mx-auto w-full max-w-4xl px-1">
								<ClarificationBox data={activeClarify} onSelect={(c) => void sendPrompt(c)} disabled={isStreaming} docked={true} />
							</div>
						)}
						<ChatToolbar selectedModel={selectedModel} onSelectModel={handleSelectModel} models={models} thinkingLevel={thinkingLevel} onSelectThinking={setThinkingLevel} selectedSkills={selectedSkills} onToggleSkill={(id) => setSelectedSkills((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])} tokensInfo={tokensInfo} onOpenCompact={() => setCompactOpen(true)} />
						{(attachedFiles.length > 0 || input.length > 40 || tokensInfo.percent > 20) && (
							<ContextRadar
								tokensInfo={tokensInfo}
								attachedFiles={attachedFiles}
								inputPrompt={input}
								modelName={curModel?.displayName || selectedModel}
							/>
						)}
						<ChatInputBar input={input} onInputChange={setInput} onSend={() => void sendPrompt(input)} isStreaming={isStreaming} uploading={uploading} onUpload={(e) => { const f = e.target.files?.[0]; if (f) void uploadSingleFile(f); }} onPaste={(e) => { const files = e.clipboardData?.files; if (files) for (let i = 0; i < files.length; i++) { const f = files[i]; if (f) void uploadSingleFile(f); } }} attachedFiles={attachedFiles} onRemoveFile={(id) => setAttachedFiles((p) => p.filter((x) => x.id !== id))} />
					</div>
				</Panel>
				{activeArtifact && (
					<>
						<Separator className="w-1.5 bg-line/60 hover:bg-accent active:bg-accent transition-colors cursor-col-resize z-10" />
						<Panel id="artifact" defaultSize="45%" minSize="320px" maxSize="70%" className="flex flex-col overflow-hidden bg-white shadow-2xl z-20">
							<ArtifactViewer artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />
						</Panel>
					</>
				)}
			</Group>
			<ShareDialog threadId={activeThreadId} threadTitle={threadDetails?.thread.title} open={shareOpen} onOpenChange={setShareOpen} />
			<ContextCompactDialog open={compactOpen} onOpenChange={(op) => { setCompactOpen(op); if (!op) setTargetSwitchModel(null); }} threadId={activeThreadId} tokensInfo={tokensInfo} modelName={curModel?.displayName || selectedModel} onCompactSuccess={() => { void refetchDetails(); toast.success(i18n.language?.startsWith("vi") ? "Đã thu gọn ngữ cảnh thành công!" : "Context compacted successfully!"); }} targetSwitchModel={targetSwitchModel ? { id: targetSwitchModel.id, displayName: targetSwitchModel.displayName || targetSwitchModel.id, contextWindow: targetSwitchModel.contextWindow || 200_000 } : null} onConfirmSwitch={handleApplyModelSwitch} />
		</div>
	);
}

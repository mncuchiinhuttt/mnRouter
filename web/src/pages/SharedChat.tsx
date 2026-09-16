import { useState } from "react";
import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, MessageSquare, AlertCircle, ArrowLeft, Bot } from "lucide-react";
import { api } from "@web/lib/api";
import { fmtDate } from "@web/lib/utils";
import { Badge } from "@web/components/ui/primitives";
import { Button } from "@web/components/ui/button";
import { MessageList, type MessageItem, type ArtifactItem } from "@web/components/chat/message-list";
import { ArtifactViewer } from "@web/components/chat/artifact-viewer";

interface SharedData {
	share: { id: string; title: string; expiresAt: string };
	thread: { id: string; title: string; model: string; createdAt: string };
	author?: { email: string; displayName: string | null } | null;
	messages: MessageItem[];
	artifacts: ArtifactItem[];
}

export default function SharedChatPage() {
	const { token } = useParams<{ token: string }>();
	const [activeArtifact, setActiveArtifact] = useState<ArtifactItem | null>(null);

	const { data, isLoading, isError } = useQuery({
		queryKey: ["shared-chat", token],
		queryFn: () => api<SharedData>(`/api/share/${token}`),
		enabled: Boolean(token),
		retry: false,
	});

	if (isLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center font-mono text-sm text-ink-2 bg-paper">
				Đang tải cuộc trò chuyện...
			</div>
		);
	}

	if (isError || !data) {
		return (
			<div className="flex h-screen w-full flex-col items-center justify-center gap-3 p-4 text-center bg-paper">
				<AlertCircle className="size-10 text-[#c6293b]" />
				<h2 className="text-lg font-semibold text-ink">Liên kết không tồn tại hoặc đã hết hạn</h2>
				<p className="max-w-md text-xs text-ink-2 font-mono">
					Liên kết chia sẻ trên mnRouter tự động huỷ sau 24 giờ kể từ thời điểm tạo để bảo vệ tính riêng tư.
				</p>
				<Link to="/login">
					<Button size="sm" className="mt-2 text-xs font-mono">Vào mnRouter</Button>
				</Link>
			</div>
		);
	}

	const { share, thread, messages, artifacts } = data;

	return (
		<div className="flex h-screen w-full flex-col bg-white">
			{/* Top bar */}
			<header className="flex shrink-0 items-center justify-between border-b border-line bg-paper px-4 py-3 sm:px-8">
				<div className="flex items-center gap-3">
					<div className="flex size-7 items-center justify-center rounded-md bg-navy text-white text-xs font-bold font-mono">
						MN
					</div>
					<div className="truncate">
						<div className="font-semibold text-sm text-ink truncate">{share.title}</div>
						<div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-ink-2">
							<span className="rounded bg-white px-1.5 py-0.2 border border-line">{thread.model}</span>
							<span>{messages.length} tin nhắn</span>
							{data.author && (
								<span className="text-ink font-medium">&middot; Tác giả: {data.author.displayName || data.author.email}</span>
							)}
						</div>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{data.author && (
						<div className="hidden sm:flex items-center gap-1.5 rounded-md bg-white border border-line px-2.5 py-1 text-xs font-mono text-ink shadow-2xs">
							<span className="text-ink-2">Chia sẻ bởi:</span>
							<span className="font-semibold text-accent">{data.author.displayName || data.author.email}</span>
						</div>
					)}
					<div className="flex items-center gap-1 rounded-md bg-[#f4faf5] border border-[#bcd9c0] px-2.5 py-1 text-xs font-mono text-[#1d7a33]">
						<Clock className="size-3.5" />
						<span>24h Share · Hết hạn: {fmtDate(share.expiresAt)}</span>
					</div>
					<Link to="/">
						<Button size="sm" variant="outline" className="h-8 text-xs font-mono gap-1">
							<ArrowLeft className="size-3" /> Dashboard
						</Button>
					</Link>
				</div>
			</header>

			{/* Main Chat Body */}
			<div className="flex flex-1 overflow-hidden bg-paper">
				<div className="flex flex-1 flex-col overflow-hidden">
					<MessageList
						messages={messages}
						streamingContent=""
						isStreaming={false}
						artifacts={artifacts}
						onOpenArtifact={setActiveArtifact}
					/>
				</div>

				<ArtifactViewer artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />
			</div>
		</div>
	);
}

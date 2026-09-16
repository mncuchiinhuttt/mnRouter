import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@web/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";

export interface ThreadItem {
	id: string;
	title: string;
	model: string;
	messageCount?: number;
	totalTokens?: number;
	createdAt: string;
	updatedAt: string;
}

export interface ModelItem {
	id: string;
	displayName?: string;
	provider?: string;
	contextWindow?: number;
	maxOutput?: number;
	priceIn?: number;
	priceOut?: number;
	priceCacheRead?: number;
	priceCacheWrite?: number;
}

interface ThreadSidebarProps {
	threads: ThreadItem[];
	activeThreadId: string | null;
	onSelectThread: (id: string) => void;
	onNewThread: () => void;
	onDeleteThread: (id: string) => void;
	width?: number;
}

export function ThreadSidebar({
	threads,
	activeThreadId,
	onSelectThread,
	onNewThread,
	onDeleteThread,
	width,
}: ThreadSidebarProps) {
	const { t } = useTranslation();
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const confirmDelete = () => {
		if (deletingId) {
			onDeleteThread(deletingId);
			setDeletingId(null);
		}
	};

	return (
		<div style={{ width: width ? `${width}px` : undefined }} className="flex h-full w-full min-w-[220px] flex-col border-r border-line bg-paper overflow-hidden">
			{/* Top Actions */}
			<div className="p-3 border-b border-line">
				<Button onClick={onNewThread} className="w-full justify-center gap-2 h-9 text-xs font-mono">
					<Plus className="size-3.5" />
					<span>{t("chat.newChat")}</span>
				</Button>
			</div>

			{/* Thread History List */}
			<div className="flex-1 overflow-y-auto p-2 space-y-1">
				{activeThreadId === null && (
					<div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-white p-2.5 text-xs text-ink shadow-2xs animate-in fade-in-50 slide-in-from-top-2">
						<MessageSquare className="size-3.5 text-accent shrink-0" />
						<span className="truncate font-medium text-accent">{t("chat.newConversation")}</span>
					</div>
				)}

				{threads.map((th) => {
					const isActive = th.id === activeThreadId;
					return (
						<div
							key={th.id}
							className={`group relative flex flex-col gap-1 rounded-lg p-2.5 text-xs transition-all duration-300 ease-out cursor-pointer animate-in fade-in-50 slide-in-from-top-2 ${
								isActive
									? "bg-white text-ink font-medium shadow-xs border border-line"
									: "text-ink-2 hover:bg-paper-2 hover:text-ink border border-transparent"
							}`}
							onClick={() => onSelectThread(th.id)}
						>
							<div className="flex items-center justify-between pr-5">
								<span className="truncate font-medium text-ink">{th.title === "New conversation" ? t("chat.newConversation") : th.title}</span>
							</div>

							<div className="flex items-center gap-1.5 font-mono text-[10px] text-ink-2">
								<span className="rounded bg-paper-2 px-1 py-0.2 border border-line/60 truncate max-w-[85px]">{th.model}</span>
								<span>{th.messageCount || 0} msgs</span>
								<span>&middot;</span>
								<span className="text-accent font-medium">{fmtTok(th.totalTokens || 0)}</span>
							</div>

							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setDeletingId(th.id);
								}}
								className="opacity-0 group-hover:opacity-100 hover:text-[#c6293b] p-1 transition cursor-pointer absolute right-1.5 top-2"
								title={t("chat.deleteThread")}
							>
								<Trash2 className="size-3.5" />
							</button>
						</div>
					);
				})}

				{threads.length === 0 && activeThreadId !== null && (
					<div className="p-4 text-center font-mono text-[11px] text-ink-2">
						{t("chat.noThreads")}
					</div>
				)}
			</div>

			{/* Delete Confirm Dialog */}
			<Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-[#c6293b]">
							<Trash2 className="size-4" /> {t("chat.deleteThread")}
						</DialogTitle>
						<DialogDescription>{t("chat.deleteThreadConfirm")}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>
							{t("common.cancel")}
						</Button>
						<Button size="sm" className="bg-[#c6293b] text-white hover:bg-[#a01828]" onClick={confirmDelete}>
							{t("common.delete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function fmtTok(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k tok`;
	return `${n} tok`;
}

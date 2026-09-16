import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, Copy, Plus, Share2, Trash2 } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { fmtDate } from "@web/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";

export interface ShareItem {
	id: string;
	threadId: string;
	token: string;
	title: string;
	expiresAt: string;
	createdAt: string;
}

interface ShareDialogProps {
	threadId: string | null;
	threadTitle?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ threadId, threadTitle, open, onOpenChange }: ShareDialogProps) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [copiedToken, setCopiedToken] = useState<string | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: ["chat-shares", threadId],
		queryFn: () => api<{ shares: ShareItem[] }>(`/api/chat/threads/${threadId}/shares`),
		enabled: Boolean(threadId && open),
	});

	const shares = data?.shares ?? [];

	const createMutation = useMutation({
		mutationFn: () => apiJson<{ share: ShareItem }>(`/api/chat/threads/${threadId}/shares`, "POST", {}),
		onSuccess: (res) => {
			qc.invalidateQueries({ queryKey: ["chat-shares", threadId] });
			copyLink(res.share.token);
			toast.success("Đã tạo liên kết chia sẻ (hiệu lực 24h)!");
		},
		onError: (e) => toast.error((e as Error).message),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => apiJson(`/api/chat/shares/${id}`, "DELETE", {}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["chat-shares", threadId] });
			toast.success("Đã xoá liên kết chia sẻ");
		},
		onError: (e) => toast.error((e as Error).message),
	});

	const copyLink = async (token: string) => {
		const fullUrl = `${window.location.origin}/share/${token}`;
		await navigator.clipboard.writeText(fullUrl);
		setCopiedToken(token);
		toast.success("Đã sao chép liên kết vào clipboard!");
		setTimeout(() => setCopiedToken(null), 2000);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Share2 className="size-4 text-accent" />
						<span>Chia sẻ cuộc trò chuyện</span>
					</DialogTitle>
					<DialogDescription>
						Liên kết chia sẻ tồn tại trong 24 giờ. Người nhận có thể đọc tin nhắn và xem artifacts mà không cần đăng nhập.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-1">
					<div className="flex items-center justify-between rounded-lg border border-line bg-paper p-3">
						<div className="truncate pr-2">
							<div className="font-semibold text-xs text-ink truncate">{threadTitle || "Hội thoại"}</div>
							<div className="font-mono text-[10.5px] text-ink-2">Tự động huỷ sau 24h</div>
						</div>
						<Button size="sm" className="h-7 shrink-0 gap-1 text-xs font-mono" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
							<Plus className="size-3" /> Tạo link mới
						</Button>
					</div>

					<div className="space-y-2">
						<span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-2">Các liên kết đang hoạt động:</span>
						{isLoading && <div className="text-center py-4 text-xs text-ink-2 font-mono">Đang tải...</div>}
						{shares.map((sh) => {
							const isCopied = copiedToken === sh.token;
							return (
								<div key={sh.id} className="flex items-center justify-between gap-2 rounded-md border border-line bg-white p-2.5 shadow-2xs text-xs font-mono">
									<div className="flex flex-col gap-0.5 truncate">
										<span className="truncate text-ink font-medium text-[11px]">{window.location.origin}/share/{sh.token}</span>
										<span className="flex items-center gap-1 text-[10px] text-[#1d7a33]">
											<Clock className="size-2.5" /> Hết hạn: {fmtDate(sh.expiresAt)}
										</span>
									</div>
									<div className="flex items-center gap-1 shrink-0">
										<Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => void copyLink(sh.token)}>
											{isCopied ? <Check className="size-3 text-[#1d7a33]" /> : <Copy className="size-3" />}
											<span>{isCopied ? "Đã copy" : "Copy"}</span>
										</Button>
										<Button size="sm" variant="ghost" className="h-7 text-[#c6293b] hover:bg-[#faebec]" onClick={() => deleteMutation.mutate(sh.id)}>
											<Trash2 className="size-3" />
										</Button>
									</div>
								</div>
							);
						})}
						{!isLoading && shares.length === 0 && (
							<div className="rounded-md border border-dashed border-line p-4 text-center text-xs text-ink-2 font-mono">
								Chưa có link chia sẻ nào được tạo.
							</div>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

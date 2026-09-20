import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	ExternalLink,
	Filter,
	Image as ImageIcon,
	MessageSquare,
	RefreshCw,
	Search,
	ShieldAlert,
	Trash2,
	X,
} from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Badge, Input, Table, TBody, TD, TH, THead, TR } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { cn } from "@web/lib/utils";

interface IssueImage {
	id: string;
	filename: string;
	sizeBytes: number;
	mimeType: string;
	createdAt: string;
}

interface IssueItem {
	id: string;
	title: string;
	description: string;
	tool: string;
	customTool: string | null;
	model: string | null;
	status: "open" | "investigating" | "resolved";
	adminNote: string | null;
	userEmail: string | null;
	resolvedAt: string | null;
	createdAt: string;
	updatedAt: string;
	images: IssueImage[];
}

interface IssuesResp {
	issues: IssueItem[];
	summary: { total: number; openCount: number; investigatingCount: number; resolvedCount: number };
}

export default function AdminIssues() {
	const { t, i18n } = useTranslation();
	const isVi = i18n.language?.startsWith("vi");
	const qc = useQueryClient();

	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [search, setSearch] = useState("");
	const [selectedIssue, setSelectedIssue] = useState<IssueItem | null>(null);
	const [adminNoteInput, setAdminNoteInput] = useState("");
	const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["admin-issues", statusFilter],
		queryFn: () => api<IssuesResp>(`/api/admin/issues?status=${statusFilter}`),
		refetchInterval: 30_000,
	});

	const patchStatus = useMutation({
		mutationFn: ({ id, status, adminNote }: { id: string; status: "open" | "investigating" | "resolved"; adminNote?: string }) =>
			apiJson(`/api/admin/issues/${id}`, "PATCH", { status, adminNote }),
		onSuccess: (_, variables) => {
			qc.invalidateQueries({ queryKey: ["admin-issues"] });
			if (variables.status === "resolved") {
				toast.success(isVi ? "Đã đánh dấu Resolved & xoá toàn bộ hình ảnh đính kèm!" : "Marked Resolved & purged all images!");
			} else {
				toast.success(isVi ? "Cập nhật trạng thái thành công" : "Updated status");
			}
			setSelectedIssue(null);
		},
		onError: (err: Error) => {
			toast.error(err.message);
		},
	});

	const remove = useMutation({
		mutationFn: (id: string) => apiJson(`/api/admin/issues/${id}`, "DELETE", {}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin-issues"] });
			toast.success(isVi ? "Đã xoá ticket sự cố" : "Deleted issue");
			setSelectedIssue(null);
		},
		onError: (err: Error) => {
			toast.error(err.message);
		},
	});

	const issues = data?.issues ?? [];
	const filtered = useMemo(() => {
		if (!search.trim()) return issues;
		const q = search.toLowerCase();
		return issues.filter(
			(it) =>
				(it.userEmail && it.userEmail.toLowerCase().includes(q)) ||
				it.title.toLowerCase().includes(q) ||
				it.description.toLowerCase().includes(q) ||
				it.tool.toLowerCase().includes(q) ||
				(it.model && it.model.toLowerCase().includes(q))
		);
	}, [issues, search]);

	const openDetail = (item: IssueItem) => {
		setSelectedIssue(item);
		setAdminNoteInput(item.adminNote || "");
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">
						{isVi ? "Quản lý Sự cố & Báo cáo Lỗi" : "Issue Reports Management"}
					</h1>
					<p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">
						{isVi
							? "Xem danh sách lỗi từ các công cụ (Claude Code, Codex, OMP, Direct API...). Khi đánh dấu Resolved, hệ thống tự động xoá sạch toàn bộ ảnh chụp màn hình khỏi ổ đĩa."
							: "Inspect and triage reports across client environments. Marking an issue Resolved triggers automatic disk purge of attached screenshots."}
					</p>
				</div>
				<Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching} className="h-9 gap-1.5 font-mono text-xs shrink-0">
					<RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
					<span>{t("common.refresh")}</span>
				</Button>
			</header>

			{/* Top Summary Cards */}
			{data?.summary && (
				<div className="grid gap-3 sm:grid-cols-4">
					<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
						<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase">
							<span>Chưa xử lý (Open)</span>
							<AlertCircle className="size-4 text-[#b45309]" />
						</div>
						<div className="mt-2 text-2xl font-semibold font-mono text-[#b45309]">{data.summary.openCount}</div>
						<p className="mt-1 text-[10.5px] font-mono text-ink-2">Cần phản hồi</p>
					</div>

					<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
						<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase">
							<span>Đang kiểm tra</span>
							<Clock className="size-4 text-accent" />
						</div>
						<div className="mt-2 text-2xl font-semibold font-mono text-accent">{data.summary.investigatingCount}</div>
						<p className="mt-1 text-[10.5px] font-mono text-ink-2">Investigating</p>
					</div>

					<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
						<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase">
							<span>Đã giải quyết</span>
							<CheckCircle2 className="size-4 text-[#1d7a33]" />
						</div>
						<div className="mt-2 text-2xl font-semibold font-mono text-[#1d7a33]">{data.summary.resolvedCount}</div>
						<p className="mt-1 text-[10.5px] font-mono text-ink-2">Ảnh đã tự xoá</p>
					</div>

					<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
						<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase">
							<span>Tổng sự cố</span>
							<ShieldAlert className="size-4 text-ink-2" />
						</div>
						<div className="mt-2 text-2xl font-semibold font-mono text-ink">{data.summary.total}</div>
						<p className="mt-1 text-[10.5px] font-mono text-ink-2">Tất cả thời gian</p>
					</div>
				</div>
			)}

			{/* Filter & Search Bar */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
				<div className="flex flex-1 flex-wrap items-center gap-2.5">
					<div className="relative min-w-[240px] max-w-sm flex-1">
						<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-2" />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={isVi ? "Tìm theo email, tiêu đề, công cụ, model..." : "Search issues..."}
							className="pl-8 pr-7 text-xs font-mono h-8"
						/>
						{search && (
							<button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2 hover:text-ink cursor-pointer">
								<X className="size-3" />
							</button>
						)}
					</div>

					<div className="w-[160px]">
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Tất cả trạng thái</SelectItem>
								<SelectItem value="open">Open (Chưa xử lý)</SelectItem>
								<SelectItem value="investigating">Investigating</SelectItem>
								<SelectItem value="resolved">Resolved (Đã xong)</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="text-xs font-mono text-ink-2 shrink-0">
					Hiển thị {filtered.length} / {issues.length} sự cố
				</div>
			</div>

			{/* Issues Table */}
			<div className="rounded-lg border border-line bg-white shadow-xs overflow-hidden">
				<Table>
					<THead>
						<TR>
							<TH className="w-24">Status</TH>
							<TH className="w-32">Tool / App</TH>
							<TH>Tiêu đề & Nội dung</TH>
							<TH className="w-36">Người báo cáo</TH>
							<TH className="w-20 text-center">Ảnh</TH>
							<TH className="w-28">Thời gian</TH>
							<TH className="w-24 text-right">Thao tác</TH>
						</TR>
					</THead>
					<TBody>
						{filtered.map((it) => (
							<TR key={it.id} className="hover:bg-paper/60 cursor-pointer" onClick={() => openDetail(it)}>
								<TD>
									<Badge
										className={cn(
											"text-[10px] font-mono uppercase px-1.5 py-0.5",
											it.status === "resolved" && "bg-[#f4faf5] text-[#1d7a33] border-[#bcd9c0]",
											it.status === "investigating" && "bg-[#fef9ee] text-[#b45309] border-[#fde68a]",
											it.status === "open" && "bg-white text-[#b45309] border-line font-bold"
										)}
									>
										{it.status}
									</Badge>
								</TD>
								<TD>
									<span className="font-mono text-xs font-semibold text-ink uppercase">
										{it.tool}
									</span>
									{it.customTool && (
										<div className="text-[10.5px] font-mono text-ink-2 truncate">({it.customTool})</div>
									)}
									{it.model && (
										<div className="text-[10.5px] font-mono text-accent truncate">{it.model}</div>
									)}
								</TD>
								<TD className="max-w-[340px]">
									<div className="font-semibold text-xs text-ink truncate">{it.title}</div>
									<div className="text-[11px] text-ink-2 line-clamp-1">{it.description}</div>
									{it.adminNote && (
										<div className="mt-1 text-[10.5px] font-mono text-accent truncate">
											Note: {it.adminNote}
										</div>
									)}
								</TD>
								<TD>
									<span className="font-mono text-xs text-ink-2 truncate block max-w-[140px]">
										{it.userEmail || "Khách (Ẩn danh)"}
									</span>
								</TD>
								<TD className="text-center">
									{it.images.length > 0 ? (
										<Badge className="font-mono text-[10px] gap-1 px-1.5 bg-paper border border-line">
											<ImageIcon className="size-3 text-accent" />
											<span>{it.images.length}</span>
										</Badge>
									) : (
										<span className="text-[11px] text-ink-2/40 font-mono">0</span>
									)}
								</TD>
								<TD className="font-mono text-[11px] text-ink-2 whitespace-nowrap">
									{new Date(it.createdAt).toLocaleString("vi-VN", {
										month: "numeric",
										day: "numeric",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</TD>
								<TD className="text-right" onClick={(e) => e.stopPropagation()}>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => openDetail(it)}
										className="h-7 px-2 text-xs font-mono text-accent hover:text-accent"
									>
										Xem & Sửa
									</Button>
								</TD>
							</TR>
						))}

						{filtered.length === 0 && (
							<TR>
								<TD colSpan={7} className="py-12 text-center text-xs font-mono text-ink-2">
									{isLoading ? t("common.loading") : isVi ? "Không có sự cố nào cần xử lý" : "No issue reports found"}
								</TD>
							</TR>
						)}
					</TBody>
				</Table>
			</div>

			{/* Detail / Action Dialog */}
			<Dialog open={selectedIssue !== null} onOpenChange={(open) => !open && setSelectedIssue(null)}>
				<DialogContent className="max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<div className="flex items-center gap-2">
							<Badge className="font-mono uppercase text-[10px]">{selectedIssue?.tool}</Badge>
							{selectedIssue?.model && (
								<Badge className="font-mono text-[10px] text-accent border-accent/30 bg-accent/10">
									{selectedIssue.model}
								</Badge>
							)}
						</div>
						<DialogTitle className="text-base font-bold text-ink mt-1">
							{selectedIssue?.title}
						</DialogTitle>
						<DialogDescription className="text-xs font-mono text-ink-2">
							Từ: {selectedIssue?.userEmail || "Ẩn danh"} · ID: {selectedIssue?.id}
						</DialogDescription>
					</DialogHeader>

					{selectedIssue && (
						<div className="space-y-5 py-2">
							{/* Description box */}
							<div className="space-y-1.5">
								<label className="text-[11px] font-mono uppercase font-semibold text-ink-2">Chi tiết mô tả lỗi:</label>
								<div className="rounded-lg border border-line bg-paper p-3.5 font-mono text-xs text-ink leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
									{selectedIssue.description}
								</div>
							</div>

							{/* Screenshots grid */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<label className="text-[11px] font-mono uppercase font-semibold text-ink-2 flex items-center gap-1.5">
										<ImageIcon className="size-3.5 text-accent" />
										<span>Hình ảnh đính kèm ({selectedIssue.images.length})</span>
									</label>
									{selectedIssue.status === "resolved" && (
										<span className="text-[10.5px] font-mono text-[#1d7a33]">
											✓ Đã xoá hình ảnh khỏi đĩa vì ticket đã Resolved
										</span>
									)}
								</div>

								{selectedIssue.images.length > 0 ? (
									<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
										{selectedIssue.images.map((img) => (
											<div
												key={img.id}
												onClick={() => setPreviewImageUrl(`/api/issues/images/${img.id}`)}
												className="group relative rounded-lg border border-line overflow-hidden bg-paper-2 aspect-video cursor-pointer hover:border-accent transition-all"
											>
												<img
													src={`/api/issues/images/${img.id}`}
													alt={img.filename}
													className="w-full h-full object-cover group-hover:scale-105 transition-all"
												/>
												<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-mono transition-opacity">
													Phóng to
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-ink-2 italic">
										Không có hình ảnh đính kèm (hoặc đã được xoá an toàn sau khi giải quyết).
									</div>
								)}
							</div>

							{/* Admin note input - Rich Markdown & Multi-line Textarea */}
							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<label className="text-[11px] font-mono uppercase font-semibold text-ink-2">Phản hồi / Ghi chú của Admin (Hỗ trợ Markdown):</label>
									<span className="text-[10px] font-mono text-ink-2/60">Xuống dòng, gạch đầu dòng, format thoải mái</span>
								</div>
								<textarea
									value={adminNoteInput}
									onChange={(e) => setAdminNoteInput(e.target.value)}
									placeholder="Nhập nội dung phản hồi, nguyên nhân và hướng xử lý (hỗ trợ xuống dòng, gạch đầu dòng, markdown)..."
									rows={5}
									className="w-full rounded-md border border-line bg-surface p-2.5 text-xs text-ink font-mono placeholder:text-ink-2/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y leading-relaxed"
								/>
							</div>
						</div>
					)}

					<DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-line">
						<Button
							type="button"
							variant="ghost"
							onClick={() => selectedIssue && remove.mutate(selectedIssue.id)}
							disabled={remove.isPending}
							className="text-[#c6293b] hover:text-[#c6293b] hover:bg-[#c6293b]/10 text-xs font-mono"
						>
							<Trash2 className="size-3.5 mr-1" />
							Xoá ticket
						</Button>

						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setSelectedIssue(null)}
								className="text-xs font-mono"
							>
								Đóng
							</Button>

							<Button
								type="button"
								variant="outline"
								onClick={() =>
									selectedIssue &&
									patchStatus.mutate({
										id: selectedIssue.id,
										status: "investigating",
										adminNote: adminNoteInput.trim() || undefined,
									})
								}
								disabled={patchStatus.isPending || selectedIssue?.status === "investigating"}
								className="text-xs font-mono text-[#b45309] border-[#fde68a] bg-[#fef9ee]"
							>
								Investigating
							</Button>

							<Button
								type="button"
								onClick={() =>
									selectedIssue &&
									patchStatus.mutate({
										id: selectedIssue.id,
										status: "resolved",
										adminNote: adminNoteInput.trim() || undefined,
									})
								}
								disabled={patchStatus.isPending || selectedIssue?.status === "resolved"}
								className="text-xs font-mono bg-[#1d7a33] hover:bg-[#166526] text-white gap-1.5"
							>
								<CheckCircle2 className="size-3.5" />
								<span>Mark Resolved & Purge Images</span>
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Image Lightbox Preview Modal */}
			<Dialog open={previewImageUrl !== null} onOpenChange={(open) => !open && setPreviewImageUrl(null)}>
				<DialogContent className="max-w-4xl p-2 bg-black/90 border-black">
					{previewImageUrl && (
						<div className="relative flex items-center justify-center p-2">
							<img src={previewImageUrl} alt="Full preview" className="max-h-[85vh] max-w-full rounded object-contain" />
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

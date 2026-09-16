import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, MessageSquareWarning, RefreshCw, Search, Trash2, X } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Badge, Input, Table, TBody, TD, TH, THead, TR } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";

interface FeedbackItem {
	id: string; messageId: string; threadId: string; userId: string | null; userEmail: string | null;
	model: string | null; reason: string; comment: string | null; messagePreview: string | null;
	status: "new" | "reviewed" | "resolved"; createdAt: string;
}

interface FeedbacksResp {
	feedbacks: FeedbackItem[];
	summary: { total: number; newCount: number; resolvedCount: number };
}

export default function AdminFeedbacks() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [statusFilter, setStatusFilter] = useState("all");
	const [search, setSearch] = useState("");

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["admin-feedbacks", statusFilter],
		queryFn: () => api<FeedbacksResp>(`/api/admin/feedbacks?status=${statusFilter}`),
		refetchInterval: 30_000,
	});

	const patchStatus = useMutation({
		mutationFn: ({ id, status }: { id: string; status: "new" | "reviewed" | "resolved" }) => apiJson(`/api/admin/feedbacks/${id}`, "PATCH", { status }),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-feedbacks"] }); toast.success("Updated status"); },
	});

	const remove = useMutation({
		mutationFn: (id: string) => apiJson(`/api/admin/feedbacks/${id}`, "DELETE", {}),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-feedbacks"] }); toast.success("Deleted feedback"); },
	});

	const feedbacks = data?.feedbacks ?? [];
	const filtered = useMemo(() => {
		if (!search.trim()) return feedbacks;
		const q = search.toLowerCase();
		return feedbacks.filter(
			(f) =>
				(f.userEmail && f.userEmail.toLowerCase().includes(q)) ||
				(f.comment && f.comment.toLowerCase().includes(q)) ||
				f.reason.toLowerCase().includes(q),
		);
	}, [feedbacks, search]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">User Feedbacks</h1>
					<p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">
						Review message reports and unliked answers from users to improve system quality.
					</p>
				</div>
				<Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching} className="h-9 gap-1.5 font-mono text-xs shrink-0">
					<RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
					<span>{t("common.refresh")}</span>
				</Button>
			</header>

			{/* Top Summary Cards */}
			{data?.summary && (
				<div className="grid gap-3 sm:grid-cols-3">
					<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
						<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase">
							<span>Pending Issues</span>
							<AlertCircle className="size-4 text-[#b45309]" />
						</div>
						<div className="mt-2 text-2xl font-semibold font-mono text-[#b45309]">{data.summary.newCount}</div>
						<p className="mt-1 text-[10.5px] font-mono text-ink-2">Unreviewed reports</p>
					</div>

					<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
						<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase">
							<span>Total Feedbacks</span>
							<MessageSquareWarning className="size-4 text-accent" />
						</div>
						<div className="mt-2 text-2xl font-semibold font-mono text-ink">{data.summary.total}</div>
						<p className="mt-1 text-[10.5px] font-mono text-ink-2">All time reports</p>
					</div>

					<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
						<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase">
							<span>Resolved</span>
							<CheckCircle2 className="size-4 text-[#1d7a33]" />
						</div>
						<div className="mt-2 text-2xl font-semibold font-mono text-[#1d7a33]">{data.summary.resolvedCount}</div>
						<p className="mt-1 text-[10.5px] font-mono text-ink-2">Addressed issues</p>
					</div>
				</div>
			)}

			{/* Filter & Search Bar */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
				<div className="flex flex-1 flex-wrap items-center gap-2.5">
					<div className="relative min-w-[220px] max-w-xs flex-1">
						<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-2" />
						<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search feedback..." className="pl-8 pr-7 text-xs font-mono h-8" />
						{search && (
							<button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2 hover:text-ink cursor-pointer">
								<X className="size-3" />
							</button>
						)}
					</div>

					<div className="w-[150px]">
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								<SelectItem value="new">New only</SelectItem>
								<SelectItem value="reviewed">Reviewed</SelectItem>
								<SelectItem value="resolved">Resolved</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="text-xs font-mono text-ink-2 shrink-0">
					Showing {filtered.length} of {feedbacks.length} feedbacks
				</div>
			</div>

			{/* Feedback Table */}
			<div className="rounded-lg border border-line bg-white shadow-xs">
				<Table>
					<THead>
						<TR>
							<TH className="w-24">Status</TH>
							<TH>User</TH>
							<TH>Issue / Reason</TH>
							<TH>Comment</TH>
							<TH>Message Context</TH>
							<TH className="text-right">Actions</TH>
						</TR>
					</THead>
					<TBody>
						{filtered.map((f) => (
							<TR key={f.id}>
								<TD>
									<span className={`inline-flex rounded px-1.5 py-0.5 text-[9.5px] font-mono font-semibold uppercase ${
										f.status === "new" ? "bg-[#fffbeb] text-[#b45309] border border-[#fef3c7]" : f.status === "reviewed" ? "bg-[#f0f4ff] text-[#2323e6] border border-[#d5daff]" : "bg-[#f4faf5] text-[#1d7a33] border border-[#bcd9c0]"
									}`}>
										{f.status}
									</span>
								</TD>
								<TD className="font-mono text-xs">
									<div className="font-medium text-ink truncate max-w-[160px]">{f.userEmail || "Anonymous"}</div>
									<div className="text-[10px] text-ink-2">{new Date(f.createdAt).toLocaleDateString()}</div>
								</TD>
								<TD>
									<Badge className="text-[10.5px]">{f.reason}</Badge>
								</TD>
								<TD className="font-mono text-xs text-ink max-w-xs">
									<p className="line-clamp-2 leading-relaxed">{f.comment || "No comment"}</p>
								</TD>
								<TD className="font-mono text-[11px] text-ink-2 max-w-xs">
									<p className="line-clamp-2 leading-relaxed">{f.messagePreview || "N/A"}</p>
								</TD>
								<TD className="text-right whitespace-nowrap">
									<div className="flex items-center justify-end gap-1.5">
										{f.status !== "resolved" && (
											<Button size="sm" variant="outline" className="h-6 text-[10px] font-mono px-2" onClick={() => patchStatus.mutate({ id: f.id, status: "resolved" })}>
												Resolve
											</Button>
										)}
										<Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-ink-2 hover:text-[#c6293b]" onClick={() => remove.mutate(f.id)}>
											<Trash2 className="size-3" />
										</Button>
									</div>
								</TD>
							</TR>
						))}
						{filtered.length === 0 && (
							<TR>
								<TD colSpan={6} className="py-12 text-center text-xs font-mono text-ink-2">
									{isLoading ? t("common.loading") : "No feedbacks found"}
								</TD>
							</TR>
						)}
					</TBody>
				</Table>
			</div>
		</div>
	);
}

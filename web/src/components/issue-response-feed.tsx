import { useState } from "react";
import { MessageSquare, Clock, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@web/components/ui/primitives";
import { cn, fmtDate } from "@web/lib/utils";

export interface UserIssueItem {
	id: string;
	title: string;
	description: string;
	tool: string;
	customTool: string | null;
	model: string | null;
	status: "open" | "investigating" | "resolved";
	adminNote: string | null;
	userEmail: string | null;
	createdAt: string;
	resolvedAt?: string | null;
}

interface IssueResponseFeedProps {
	issues: UserIssueItem[];
	isVi: boolean;
}

export function IssueResponseFeed({ issues, isVi }: IssueResponseFeedProps) {
	const [expandedId, setExpandedId] = useState<string | null>(issues[0]?.id || null);

	if (!issues || issues.length === 0) return null;

	const toggleExpand = (id: string) => {
		setExpandedId((prev) => (prev === id ? null : id));
	};

	return (
		<div className="rounded-2xl border border-line bg-surface p-6 shadow-xs space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line/60 pb-3">
				<div className="flex items-center gap-2">
					<div className="flex size-7 items-center justify-center rounded-md bg-accent/10 text-accent">
						<MessageSquare className="size-4" />
					</div>
					<div>
						<h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
							<span>{isVi ? "Phản hồi & Lịch sử xử lý sự cố" : "Admin Responses & Triage Updates"}</span>
							<span className="rounded-full bg-accent/10 text-accent font-semibold px-2 py-0.2 text-[10px]">
								{issues.length} {issues.length === 1 ? "ticket" : "tickets"}
							</span>
						</h3>
						<p className="text-[11px] font-mono text-ink-2">
							{isVi
								? "Theo dõi tiến độ, xem trực tiếp câu trả lời của Admin và hướng dẫn khắc phục"
								: "Track resolution status and read direct administrative feedback"}
						</p>
					</div>
				</div>
			</div>

			{/* List of User Tickets with Expandable Admin Response */}
			<div className="space-y-3">
				{issues.map((it) => {
					const isExpanded = expandedId === it.id;
					const isResolved = it.status === "resolved";
					const isInvestigating = it.status === "investigating";

					return (
						<div
							key={it.id}
							className={cn(
								"rounded-xl border transition-all duration-200 overflow-hidden",
								isExpanded ? "border-accent/50 ring-1 ring-accent/20 bg-paper/60 shadow-xs" : "border-line bg-paper/30 hover:border-line-hover"
							)}
						>
							{/* Ticket Header Row */}
							<button
								type="button"
								onClick={() => toggleExpand(it.id)}
								className="w-full flex items-center justify-between gap-3 p-3.5 text-left cursor-pointer select-none"
							>
								<div className="flex items-center gap-2.5 min-w-0 flex-1">
									<Badge
										className={cn(
											"text-[10px] font-mono uppercase px-2 py-0.5 shrink-0",
											isResolved && "bg-[#f4faf5] text-[#1d7a33] border-[#bcd9c0]",
											isInvestigating && "bg-[#fef9ee] text-[#b45309] border-[#fde68a]",
											it.status === "open" && "bg-surface text-ink-2 border-line"
										)}
									>
										{it.status}
									</Badge>

									<span className="font-mono text-xs font-semibold text-ink truncate">
										{it.title}
									</span>

									<span className="hidden sm:inline font-mono text-[10.5px] text-ink-2 shrink-0">
										&middot; {it.tool}
									</span>
								</div>

								<div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-ink-2">
									<span className="hidden md:inline">{fmtDate(it.createdAt)}</span>
									{it.adminNote ? (
										<span className="inline-flex items-center gap-1 text-accent font-semibold text-[10.5px] bg-accent/10 px-1.5 py-0.5 rounded">
											<CheckCircle2 className="size-3 text-accent" />
											{isVi ? "Có phản hồi" : "Responded"}
										</span>
									) : (
										<span className="text-ink-2/60 text-[10.5px]">
											{isVi ? "Đang chờ" : "Pending"}
										</span>
									)}
									{isExpanded ? <ChevronUp className="size-4 text-ink-2" /> : <ChevronDown className="size-4 text-ink-2" />}
								</div>
							</button>

							{/* Expandable Details Area */}
							{isExpanded && (
								<div className="px-4 pb-4 pt-1 space-y-3 border-t border-line/40 text-xs font-mono">
									{/* Original User Description */}
									<div className="space-y-1">
										<span className="text-[10px] uppercase font-semibold text-ink-2">
											{isVi ? "Mô tả sự cố bạn đã gửi:" : "Your Reported Problem:"}
										</span>
										<div className="p-3 rounded-lg bg-surface border border-line text-ink whitespace-pre-wrap leading-relaxed text-[11.5px]">
											{it.description}
										</div>
									</div>

									{/* Admin Response Box */}
									{it.adminNote ? (
										<div className="space-y-1.5 pt-1">
											<div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-accent">
												<CheckCircle2 className="size-3.5 text-accent" />
												<span>{isVi ? "Phản hồi & Hướng xử lý từ Quản trị viên:" : "Official Admin Response & Resolution:"}</span>
											</div>
											<div className="p-3.5 rounded-lg bg-accent/5 border border-accent/25 text-ink leading-relaxed font-sans text-xs sm:text-[13px] shadow-2xs">
												{it.adminNote}
											</div>
										</div>
									) : (
										<div className="flex items-center gap-2 p-2.5 rounded-lg bg-paper-2 text-ink-2 text-[11px]">
											<Clock className="size-3.5 text-[#b45309]" />
											<span>{isVi ? "Sự cố đang được đội ngũ quản trị kiểm tra. Bạn sẽ nhận được thông báo phản hồi ngay tại đây." : "Admin has queued this ticket. Responses will appear directly here."}</span>
										</div>
									)}

									{/* Meta footer */}
									<div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/40 text-[10.5px] text-ink-2">
										<span>Ticket ID: <code>{it.id}</code></span>
										{it.model && <span>Model: <code>{it.model}</code></span>}
										{it.resolvedAt && <span>{isVi ? "Đã đóng lúc: " : "Resolved at: "}{fmtDate(it.resolvedAt)}</span>}
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

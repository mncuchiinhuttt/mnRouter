import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, Search, X } from "lucide-react";
import { Badge, Input, Table, TBody, TD, TH, THead, TR } from "@web/components/ui/primitives";
import { fmtCompact } from "@web/lib/utils";

export interface LeaderboardUser {
	rank: number;
	userId: string;
	displayName: string | null;
	username: string | null;
	department?: string | null;
	avatarUrl?: string | null;
	packageName: string | null;
	role: string;
	totalTokens: number;
	promptTokens: number;
	completionTokens: number;
	credits: number;
	requests: number;
	errors: number;
	lastActive: string | null;
	isCurrentUser?: boolean;
}

interface UserLeaderboardProps {
	users: LeaderboardUser[];
	isLoading?: boolean;
}

export function UserLeaderboard({ users, isLoading }: UserLeaderboardProps) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");

	const filtered = users.filter((u) => {
		if (!query.trim()) return true;
		const q = query.toLowerCase();
		return (
			(u.displayName && u.displayName.toLowerCase().includes(q)) ||
			(u.username && u.username.toLowerCase().includes(q)) ||
			(u.department && u.department.toLowerCase().includes(q))
		);
	});

	return (
		<div className="rounded-lg border border-line bg-white shadow-xs space-y-3 p-4">
			{/* Header & Search */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
				<div>
					<div className="flex items-center gap-2">
						<Award className="size-4 text-accent" />
						<h3 className="font-semibold text-sm text-ink">{t("adminAnalytics.leaderboardTitle")}</h3>
					</div>
					<p className="text-xs text-ink-2 mt-0.5">{t("adminAnalytics.leaderboardDesc")}</p>
				</div>

				<div className="relative w-full max-w-xs">
					<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-2" />
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t("adminAnalytics.searchUsers")}
						className="pl-8 pr-7 text-xs font-mono h-8"
					/>
					{query && (
						<button
							type="button"
							onClick={() => setQuery("")}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2 hover:text-ink cursor-pointer"
						>
							<X className="size-3" />
						</button>
					)}
				</div>
			</div>

			{/* Table */}
			<Table>
				<THead>
					<TR>
						<TH className="w-12 text-center">{t("adminAnalytics.rank")}</TH>
						<TH>{t("adminAnalytics.colUser")}</TH>
						<TH className="text-right">{t("adminAnalytics.colTokens")}</TH>
						<TH className="text-right">{t("adminAnalytics.colCredits")}</TH>
						<TH className="text-right">{t("adminAnalytics.colRequests")}</TH>
						<TH className="text-right">{t("adminAnalytics.colLastActive")}</TH>
					</TR>
				</THead>
				<TBody>
					{filtered.map((u) => {
						const isTop1 = u.rank === 1;
						const isTop2 = u.rank === 2;
						const isTop3 = u.rank === 3;
						return (
							<TR key={u.userId}>
								<TD className="text-center font-mono text-xs">
									{isTop1 ? (
										<span className="inline-flex size-6 items-center justify-center rounded-full bg-[#fef3c7] text-[#b45309] font-bold">1</span>
									) : isTop2 ? (
										<span className="inline-flex size-6 items-center justify-center rounded-full bg-[#f1f5f9] text-[#475569] font-bold">2</span>
									) : isTop3 ? (
										<span className="inline-flex size-6 items-center justify-center rounded-full bg-[#fed7aa] text-[#9a3412] font-bold">3</span>
									) : (
										<span className="text-ink-2">#{u.rank}</span>
									)}
								</TD>
								<TD className="font-mono text-xs">
									<div className="flex items-center gap-2.5">
										{u.avatarUrl ? (
											<img src={u.avatarUrl} alt="" className="size-7 rounded-full object-cover shrink-0 border border-line shadow-2xs" />
										) : (
											<div className="size-7 rounded-full bg-accent/15 text-accent font-semibold flex items-center justify-center font-mono text-[10px] shrink-0 border border-accent/25">
												{(u.displayName || u.username || "U").slice(0, 2).toUpperCase()}
											</div>
										)}
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-1.5 flex-wrap">
												<span className="font-semibold text-ink truncate max-w-[220px]" title={u.displayName || (u.username ? `@${u.username}` : "User")}>
													{u.displayName || (u.username ? `@${u.username}` : "Anonymous User")}
												</span>
												{u.isCurrentUser && (
													<span className="rounded bg-accent/20 border border-accent/40 px-1.5 py-0.2 text-[9px] text-accent font-semibold">
														You
													</span>
												)}
												{u.packageName && (
													<span className="rounded bg-accent/15 border border-accent/30 px-1.5 py-0.2 text-[9px] text-accent-bright font-semibold">
														{u.packageName}
													</span>
												)}
												{u.role === "admin" && (
													<span className="rounded bg-paper-2 border border-line px-1.5 py-0.2 text-[9px] text-ink-2 uppercase">
														Admin
													</span>
												)}
											</div>
											<div className="flex items-center gap-1.5 text-[10px] text-ink-2 mt-0.5">
												{u.username && <span>@{u.username}</span>}
												{u.username && u.department && <span>&middot;</span>}
												{u.department && <span className="truncate max-w-[200px]">{u.department}</span>}
											</div>
										</div>
									</div>
								</TD>
								<TD className="text-right font-mono text-xs tabular-nums font-semibold text-ink">
									{fmtCompact(u.totalTokens)}
								</TD>
								<TD className="text-right font-mono text-xs tabular-nums font-medium text-ink">
									{u.credits.toFixed(2)} cr
								</TD>
								<TD className="text-right font-mono text-xs tabular-nums text-ink">
									<div>{u.requests} reqs</div>
									{u.errors > 0 && <div className="text-[10px] text-[#c6293b]">{u.errors} errs</div>}
								</TD>
								<TD className="text-right font-mono text-[11px] text-ink-2">
									{u.lastActive ? new Date(u.lastActive).toLocaleString() : "Never"}
								</TD>
							</TR>
						);
					})}
					{filtered.length === 0 && (
						<TR>
							<TD colSpan={6} className="py-8 text-center text-xs font-mono text-ink-2">
								{isLoading ? t("common.loading") : t("adminAnalytics.noLeaderboard")}
							</TD>
						</TR>
					)}
				</TBody>
			</Table>
		</div>
	);
}

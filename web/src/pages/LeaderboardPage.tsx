import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Award, RefreshCw, Trophy, UserCheck } from "lucide-react";
import { api } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { UserLeaderboard, type LeaderboardUser } from "@web/components/admin/user-leaderboard";
import { fmtCompact } from "@web/lib/utils";

interface LeaderboardResp {
	range: string;
	leaderboard: LeaderboardUser[];
	myRank: { rank: number; totalTokens: number; credits: number; requests: number } | null;
	totalParticipants: number;
}

const RANGES = [
	{ id: "24h", label: "24h" },
	{ id: "7d", label: "7 Days" },
	{ id: "30d", label: "30 Days" },
	{ id: "all", label: "All Time" },
] as const;

export default function LeaderboardPage() {
	const { t } = useTranslation();
	const [range, setRange] = useState<"24h" | "7d" | "30d" | "all">("7d");

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["community-leaderboard", range],
		queryFn: () => api<LeaderboardResp>(`/api/leaderboard?range=${range}`),
		refetchInterval: 30_000,
	});

	const myRank = data?.myRank;

	return (
		<div className="space-y-6">
			{/* Header */}
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Trophy className="size-6 text-accent" />
						<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">
							{t("adminAnalytics.leaderboardTitle")}
						</h1>
					</div>
					<p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">
						{t("adminAnalytics.leaderboardDesc")}
					</p>
				</div>

				<div className="flex items-center gap-2">
					<div className="inline-flex rounded-md border border-line bg-paper-2 p-0.5 font-mono text-xs shadow-2xs">
						{RANGES.map((r) => (
							<button
								key={r.id}
								type="button"
								onClick={() => setRange(r.id)}
								className={`rounded px-2.5 py-1 transition cursor-pointer ${
									range === r.id ? "bg-accent text-white font-medium" : "text-ink-2 hover:text-ink"
								}`}
							>
								{r.label}
							</button>
						))}
					</div>

					<Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching} className="h-8 gap-1.5 font-mono text-xs shrink-0">
						<RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
						<span>{t("common.refresh")}</span>
					</Button>
				</div>
			</header>

			{/* My Rank Card */}
			{myRank && (
				<div className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-[#f6f8ff] p-4 text-xs shadow-xs sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2.5">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-white font-bold font-mono text-sm">
							#{myRank.rank}
						</div>
						<div>
							<div className="flex items-center gap-1.5 font-semibold text-ink font-mono text-sm">
								<UserCheck className="size-3.5 text-accent" />
								<span>Your Ranking</span>
							</div>
							<p className="text-ink-2 font-mono text-[11px] mt-0.5">
								You are ranked #{myRank.rank} out of {data?.totalParticipants || 1} active users this period.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-4 font-mono text-xs">
						<div>
							<span className="text-ink-2 block text-[10px] uppercase">Tokens</span>
							<span className="font-semibold text-ink">{fmtCompact(myRank.totalTokens)}</span>
						</div>
						<div>
							<span className="text-ink-2 block text-[10px] uppercase">Credits</span>
							<span className="font-semibold text-ink">{myRank.credits.toFixed(2)} cr</span>
						</div>
						<div>
							<span className="text-ink-2 block text-[10px] uppercase">Requests</span>
							<span className="font-semibold text-ink">{myRank.requests}</span>
						</div>
					</div>
				</div>
			)}

			{/* Leaderboard Table */}
			<UserLeaderboard users={data?.leaderboard ?? []} isLoading={isLoading} />
		</div>
	);
}

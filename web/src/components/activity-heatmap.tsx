import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Trophy, Calendar, Zap, Sparkles } from "lucide-react";
import { fmtCompact, fmtNum } from "@web/lib/utils";

export interface StreakDay {
	date: string;
	requests: number;
	tokens: number;
	credits: number;
}

export interface StreakData {
	currentStreak: number;
	longestStreak: number;
	totalActiveDays: number;
	totalYearTokens: number;
	totalYearRequests: number;
	totalYearCredits: number;
	days: StreakDay[];
}

interface ActivityHeatmapProps {
	data: StreakData;
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
	const { t } = useTranslation();
	const [hoveredDay, setHoveredDay] = useState<{
		date: string;
		tokens: number;
		requests: number;
		credits: number;
		x: number;
		y: number;
	} | null>(null);

	// Build exact 52 weeks (364 days + current day = 365 days) leading up to today
	const { weeks, monthLabels, maxTokens } = useMemo(() => {
		const dayMap = new Map<string, StreakDay>();
		let maxTok = 0;
		for (const d of data.days) {
			dayMap.set(d.date, d);
			if (d.tokens > maxTok) maxTok = d.tokens;
		}

		const today = new Date();
		// Set to start of today
		const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

		// We display 52 columns of 7 days (Sunday to Saturday)
		// Find the end day of week (0: Sun, 6: Sat)
		const endDayOfWeek = end.getDay();
		const totalDays = 52 * 7 + (endDayOfWeek + 1);

		const start = new Date(end);
		start.setDate(start.getDate() - (totalDays - 1));

		const allWeeks: Array<Array<{ date: string; dayOfWeek: number; activity?: StreakDay } | null>> = [];
		let currentWeek: Array<{ date: string; dayOfWeek: number; activity?: StreakDay } | null> = [];

		// Month label markers
		const months: Array<{ name: string; weekIndex: number }> = [];
		let lastMonth = -1;

		const cur = new Date(start);
		let weekIdx = 0;

		while (cur <= end) {
			const dayOfWeek = cur.getDay(); // 0 is Sunday
			const iso = cur.toISOString().slice(0, 10);
			const month = cur.getMonth();

			if (month !== lastMonth && dayOfWeek === 0) {
				months.push({
					name: cur.toLocaleString("en-US", { month: "short" }),
					weekIndex: weekIdx,
				});
				lastMonth = month;
			}

			currentWeek.push({
				date: iso,
				dayOfWeek,
				activity: dayMap.get(iso),
			});

			if (dayOfWeek === 6 || cur.getTime() === end.getTime()) {
				allWeeks.push(currentWeek);
				currentWeek = [];
				weekIdx++;
			}

			cur.setDate(cur.getDate() + 1);
		}

		if (currentWeek.length > 0) {
			allWeeks.push(currentWeek);
		}

		return {
			weeks: allWeeks.slice(-52), // keep the latest 52 weeks
			monthLabels: months.slice(-12),
			maxTokens: Math.max(1, maxTok),
		};
	}, [data]);

	function getColorClass(tokens: number): string {
		if (tokens === 0) return "bg-[#ebedf0] dark:bg-[#232342]";
		const ratio = tokens / maxTokens;
		if (ratio < 0.15) return "bg-[#9be9a8] dark:bg-[#0e4429]";
		if (ratio < 0.4) return "bg-[#40c463] dark:bg-[#006d32]";
		if (ratio < 0.75) return "bg-[#30a14e] dark:bg-[#26a641]";
		return "bg-[#216e39] dark:bg-[#39d353]";
	}

	return (
		<div className="rounded-xl border border-line bg-white p-5 shadow-2xs space-y-5">
			{/* Top Streak Header Counters */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line/60 pb-4">
				<div>
					<div className="flex items-center gap-2">
						<Flame className="size-5 text-amber-500 fill-amber-500 animate-pulse" />
						<h3 className="text-lg font-bold tracking-tight text-ink">
							AI Usage Streak & Activity
						</h3>
					</div>
					<p className="text-xs font-mono text-ink-2 mt-0.5">
						GitHub & Codex style 365-day coding activity heatmap
					</p>
				</div>

				<div className="flex items-center gap-5 sm:gap-6 font-mono">
					<div className="flex items-center gap-2">
						<div className="size-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-sm">
							{data.currentStreak}
						</div>
						<div>
							<div className="text-[10px] text-ink-2 uppercase tracking-wider">Current Streak</div>
							<div className="text-xs font-bold text-ink">{data.currentStreak} days</div>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<div className="size-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-accent font-bold text-sm">
							{data.longestStreak}
						</div>
						<div>
							<div className="text-[10px] text-ink-2 uppercase tracking-wider">Longest Streak</div>
							<div className="text-xs font-bold text-ink">{data.longestStreak} days</div>
						</div>
					</div>

					<div className="hidden md:block">
						<div className="text-[10px] text-ink-2 uppercase tracking-wider">Total Active Days</div>
						<div className="text-xs font-bold text-ink">{data.totalActiveDays} / 365 days</div>
					</div>
				</div>
			</div>

			{/* Calendar Heatmap Matrix */}
			<div className="relative overflow-x-auto pb-2 [scrollbar-width:thin]">
				<div className="min-w-[720px] space-y-1.5">
					{/* Month labels */}
					<div className="flex text-[10px] font-mono text-ink-2 h-4 relative">
						{monthLabels.map((m, idx) => (
							<span
								key={`${m.name}-${idx}`}
								className="absolute"
								style={{ left: `${(m.weekIndex / 52) * 100}%` }}
							>
								{m.name}
							</span>
						))}
					</div>

					{/* 7-row Weekday Grid */}
					<div className="flex gap-1">
						{/* Day of week labels */}
						<div className="flex flex-col justify-between text-[9px] font-mono text-ink-2 pr-1.5 py-0.5 select-none">
							<span>Sun</span>
							<span>Tue</span>
							<span>Thu</span>
							<span>Sat</span>
						</div>

						{/* 52 Columns */}
						<div className="flex flex-1 gap-1">
							{weeks.map((week, wIdx) => (
								<div key={wIdx} className="flex flex-col gap-1 flex-1">
									{week.map((day, dIdx) => {
										if (!day) return <div key={dIdx} className="size-2.5 rounded-2xs opacity-0" />;
										const tokens = day.activity?.tokens ?? 0;
										const color = getColorClass(tokens);

										return (
											<div
												key={day.date}
												onMouseEnter={(e) => {
													const rect = e.currentTarget.getBoundingClientRect();
													setHoveredDay({
														date: day.date,
														tokens,
														requests: day.activity?.requests ?? 0,
														credits: day.activity?.credits ?? 0,
														x: rect.left + rect.width / 2,
														y: rect.top - 8,
													});
												}}
												onMouseLeave={() => setHoveredDay(null)}
												className={`size-2.5 sm:size-3 rounded-2xs transition-all hover:scale-125 cursor-pointer ${color}`}
											/>
										);
									})}
								</div>
							))}
						</div>
					</div>

					{/* Legend footer */}
					<div className="flex items-center justify-between pt-2 text-[10.5px] font-mono text-ink-2">
						<span>
							{fmtCompact(data.totalYearTokens)} tokens ({fmtNum(data.totalYearRequests)} requests) in the last year
						</span>
						<div className="flex items-center gap-1.5">
							<span>Less</span>
							<span className="size-2.5 rounded-2xs bg-[#ebedf0] dark:bg-[#232342]" />
							<span className="size-2.5 rounded-2xs bg-[#9be9a8] dark:bg-[#0e4429]" />
							<span className="size-2.5 rounded-2xs bg-[#40c463] dark:bg-[#006d32]" />
							<span className="size-2.5 rounded-2xs bg-[#30a14e] dark:bg-[#26a641]" />
							<span className="size-2.5 rounded-2xs bg-[#216e39] dark:bg-[#39d353]" />
							<span>More</span>
						</div>
					</div>
				</div>

				{/* Floating tooltip on hover */}
				{hoveredDay && (
					<div
						className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full rounded-md bg-navy text-white px-2.5 py-1.5 shadow-xl font-mono text-[11px] space-y-0.5 border border-white/20 animate-in fade-in-50 duration-100"
						style={{ left: hoveredDay.x, top: hoveredDay.y }}
					>
						<div className="font-bold text-accent-light">{hoveredDay.date}</div>
						<div className="text-white/90">
							{fmtNum(hoveredDay.tokens)} tokens ({hoveredDay.requests} reqs)
						</div>
						{hoveredDay.credits > 0 && (
							<div className="text-amber-300 text-[10px]">
								{hoveredDay.credits} credits consumed
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

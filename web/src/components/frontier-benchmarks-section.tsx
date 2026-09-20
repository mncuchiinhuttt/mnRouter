import { useState, useMemo } from "react";
import { Award, Terminal, Code2, Brain, Microscope, ShieldCheck, Eye, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@web/components/ui/primitives";
import { getDetailedBenchmark, type DetailedBenchmarkMetrics } from "@web/lib/model-benchmarks";

interface ModelItem {
	id: string;
	displayName: string;
	provider: string;
	contextWindow: number;
	priceIn: number;
	priceOut: number;
}

interface FrontierBenchmarksSectionProps {
	models: ModelItem[];
}

type MetricKey = keyof DetailedBenchmarkMetrics;

interface BenchmarkMetricDef {
	key: MetricKey;
	nameKey: string;
	categoryKey: string;
	descKey: string;
	icon: any;
	color: string;
}

const BENCHMARK_METRICS: BenchmarkMetricDef[] = [
	{
		key: "terminalBench2",
		nameKey: "metricTerminalBench2Name",
		categoryKey: "metricTerminalBench2Category",
		descKey: "metricTerminalBench2Desc",
		icon: Terminal,
		color: "text-[#5858ff] bg-[#5858ff]/10 border-[#5858ff]/25",
	},
	{
		key: "terminalBench4",
		nameKey: "metricTerminalBench4Name",
		categoryKey: "metricTerminalBench4Category",
		descKey: "metricTerminalBench4Desc",
		icon: Terminal,
		color: "text-[#a855f7] bg-[#a855f7]/10 border-[#a855f7]/25",
	},
	{
		key: "deepSwe",
		nameKey: "metricDeepSweName",
		categoryKey: "metricDeepSweCategory",
		descKey: "metricDeepSweDesc",
		icon: Code2,
		color: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25",
	},
	{
		key: "gpqaDiamond",
		nameKey: "metricGpqaDiamondName",
		categoryKey: "metricGpqaDiamondCategory",
		descKey: "metricGpqaDiamondDesc",
		icon: Microscope,
		color: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/25",
	},
	{
		key: "hleTools",
		nameKey: "metricHleToolsName",
		categoryKey: "metricHleCategory",
		descKey: "metricHleDesc",
		icon: Award,
		color: "text-[#ec4899] bg-[#ec4899]/10 border-[#ec4899]/25",
	},
	{
		key: "nl2repo",
		nameKey: "metricNl2repoName",
		categoryKey: "metricNl2repoCategory",
		descKey: "metricNl2repoDesc",
		icon: Brain,
		color: "text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/25",
	},
	{
		key: "mathArena",
		nameKey: "metricMathArenaName",
		categoryKey: "metricMathArenaCategory",
		descKey: "metricMathArenaDesc",
		icon: Sparkles,
		color: "text-[#06b6d4] bg-[#06b6d4]/10 border-[#06b6d4]/25",
	},
	{
		key: "cyberGym",
		nameKey: "metricCyberGymName",
		categoryKey: "metricCyberGymCategory",
		descKey: "metricCyberGymDesc",
		icon: ShieldCheck,
		color: "text-[#e11d48] bg-[#e11d48]/10 border-[#e11d48]/25",
	},
	{
		key: "visionMultimodal",
		nameKey: "metricVisionMultimodalName",
		categoryKey: "metricVisionMultimodalCategory",
		descKey: "metricVisionMultimodalDesc",
		icon: Eye,
		color: "text-[#14b8a6] bg-[#14b8a6]/10 border-[#14b8a6]/25",
	},
];

export function FrontierBenchmarksSection({ models }: { models: ModelItem[] }) {
	const { t } = useTranslation();
	const [activeMetricKey, setActiveMetricKey] = useState<MetricKey>("terminalBench2");

	const activeMetric = useMemo(() => {
		return BENCHMARK_METRICS.find((m) => m.key === activeMetricKey) || BENCHMARK_METRICS[0]!;
	}, [activeMetricKey]);

	// Filter and rank only models available on mnRouter
	const rankedModels = useMemo(() => {
		const scored = models.map((m) => {
			const bench = getDetailedBenchmark(m.id);
			const score = bench[activeMetricKey];
			// Clean display name by removing provider suffixes like (Kiro), (AG), (via AG)
			const cleanName = m.displayName
				.replace(/\s*\((?:via\s*)?(?:AG|Kiro|Antigravity|OpenCode|Codex)\)/gi, "")
				.trim();

			return {
				...m,
				cleanName,
				benchmarks: bench,
				currentScore: score,
			};
		});

		// Sort by active metric descending (models without scores go to bottom)
		scored.sort((a, b) => {
			if (a.currentScore === null && b.currentScore === null) return 0;
			if (a.currentScore === null) return 1;
			if (b.currentScore === null) return -1;
			return b.currentScore - a.currentScore;
		});
		return scored;
	}, [models, activeMetricKey]);

	const highestScoredModel = rankedModels.find((m) => m.currentScore !== null);

	return (
		<section className="space-y-4">
			{/* Section Header */}
			<div className="border-b border-line pb-3">
				<h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink flex items-center gap-2">
					<span>{t("frontierBenchmarks.title", "Frontier Benchmarks Leaderboard.")}</span>
				</h2>
				<p className="text-xs sm:text-sm font-mono text-ink-2 mt-1">
					{t(
						"frontierBenchmarks.desc",
						"So sánh năng lực thực tế của các model trên mnRouter qua các bài test năng lực lập trình, suy luận và xử lý tác vụ",
					)}
				</p>
			</div>

			{/* Benchmark Categories Tab Selector - 2 balanced, spacious rows */}
			<div className="flex flex-wrap gap-2.5">
				{BENCHMARK_METRICS.map((metric) => {
					const Icon = metric.icon;
					const isActive = activeMetricKey === metric.key;
					const categoryText = t(`frontierBenchmarks.${metric.categoryKey}`);
					const nameText = t(`frontierBenchmarks.${metric.nameKey}`);

					return (
						<button
							key={metric.key}
							type="button"
							onClick={() => setActiveMetricKey(metric.key)}
							className={`flex-1 min-w-[calc(50%-0.6rem)] sm:min-w-[calc(33.333%-0.6rem)] lg:min-w-[calc(20%-0.6rem)] p-3 rounded-xl border text-left transition-all cursor-pointer ${
								isActive
									? "border-accent bg-surface ring-1 ring-accent/30 shadow-xs"
									: "border-line bg-surface hover:border-line-hover opacity-80 hover:opacity-100 hover:shadow-2xs"
							}`}
						>
							<div className="flex items-center justify-between gap-1.5 mb-1.5">
								<div className="flex items-center gap-2 min-w-0">
									<div className={`flex size-6 shrink-0 items-center justify-center rounded-md border ${metric.color}`}>
										<Icon className="size-3.5" />
									</div>
									<span className="text-[10px] uppercase font-mono tracking-wider text-ink-2 truncate">
										{categoryText}
									</span>
								</div>
								{isActive && (
									<span className="size-1.5 shrink-0 rounded-full bg-accent animate-ping" />
								)}
							</div>

							<div className="font-mono text-xs font-bold text-ink truncate">
								{nameText}
							</div>
						</button>
					);
				})}
			</div>

			{/* Active Benchmark Description Card */}
			<div className="rounded-xl border border-line/70 bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
				<div className="flex items-center gap-3">
					<div className={`flex size-8 items-center justify-center rounded-lg border ${activeMetric.color}`}>
						<activeMetric.icon className="size-4" />
					</div>
					<div>
						<div className="font-bold text-ink text-sm flex items-center gap-2">
							<span>{t(`frontierBenchmarks.${activeMetric.nameKey}`)}</span>
							<Badge className="text-[10px]">{t(`frontierBenchmarks.${activeMetric.categoryKey}`)}</Badge>
						</div>
						<div className="text-ink-2 text-[11px] mt-0.5">{t(`frontierBenchmarks.${activeMetric.descKey}`)}</div>
					</div>
				</div>

				<div className="shrink-0 text-[11px] text-ink-2 bg-paper-2 px-3 py-1.5 rounded-lg border border-line/60">
					{t("frontierBenchmarks.frontierLeader", "Frontier Leader")}:{" "}
					<strong className="text-accent">
						{highestScoredModel
							? `${highestScoredModel.cleanName} (${highestScoredModel.currentScore?.toFixed(1)} pts)`
							: "N/A"}
					</strong>
				</div>
			</div>

			{/* Leaderboard Ranking Table */}
			<div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
				<div className="overflow-x-auto">
					<table className="w-full text-left font-mono text-xs">
						<thead>
							<tr className="border-b border-line bg-paper text-[10.5px] uppercase tracking-wider text-ink-2">
								<th className="py-2.5 px-4 w-12 text-center">{t("frontierBenchmarks.thRank", "Rank")}</th>
								<th className="py-2.5 px-4 min-w-[220px]">{t("frontierBenchmarks.thModel", "Model Name")}</th>
								<th className="py-2.5 px-4 min-w-[280px]">{t("frontierBenchmarks.thScore", "Score Visualization")}</th>
								<th className="py-2.5 px-4 w-28 text-right">{t("frontierBenchmarks.thPoints", "Points")}</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line/40">
							{rankedModels.map((m, idx) => {
								const isGold = idx === 0;
								const isSilver = idx === 1;
								const isBronze = idx === 2;

								const barWidth = m.currentScore !== null ? Math.max(6, (m.currentScore / 100) * 100) : 0;

								return (
									<tr key={m.id} className="hover:bg-paper/40 transition-colors">
										{/* Rank */}
										<td className="py-3 px-4 text-center font-bold">
											{isGold ? (
												<span className="inline-flex size-6 items-center justify-center rounded-full bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">01</span>
											) : isSilver ? (
												<span className="inline-flex size-6 items-center justify-center rounded-full bg-[#94a3b8]/15 text-[#64748b] border border-[#94a3b8]/30">02</span>
											) : isBronze ? (
												<span className="inline-flex size-6 items-center justify-center rounded-full bg-[#b45309]/15 text-[#b45309] border border-[#b45309]/30">03</span>
											) : (
												<span className="text-ink-2">{String(idx + 1).padStart(2, "0")}</span>
											)}
										</td>

										{/* Model Details without (Kiro) or (AG) tags */}
										<td className="py-3 px-4">
											<div className="font-bold text-ink text-xs truncate max-w-xs">{m.cleanName}</div>
											<div className="text-[10px] text-ink-2 truncate">{m.id}</div>
										</td>

										{/* Score Bar */}
										<td className="py-3 px-4">
											<div className="space-y-1">
												<div className="h-2 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
													<div
														className={`h-full rounded-full transition-all duration-500 ${
															isGold ? "bg-[#f59e0b]" : isSilver ? "bg-[#5858ff]" : "bg-accent"
														}`}
														style={{ width: `${barWidth}%` }}
													/>
												</div>
											</div>
										</td>

										{/* Points */}
										<td className="py-3 px-4 text-right">
											{m.currentScore !== null ? (
												<span className="font-bold text-sm text-ink tabular-nums">{m.currentScore.toFixed(1)}</span>
											) : (
												<span className="text-ink-2/50 text-xs font-normal">—</span>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	);
}

import { useState, useMemo } from "react";
import { Award, Terminal, Code2, Brain, Microscope, ShieldCheck, Eye, Sparkles } from "lucide-react";
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

const BENCHMARK_METRICS: Array<{
	key: MetricKey;
	name: string;
	category: string;
	desc: string;
	icon: any;
	color: string;
}> = [
	{
		key: "terminalBench",
		name: "Terminal-Bench 2.1 / 4.0",
		category: "Agentic Coding",
		desc: "Thao tác dòng lệnh, debug mã nguồn và giải quyết tác vụ kỹ thuật tự động trong container sandbox",
		icon: Terminal,
		color: "text-[#5858ff] bg-[#5858ff]/10 border-[#5858ff]/25",
	},
	{
		key: "deepSwe",
		name: "DeepSWE v1.1",
		category: "Software Engineering",
		desc: "Kiểm tra kỹ thuật phần mềm tầm xa, giải quyết issue trên nhiều tệp mã nguồn",
		icon: Code2,
		color: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25",
	},
	{
		key: "gpqaDiamond",
		name: "GPQA Diamond",
		category: "Scientific Reasoning",
		desc: "Đánh giá năng lực suy luận khoa học chuyên sâu, Google-proof cấp tiến sĩ",
		icon: Microscope,
		color: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/25",
	},
	{
		key: "hleTools",
		name: "HLE (With Tools)",
		category: "Humanity's Last Exam",
		desc: "Bài thi học thuật tối hậu liên ngành (Toán, Khoa học, Pháp lý, Y khoa) có công cụ hỗ trợ",
		icon: Award,
		color: "text-[#ec4899] bg-[#ec4899]/10 border-[#ec4899]/25",
	},
	{
		key: "nl2repo",
		name: "NL2Repo-Bench",
		category: "Repo Architecture",
		desc: "Sinh toàn bộ kho mã nguồn và cấu trúc project từ mô tả ngôn ngữ tự nhiên",
		icon: Brain,
		color: "text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/25",
	},
	{
		key: "mathArena",
		name: "MathArena Apex",
		category: "Math Reasoning",
		desc: "Suy luận toán học cấp cao, giải các bài toán Olympic và hình học phức tạp",
		icon: Sparkles,
		color: "text-[#06b6d4] bg-[#06b6d4]/10 border-[#06b6d4]/25",
	},
	{
		key: "cyberGym",
		name: "CyberGym",
		category: "Cybersecurity",
		desc: "Thực hành vá lỗi bảo mật, phân tích mã độc và kiểm thử thâm nhập an toàn",
		icon: ShieldCheck,
		color: "text-[#e11d48] bg-[#e11d48]/10 border-[#e11d48]/25",
	},
	{
		key: "visionMultimodal",
		name: "BabyVision / Chart",
		category: "Multimodal Vision",
		desc: "Đọc hiểu biểu đồ, trích xuất dữ liệu thị giác từ ảnh chụp và sơ đồ kỹ thuật",
		icon: Eye,
		color: "text-[#14b8a6] bg-[#14b8a6]/10 border-[#14b8a6]/25",
	},
];

export function FrontierBenchmarksSection({ models }: { models: ModelItem[] }) {
	const [activeMetricKey, setActiveMetricKey] = useState<MetricKey>("terminalBench");
	const [providerFilter, setProviderFilter] = useState<string>("all");

	const activeMetric = useMemo(() => {
		return BENCHMARK_METRICS.find((m) => m.key === activeMetricKey) || BENCHMARK_METRICS[0]!;
	}, [activeMetricKey]);

	// Filter and rank only models available on mnRouter
	const rankedModels = useMemo(() => {
		const filtered = providerFilter === "all" ? models : models.filter((m) => m.provider === providerFilter);

		const scored = filtered.map((m) => {
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
	}, [models, activeMetricKey, providerFilter]);

	const highestScoredModel = rankedModels.find((m) => m.currentScore !== null);
	return (
		<section className="space-y-4">
			{/* Section Header */}
			<div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-line pb-3">
				<div>
					<h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink flex items-center gap-2">
						<span>Frontier Benchmarks Leaderboard.</span>
					</h2>
					<p className="text-xs sm:text-sm font-mono text-ink-2 mt-1">
						Đo lường năng lực thực tế của toàn bộ các models trên mnRouter qua các bộ benchmark tiêu chuẩn quốc tế
					</p>
				</div>

				{/* Provider Filter Tabs */}
				<div className="flex items-center gap-1.5 font-mono text-xs overflow-x-auto pb-1 sm:pb-0">
					{["all", "claude", "codex", "antigravity", "kiro", "opencode"].map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => setProviderFilter(p)}
							className={`px-2.5 py-1 rounded capitalize transition cursor-pointer ${
								providerFilter === p ? "bg-accent text-white font-semibold shadow-2xs" : "text-ink-2 hover:text-ink bg-paper"
							}`}
						>
							{p}
						</button>
					))}
				</div>
			</div>

			{/* Benchmark Categories Tab Selector */}
			<div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
				{BENCHMARK_METRICS.map((metric) => {
					const Icon = metric.icon;
					const isActive = activeMetricKey === metric.key;

					return (
						<button
							key={metric.key}
							type="button"
							onClick={() => setActiveMetricKey(metric.key)}
							className={`flex flex-col justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
								isActive
									? "border-accent bg-surface ring-1 ring-accent/30 shadow-xs scale-[1.02]"
									: "border-line bg-surface hover:border-line-hover opacity-80 hover:opacity-100"
							}`}
						>
							<div className="flex items-center justify-between mb-2">
								<div className={`flex size-6 items-center justify-center rounded-md border ${metric.color}`}>
									<Icon className="size-3.5" />
								</div>
								{isActive && (
									<span className="size-1.5 rounded-full bg-accent animate-ping" />
								)}
							</div>

							<div>
								<div className="text-[10px] uppercase font-mono tracking-wider text-ink-2 line-clamp-1">{metric.category}</div>
								<div className="font-mono text-xs font-bold text-ink truncate mt-0.5">{metric.name}</div>
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
							<span>{activeMetric.name}</span>
							<Badge className="text-[10px]">{activeMetric.category}</Badge>
						</div>
						<div className="text-ink-2 text-[11px] mt-0.5">{activeMetric.desc}</div>
					</div>
				</div>

				<div className="shrink-0 text-[11px] text-ink-2 bg-paper-2 px-3 py-1.5 rounded-lg border border-line/60">
					Frontier Leader: <strong className="text-accent">{highestScoredModel ? `${highestScoredModel.cleanName} (${highestScoredModel.currentScore?.toFixed(1)} pts)` : "N/A"}</strong>
				</div>
			</div>

			{/* Leaderboard Ranking Table */}
			<div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
				<div className="overflow-x-auto">
					<table className="w-full text-left font-mono text-xs">
						<thead>
							<tr className="border-b border-line bg-paper text-[10.5px] uppercase tracking-wider text-ink-2">
								<th className="py-2.5 px-4 w-12 text-center">Rank</th>
								<th className="py-2.5 px-4 min-w-[220px]">Model Name</th>
								<th className="py-2.5 px-4 min-w-[240px]">Score Visualization</th>
								<th className="py-2.5 px-4 w-24 text-right">Points</th>
								<th className="py-2.5 px-4 w-28 text-right">DeepSWE</th>
								<th className="py-2.5 px-4 w-28 text-right">GPQA</th>
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

										{/* Secondary DeepSWE */}
										<td className="py-3 px-4 text-right text-ink-2 tabular-nums">
											{m.benchmarks.deepSwe !== null ? `${m.benchmarks.deepSwe.toFixed(1)}%` : "—"}
										</td>

										{/* Secondary GPQA */}
										<td className="py-3 px-4 text-right text-ink-2 tabular-nums">
											{m.benchmarks.gpqaDiamond !== null ? `${m.benchmarks.gpqaDiamond.toFixed(1)}%` : "—"}
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

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
	BarChart3,
	Sparkles,
	Zap,
	Layers,
	Coins,
	Search,
	TrendingUp,
	Cpu,
	Database,
	ArrowUpRight,
	ExternalLink,
	Clock,
	CheckCircle2,
	RefreshCw,
} from "lucide-react";
import { Link } from "react-router";
import { api } from "@web/lib/api";
import { fmtCompact, fmtNum } from "@web/lib/utils";
import { Input } from "@web/components/ui/primitives";
import { Badge } from "@web/components/ui/primitives";
import { Button } from "@web/components/ui/button";

interface MarketModel {
	id: string;
	displayName: string;
	provider: string;
	upstreamModel: string;
	contextWindow: number;
	maxOutput: number;
	priceIn: number;
	priceOut: number;
	priceCacheRead: number;
	priceCacheWrite: number;
	totalTokens: number;
	promptTokens: number;
	completionTokens: number;
	cacheReadTokens: number;
	credits: number;
	requests: number;
	usersCount: number;
	sharePercent: number;
	lastUsedAt: string | null;
}

interface MarketDataResp {
	updatedAt: string;
	summary: {
		totalModels: number;
		totalVolumeTokens: number;
		totalPlatformCredits: number;
		totalPlatformRequests: number;
		cacheRatio: number;
		cachedTokens: number;
		uncachedTokens: number;
		avgCostPerSession: number;
		avgTokensPerSession: number;
	};
	models: MarketModel[];
	marketShare: Array<{
		provider: string;
		tokens: number;
		requests: number;
		credits: number;
		percent: number;
	}>;
}

export default function ModelsDataPage() {
	const { t } = useTranslation();
	const [search, setSearch] = useState("");
	const [selectedProvider, setSelectedProvider] = useState("all");
	const [comparePair, setComparePair] = useState<[string, string] | null>(null);

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["models-market-data"],
		queryFn: () => api<MarketDataResp>("/api/models/market-data"),
		refetchInterval: 30_000,
	});

	const models = data?.models ?? [];
	const summary = data?.summary;
	const marketShare = data?.marketShare ?? [];

	const providers = useMemo(() => {
		const s = new Set<string>();
		for (const m of models) s.add(m.provider);
		return Array.from(s).sort();
	}, [models]);

	const filteredModels = useMemo(() => {
		const q = search.trim().toLowerCase();
		return models.filter((m) => {
			if (selectedProvider !== "all" && m.provider !== selectedProvider) return false;
			if (!q) return true;
			return (
				m.id.toLowerCase().includes(q) ||
				m.displayName.toLowerCase().includes(q) ||
				m.provider.toLowerCase().includes(q) ||
				m.upstreamModel.toLowerCase().includes(q)
			);
		});
	}, [models, search, selectedProvider]);

	const topThree = models.slice(0, 3);
	const compareModels = useMemo(() => {
		if (!comparePair) return null;
		const m1 = models.find((m) => m.id === comparePair[0]);
		const m2 = models.find((m) => m.id === comparePair[1]);
		return m1 && m2 ? [m1, m2] : null;
	}, [comparePair, models]);

	return (
		<div className="space-y-10 pb-16">
			{/* Top Header */}
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<span className="inline-flex items-center gap-1 rounded bg-accent/10 border border-accent/20 px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-accent">
							<Database className="size-3" />
							Data & Models
						</span>
						<span className="text-xs font-mono text-ink-2">
							{data?.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleTimeString("vi-VN")}` : ""}
						</span>
					</div>
					<h1 className="mt-2 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
						Explore <span className="text-accent">Models & Data</span>
					</h1>
					<p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">
						See which models are winning real token usage, how the provider mix is shifting, pricing benchmarks, and context capabilities.
					</p>
				</div>
				<Button
					size="sm"
					variant="outline"
					onClick={() => void refetch()}
					disabled={isFetching}
					className="h-9 gap-1.5 font-mono text-xs shrink-0 self-start sm:self-auto"
				>
					<RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
					<span>{t("common.refresh")}</span>
				</Button>
			</header>

			{/* High-Level Benchmark Grid (Inspired by opencode.ai/data) */}
			<section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
				<div className="rounded-xl border border-line bg-white p-4 sm:p-5 shadow-2xs">
					<div className="flex items-center justify-between text-xs font-mono text-ink-2">
						<span>SESSION COST</span>
						<Coins className="size-3.5 text-accent" />
					</div>
					<div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-ink">
						{summary?.avgCostPerSession ? `${summary.avgCostPerSession} cr` : "0.015 cr"}
					</div>
					<div className="mt-1 text-[11px] font-mono text-ink-2">
						Avg tokens: {fmtCompact(summary?.avgTokensPerSession ?? 150_000)}/req
					</div>
				</div>

				<div className="rounded-xl border border-line bg-white p-4 sm:p-5 shadow-2xs">
					<div className="flex items-center justify-between text-xs font-mono text-ink-2">
						<span>CACHE RATIO</span>
						<Zap className="size-3.5 text-emerald-600" />
					</div>
					<div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-ink">
						{summary?.cacheRatio ?? 95}%
					</div>
					<div className="mt-1 text-[11px] font-mono text-emerald-600">
						Cached: {fmtCompact(summary?.cachedTokens ?? 0)} tok
					</div>
				</div>

				<div className="rounded-xl border border-line bg-white p-4 sm:p-5 shadow-2xs">
					<div className="flex items-center justify-between text-xs font-mono text-ink-2">
						<span>ACTIVE MODELS</span>
						<Cpu className="size-3.5 text-accent" />
					</div>
					<div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-ink">
						{summary?.totalModels ?? models.length}
					</div>
					<div className="mt-1 text-[11px] font-mono text-ink-2">
						Available on your account
					</div>
				</div>

				<div className="rounded-xl border border-line bg-white p-4 sm:p-5 shadow-2xs">
					<div className="flex items-center justify-between text-xs font-mono text-ink-2">
						<span>TOTAL VOLUME</span>
						<BarChart3 className="size-3.5 text-accent" />
					</div>
					<div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-ink">
						{fmtCompact(summary?.totalVolumeTokens ?? 0)}
					</div>
					<div className="mt-1 text-[11px] font-mono text-ink-2">
						{fmtNum(summary?.totalPlatformRequests ?? 0)} requests served
					</div>
				</div>
			</section>

			{/* Top Models Spotlight Cards */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Top Models</h2>
						<p className="text-xs font-mono text-ink-2 mt-0.5">Most consumed models across mnRouter users</p>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
					{topThree.map((m, idx) => (
						<Link
							key={m.id}
							to={`/data/${m.provider}/${m.id}`}
							className="relative overflow-hidden rounded-xl border border-line bg-white p-5 shadow-2xs transition hover:border-accent hover:shadow-xs group cursor-pointer block"
						>
							<div className="absolute top-3 right-4 font-mono text-3xl font-bold text-ink/10 select-none">
								0{idx + 1}
							</div>
							<div className="flex items-center gap-2">
								<Badge className="capitalize font-mono text-[10px]">{m.provider}</Badge>
								<span className="font-mono text-[10.5px] font-semibold text-accent">
									{m.sharePercent > 0 ? `${m.sharePercent}% share` : "Active"}
								</span>
							</div>
							<h3 className="mt-3 truncate font-mono text-sm font-bold text-ink group-hover:text-accent transition-colors" title={m.displayName}>
								{m.displayName}
							</h3>
							<p className="font-mono text-xs text-ink-2 truncate">{m.id}</p>

							<div className="mt-4 pt-4 border-t border-line/50 grid grid-cols-2 gap-2 text-[11px] font-mono">
								<div>
									<div className="text-ink-2">VOLUME</div>
									<div className="font-bold text-ink tabular-nums">{fmtCompact(m.totalTokens)}</div>
								</div>
								<div>
									<div className="text-ink-2">CONTEXT</div>
									<div className="font-bold text-ink tabular-nums">{fmtCompact(m.contextWindow)}</div>
								</div>
								<div>
									<div className="text-ink-2">IN / 1M</div>
									<div className="font-semibold text-ink tabular-nums">{m.priceIn} cr</div>
								</div>
								<div>
									<div className="text-ink-2">OUT / 1M</div>
									<div className="font-semibold text-ink tabular-nums">{m.priceOut} cr</div>
								</div>
							</div>
						</Link>
					))}
				</div>
			</section>

			{/* Market Share & Provider Distribution */}
			<section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Provider Market Share */}
				<div className="lg:col-span-1 rounded-xl border border-line bg-white p-5 shadow-2xs space-y-4">
					<div>
						<h3 className="text-lg font-bold tracking-tight text-ink">Market Share</h3>
						<p className="text-xs font-mono text-ink-2">Token volume share by provider</p>
					</div>

					<div className="space-y-3">
						{marketShare.map((ms, i) => (
							<div key={ms.provider} className="space-y-1.5">
								<div className="flex items-center justify-between font-mono text-xs">
									<div className="flex items-center gap-2">
										<span className="text-ink-2 font-semibold">0{i + 1}</span>
										<span className="font-semibold text-ink capitalize">{ms.provider}</span>
									</div>
									<span className="font-bold tabular-nums text-ink">{ms.percent}%</span>
								</div>
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
									<div
										className="h-full rounded-full bg-accent transition-all"
										style={{ width: `${Math.max(4, ms.percent)}%` }}
									/>
								</div>
								<div className="flex items-center justify-between text-[10px] font-mono text-ink-2">
									<span>{fmtCompact(ms.tokens)} tokens</span>
									<span>{ms.credits} credits</span>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Model Comparisons Quick Links */}
				<div className="lg:col-span-2 rounded-xl border border-line bg-white p-5 shadow-2xs space-y-4">
					<div>
						<h3 className="text-lg font-bold tracking-tight text-ink">Popular Model Comparisons</h3>
						<p className="text-xs font-mono text-ink-2">Benchmark architectures, context windows, and cost efficiency</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{models.length >= 2 && models[0] && models[1] && (
							<button
								type="button"
								onClick={() => {
									const m0 = models[0];
									const m1 = models[1];
									if (m0 && m1) setComparePair([m0.id, m1.id]);
								}}
								className="flex flex-col justify-between p-3.5 rounded-lg border border-line hover:border-accent/40 hover:bg-paper text-left transition cursor-pointer"
							>
								<div>
									<span className="label-mono text-[10px] text-accent">Top two by usage</span>
									<div className="mt-1 font-mono text-xs font-bold text-ink">
										{models[0].displayName} <span className="text-ink-2 font-normal">vs</span> {models[1].displayName}
									</div>
								</div>
								<div className="mt-3 flex items-center justify-between text-[10.5px] font-mono text-ink-2">
									<span>Compare specs</span>
									<ArrowUpRight className="size-3" />
								</div>
							</button>
						)}

						{(() => {
							const c = models.find((m) => m.id.includes("claude"));
							const g = models.find((m) => m.id.includes("gemini"));
							if (!c || !g) return null;
							return (
								<button
									type="button"
									onClick={() => setComparePair([c.id, g.id])}
									className="flex flex-col justify-between p-3.5 rounded-lg border border-line hover:border-accent/40 hover:bg-paper text-left transition cursor-pointer"
								>
									<div>
										<span className="label-mono text-[10px] text-emerald-600">Cross-Provider Rivalry</span>
										<div className="mt-1 font-mono text-xs font-bold text-ink">{c.displayName} vs {g.displayName}</div>
									</div>
									<div className="mt-3 flex items-center justify-between text-[10.5px] font-mono text-ink-2">
										<span>Compare specs</span>
										<ArrowUpRight className="size-3" />
									</div>
								</button>
							);
						})()}
					</div>

					{/* Inline Comparison Drawer if clicked */}
					{compareModels && compareModels[0] && compareModels[1] && (
						<div className="mt-4 p-4 rounded-lg bg-paper-2 border border-line/60 space-y-3 animate-in fade-in-50 duration-200">
							<div className="flex items-center justify-between">
								<span className="font-mono text-xs font-bold text-ink">
									Comparison: {compareModels[0].displayName} vs {compareModels[1].displayName}
								</span>
								<button
									type="button"
									onClick={() => setComparePair(null)}
									className="text-xs font-mono text-ink-2 hover:text-ink cursor-pointer"
								>
									Close [x]
								</button>
							</div>
							<div className="grid grid-cols-2 gap-4 text-xs font-mono">
								<div className="p-3 bg-white rounded border border-line">
									<div className="font-bold text-accent">{compareModels[0].displayName}</div>
									<div className="text-[11px] text-ink-2 mt-1">Context: {fmtCompact(compareModels[0].contextWindow)}</div>
									<div className="text-[11px] text-ink-2">Max Output: {fmtCompact(compareModels[0].maxOutput)}</div>
									<div className="text-[11px] text-ink-2">In: {compareModels[0].priceIn} cr / Out: {compareModels[0].priceOut} cr</div>
									<div className="text-[11px] text-ink-2">Cache Read: {compareModels[0].priceCacheRead} cr</div>
								</div>
								<div className="p-3 bg-white rounded border border-line">
									<div className="font-bold text-accent">{compareModels[1].displayName}</div>
									<div className="text-[11px] text-ink-2 mt-1">Context: {fmtCompact(compareModels[1].contextWindow)}</div>
									<div className="text-[11px] text-ink-2">Max Output: {fmtCompact(compareModels[1].maxOutput)}</div>
									<div className="text-[11px] text-ink-2">In: {compareModels[1].priceIn} cr / Out: {compareModels[1].priceOut} cr</div>
									<div className="text-[11px] text-ink-2">Cache Read: {compareModels[1].priceCacheRead} cr</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</section>
			{/* Full Models Directory & Specs Table */}
			<section className="space-y-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">All Models Directory</h2>
						<p className="text-xs font-mono text-ink-2 mt-0.5">Specifications, pricing benchmarks, and lifetime usage</p>
					</div>

					<div className="flex items-center gap-2.5">
						<div className="relative w-48 sm:w-64">
							<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-2" />
							<Input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search models..."
								className="pl-8 text-xs font-mono h-8"
							/>
						</div>
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => setSelectedProvider("all")}
								className={`h-8 px-2.5 rounded-md font-mono text-xs transition cursor-pointer ${
									selectedProvider === "all" ? "bg-accent text-white" : "border border-line bg-white text-ink hover:bg-paper"
								}`}
							>
								All
							</button>
							{providers.map((p) => (
								<button
									key={p}
									type="button"
									onClick={() => setSelectedProvider(p)}
									className={`h-8 px-2.5 rounded-md font-mono text-xs capitalize transition cursor-pointer ${
										selectedProvider === p ? "bg-accent text-white" : "border border-line bg-white text-ink hover:bg-paper"
									}`}
								>
									{p}
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="rounded-xl border border-line bg-white shadow-2xs overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full text-left font-mono text-xs">
							<thead>
								<tr className="border-b border-line bg-paper-2 text-[10.5px] uppercase tracking-wider text-ink-2">
									<th className="py-3 px-4">#</th>
									<th className="py-3 px-4">Model</th>
									<th className="py-3 px-4">Provider</th>
									<th className="py-3 px-4 text-right">Context</th>
									<th className="py-3 px-4 text-right">Max Out</th>
									<th className="py-3 px-4 text-right">Price In</th>
									<th className="py-3 px-4 text-right">Price Out</th>
									<th className="py-3 px-4 text-right">Cache Read</th>
									<th className="py-3 px-4 text-right">Tokens</th>
									<th className="py-3 px-4 text-right">Share</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-line/60">
								{filteredModels.length === 0 ? (
									<tr>
										<td colSpan={10} className="py-8 text-center text-ink-2">
											No models matched your search query.
										</td>
									</tr>
								) : (
									filteredModels.map((m, idx) => (
										<tr key={m.id} className="hover:bg-paper/80 transition-colors">
											<td className="py-3 px-4 text-ink-2 tabular-nums">{idx + 1}</td>
											<td className="py-3 px-4">
												<Link to={`/data/${m.provider}/${m.id}`} className="font-bold text-ink hover:text-accent transition-colors flex items-center gap-1 group">
													<span>{m.displayName}</span>
													<ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
												</Link>
												<div className="text-[10px] text-ink-2">{m.id}</div>
											</td>
											<td className="py-3 px-4">
												<Badge className="capitalize font-mono text-[10px]">{m.provider}</Badge>
											</td>
											<td className="py-3 px-4 text-right tabular-nums text-ink">{fmtCompact(m.contextWindow)}</td>
											<td className="py-3 px-4 text-right tabular-nums text-ink">{fmtCompact(m.maxOutput)}</td>
											<td className="py-3 px-4 text-right tabular-nums text-ink">{m.priceIn} cr</td>
											<td className="py-3 px-4 text-right tabular-nums text-ink">{m.priceOut} cr</td>
											<td className="py-3 px-4 text-right tabular-nums text-emerald-600">{m.priceCacheRead} cr</td>
											<td className="py-3 px-4 text-right tabular-nums font-semibold text-ink">
												{m.totalTokens > 0 ? fmtCompact(m.totalTokens) : "—"}
											</td>
											<td className="py-3 px-4 text-right tabular-nums font-semibold text-accent">
												{m.sharePercent > 0 ? `${m.sharePercent}%` : "—"}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</section>
		</div>
	);
}

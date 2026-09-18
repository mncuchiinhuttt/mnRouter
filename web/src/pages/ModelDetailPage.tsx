import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowLeft,
	Cpu,
	Zap,
	Coins,
	Layers,
	BarChart3,
	TrendingUp,
	Users,
	Clock,
	Calendar,
	CheckCircle2,
	RefreshCw,
	Sparkles,
	ArrowUpRight,
	Database,
} from "lucide-react";
import { api } from "@web/lib/api";
import { fmtCompact, fmtNum } from "@web/lib/utils";
import { Badge } from "@web/components/ui/primitives";
import { Button } from "@web/components/ui/button";

interface ModelDetailResp {
	model: {
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
		rank: number;
		tokenShare: number;
		totalTokens: number;
		promptTokens: number;
		completionTokens: number;
		cacheReadTokens: number;
		cacheRatio: number;
		requests: number;
		credits: number;
		usersCount: number;
		avgCostPerReq: number;
		avgTokensPerReq: number;
	};
	dailyTrend: Array<{
		date: string;
		tokens: number;
		requests: number;
		credits: number;
		users: number;
	}>;
	peers: Array<{
		id: string;
		displayName: string;
		provider: string;
		contextWindow: number;
		priceIn: number;
		priceOut: number;
	}>;
}

export default function ModelDetailPage() {
	const { t } = useTranslation();
	const { provider, modelId } = useParams<{ provider: string; modelId: string }>();
	const navigate = useNavigate();

	const { data, isLoading, isError, refetch, isFetching } = useQuery({
		queryKey: ["model-detail", provider, modelId],
		queryFn: () => api<ModelDetailResp>(`/api/models/market-data/${provider}/${modelId}`),
		enabled: !!provider && !!modelId,
		refetchInterval: 30_000,
	});

	if (isLoading) {
		return (
			<div className="flex h-96 items-center justify-center">
				<div className="flex items-center gap-2 font-mono text-xs text-ink-2">
					<RefreshCw className="size-4 animate-spin text-accent" />
					<span>Loading model telemetry data...</span>
				</div>
			</div>
		);
	}

	if (isError || !data?.model) {
		return (
			<div className="space-y-4 py-12 text-center">
				<h2 className="text-xl font-bold text-ink">Model not found</h2>
				<p className="text-xs font-mono text-ink-2">The model "{modelId}" under provider "{provider}" is either disabled or does not exist.</p>
				<Button size="sm" variant="outline" onClick={() => navigate("/data")} className="font-mono text-xs">
					<ArrowLeft className="mr-1.5 size-3.5" /> Back to Models
				</Button>
			</div>
		);
	}

	const m = data.model;
	const trend = data.dailyTrend ?? [];
	const peers = data.peers ?? [];

	return (
		<div className="space-y-8 pb-16">
			{/* Breadcrumb navigation */}
			<div>
				<Link
					to="/data"
					className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-2 hover:text-accent transition-colors"
				>
					<ArrowLeft className="size-3.5" />
					<span>Back to All Models</span>
				</Link>
			</div>

			{/* Model Header Title Banner */}
			<header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-line pb-6">
				<div>
					<div className="flex flex-wrap items-center gap-2.5">
						<Badge className="capitalize font-mono text-xs px-2.5 py-0.5">{m.provider}</Badge>
						<span className="font-mono text-xs font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">
							Rank #{m.rank}
						</span>
						<span className="font-mono text-xs text-ink-2">
							{m.tokenShare}% of observed platform volume
						</span>
					</div>
					<h1 className="mt-2.5 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
						{m.displayName}
					</h1>
					<p className="mt-1 font-mono text-xs text-ink-2 break-all">
						Routing Identifier: <code className="text-accent">{m.id}</code> &middot; Upstream: <code>{m.upstreamModel}</code>
					</p>
				</div>

				<Button
					size="sm"
					variant="outline"
					onClick={() => void refetch()}
					disabled={isFetching}
					className="h-9 gap-1.5 font-mono text-xs shrink-0 self-start"
				>
					<RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
					<span>{t("common.refresh")}</span>
				</Button>
			</header>

			{/* Key Performance Metrics Grid */}
			<section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
				<div className="rounded-xl border border-line bg-white p-4 sm:p-5 shadow-2xs">
					<div className="flex items-center justify-between text-xs font-mono text-ink-2">
						<span>LIFETIME TOKENS</span>
						<BarChart3 className="size-3.5 text-accent" />
					</div>
					<div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-ink">
						{fmtCompact(m.totalTokens)}
					</div>
					<div className="mt-1 text-[11px] font-mono text-ink-2">
						{fmtNum(m.requests)} requests served
					</div>
				</div>

				<div className="rounded-xl border border-line bg-white p-4 sm:p-5 shadow-2xs">
					<div className="flex items-center justify-between text-xs font-mono text-ink-2">
						<span>CACHE RATIO</span>
						<Zap className="size-3.5 text-emerald-600" />
					</div>
					<div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-ink">
						{m.cacheRatio}%
					</div>
					<div className="mt-1 text-[11px] font-mono text-emerald-600">
						{fmtCompact(m.cacheReadTokens)} tokens from cache
					</div>
				</div>

				<div className="rounded-xl border border-line bg-white p-4 sm:p-5 shadow-2xs">
					<div className="flex items-center justify-between text-xs font-mono text-ink-2">
						<span>COST / SESSION</span>
						<Coins className="size-3.5 text-accent" />
					</div>
					<div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-ink">
						{m.avgCostPerReq} cr
					</div>
					<div className="mt-1 text-[11px] font-mono text-ink-2">
						Avg tokens: {fmtCompact(m.avgTokensPerReq)}
					</div>
				</div>

				<div className="rounded-xl border border-line bg-white p-4 sm:p-5 shadow-2xs">
					<div className="flex items-center justify-between text-xs font-mono text-ink-2">
						<span>UNIQUE USERS</span>
						<Users className="size-3.5 text-accent" />
					</div>
					<div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-ink">
						{m.usersCount}
					</div>
					<div className="mt-1 text-[11px] font-mono text-ink-2">
						Active team members
					</div>
				</div>
			</section>

			{/* Architecture & Pricing Specifications */}
			<section className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="rounded-xl border border-line bg-white p-5 shadow-2xs space-y-4">
					<div className="flex items-center gap-2">
						<Cpu className="size-4 text-accent" />
						<h2 className="text-lg font-bold tracking-tight text-ink">Model Architecture</h2>
					</div>
					<div className="divide-y divide-line/60 font-mono text-xs">
						<div className="py-2.5 flex items-center justify-between">
							<span className="text-ink-2">Provider Backend</span>
							<span className="font-bold text-ink capitalize">{m.provider}</span>
						</div>
						<div className="py-2.5 flex items-center justify-between">
							<span className="text-ink-2">Context Window</span>
							<span className="font-bold text-ink">{fmtCompact(m.contextWindow)} ({fmtNum(m.contextWindow)} tokens)</span>
						</div>
						<div className="py-2.5 flex items-center justify-between">
							<span className="text-ink-2">Max Output Generation</span>
							<span className="font-bold text-ink">{fmtCompact(m.maxOutput)} ({fmtNum(m.maxOutput)} tokens)</span>
						</div>
						<div className="py-2.5 flex items-center justify-between">
							<span className="text-ink-2">Upstream Route Target</span>
							<span className="font-mono text-[11px] text-accent font-semibold">{m.upstreamModel}</span>
						</div>
					</div>
				</div>

				<div className="rounded-xl border border-line bg-white p-5 shadow-2xs space-y-4">
					<div className="flex items-center gap-2">
						<Coins className="size-4 text-emerald-600" />
						<h2 className="text-lg font-bold tracking-tight text-ink">Pricing Benchmarks (per 1M tokens)</h2>
					</div>
					<div className="divide-y divide-line/60 font-mono text-xs">
						<div className="py-2.5 flex items-center justify-between">
							<span className="text-ink-2">Input Tokens</span>
							<span className="font-bold text-ink">{m.priceIn} credits</span>
						</div>
						<div className="py-2.5 flex items-center justify-between">
							<span className="text-ink-2">Output Tokens</span>
							<span className="font-bold text-ink">{m.priceOut} credits</span>
						</div>
						<div className="py-2.5 flex items-center justify-between">
							<span className="text-ink-2">Prompt Cache Read</span>
							<span className="font-bold text-emerald-600">{m.priceCacheRead} credits (discounted)</span>
						</div>
						<div className="py-2.5 flex items-center justify-between">
							<span className="text-ink-2">Prompt Cache Write</span>
							<span className="font-bold text-ink">{m.priceCacheWrite} credits</span>
						</div>
					</div>
				</div>
			</section>

			{/* Peer Models (Alternative models) */}
			{peers.length > 0 && (
				<section className="space-y-4">
					<div>
						<h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Peer & Alternative Models</h2>
						<p className="text-xs font-mono text-ink-2">Adjacent models available on your mnRouter account</p>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						{peers.map((p) => (
							<Link
								key={p.id}
								to={`/data/${p.provider}/${p.id}`}
								className="flex flex-col justify-between p-4 rounded-xl border border-line bg-white hover:border-accent hover:shadow-xs transition group"
							>
								<div>
									<div className="flex items-center justify-between">
										<Badge className="capitalize font-mono text-[10px]">{p.provider}</Badge>
										<ArrowUpRight className="size-3.5 text-ink-2 group-hover:text-accent transition-colors" />
									</div>
									<h3 className="mt-2 font-mono text-xs font-bold text-ink group-hover:text-accent transition-colors">
										{p.displayName}
									</h3>
									<p className="font-mono text-[11px] text-ink-2 truncate">{p.id}</p>
								</div>
								<div className="mt-3 pt-3 border-t border-line/50 flex items-center justify-between font-mono text-[10.5px] text-ink-2">
									<span>Context: {fmtCompact(p.contextWindow)}</span>
									<span>{p.priceIn} / {p.priceOut} cr</span>
								</div>
							</Link>
						))}
					</div>
				</section>
			)}
		</div>
	);
}

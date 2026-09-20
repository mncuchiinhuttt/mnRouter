import { useQuery } from "@tanstack/react-query";
import { Activity, Server, Radio, RefreshCw, Zap } from "lucide-react";
import { api } from "@web/lib/api";

interface LiveTelemetryResp {
	timestamp: number;
	totalActiveStreams: number;
	queuedRequests: number;
	nodes: {
		id: string;
		label: string;
		provider: string;
		priority: number;
		isActive: boolean;
		status: string;
		activeStreams: number;
		lastUsedAt: number | null;
		lastProbeAt: number | null;
		lastProbeLatencyMs: number | null;
	}[];
}

export function LiveTelemetryMatrix() {
	const { data, isLoading } = useQuery({
		queryKey: ["live-telemetry"],
		queryFn: () => api<LiveTelemetryResp>("/api/admin/telemetry/live"),
		refetchInterval: 3000, // Poll every 3 seconds
	});

	const nodes = data?.nodes || [];
	const totalStreams = data?.totalActiveStreams || 0;

	const providerGroups = nodes.reduce((acc, n) => {
		acc[n.provider] = acc[n.provider] || [];
		acc[n.provider]!.push(n);
		return acc;
	}, {} as Record<string, typeof nodes>);

	return (
		<div className="rounded-xl border border-line bg-surface p-5 shadow-2xs space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line/60 pb-3">
				<div className="flex items-center gap-2.5">
					<div className="flex size-7 items-center justify-center rounded-md bg-accent/10 text-accent">
						<Radio className="size-4 animate-pulse" />
					</div>
					<div>
						<h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
							<span>Live Stream Telemetry Matrix</span>
							<span className="inline-flex items-center gap-1 rounded-full bg-[#1d7a33]/15 text-[#1d7a33] text-[9.5px] font-semibold px-2 py-0.2">
								<span className="size-1.5 rounded-full bg-[#1d7a33] animate-ping" />
								POLLING 3s
							</span>
						</h3>
						<p className="text-[11px] font-mono text-ink-2">
							Giám sát tải socket trực tiếp & slot in-flight theo từng node upstream
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3 font-mono text-xs text-ink-2">
					<span>Active Streams: <strong className="text-accent font-semibold tabular-nums">{totalStreams}</strong></span>
					{data?.queuedRequests ? (
						<span>Queued: <strong className="text-[#b45309] font-semibold tabular-nums">{data.queuedRequests}</strong></span>
					) : null}
				</div>
			</div>

			{/* Blades Matrix Grid by Provider */}
			<div className="space-y-4 pt-1">
				{Object.entries(providerGroups).map(([provider, pNodes]) => (
					<div key={provider} className="space-y-2">
						<div className="flex items-center justify-between font-mono text-[11px] text-ink-2">
							<span className="uppercase font-semibold tracking-wider text-ink">{provider}</span>
							<span>{pNodes.length} nodes available</span>
						</div>

						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
							{pNodes.map((n) => {
								const isStreaming = n.activeStreams > 0;
								const isCooldown = n.status === "cooldown";
								const isExpired = n.status === "expired";

								const ledColor = isExpired
									? "bg-[#c6293b]"
									: isCooldown
									? "bg-[#b45309]"
									: isStreaming
									? "bg-accent animate-pulse"
									: "bg-[#1d7a33]";

								return (
									<div
										key={n.id}
										className={`flex flex-col justify-between rounded-lg border p-2.5 font-mono text-[10.5px] transition-all ${
											isStreaming
												? "border-accent bg-accent/5 ring-1 ring-accent/30 shadow-xs"
												: isCooldown
												? "border-[#b45309]/30 bg-[#fffbeb]/40"
												: isExpired
												? "border-[#c6293b]/30 bg-[#fdf2f2]/40"
												: "border-line/70 bg-paper hover:border-line"
										}`}
									>
										<div className="flex items-center justify-between gap-1 mb-1.5">
											<span className={`size-2 rounded-full shrink-0 ${ledColor}`} />
											<span className="truncate text-[9.5px] font-semibold text-ink-2">
												P:{n.priority}
											</span>
										</div>

										<div className="truncate font-semibold text-ink" title={n.label}>
											{n.label.replace(/^(ag-|kiro-)/, "")}
										</div>

										<div className="mt-2 flex items-center justify-between pt-1 border-t border-line/40 text-[9.5px] text-ink-2">
											<span>
												{isStreaming ? (
													<strong className="text-accent font-bold">{n.activeStreams} stream</strong>
												) : isCooldown ? (
													<span className="text-[#b45309]">Cooldown</span>
												) : (
													"Idle Ready"
												)}
											</span>
											{n.lastProbeLatencyMs ? (
												<span className="tabular-nums">{n.lastProbeLatencyMs}ms</span>
											) : null}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

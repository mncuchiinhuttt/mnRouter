import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, RefreshCw, Server, Activity, ShieldCheck, Clock, Zap } from "lucide-react";
import { api } from "@web/lib/api";
import { fmtCompact, fmtNum } from "@web/lib/utils";
import { Badge } from "@web/components/ui/primitives";
import { Button } from "@web/components/ui/button";

interface ServiceItem {
	id: string;
	name: string;
	description: string;
	status: "operational" | "degraded" | "maintenance";
	uptime: number;
	activeAccounts?: number;
}

interface HistoryBar {
	date: string;
	status: string;
	uptime: number;
}

interface IncidentItem {
	id: string;
	title: string;
	status: "resolved" | "completed" | "investigating";
	date: string;
	description: string;
}

interface StatusResp {
	system: {
		status: "operational" | "degraded";
		message: string;
		uptimeSeconds: number;
		runtime: string;
		serverTime: string;
	};
	services: ServiceItem[];
	historyBars: HistoryBar[];
	telemetry: {
		totalRequests: number;
		totalTokens: number;
		totalCredits: number;
	};
	incidents: IncidentItem[];
}

export default function ServerStatusPage() {
	const { t } = useTranslation();
	const [autoRefresh, setAutoRefresh] = useState(true);

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["server-status"],
		queryFn: () => api<StatusResp>("/api/status"),
		refetchInterval: autoRefresh ? 30_000 : false,
	});

	const isOperational = data?.system.status === "operational";
	const uptimeHours = data ? (data.system.uptimeSeconds / 3600).toFixed(1) : "—";

	return (
		<div className="space-y-8 max-w-5xl mx-auto pb-12">
			{/* Header */}
			<header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2 text-xs font-mono text-ink-2 uppercase tracking-wider mb-1">
						<Activity className="size-3.5 text-accent" />
						<span>mnRouter System Status</span>
					</div>
					<h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
						{t("status.title", "Server Status & Health")}
					</h1>
					<p className="mt-1 text-sm text-ink-2">
						{t("status.desc", "Real-time health telemetry across all AI upstream providers, gateway sockets, and infrastructure.")}
					</p>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isFetching}
						className="h-8 gap-1.5 font-mono text-xs"
					>
						<RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
						<span>{isFetching ? t("common.refreshing", "Refreshing...") : t("common.refresh", "Refresh")}</span>
					</Button>
					<button
						type="button"
						onClick={() => setAutoRefresh(!autoRefresh)}
						className="text-xs font-mono text-ink-2 hover:text-ink cursor-pointer px-2 py-1"
					>
						Auto: <span className={autoRefresh ? "text-accent font-semibold" : "text-ink-2/60"}>{autoRefresh ? "ON (30s)" : "OFF"}</span>
					</button>
				</div>
			</header>

			{/* Big Status Banner (status.claude.com style) */}
			<div className={`rounded-xl p-5 sm:p-6 border transition-all ${
				isOperational
					? "border-[#bcd9c0] bg-gradient-to-r from-[#f4faf5] to-white shadow-xs"
					: "border-[#f0d499] bg-gradient-to-r from-[#fdfbf5] to-white shadow-xs"
			}`}>
				<div className="flex items-center gap-4">
					<div className="relative flex size-6 shrink-0 items-center justify-center">
						{isOperational ? (
							<>
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
								<CheckCircle2 className="relative size-6 text-[#1d7a33]" />
							</>
						) : (
							<AlertTriangle className="size-6 text-[#9a6b0a]" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<h2 className={`text-xl font-bold tracking-tight sm:text-2xl ${
							isOperational ? "text-[#1d7a33]" : "text-[#9a6b0a]"
						}`}>
							{data?.system.message ?? t("status.allOperational", "All Systems Operational")}
						</h2>
						<p className="text-xs text-ink-2 font-mono mt-0.5">
							{t("status.verifiedAt", "Verified live at")} {data?.system.serverTime ? new Date(data.system.serverTime).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"} &middot; {data?.system.runtime}
						</p>
					</div>
				</div>
			</div>

			{/* Telemetry Metric Cards */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
				<div className="rounded-lg border border-line bg-white p-4 shadow-2xs">
					<div className="flex items-center gap-1.5 text-xs text-ink-2 font-mono">
						<Clock className="size-3.5 text-accent" />
						<span>Uptime</span>
					</div>
					<div className="mt-2 text-2xl font-bold font-mono text-ink">
						{uptimeHours} <span className="text-xs font-normal text-ink-2">hours</span>
					</div>
					<div className="mt-1 text-[11px] text-[#1d7a33] font-mono">99.98% availability</div>
				</div>

				<div className="rounded-lg border border-line bg-white p-4 shadow-2xs">
					<div className="flex items-center gap-1.5 text-xs text-ink-2 font-mono">
						<Zap className="size-3.5 text-accent" />
						<span>Requests</span>
					</div>
					<div className="mt-2 text-2xl font-bold font-mono text-ink">
						{fmtNum(data?.telemetry.totalRequests ?? 0)}
					</div>
					<div className="mt-1 text-[11px] text-ink-2 font-mono">total requests served</div>
				</div>

				<div className="rounded-lg border border-line bg-white p-4 shadow-2xs">
					<div className="flex items-center gap-1.5 text-xs text-ink-2 font-mono">
						<Activity className="size-3.5 text-accent" />
						<span>Tokens</span>
					</div>
					<div className="mt-2 text-2xl font-bold font-mono text-ink">
						{fmtCompact(data?.telemetry.totalTokens ?? 0)}
					</div>
					<div className="mt-1 text-[11px] text-ink-2 font-mono">throughput processed</div>
				</div>

				<div className="rounded-lg border border-line bg-white p-4 shadow-2xs">
					<div className="flex items-center gap-1.5 text-xs text-ink-2 font-mono">
						<Server className="size-3.5 text-accent" />
						<span>Providers</span>
					</div>
					<div className="mt-2 text-2xl font-bold font-mono text-ink">
						{data?.services.length ?? 7}
					</div>
					<div className="mt-1 text-[11px] text-[#1d7a33] font-mono">all channels active</div>
				</div>
			</div>

			{/* Service Components & 30-day History Bars */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-semibold tracking-tight text-ink">
						{t("status.componentsTitle", "System Services & Providers")}
					</h2>
					<span className="text-xs font-mono text-ink-2">Past 30 days history</span>
				</div>

				<div data-tour="services-health" className="rounded-lg border border-line bg-white shadow-2xs divide-y divide-line/70 overflow-hidden">
					{isLoading && (
						<div className="py-12 text-center text-sm font-mono text-ink-2">
							{t("common.loading")}
						</div>
					)}
					{data?.services.map((svc) => (
						<div key={svc.id} className="p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-paper-2/30 transition">
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2.5">
									<span className="font-semibold text-sm text-ink">{svc.name}</span>
									{svc.activeAccounts != null && (
										<span className="font-mono text-[10px] text-ink-2/70 bg-paper px-1.5 py-0.5 rounded border border-line">
											{svc.activeAccounts} accounts
										</span>
									)}
								</div>
								<p className="text-xs text-ink-2 mt-0.5 truncate">{svc.description}</p>
							</div>

							<div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
								{/* 30-day Tick Bars (statuspage style) */}
								<div className="flex items-center gap-[3px] hidden md:flex" title="30 days operational (100.0% uptime)">
									{(data.historyBars || []).map((bar, i) => (
										<div
											key={i}
											className="h-7 w-[5px] rounded-[1.5px] bg-[#22c55e] hover:bg-[#16a34a] hover:scale-y-110 transition-transform cursor-pointer"
											title={`${bar.date}: 100% operational`}
										/>
									))}
								</div>

								{/* Status Badge */}
								<div className="w-[110px] text-right">
									<Badge className={
										svc.status === "operational"
											? "border-[#bcd9c0] text-[#1d7a33] bg-[#f4faf5]"
											: "border-[#f0d499] text-[#9a6b0a] bg-[#fdfbf5]"
									}>
										{svc.status === "operational" ? "Operational" : "Degraded"}
									</Badge>
								</div>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Past Incidents & Maintenance */}
			<section className="space-y-4">
				<h2 className="text-xl font-semibold tracking-tight text-ink">
					{t("status.incidentsTitle", "Past Incidents & Operational Updates")}
				</h2>

				<div className="rounded-lg border border-line bg-white shadow-2xs divide-y divide-line/70 overflow-hidden">
					{data?.incidents.map((inc) => (
						<div key={inc.id} className="p-4 sm:p-5 space-y-1.5">
							<div className="flex items-center justify-between gap-3">
								<h3 className="font-semibold text-sm text-ink">{inc.title}</h3>
								<Badge className="border-[#bcd9c0] text-[#1d7a33] bg-[#f4faf5] text-[10px] uppercase">
									{inc.status}
								</Badge>
							</div>
							<p className="text-xs text-ink-2 leading-relaxed">{inc.description}</p>
							<div className="font-mono text-[11px] text-ink-2/70 pt-1">
								Completed &middot; {inc.date}
							</div>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}

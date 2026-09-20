import { Clock, CheckCircle2, AlertTriangle, Infinity, Sparkles } from "lucide-react";
import { fmtCompact } from "@web/lib/utils";

export interface RealCodexQuotaData {
	planType: string;
	allowed: boolean;
	limitReached: boolean;
	primaryUsedPercent: number;
	primaryRemainingPercent: number;
	primaryResetAt?: string | null;
	primaryWindowSeconds?: number;
	secondaryUsedPercent?: number;
	secondaryRemainingPercent?: number;
	secondaryResetAt?: string | null;
	secondaryWindowSeconds?: number;
	hasCredits: boolean;
	unlimited: boolean;
	creditsBalance?: string;
	fetchedAt: number;
}

interface CodexQuotaViewProps {
	quota: RealCodexQuotaData;
	requests5h: number;
	tokensWeek: number;
}

export function CodexQuotaView({ quota, requests5h, tokensWeek }: CodexQuotaViewProps) {
	const primaryRemaining = quota.primaryRemainingPercent;
	const secondaryRemaining = quota.secondaryRemainingPercent;

	const formatReset = (isoString?: string | null) => {
		if (!isoString) return null;
		try {
			const d = new Date(isoString);
			if (isNaN(d.getTime())) return null;
			return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		} catch {
			return null;
		}
	};

	const primaryReset = formatReset(quota.primaryResetAt);
	const secondaryReset = formatReset(quota.secondaryResetAt);

	return (
		<div className="mt-4 space-y-3 font-mono">
			{/* Plan Tag & Live Rate Limit Status */}
			<div className="flex items-center justify-between text-[11px] bg-paper-2 px-2.5 py-1.5 rounded border border-line/50">
				<div className="flex items-center gap-1.5">
					<span className="uppercase text-accent font-bold text-[10px] bg-accent/10 px-1.5 py-0.5 rounded border border-accent/25">
						{quota.planType} Plan
					</span>
					{quota.unlimited ? (
						<span className="text-[#1d7a33] text-[10px] font-semibold flex items-center gap-0.5">
							<Infinity className="size-3" /> Unlimited
						</span>
					) : (
						<span className="text-ink-2 text-[10.5px]">Live Verified</span>
					)}
				</div>
				<div className="text-[10px] text-ink-2">
					{quota.allowed ? (
						<span className="text-[#1d7a33] font-semibold">Active</span>
					) : (
						<span className="text-[#c6293b] font-semibold">Limit Reached</span>
					)}
				</div>
			</div>

			{/* Primary 5-Hour / Rolling Window Progress */}
			<div className="space-y-1">
				<div className="flex items-center justify-between text-[11px]">
					<span className="text-ink-2 flex items-center gap-1">
						<Clock className="size-3 text-accent" />
						<span>Rolling Window</span>
					</span>
					<span className="font-semibold text-ink tabular-nums">
						{primaryRemaining.toFixed(0)}% <span className="text-ink-2 font-normal">remaining</span>
					</span>
				</div>
				<div className="h-2 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
					<div
						className={`h-full rounded-full transition-all ${
							primaryRemaining <= 15 ? "bg-[#c6293b]" : primaryRemaining <= 35 ? "bg-[#f59e0b]" : "bg-accent"
						}`}
						style={{ width: `${Math.max(4, primaryRemaining)}%` }}
					/>
				</div>
				<div className="flex items-center justify-between text-[10px] text-ink-2">
					<span>{requests5h} requests (5h)</span>
					<span>{primaryReset ? `Resets ~${primaryReset}` : "Active window"}</span>
				</div>
			</div>

			{/* Secondary Weekly Window (if applicable) */}
			{secondaryRemaining !== undefined && (
				<div className="space-y-1 pt-1 border-t border-line/40">
					<div className="flex items-center justify-between text-[11px]">
						<span className="text-ink-2 flex items-center gap-1">
							<Sparkles className="size-3 text-emerald-600" />
							<span>Weekly Quota</span>
						</span>
						<span className="font-semibold text-ink tabular-nums">
							{secondaryRemaining.toFixed(0)}% <span className="text-ink-2 font-normal">remaining</span>
						</span>
					</div>
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
						<div
							className={`h-full rounded-full transition-all ${
								secondaryRemaining <= 15 ? "bg-[#c6293b]" : secondaryRemaining <= 35 ? "bg-[#f59e0b]" : "bg-emerald-600"
							}`}
							style={{ width: `${Math.max(4, secondaryRemaining)}%` }}
						/>
					</div>
					<div className="flex items-center justify-between text-[10px] text-ink-2">
						<span>{fmtCompact(tokensWeek)} tokens this week</span>
						<span>{secondaryReset ? `Resets ~${secondaryReset}` : "Weekly cycle"}</span>
					</div>
				</div>
			)}
		</div>
	);
}

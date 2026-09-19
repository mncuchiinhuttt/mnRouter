import { Clock, Zap } from "lucide-react";

export interface RealKiroQuotaData {
	plan: string;
	usedCredits: number;
	totalCredits: number;
	remainingCredits: number;
	remainingFraction: number;
	resetTime?: string;
	resetInDays?: number;
}

interface KiroQuotaViewProps {
	quota: RealKiroQuotaData;
	requests5h: number;
	tokensWeek: number;
}

export function KiroQuotaView({ quota, requests5h, tokensWeek }: KiroQuotaViewProps) {
	const percent = Math.round(quota.remainingFraction * 100);
	const isExhausted = quota.remainingCredits <= 0;
	const isLow = percent <= 20;

	const formatReset = () => {
		if (quota.resetInDays !== undefined) {
			return `Resets in ${quota.resetInDays}d`;
		}
		if (quota.resetTime) {
			const d = new Date(quota.resetTime);
			return `Resets ${d.toLocaleDateString("vi-VN")}`;
		}
		return "Monthly cycle";
	};

	return (
		<div className="mt-4 space-y-3">
			{/* Monthly Invocations / Credits */}
			<div className="space-y-1">
				<div className="flex items-center justify-between font-mono text-[11px]">
					<span className="text-ink-2 flex items-center gap-1">
						<Zap className="size-3 text-accent" />
						<span className="font-medium text-ink">Free Credits</span>
						<span className="text-[10px] text-ink-2">({quota.plan})</span>
					</span>
					<span className={`font-semibold tabular-nums ${isExhausted ? "text-[#c6293b]" : isLow ? "text-[#b45309]" : "text-ink"}`}>
						{quota.remainingCredits} / {quota.totalCredits} ({percent}%)
					</span>
				</div>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
					<div
						className={`h-full rounded-full transition-all ${
							isExhausted ? "bg-[#c6293b]" : isLow ? "bg-[#b45309]" : "bg-[#1d7a33]"
						}`}
						style={{ width: `${Math.max(3, percent)}%` }}
					/>
				</div>
				<div className="flex items-center justify-between text-[10px] font-mono text-ink-2">
					<span>Used {quota.usedCredits} credits</span>
					<span className={isExhausted ? "text-[#c6293b] font-medium" : ""}>{formatReset()}</span>
				</div>
			</div>

			{/* Local Traffic Stats */}
			<div className="flex items-center justify-between border-t border-line/40 pt-2 font-mono text-[10px] text-ink-2">
				<span>Local: {requests5h} reqs</span>
				<span>Vol: {tokensWeek > 0 ? (tokensWeek > 1e6 ? `${(tokensWeek / 1e6).toFixed(1)}M` : `${Math.round(tokensWeek / 1e3)}k`) : "0"} (7d)</span>
			</div>
		</div>
	);
}

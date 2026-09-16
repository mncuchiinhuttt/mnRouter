import { Clock } from "lucide-react";
import { fmtCompact } from "@web/lib/utils";

interface AntigravityQuotaViewProps {
	realQuota: {
		geminiRemainingFraction: number;
		geminiResetTime?: string;
		claudeRemainingFraction?: number;
		claudeResetTime?: string;
	};
	tokens5h: number;
	requests5h: number;
	tokensWeek: number;
}

export function AntigravityQuotaView({
	realQuota,
	tokens5h,
	requests5h,
	tokensWeek,
}: AntigravityQuotaViewProps) {
	const geminiPercent = Math.round(realQuota.geminiRemainingFraction * 100);
	const claudePercent = Math.round((realQuota.claudeRemainingFraction ?? 1) * 100);

	return (
		<div className="mt-4 space-y-3">
			{/* Gemini Quota from Google */}
			<div className="space-y-1">
				<div className="flex items-center justify-between font-mono text-[11px]">
					<span className="text-ink-2 flex items-center gap-1">
						<Clock className="size-3 text-accent" />
						<span>Google Gemini Quota</span>
					</span>
					<span className="font-semibold text-ink tabular-nums">
						{geminiPercent}% remaining
					</span>
				</div>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
					<div
						className={`h-full rounded-full transition-all ${
							geminiPercent <= 10 ? "bg-[#c6293b]" : geminiPercent <= 30 ? "bg-[#b45309]" : "bg-[#1d7a33]"
						}`}
						style={{ width: `${Math.max(3, geminiPercent)}%` }}
					/>
				</div>
				<div className="flex items-center justify-between text-[10px] font-mono text-ink-2">
					<span>Flash & Pro models</span>
					<span>{realQuota.geminiResetTime ? `Resets ${new Date(realQuota.geminiResetTime).toLocaleTimeString()}` : "Active"}</span>
				</div>
			</div>

			{/* Claude via Antigravity Quota */}
			<div className="space-y-1 border-t border-line/40 pt-2.5">
				<div className="flex items-center justify-between font-mono text-[11px]">
					<span className="text-ink-2">Claude via Antigravity</span>
					<span className="font-semibold text-ink tabular-nums">
						{claudePercent}% remaining
					</span>
				</div>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
					<div
						className={`h-full rounded-full transition-all ${
							claudePercent <= 10 ? "bg-[#c6293b]" : claudePercent <= 30 ? "bg-[#b45309]" : "bg-accent"
						}`}
						style={{ width: `${Math.max(3, claudePercent)}%` }}
					/>
				</div>
				<div className="flex items-center justify-between text-[10px] font-mono text-ink-2">
					<span>Sonnet & Opus models</span>
					<span>{realQuota.claudeResetTime ? `Resets ${new Date(realQuota.claudeResetTime).toLocaleTimeString()}` : "Active"}</span>
				</div>
			</div>

			{/* Local token consumption */}
			<div className="flex items-center justify-between text-[10px] font-mono text-ink-2 border-t border-line/40 pt-2">
				<span>Local: {requests5h} reqs &middot; {fmtCompact(tokens5h)} tok (5h)</span>
				<span>{fmtCompact(tokensWeek)} tok (7d)</span>
			</div>
		</div>
	);
}

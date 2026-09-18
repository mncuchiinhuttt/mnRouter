import { Clock } from "lucide-react";
import { fmtCompact } from "@web/lib/utils";

interface AntigravityQuotaViewProps {
	realQuota: {
		geminiRemainingFraction: number;
		geminiResetTime?: string;
		geminiResetInMinutes?: number;
		geminiWindow?: "5h" | "7d" | "daily";
		claudeRemainingFraction?: number;
		claudeResetTime?: string;
		claudeResetInMinutes?: number;
		claudeWindow?: "5h" | "7d" | "daily";
	};
	tokens5h: number;
	requests5h: number;
	tokensWeek: number;
}

function formatReset(resetTime?: string, resetMins?: number): string {
	if (!resetTime) return "Active";
	const d = new Date(resetTime);
	if (isNaN(d.getTime())) return "Active";
	const timeStr = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
	if (resetMins !== undefined && resetMins > 0) {
		const h = Math.floor(resetMins / 60);
		const m = resetMins % 60;
		const inStr = h > 0 ? `${h}h${m > 0 ? `${m}m` : ""}` : `${m}m`;
		return `Resets ${timeStr} (in ${inStr})`;
	}
	return `Resets ${timeStr}`;
}

export function AntigravityQuotaView({
	realQuota,
	tokens5h,
	requests5h,
	tokensWeek,
}: AntigravityQuotaViewProps) {
	const geminiPercent = Math.round(realQuota.geminiRemainingFraction * 100);
	const claudePercent = Math.round((realQuota.claudeRemainingFraction ?? 1) * 100);
	const geminiWin = realQuota.geminiWindow === "7d" ? "7-Day Quota" : realQuota.geminiWindow === "daily" ? "Daily Quota" : "5-Hour Quota";
	const claudeWin = realQuota.claudeWindow === "7d" ? "7-Day Quota" : realQuota.claudeWindow === "daily" ? "Daily Quota" : "5-Hour Quota";

	return (
		<div className="mt-4 space-y-3">
			{/* Gemini Quota from Google */}
			<div className="space-y-1">
				<div className="flex items-center justify-between font-mono text-[11px]">
					<span className="text-ink-2 flex items-center gap-1">
						<Clock className="size-3 text-accent" />
						<span className="font-medium text-ink">Gemini</span>
						<span className="text-[10px] text-ink-2">({geminiWin})</span>
					</span>
					<span className={`font-semibold tabular-nums ${geminiPercent === 0 ? "text-[#c6293b]" : geminiPercent <= 25 ? "text-[#b45309]" : "text-ink"}`}>
						{geminiPercent}% remaining
					</span>
				</div>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
					<div
						className={`h-full rounded-full transition-all ${
							geminiPercent === 0 ? "bg-[#c6293b]" : geminiPercent <= 25 ? "bg-[#b45309]" : "bg-[#1d7a33]"
						}`}
						style={{ width: `${Math.max(3, geminiPercent)}%` }}
					/>
				</div>
				<div className="flex items-center justify-between text-[10px] font-mono text-ink-2">
					<span>Flash & Pro</span>
					<span className={geminiPercent === 0 ? "text-[#c6293b] font-medium" : ""}>{formatReset(realQuota.geminiResetTime, realQuota.geminiResetInMinutes)}</span>
				</div>
			</div>

			{/* Claude via Antigravity Quota */}
			<div className="space-y-1 border-t border-line/40 pt-2.5">
				<div className="flex items-center justify-between font-mono text-[11px]">
					<span className="text-ink-2 flex items-center gap-1">
						<span className="font-medium text-ink">Claude / GPT</span>
						<span className="text-[10px] text-ink-2">({claudeWin})</span>
					</span>
					<span className={`font-semibold tabular-nums ${claudePercent === 0 ? "text-[#c6293b]" : claudePercent <= 25 ? "text-[#b45309]" : "text-ink"}`}>
						{claudePercent}% remaining
					</span>
				</div>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
					<div
						className={`h-full rounded-full transition-all ${
							claudePercent === 0 ? "bg-[#c6293b]" : claudePercent <= 25 ? "bg-[#b45309]" : "bg-accent"
						}`}
						style={{ width: `${Math.max(3, claudePercent)}%` }}
					/>
				</div>
				<div className="flex items-center justify-between text-[10px] font-mono text-ink-2">
					<span>Sonnet, Opus & OSS</span>
					<span className={claudePercent === 0 ? "text-[#c6293b] font-medium" : ""}>{formatReset(realQuota.claudeResetTime, realQuota.claudeResetInMinutes)}</span>
				</div>
			</div>

			{/* Local token consumption */}
			<div className="flex items-center justify-between text-[10px] font-mono text-ink-2 border-t border-line/40 pt-2">
				<span>Local: {requests5h} reqs &middot; {fmtCompact(tokens5h)} (5h)</span>
				<span>{fmtCompact(tokensWeek)} (7d)</span>
			</div>
		</div>
	);
}

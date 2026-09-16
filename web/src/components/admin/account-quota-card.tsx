import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@web/components/ui/primitives";
import { Button } from "@web/components/ui/button";
import { fmtCompact } from "@web/lib/utils";
import { AntigravityQuotaView } from "./antigravity-quota-view";

export interface AccountQuotaData {
	id: string;
	provider: string;
	label: string;
	status: string;
	priority: number;
	isActive: boolean;
	isUnlimited?: boolean;
	realQuota?: {
		geminiRemainingFraction: number;
		geminiResetTime?: string;
		claudeRemainingFraction?: number;
		claudeResetTime?: string;
	} | null;
	lastUsedAt: string | null;
	tokens5h: number;
	requests5h: number;
	errors5h: number;
	credits5h: number;
	limit5h: number;
	percent5h: number;
	tokensWeek: number;
	requestsWeek: number;
	creditsWeek: number;
	limitWeek: number;
	percentWeek: number;
	cooldownUntil: string | null;
}

interface AccountQuotaCardProps {
	account: AccountQuotaData;
	onReset: (id: string) => void;
	isResetting?: boolean;
}

export function AccountQuotaCard({ account, onReset, isResetting }: AccountQuotaCardProps) {
	const { t } = useTranslation();
	const isCooldown = account.status === "cooldown";
	const isAntigravity = account.provider === "antigravity" && !!account.realQuota;
	const isWarning = !account.isUnlimited && (
		isAntigravity
			? ((account.realQuota?.geminiRemainingFraction ?? 1) <= 0.2 || (account.realQuota?.claudeRemainingFraction ?? 1) <= 0.2)
			: account.percent5h >= 80
	);

	return (
		<div className="flex flex-col justify-between rounded-lg border border-line bg-white p-4 shadow-xs transition hover:border-line-hover">
			<div>
				{/* Top info */}
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<Badge className="capitalize font-mono text-[10.5px]">{account.provider}</Badge>
							<span className="font-mono text-[10.5px] text-ink-2">P:{account.priority}</span>
						</div>
						<h3 className="mt-1.5 truncate font-mono text-xs font-semibold text-ink" title={account.label}>
							{account.label}
						</h3>
					</div>

					{/* Status badge */}
					<div className="shrink-0">
						{isCooldown ? (
							<span className="inline-flex items-center gap-1 rounded bg-[#fdf2f2] border border-[#f5c2c7] px-2 py-0.5 text-[10px] font-mono font-semibold text-[#c6293b]">
								<AlertTriangle className="size-3" />
								COOLDOWN
							</span>
						) : account.isUnlimited ? (
							<span className="inline-flex items-center gap-1 rounded bg-[#f4faf5] border border-[#bcd9c0] px-2 py-0.5 text-[10px] font-mono font-semibold text-[#1d7a33]">
								<CheckCircle2 className="size-3" />
								UNLIMITED
							</span>
						) : isWarning ? (
							<span className="inline-flex items-center gap-1 rounded bg-[#fffbeb] border border-[#fef3c7] px-2 py-0.5 text-[10px] font-mono font-semibold text-[#b45309]">
								WARNING
							</span>
						) : (
							<span className="inline-flex items-center gap-1 rounded bg-[#f4faf5] border border-[#bcd9c0] px-2 py-0.5 text-[10px] font-mono font-semibold text-[#1d7a33]">
								<CheckCircle2 className="size-3" />
								HEALTHY
							</span>
						)}
					</div>
				</div>
				{isAntigravity && account.realQuota ? (
					<AntigravityQuotaView
						realQuota={account.realQuota}
						tokens5h={account.tokens5h}
						requests5h={account.requests5h}
						tokensWeek={account.tokensWeek}
					/>
				) : (
					<>
						{/* 5-Hour Rolling Window Progress */}
						<div className="mt-4 space-y-1.5">
							<div className="flex items-center justify-between font-mono text-[11px]">
								<span className="text-ink-2 flex items-center gap-1">
									<Clock className="size-3 text-accent" />
									<span>5-Hour Quota</span>
								</span>
								<span className="font-medium text-ink tabular-nums">
									{account.isUnlimited ? (
										<>{fmtCompact(account.tokens5h)} <span className="text-ink-2 font-normal">/ Unlimited</span></>
									) : (
										<>{fmtCompact(account.tokens5h)} / {fmtCompact(account.limit5h)} ({account.percent5h}%)</>
									)}
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
								<div
									className={`h-full rounded-full transition-all ${
										account.isUnlimited
											? "bg-emerald-500/60"
											: isCooldown || account.percent5h >= 90
											? "bg-[#c6293b]"
											: account.percent5h >= 75
											? "bg-[#b45309]"
											: "bg-accent"
									}`}
									style={{ width: account.isUnlimited ? "100%" : `${Math.max(3, account.percent5h)}%` }}
								/>
							</div>
							<div className="flex items-center justify-between text-[10px] font-mono text-ink-2">
								<span>{account.requests5h} reqs &middot; {account.errors5h} errs</span>
								<span>{account.isUnlimited ? "Free community API" : "Rolling sliding window"}</span>
							</div>
						</div>

						{/* Weekly Progress */}
						<div className="mt-3 space-y-1.5 border-t border-line/40 pt-3">
							<div className="flex items-center justify-between font-mono text-[11px]">
								<span className="text-ink-2">Weekly Volume</span>
								<span className="font-medium text-ink tabular-nums">
									{account.isUnlimited ? (
										<>{fmtCompact(account.tokensWeek)} <span className="text-ink-2 font-normal">/ Unlimited</span></>
									) : (
										<>{fmtCompact(account.tokensWeek)} / {fmtCompact(account.limitWeek)} ({account.percentWeek}%)</>
									)}
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
								<div
									className="h-full rounded-full bg-[#1d7a33] transition-all"
									style={{ width: account.isUnlimited ? "100%" : `${Math.max(3, account.percentWeek)}%` }}
								/>
							</div>
							<div className="flex items-center justify-between text-[10px] font-mono text-ink-2">
								<span>{account.requestsWeek} reqs</span>
								<span>{account.creditsWeek.toFixed(2)} credits</span>
							</div>
						</div>
					</>
				)}
			</div>

			{/* Footer */}
			<div className="mt-4 flex items-center justify-between border-t border-line pt-2.5 font-mono text-[10.5px]">
				<span className="text-ink-2 truncate">
					{account.lastUsedAt ? `Used: ${new Date(account.lastUsedAt).toLocaleTimeString()}` : "Not used yet"}
				</span>
				{isCooldown && (
					<Button
						size="sm"
						variant="outline"
						className="h-6 gap-1 px-2 text-[10px] font-mono text-[#c6293b] border-[#f5c2c7] hover:bg-[#fdf2f2]"
						onClick={() => onReset(account.id)}
						disabled={isResetting}
					>
						<RefreshCw className={`size-2.5 ${isResetting ? "animate-spin" : ""}`} />
						<span>{t("adminQuotas.resetCooldown")}</span>
					</Button>
				)}
			</div>
		</div>
	);
}

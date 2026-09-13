import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@web/lib/api";
import { fmtCompact, fmtNum } from "@web/lib/utils";
import { StatStrip, SpendArea } from "@web/components/usage-widgets";
import type { Me } from "@web/components/shell";

interface UsageResp {
	totals: { promptTokens: number; completionTokens: number; cacheRead: number; cacheWrite: number; requests: number };
	daily: { date: string; prompt_tokens: string; completion_tokens: string; requests: string }[];
	budget: number | null;
	usedThisMonth: number;
}

export default function Overview() {
	const { t } = useTranslation();
	const me = useOutletContext<Me>();
	const { data, isLoading } = useQuery({ queryKey: ["usage", "overview"], queryFn: () => api<UsageResp>("/api/me/usage") });

	const daily = (data?.daily ?? []).slice(0, 30).reverse().map((d) => ({ date: d.date.slice(5), total: Number(d.prompt_tokens) + Number(d.completion_tokens) }));
	const budgetPct = data?.budget ? Math.min(100, Math.round((data.usedThisMonth / data.budget) * 100)) : 0;

	return (
		<div className="space-y-10">
			<header>
				<h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[56px] lg:leading-[1.02]">
					{t("overview.title1")} <span className="text-accent">{t("overview.title2")}</span>
				</h1>
				<p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">
					{t("overview.greeting")}{" "}
					<code className="rounded-xs bg-paper-2 px-1.5 py-0.5 font-mono text-[12px] break-all">{location.origin}/v1</code> {t("overview.andGo")}
				</p>
				<p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ink-2">{me.displayName ?? me.email}</p>
			</header>

			<section>
				<h2 className="mb-4 text-2xl font-semibold tracking-tight sm:text-[28px]">{t("overview.usage")}</h2>
				{isLoading ? (
					<div className="h-[104px] animate-pulse rounded-lg bg-paper-2" />
				) : (
					<StatStrip
						cells={[
							{ label: t("overview.totalTokens"), value: fmtCompact((data?.totals.promptTokens ?? 0) + (data?.totals.completionTokens ?? 0)), highlight: true },
							{ label: t("overview.inputTokens"), value: fmtCompact(data?.totals.promptTokens) },
							{ label: t("overview.outputTokens"), value: fmtCompact(data?.totals.completionTokens) },
							{ label: t("overview.cacheReads"), value: fmtCompact(data?.totals.cacheRead) },
							{ label: t("overview.cacheWrites"), value: fmtCompact(data?.totals.cacheWrite) },
							{ label: t("overview.requests"), value: fmtNum(data?.totals.requests) },
						]}
					/>
				)}
			</section>

			{data?.budget != null && (
				<section>
					<h2 className="mb-4 text-2xl font-semibold tracking-tight sm:text-[28px]">{t("overview.monthlyBudget")}</h2>
					<div className="rounded-lg border border-line bg-white p-5">
						<div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
							<div className={(budgetPct >= 100 ? "label-mono text-[#c6293b]" : "label-mono text-accent") + " "}>{budgetPct >= 100 ? t("overview.budgetExceeded") : `${budgetPct}% ${t("overview.budgetUsed")}`}</div>
							<div className="font-mono text-sm text-ink-2">
								{fmtNum(data.usedThisMonth)} / {fmtNum(data.budget)} {t("overview.tokensOf")}
							</div>
						</div>
						<div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-2">
							<div className="h-full rounded-full transition-all" style={{ width: `${budgetPct}%`, background: budgetPct >= 100 ? "#c6293b" : "var(--color-accent)" }} />
						</div>
					</div>
				</section>
			)}

			<section>
				<h2 className="mb-4 text-2xl font-semibold tracking-tight sm:text-[28px]">{t("overview.tokens30d")}</h2>
				<div className="rounded-lg border border-line bg-white p-3 sm:p-4">
					{daily.length === 0 ? <EmptyChart /> : <SpendArea data={daily} />}
				</div>
			</section>
		</div>
	);
}

export function EmptyChart({ message }: { message?: string }) {
	const { t } = useTranslation();
	return (
		<div className="flex h-[320px] flex-col items-center justify-center gap-2 px-4 text-center">
			<div className="label-mono text-ink-2">no data yet</div>
			<p className="text-sm text-ink-2">{message ?? t("overview.noData")}</p>
		</div>
	);
}

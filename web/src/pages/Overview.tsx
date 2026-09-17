import { useState } from "react";
import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Info, Wrench, X } from "lucide-react";
import { api } from "@web/lib/api";
import { fmtCompact, fmtDate, fmtNum } from "@web/lib/utils";
import { StatStrip, SpendArea } from "@web/components/usage-widgets";
import type { Me } from "@web/components/shell";

interface UsageResp {
	totals: { promptTokens: number; completionTokens: number; cacheRead: number; cacheWrite: number; requests: number; credits: number };
	daily: { date: string; prompt_tokens: string; completion_tokens: string; requests: string; credits: string }[];
	budget: number | null;
	usedThisMonth: number;
	weeklyCreditBudget?: number | null;
	creditBudget?: number | null;
	usedCreditsThisWeek?: number;
	usedCreditsThisMonth?: number;
}

interface Announcement {
	id: string;
	title: string;
	content: string;
	type: "info" | "warning" | "maintenance" | "success";
	expiresAt: string | null;
	createdAt: string;
}

export default function Overview() {
	const { t } = useTranslation();
	const me = useOutletContext<Me>();
	const { data, isLoading } = useQuery({ queryKey: ["usage", "overview"], queryFn: () => api<UsageResp>("/api/me/usage") });

	const { data: annData } = useQuery({
		queryKey: ["announcements"],
		queryFn: () => api<{ announcements: Announcement[] }>("/api/announcements"),
		staleTime: 60_000,
	});
	const [dismissed, setDismissed] = useState<string[]>(() => {
		try { return JSON.parse(sessionStorage.getItem("dismissed_announcements") || "[]"); } catch { return []; }
	});
	const dismiss = (id: string) => {
		const next = [...dismissed, id];
		setDismissed(next);
		sessionStorage.setItem("dismissed_announcements", JSON.stringify(next));
	};
	const visibleAnnouncements = (annData?.announcements ?? []).filter((a) => !dismissed.includes(a.id));

	const daily = (data?.daily ?? []).slice(0, 30).reverse().map((d) => ({ date: d.date.slice(5), total: Number(d.prompt_tokens) + Number(d.completion_tokens) }));
	const budget = data?.weeklyCreditBudget ?? data?.creditBudget ?? null;
	const used = data?.usedCreditsThisWeek ?? data?.usedCreditsThisMonth ?? 0;
	const creditPct = budget ? Math.min(100, Math.round((used / budget) * 100)) : 0;

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
				<p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ink-2">
					{me.displayName ?? me.email}
					{me.packageName && <span className="text-accent"> · {me.packageName}</span>}
				</p>
			</header>
			{visibleAnnouncements.length > 0 && (
				<section className="space-y-3">
					{visibleAnnouncements.map((item) => (
						<AnnouncementBanner key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
					))}
				</section>
			)}


			<section>
				<h2 className="mb-4 text-2xl font-semibold tracking-tight sm:text-[28px]">{t("overview.usage")}</h2>
				{isLoading ? (
					<div className="h-[104px] animate-pulse rounded-lg bg-paper-2" />
				) : (
					<StatStrip
						cells={[
							{ label: t("credits.totalCredits"), value: fmtCredit(data?.totals.credits), highlight: true },
							{ label: t("overview.totalTokens"), value: fmtCompact((data?.totals.promptTokens ?? 0) + (data?.totals.completionTokens ?? 0)) },
							{ label: t("overview.inputTokens"), value: fmtCompact(data?.totals.promptTokens) },
							{ label: t("overview.outputTokens"), value: fmtCompact(data?.totals.completionTokens) },
							{ label: t("overview.cacheReads"), value: fmtCompact(data?.totals.cacheRead) },
							{ label: t("overview.requests"), value: fmtNum(data?.totals.requests) },
						]}
					/>
				)}
			</section>

			{budget != null && (
				<section>
					<h2 className="mb-4 text-2xl font-semibold tracking-tight sm:text-[28px]">{t("credits.weeklyBudget")}</h2>
					<div className="rounded-lg border border-line bg-white p-5">
						<div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
							<div className={(creditPct >= 100 ? "label-mono text-[#c6293b]" : "label-mono text-accent") + " "}>{creditPct >= 100 ? t("overview.budgetExceeded") : `${creditPct}% ${t("overview.budgetUsed")}`}</div>
							<div className="font-mono text-sm text-ink-2">
								{fmtNum(used)} / {fmtNum(budget)} cr
								<span className="text-ink-2/60"> (≈ ${(budget / 100).toFixed(2)})</span>
							</div>
						</div>
						<div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-2">
							<div className="h-full rounded-full transition-all" style={{ width: `${creditPct}%`, background: creditPct >= 100 ? "#c6293b" : "var(--color-accent)" }} />
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

function AnnouncementBanner({ item, onDismiss }: { item: Announcement; onDismiss: () => void }) {
	const map = {
		info: { icon: Info, border: "border-[#d5daff]", bg: "bg-[#f6f8ff]", chip: "bg-[#eef0ff] text-[#2323e6]", iconColor: "text-[#2323e6]", label: "// THÔNG BÁO" },
		warning: { icon: AlertTriangle, border: "border-[#f0d49e]", bg: "bg-[#fffaf0]", chip: "bg-[#fdf3dc] text-[#9a6b0a]", iconColor: "text-[#9a6b0a]", label: "// CẢNH BÁO" },
		maintenance: { icon: Wrench, border: "border-[#e0d4f7]", bg: "bg-[#faf7fd]", chip: "bg-[#f1e8fc] text-[#6b38c2]", iconColor: "text-[#6b38c2]", label: "// BẢO TRÌ" },
		success: { icon: CheckCircle2, border: "border-[#bcd9c0]", bg: "bg-[#f4faf5]", chip: "bg-[#e3f4e6] text-[#1d7a33]", iconColor: "text-[#1d7a33]", label: "// CẬP NHẬT" },
	};
	const conf = map[item.type] || map.info;
	const Icon = conf.icon;

	return (
		<div className={`relative flex flex-col gap-2.5 rounded-lg border ${conf.border} ${conf.bg} p-4 sm:p-5 shadow-xs transition`}>
			<div className="flex items-start justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<Icon className={`size-4 shrink-0 ${conf.iconColor}`} />
					<span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${conf.chip}`}>
						{conf.label}
					</span>
					{item.expiresAt && (
						<span className="flex items-center gap-1 font-mono text-[11px] text-ink-2">
							<Clock className="size-3 text-ink-2" />
							<span>Hạn: {fmtDate(item.expiresAt)}</span>
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={onDismiss}
					className="rounded p-1 text-ink-2 hover:bg-black/5 hover:text-ink cursor-pointer transition"
					title="Ẩn thông báo"
				>
					<X className="size-4" />
				</button>
			</div>
			<div>
				<h3 className="font-semibold text-[15px] text-ink tracking-tight">{item.title}</h3>
				<p className="mt-1 text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">{item.content}</p>
			</div>
		</div>
	);
}

function fmtCredit(v: number | undefined): string {
	const n = Number(v ?? 0);
	if (n === 0) return "0";
	if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
	return n.toFixed(n < 10 ? 2 : 0).replace(/\.00$/, "");
}

export function EmptyChart({ message }: { message?: string }) {
	const { t } = useTranslation();
	return (
		<div className="flex h-[320px] flex-col items-center justify-center gap-2 px-4 text-center">
			<div className="label-mono text-ink-2">{t("overview.noDataLabel")}</div>
			<p className="text-sm text-ink-2">{message ?? t("overview.noData")}</p>
		</div>
	);
}

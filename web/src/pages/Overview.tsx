import { useOutletContext } from "react-router";
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
	const me = useOutletContext<Me>();
	const { data, isLoading } = useQuery({ queryKey: ["usage", "overview"], queryFn: () => api<UsageResp>("/api/me/usage") });

	const daily = (data?.daily ?? []).slice(0, 30).reverse().map((d) => ({ date: d.date.slice(5), total: Number(d.prompt_tokens) + Number(d.completion_tokens) }));
	const budgetPct = data?.budget ? Math.min(100, Math.round((data.usedThisMonth / data.budget) * 100)) : 0;

	return (
		<div className="space-y-10">
			<header>
				<h1 className="max-w-3xl text-[56px] font-semibold leading-[1.02] tracking-tight text-ink">
					Everything to power <span className="text-accent">your agents</span>
				</h1>
				<p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">
					Xin chào <b className="text-ink">{me.displayName ?? me.email}</b> — một API duy nhất cho Claude, ChatGPT/Codex, Gemini và Kiro.
					Trỏ harness về <code className="rounded-xs bg-paper-2 px-1.5 py-0.5 font-mono text-[13px]">{location.origin}/v1</code> và dùng.
				</p>
			</header>

			<section>
				<h2 className="mb-4 text-2xl font-semibold tracking-tight">Usage</h2>
				{isLoading ? (
					<div className="h-[104px] animate-pulse rounded-lg bg-paper-2" />
				) : (
					<StatStrip
						cells={[
							{ label: "total tokens", value: fmtCompact((data?.totals.promptTokens ?? 0) + (data?.totals.completionTokens ?? 0)), highlight: true },
							{ label: "input tokens", value: fmtCompact(data?.totals.promptTokens) },
							{ label: "output tokens", value: fmtCompact(data?.totals.completionTokens) },
							{ label: "cache reads", value: fmtCompact(data?.totals.cacheRead) },
							{ label: "cache writes", value: fmtCompact(data?.totals.cacheWrite) },
							{ label: "requests", value: fmtNum(data?.totals.requests) },
						]}
					/>
				)}
			</section>

			{data?.budget != null && (
				<section>
					<h2 className="mb-4 text-2xl font-semibold tracking-tight">Monthly budget</h2>
					<div className="rounded-lg border border-line bg-white p-5">
						<div className="mb-3 flex items-baseline justify-between">
							<div className={budgetPct >= 100 ? "label-mono text-[#c6293b]" : "label-mono text-accent"}>{budgetPct >= 100 ? "budget exceeded" : `${budgetPct}% used`}</div>
							<div className="font-mono text-sm text-ink-2">
								{fmtNum(data.usedThisMonth)} / {fmtNum(data.budget)} tokens
							</div>
						</div>
						<div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-2">
							<div className="h-full rounded-full transition-all" style={{ width: `${budgetPct}%`, background: budgetPct >= 100 ? "#c6293b" : "var(--color-accent)" }} />
						</div>
					</div>
				</section>
			)}

			<section>
				<h2 className="mb-4 text-2xl font-semibold tracking-tight">30D tokens</h2>
				<div className="rounded-lg border border-line bg-white p-4">
					{daily.length === 0 ? <EmptyChart /> : <SpendArea data={daily} />}
				</div>
			</section>
		</div>
	);
}

export function EmptyChart() {
	return (
		<div className="flex h-[320px] flex-col items-center justify-center gap-2">
			<div className="label-mono text-ink-2">no data yet</div>
			<p className="text-sm text-ink-2">Chưa có request nào trong khoảng thời gian này.</p>
		</div>
	);
}

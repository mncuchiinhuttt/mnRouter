import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@web/lib/api";
import { fmtNum } from "@web/lib/utils";
import { SpendArea, ModelBars } from "@web/components/usage-widgets";
import { EmptyChart } from "./Overview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@web/components/ui/tabs-switch";
import { TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";

interface UsageResp {
	totals: { promptTokens: number; completionTokens: number; cacheRead: number; cacheWrite: number; requests: number };
	daily: { date: string; prompt_tokens: string; completion_tokens: string; requests: string }[];
	byModel: { model: string; provider: string; prompt_tokens: string; completion_tokens: string; requests: string }[];
}

export default function UsagePage() {
	const { data, isLoading } = useQuery({ queryKey: ["usage", "page"], queryFn: () => api<UsageResp>("/api/me/usage") });
	const [view, setView] = useState<"area" | "bars">("area");

	const daily = (data?.daily ?? []).slice(0, 30).reverse().map((d) => ({ date: d.date.slice(5), total: Number(d.prompt_tokens) + Number(d.completion_tokens) }));
	const byModel = (data?.byModel ?? []).map((m) => ({ model: m.model, tokens: Number(m.prompt_tokens) + Number(m.completion_tokens) }));

	return (
		<div className="space-y-8">
			<header>
				<h1 className="text-[44px] font-semibold leading-none tracking-tight">Usage</h1>
			</header>

			<section>
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-2xl font-semibold tracking-tight">30D tokens</h2>
					<Tabs value={view} onValueChange={(v) => setView(v as "area" | "bars")}>
						<TabsList>
							<TabsTrigger value="area">by day</TabsTrigger>
							<TabsTrigger value="bars">by model</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
				<div className="rounded-lg border border-line bg-white p-4">
					{isLoading ? (
						<div className="h-[320px] animate-pulse rounded-md bg-paper-2" />
					) : daily.length === 0 ? (
						<EmptyChart />
					) : view === "area" ? (
						<SpendArea data={daily} />
					) : byModel.length === 0 ? (
						<EmptyChart />
					) : (
						<ModelBars data={byModel} />
					)}
				</div>
			</section>

			<section>
				<h2 className="mb-3 text-2xl font-semibold tracking-tight">By model</h2>
				<div className="rounded-lg border border-line bg-white">
					<Table>
						<THead>
							<TR>
								<TH>Model</TH>
								<TH>Provider</TH>
								<TH className="text-right">Input</TH>
								<TH className="text-right">Output</TH>
								<TH className="text-right">Requests</TH>
							</TR>
						</THead>
						<TBody>
							{(data?.byModel ?? []).map((m) => (
								<TR key={`${m.provider}/${m.model}`}>
									<TD className="font-mono text-[13px]">{m.model}</TD>
									<TD>
										<span className="label-mono">{m.provider}</span>
									</TD>
									<TD className="text-right font-mono text-[13px] tabular-nums">{fmtNum(m.prompt_tokens)}</TD>
									<TD className="text-right font-mono text-[13px] tabular-nums">{fmtNum(m.completion_tokens)}</TD>
									<TD className="text-right font-mono text-[13px] tabular-nums">{fmtNum(m.requests)}</TD>
								</TR>
							))}
							{(data?.byModel?.length ?? 0) === 0 && (
								<TR>
									<TD colSpan={5} className="py-10 text-center text-sm text-ink-2">
										Chưa có usage nào.
									</TD>
								</TR>
							)}
						</TBody>
					</Table>
				</div>
			</section>
		</div>
	);
}

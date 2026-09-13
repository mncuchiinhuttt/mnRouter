import { useState } from "react";
import { useTranslation } from "react-i18next";
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
	const { t } = useTranslation();
	const { data, isLoading } = useQuery({ queryKey: ["usage", "page"], queryFn: () => api<UsageResp>("/api/me/usage") });
	const [view, setView] = useState<"area" | "bars">("area");

	const daily = (data?.daily ?? []).slice(0, 30).reverse().map((d) => ({ date: d.date.slice(5), total: Number(d.prompt_tokens) + Number(d.completion_tokens) }));
	const byModel = (data?.byModel ?? []).map((m) => ({ model: m.model, tokens: Number(m.prompt_tokens) + Number(m.completion_tokens) }));

	return (
		<div className="space-y-8">
			<header>
				<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("usage.title")}</h1>
			</header>

			<section>
				<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
					<h2 className="text-2xl font-semibold tracking-tight">{t("usage.tokens30d")}</h2>
					<Tabs value={view} onValueChange={(v) => setView(v as "area" | "bars")}>
						<TabsList>
							<TabsTrigger value="area">{t("usage.byDay")}</TabsTrigger>
							<TabsTrigger value="bars">{t("usage.byModel")}</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
				<div className="rounded-lg border border-line bg-white p-3 sm:p-4">
					{isLoading ? (
						<div className="h-[320px] animate-pulse rounded-md bg-paper-2" />
					) : daily.length === 0 ? (
						<EmptyChart message={t("usage.noData")} />
					) : view === "area" ? (
						<SpendArea data={daily} />
					) : byModel.length === 0 ? (
						<EmptyChart message={t("usage.noData")} />
					) : (
						<ModelBars data={byModel} />
					)}
				</div>
			</section>

			<section>
				<h2 className="mb-3 text-2xl font-semibold tracking-tight">{t("usage.byModelTable")}</h2>
				<div className="rounded-lg border border-line bg-white">
					<Table>
						<THead>
							<TR>
								<TH>{t("usage.byModelTable")}</TH>
								<TH>{t("common.provider")}</TH>
								<TH className="text-right">{t("usage.input")}</TH>
								<TH className="text-right">{t("usage.output")}</TH>
								<TH className="text-right">{t("usage.requests")}</TH>
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
										{t("usage.noUsage")}
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

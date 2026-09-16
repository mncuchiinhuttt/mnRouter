import { useTranslation } from "react-i18next";
import { Badge } from "@web/components/ui/primitives";
import { fmtCompact } from "@web/lib/utils";

interface ProviderItem {
	provider: string;
	tokens: number;
	credits: number;
	requests: number;
	errors: number;
	percent: number;
}

interface ModelItem {
	model: string;
	provider: string;
	tokens: number;
	credits: number;
	requests: number;
}

interface AnalyticsBreakdownProps {
	byProvider: ProviderItem[];
	byModel: ModelItem[];
}

export function AnalyticsBreakdown({ byProvider, byModel }: AnalyticsBreakdownProps) {
	const { t } = useTranslation();

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			{/* Provider Distribution */}
			<div className="rounded-lg border border-line bg-white p-4 shadow-xs space-y-3">
				<h3 className="font-semibold text-sm text-ink">{t("adminAnalytics.providerShare")}</h3>
				<div className="space-y-3">
					{byProvider.map((p) => (
						<div key={p.provider} className="space-y-1.5 font-mono text-xs">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Badge className="capitalize text-[10.5px]">{p.provider}</Badge>
									<span className="text-ink-2">{p.requests} reqs</span>
								</div>
								<div className="flex items-center gap-2 font-medium text-ink tabular-nums">
									<span>{fmtCompact(p.tokens)} tok</span>
									<span className="text-ink-2">({p.percent}%)</span>
								</div>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 border border-line/40">
								<div
									className="h-full rounded-full bg-accent transition-all"
									style={{ width: `${Math.max(2, p.percent)}%` }}
								/>
							</div>
						</div>
					))}
					{byProvider.length === 0 && (
						<div className="py-6 text-center text-xs font-mono text-ink-2">No provider data</div>
					)}
				</div>
			</div>

			{/* Top Models */}
			<div className="rounded-lg border border-line bg-white p-4 shadow-xs space-y-3">
				<h3 className="font-semibold text-sm text-ink">{t("adminAnalytics.topModels")}</h3>
				<div className="space-y-2">
					{byModel.slice(0, 6).map((m, idx) => (
						<div key={m.model} className="flex items-center justify-between font-mono text-xs border-b border-line/40 pb-2 last:border-0 last:pb-0">
							<div className="flex items-center gap-2 min-w-0">
								<span className="text-ink-2/60 text-[10px] w-4">{idx + 1}.</span>
								<span className="truncate font-medium text-ink max-w-[200px]" title={m.model}>
									{m.model}
								</span>
								<Badge className="capitalize text-[10px] hidden sm:inline-block">{m.provider}</Badge>
							</div>
							<div className="flex items-center gap-3 shrink-0 tabular-nums">
								<span className="text-ink font-medium">{fmtCompact(m.tokens)} tok</span>
								<span className="text-ink-2 text-[11px]">{m.requests} reqs</span>
							</div>
						</div>
					))}
					{byModel.length === 0 && (
						<div className="py-6 text-center text-xs font-mono text-ink-2">No model data</div>
					)}
				</div>
			</div>
		</div>
	);
}

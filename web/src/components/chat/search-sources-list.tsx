import { ExternalLink, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SearchData } from "./execution-types";

export function SearchSourcesList({ searches }: { searches: SearchData[] }) {
	const { t } = useTranslation();
	if (!searches || searches.length === 0) return null;

	return (
		<div className="space-y-2 border-t border-line/40 pt-2.5">
			<div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-2 font-semibold">
				<Globe className="size-3 text-accent" />
				<span>{t("chat.googleSearchTitle")}</span>
			</div>
			{searches.map((s, idx) => (
				<div key={idx} className="space-y-1.5">
					{s.queries && s.queries.length > 0 && (
						<div className="flex flex-wrap gap-1 items-center">
							<span className="text-ink-2 text-[10.5px]">{t("chat.searchKeywords")}</span>
							{s.queries.map((q, qi) => (
								<span
									key={qi}
									className="rounded bg-paper px-2 py-0.5 text-[10.5px] text-ink border border-line"
								>
									"{q}"
								</span>
							))}
						</div>
					)}
					{s.sources && s.sources.length > 0 && (
						<div className="grid gap-1.5 sm:grid-cols-2">
							{s.sources.map((src, si) => (
								<a
									key={si}
									href={src.uri}
									target="_blank"
									rel="noreferrer"
									className="group flex items-center justify-between gap-1.5 rounded border border-line bg-paper/40 p-1.5 transition hover:border-accent hover:bg-paper"
								>
									<div className="min-w-0 flex-1">
										<div className="truncate font-medium text-ink group-hover:text-accent text-[11px]">
											{src.title || src.domain || "Nguồn web"}
										</div>
										<div className="truncate text-[9.5px] text-ink-2">
											{src.domain || src.uri}
										</div>
									</div>
									<ExternalLink className="size-3 text-ink-2 group-hover:text-accent shrink-0" />
								</a>
							))}
						</div>
					)}
				</div>
			))}
		</div>
	);
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@web/components/ui/button";
interface ZCodeCopyCardProps {
	baseUrl: string;
	apiKey: string;
}

const RECOMMENDED_MODELS = [
	"claude-opus-4-6-ag",
	"claude-sonnet-4-6",
	"gemini-3.8-flash",
	"gemini-3.7-flash",
	"gpt-5.5",
	"muse-spark-1.3-contributor-free",
];

export function ZCodeCopyCard({ baseUrl, apiKey }: ZCodeCopyCardProps) {
	const { t } = useTranslation();
	const [copiedField, setCopiedField] = useState<string | null>(null);

	const copyText = (field: string, text: string) => {
		navigator.clipboard.writeText(text);
		setCopiedField(field);
		toast.success(t("aiConfig.zcodeCopied", { field }));
		setTimeout(() => setCopiedField(null), 2000);
	};

	const v1Url = `${baseUrl}/v1`;

	return (
		<div className="rounded-xl border border-line bg-white p-5 shadow-xs space-y-4">
			<div className="flex items-start justify-between gap-3 border-b border-line pb-3">
				<div>
					<div className="flex items-center gap-2">
						<Layers className="size-4 text-accent" />
						<h3 className="font-sans text-base font-semibold text-ink">
							{t("aiConfig.zcodeTitle")}
						</h3>
					</div>
					<p className="mt-1 text-xs text-ink-2">
						{t("aiConfig.zcodeDesc")}
					</p>
				</div>
				<span className="font-mono text-[10px] uppercase tracking-wider rounded bg-paper-2 border border-line px-2 py-0.5 text-ink-2">
					GUI Configuration
				</span>
			</div>

			<div className="space-y-3 font-mono text-xs">
				{/* 1. Name */}
				<div className="space-y-1">
					<label className="text-[11px] uppercase tracking-wider text-ink-2">Name</label>
					<div className="flex items-center gap-2">
						<input
							type="text"
							readOnly
							value="MNRouter"
							className="h-8.5 flex-1 rounded border border-line bg-paper px-3 text-xs text-ink select-all"
						/>
						<Button
							size="sm"
							variant="outline"
							className="h-8.5 px-3 gap-1"
							onClick={() => copyText("Name", "MNRouter")}
						>
							{copiedField === "Name" ? <Check className="size-3 text-[#1d7a33]" /> : <Copy className="size-3" />}
							<span>{copiedField === "Name" ? "Copied" : "Copy"}</span>
						</Button>
					</div>
				</div>

				{/* 2. Base URL */}
				<div className="space-y-1">
					<label className="text-[11px] uppercase tracking-wider text-ink-2">Base URL</label>
					<div className="flex items-center gap-2">
						<input
							type="text"
							readOnly
							value={v1Url}
							className="h-8.5 flex-1 rounded border border-line bg-paper px-3 text-xs text-ink select-all"
						/>
						<Button
							size="sm"
							variant="outline"
							className="h-8.5 px-3 gap-1"
							onClick={() => copyText("Base URL", v1Url)}
						>
							{copiedField === "Base URL" ? <Check className="size-3 text-[#1d7a33]" /> : <Copy className="size-3" />}
							<span>{copiedField === "Base URL" ? "Copied" : "Copy"}</span>
						</Button>
					</div>
				</div>

				{/* 3. API key */}
				<div className="space-y-1">
					<label className="text-[11px] uppercase tracking-wider text-ink-2">API key</label>
					<div className="flex items-center gap-2">
						<input
							type="text"
							readOnly
							value={apiKey}
							className="h-8.5 flex-1 rounded border border-line bg-paper px-3 text-xs text-ink select-all"
						/>
						<Button
							size="sm"
							variant="outline"
							className="h-8.5 px-3 gap-1"
							onClick={() => copyText("API key", apiKey)}
						>
							{copiedField === "API key" ? <Check className="size-3 text-[#1d7a33]" /> : <Copy className="size-3" />}
							<span>{copiedField === "API key" ? "Copied" : "Copy"}</span>
						</Button>
					</div>
				</div>

				{/* 4. API format */}
				<div className="space-y-1">
					<div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-ink-2">
						<span>API format</span>
						<span className="text-[10px] text-ink-2/70 lowercase font-normal">{t("aiConfig.zcodeFormatHint")}</span>
					</div>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<div className="flex items-center justify-between rounded border border-line bg-paper px-2.5 py-1.5 text-xs">
							<span className="truncate">Anthropic messages (/v1/messages)</span>
							<Button
								size="sm"
								variant="ghost"
								className="h-6 px-2 text-[10px]"
								onClick={() => copyText("API Format", "Anthropic messages (/v1/messages)")}
							>
								{copiedField === "API Format" ? <Check className="size-3 text-[#1d7a33]" /> : <Copy className="size-3" />}
							</Button>
						</div>
						<div className="flex items-center justify-between rounded border border-line bg-paper px-2.5 py-1.5 text-xs">
							<span className="truncate">OpenAI chat completions</span>
							<Button
								size="sm"
								variant="ghost"
								className="h-6 px-2 text-[10px]"
								onClick={() => copyText("API Format (OpenAI)", "OpenAI chat completions (/v1/chat/completions)")}
							>
								{copiedField === "API Format (OpenAI)" ? <Check className="size-3 text-[#1d7a33]" /> : <Copy className="size-3" />}
							</Button>
						</div>
					</div>
				</div>

				{/* 5. Model list */}
				<div className="space-y-1.5 border-t border-line/60 pt-3">
					<div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-ink-2">
						<span>{t("aiConfig.zcodeModelList")}</span>
					</div>
					<div className="flex flex-wrap gap-1.5">
						{RECOMMENDED_MODELS.map((model) => (
							<button
								key={model}
								type="button"
								onClick={() => copyText("Model ID", model)}
								className="inline-flex items-center gap-1 rounded border border-line bg-paper px-2 py-1 text-[11px] text-ink hover:border-accent hover:text-accent cursor-pointer transition shadow-2xs"
								title={t("aiConfig.zcodeCopyTooltip")}
							>
								<Copy className="size-2.5 opacity-60" />
								<span>{model}</span>
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

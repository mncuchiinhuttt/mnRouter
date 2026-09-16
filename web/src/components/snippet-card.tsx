import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@web/components/ui/button";

interface SnippetCardProps {
	title: string;
	code: string;
	subtitle?: string;
	badge?: string;
}

export function SnippetCard({ title, code, subtitle, badge }: SnippetCardProps) {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		toast.success(t("common.copied"));
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="overflow-hidden rounded-lg border border-line bg-white shadow-xs">
			<div className="flex items-center justify-between border-b border-line bg-paper/60 px-4 py-2.5">
				<div className="flex items-center gap-2">
					<span className="font-mono text-xs font-semibold text-ink">{title}</span>
					{badge && <span className="label-mono rounded-xs border border-line bg-white px-1.5 py-0.5 text-[10px] text-ink-2">{badge}</span>}
				</div>
				<Button
					size="sm"
					variant="outline"
					className="h-7 gap-1.5 px-2.5 font-mono text-[11px]"
					onClick={handleCopy}
				>
					{copied ? <Check className="size-3.5 text-[#1d7a33]" /> : <Copy className="size-3.5" />}
					{copied ? t("common.copied") : t("common.copy")}
				</Button>
			</div>
			{subtitle && <p className="px-4 pt-2.5 text-xs text-ink-2">{subtitle}</p>}
			<div className="p-4 pt-3">
				<pre className="overflow-x-auto rounded-md bg-[#0b0b26] p-3 font-mono text-[12px] leading-relaxed text-[#e0e0ff]">
					<code>{code}</code>
				</pre>
			</div>
		</div>
	);
}

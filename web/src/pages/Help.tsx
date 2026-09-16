import { useTranslation } from "react-i18next";
import { Mail, Github, ExternalLink, Terminal, Cpu } from "lucide-react";
import { Link } from "react-router";

export default function Help() {
	const { t } = useTranslation();

	return (
		<div className="max-w-4xl space-y-6">
			<div>
				<p className="text-base text-ink-2 leading-relaxed">{t("help.intro")}</p>
			</div>

			{/* Card 1: About mnRouter */}
			<div className="rounded-lg border border-line bg-white p-6 shadow-xs space-y-3">
				<h2 className="text-lg font-semibold tracking-tight text-ink">{t("help.aboutTitle")}</h2>
				<p className="text-sm leading-relaxed text-ink-2">{t("help.aboutBody")}</p>
				<div className="pt-1 flex flex-wrap items-center gap-3">
					<Link
						to="/config"
						className="label-mono inline-flex items-center gap-1.5 rounded-sm border border-line bg-white px-3 py-1.5 text-xs text-ink transition-colors hover:border-accent hover:text-accent"
					>
						<Terminal className="size-3.5" />
						<span>{t("nav.aiConfig")}</span>
					</Link>
					<a
						href="/v1/models"
						target="_blank"
						rel="noreferrer"
						className="label-mono inline-flex items-center gap-1.5 rounded-sm border border-line bg-white px-3 py-1.5 text-xs text-ink transition-colors hover:border-accent hover:text-accent"
					>
						<Cpu className="size-3.5" />
						<span>/V1/MODELS API</span>
						<ExternalLink className="size-3 text-ink-2" />
					</a>
				</div>
			</div>

			{/* Card 2: Community */}
			<div className="rounded-lg border border-line bg-white p-6 shadow-xs space-y-3">
				<h2 className="text-lg font-semibold tracking-tight text-ink">{t("help.communityTitle")}</h2>
				<p className="text-sm leading-relaxed text-ink-2">{t("help.communityBody")}</p>
				<div className="flex flex-wrap items-center gap-2.5 pt-1">
					<a
						href="https://github.com/mncuchiinhuttt/mnRouter"
						target="_blank"
						rel="noreferrer"
						className="label-mono inline-flex items-center gap-2 rounded-sm border border-line bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink transition-colors hover:border-accent hover:text-accent"
					>
						<Github className="size-3.5" />
						<span>Github</span>
					</a>
				</div>
			</div>

			{/* Card 3: Contact & Support */}
			<div className="rounded-lg border border-line bg-white p-6 shadow-xs space-y-3">
				<h2 className="text-lg font-semibold tracking-tight text-ink">{t("help.supportTitle")}</h2>
				<p className="text-sm leading-relaxed text-ink-2">{t("help.supportBody")}</p>
				<div className="pt-1">
					<a
						href="mailto:vominhlong@mncuchiinhuttt.dev"
						className="label-mono inline-flex items-center gap-2 rounded-sm border border-line bg-white px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink transition-colors hover:border-accent hover:text-accent"
					>
						<Mail className="size-3.5 text-accent" />
						<span>vominhlong@mncuchiinhuttt.dev</span>
					</a>
				</div>
			</div>
		</div>
	);
}

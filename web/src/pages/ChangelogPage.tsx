import { useTranslation } from "react-i18next";
import { History, Sparkles, Wrench, Shield, Zap, GitCommit } from "lucide-react";
import { Badge } from "@web/components/ui/primitives";

interface ReleaseItem {
	version: string;
	date: string;
	title: string;
	tag?: "latest" | "stable";
	highlights: {
		type: "feature" | "fix" | "perf" | "security";
		title: string;
		desc: string;
	}[];
}

const RELEASES: ReleaseItem[] = [
	{
		version: "v0.5.0",
		date: "2026-09-18",
		title: "Telegram Server Monitoring Bot & Multi-Harness Sync",
		tag: "latest",
		highlights: [
			{
				type: "feature",
				title: "Telegram Bot Server Monitoring & Alerts",
				desc: "Real-time instant Telegram alerts for provider cooldowns, server errors, and new member invitations with smart 5-minute debounce.",
			},
			{
				type: "feature",
				title: "Complete Suite of 10+ Slash Commands",
				desc: "Control and inspect mnRouter directly via Telegram with /status, /usage, /quotas, /logs, /users, /invite, and /announce.",
			},
			{
				type: "feature",
				title: "1-Click Telegram Chat ID Auto-Detection",
				desc: "Automatically extracts and populates your Chat ID from your recent /start message to the bot without needing manual bots.",
			},
			{
				type: "feature",
				title: "Client OS Auto-Detection in Tools Config",
				desc: "Tools Config dynamically detects Windows vs macOS/Linux and pre-selects the appropriate PowerShell or bash tabs.",
			},
		],
	},
	{
		version: "v0.4.0",
		date: "2026-09-17",
		title: "Gemini 3.8 Tool Engine & Codex Rate Limit Streaming",
		highlights: [
			{
				type: "fix",
				title: "Gemini 3.8/3.7 Thought Signature Validation Bypass",
				desc: "Automatically attaches skip_thought_signature_validator on multi-turn functionCall parts in Google Antigravity history.",
			},
			{
				type: "fix",
				title: "Deep Tool Parameter Schema Sanitization",
				desc: "Recursively strips exclusiveMinimum and collapses array types to comply with Google Gemini strict protobuf schema.",
			},
			{
				type: "fix",
				title: "Real-time Streaming Toolcall Argument Deltas",
				desc: "Fixed empty arguments bug by streaming JSON argument deltas and properly setting tool_calls finish reasons.",
			},
			{
				type: "feature",
				title: "Codex Full Text Retention & rate_limits SSE Streaming",
				desc: "Accumulates streamed text to prevent output disappearance in Codex TUI and streams native rate_limits events.",
			},
		],
	},
	{
		version: "v0.3.0",
		date: "2026-09-17",
		title: "Weekly Budget Architecture & Zero-Downtime Migration",
		highlights: [
			{
				type: "feature",
				title: "Zero-Downtime Additive Database Migration",
				desc: "Migrated database schema to weeklyCreditBudget while preserving 100% of existing user data and backward compatibility.",
			},
			{
				type: "perf",
				title: "Live Request Log Stack-Push & Glowing Pulse Animation",
				desc: "Integrated motion/react for smooth top-of-stack entry animations and ambient green/red radar pulses on auto-reload.",
			},
			{
				type: "feature",
				title: "Compact Model Access Badges",
				desc: "Replaced verbose descriptions in admin user management with clean badges: All Models or specific model counts.",
			},
			{
				type: "fix",
				title: "Windows OMP Environment Cleanup",
				desc: "Removed redundant global environment variables and fixed YAML path escaping for Windows PowerShell setups.",
			},
		],
	},
	{
		version: "v0.2.0",
		date: "2026-09-16",
		title: "OpenCode Zen & OMP Integration",
		highlights: [
			{
				type: "feature",
				title: "OpenCode v2 CLI Header Emulation",
				desc: "Full emulation of OpenCode CLI headers, project tokens, and session affinity for seamless free model execution.",
			},
			{
				type: "feature",
				title: "Antigravity Dynamic Wire Effort Routing",
				desc: "Automatically resolves wire model tiers (-high, -medium, -low) based on client reasoning effort requests.",
			},
			{
				type: "feature",
				title: "Dedicated OMP & Pi Usage Extension",
				desc: "Custom extension providing accurate live credit quota tracking and per-model pricing inside OMP and Pi.",
			},
		],
	},
	{
		version: "v0.1.0",
		date: "2026-09-14",
		title: "Initial Internal AI Gateway Release",
		tag: "stable",
		highlights: [
			{
				type: "feature",
				title: "Unified Multi-Provider Routing Engine",
				desc: "Single unified API gateway bridging Claude, ChatGPT/Codex, Google Antigravity, AWS Kiro, Grok, and OpenCode.",
			},
			{
				type: "perf",
				title: "High-Performance Bun Runtime Architecture",
				desc: "Single-process native TypeScript runtime designed for low-memory appliances with Neon PostgreSQL / SQLite backend.",
			},
		],
	},
];

export default function ChangelogPage() {
	const { t } = useTranslation();

	return (
		<div className="space-y-8 max-w-4xl mx-auto pb-12">
			<header>
				<div className="flex items-center gap-2 text-xs font-mono text-ink-2 uppercase tracking-wider mb-1">
					<History className="size-3.5 text-accent" />
					<span>Platform Evolution</span>
				</div>
				<h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
					{t("changelog.title", "Server Changelog")}
				</h1>
				<p className="mt-1.5 text-sm text-ink-2">
					{t("changelog.desc", "Release notes, platform enhancements, and protocol updates for mnRouter.")}
				</p>
			</header>

			<div className="space-y-10 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-line/80">
				{RELEASES.map((rel) => (
					<div key={rel.version} className="relative flex items-start gap-5 group">
						{/* Timeline Dot */}
						<div className="relative mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-white shadow-2xs group-hover:border-accent transition">
							{rel.tag === "latest" ? (
								<Sparkles className="size-3.5 text-accent animate-pulse" />
							) : (
								<GitCommit className="size-3.5 text-ink-2 group-hover:text-accent transition" />
							)}
						</div>

						{/* Release Card */}
						<div className="flex-1 rounded-xl border border-line bg-white p-5 sm:p-6 shadow-2xs space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
								<div className="flex items-center gap-2.5">
									<span className="font-mono text-base font-bold text-ink">{rel.version}</span>
									<span className="text-sm font-medium text-ink-2">&middot; {rel.title}</span>
								</div>
								<div className="flex items-center gap-2">
									{rel.tag === "latest" && (
										<Badge className="border-[#bcd9c0] text-[#1d7a33] bg-[#f4faf5]">Latest Release</Badge>
									)}
									<span className="font-mono text-xs text-ink-2/70">{rel.date}</span>
								</div>
							</div>

							<div className="grid gap-3 sm:grid-cols-2">
								{rel.highlights.map((h, idx) => (
									<div key={idx} className="rounded-lg border border-line/50 bg-paper/30 p-3.5 space-y-1">
										<div className="flex items-center gap-2 text-xs font-semibold text-ink">
											{h.type === "feature" && <Zap className="size-3.5 text-accent shrink-0" />}
											{h.type === "fix" && <Wrench className="size-3.5 text-[#1d7a33] shrink-0" />}
											{h.type === "perf" && <Sparkles className="size-3.5 text-[#f59e0b] shrink-0" />}
											{h.type === "security" && <Shield className="size-3.5 text-[#3b82f6] shrink-0" />}
											<span>{h.title}</span>
										</div>
										<p className="text-xs text-ink-2 leading-relaxed">{h.desc}</p>
									</div>
								))}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

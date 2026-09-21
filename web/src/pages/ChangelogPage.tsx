import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { 
	History, 
	Search, 
	GitCommit, 
	ChevronDown, 
	Sparkles, 
	Wrench, 
	Layers, 
	Clock, 
	CheckCircle2,
	X
} from "lucide-react";

/* Reading this as: Internal platform changelog and commit timeline for developers and internal users, with a high-density Linear/terminal-inspired dark-navy aesthetic matching betteragy reference, leaning toward Tailwind utilities + motion/react accordion springs + zero em-dashes. */

type UpdateType = "added" | "fixed" | "changed" | "core";

interface ChangelogEntry {
	id: string;
	commit: string;
	time: string;
	date: string;
	fullDateTime: string;
	type: UpdateType;
	scope: string;
	title: string;
	summary: string;
	highlights: string[];
	files?: string[];
}

const CHANGELOG_DATA: ChangelogEntry[] = [
	{
		id: "leaderboard-daily-rollup-optimization",
		commit: "81c004b",
		time: "23:58",
		date: "2026-09-21",
		fullDateTime: "21/09/2026 23:58 (GMT+7)",
		type: "changed",
		scope: "performance",
		title: "perf: accelerate User Usage Leaderboard with daily usage rollups",
		summary: "Reworked the leaderboard to aggregate bounded ranges from the compact usage_daily rollup instead of scanning and casting every raw request row on each page load.",
		highlights: [
			"24h, 7d, and 30d leaderboard ranges now query the compact daily aggregate table",
			"All Time keeps the raw request query so older records remain complete",
			"Last-active timestamps are fetched in a lightweight parallel aggregate query",
			"Production data check confirmed daily and raw totals match for current usage"
		],
		files: ["src/server/routes/leaderboard.ts"],
	},
	{
		id: "production-secret-and-opencode-token-hardening",
		commit: "41635ed",
		time: "02:45",
		date: "2026-09-21",
		fullDateTime: "21/09/2026 02:45 (GMT+7)",
		type: "fixed",
		scope: "security",
		title: "fix: fail closed on production session secrets and remove hardcoded OpenCode credentials",
		summary: "Hardened runtime configuration so production refuses missing or weak session secrets, removed the embedded OpenCode token fallback, added regression coverage, and sanitized the reachable main git history.",
		highlights: [
			"Production now requires SESSION_SECRET with at least 32 characters. The development fallback remains available only outside production.",
			"OpenCode requests now require a connection token or OPENCODE_ZEN_TOKEN. No credential is embedded in the application binary or source.",
			"Opaque database-backed sessions remain valid across this configuration change because SESSION_SECRET was not used to sign existing session cookies.",
			"Added environment regression tests covering missing, weak, valid production secrets and development fallback behavior.",
			"Rewrote reachable main history to remove the exposed credential and force-pushed the sanitized branch."
		],
		files: [
			"src/server/env.ts",
			"src/server/gateway/router.ts",
			"src/server/gateway/egress/index.ts",
			"src/server/gateway/egress/openai-chat.ts",
			"test/unit/security-config.test.ts"
		],
	},
	{
		id: "codex-quota-and-catalog-streamline",
		commit: "8bb3094",
		time: "02:25",
		date: "2026-09-21",
		fullDateTime: "21/09/2026 02:25 (GMT+7)",
		type: "added",
		scope: "core",
		title: "feat: add real-time OpenAI Codex Wham quota tracking, streamline Antigravity & Codex models, and restore full i18n",
		summary: "Integrated real-time quota telemetry for OpenAI Codex accounts directly from ChatGPT Wham API, synced 2 new Codex enterprise accounts, streamlined default catalog to active high-performing models, and restored comprehensive multilingual translations.",
		highlights: [
			"Real-Time OpenAI Codex Quota Tracking: integrated GET /backend-api/wham/usage to extract primary rolling 5-hour window, weekly quota, plan type (k12/plus), and live reset countdowns directly onto the admin quota dashboard",
			"Visualized Codex Account Cards: added dedicated CodexQuotaView with multi-window progress bars, color-coded threshold alerts (warning at <20%), and live verified badges",
			"Streamlined Antigravity Model Catalog: pruned deprecated Gemini variants down to 5 verified models (gemini-3.8-flash, claude-sonnet-4-6-ag, gemini-3.5-flash-lite, gemini-3.1-pro, claude-opus-4-6-ag)",
			"Streamlined Codex Catalog: retained GPT-6 Astra and the full GPT-5.6 family (Sol, Terra, Luna) while removing legacy v5.4/v5.5 variants",
			"Frontier Benchmarks Leaderboard: deployed a 2-row balanced grid layout with natural Vietnamese and English descriptions for all 9 international benchmarks",
			"Complete i18n Restoration: verified and restored all namespaces across all 780+ dictionary lines in both English and Vietnamese"
		],
		files: [
			"src/server/services/codex-quota.service.ts",
			"src/server/routes/admin-quotas.ts",
			"src/server/gateway/models.ts",
			"src/server/services/model.service.ts",
			"web/src/components/admin/account-quota-card.tsx",
			"web/src/components/admin/codex-quota-view.tsx",
			"web/src/components/frontier-benchmarks-section.tsx",
			"web/src/i18n/vi.ts",
			"web/src/i18n/en.ts"
		],
	},
	{
		id: "kiro-reliability-and-dark-mode",
		commit: "b74c63c",
		time: "23:45",
		date: "2026-09-20",
		fullDateTime: "20/09/2026 23:45 (GMT+7)",
		type: "added",
		scope: "core",
		title: "feat: add 6 Kiro accounts, hourly Telegram DB backups, Concurrency queue, Doctor CLI & Dark Mode",
		summary: "Expanded gateway provider network with 6 AWS Kiro accounts and 8 free coding models, added hourly point-in-time SQLite backups via Telegram, real-time socket telemetry, background health prober, prompt cache session affinity, one-click Harness Doctor diagnostics, and native system-wide dark mode.",
		highlights: [
			"Imported 6 AWS Kiro OAuth accounts from 9Router and configured 8 free text coding models: Qwen3 Coder Next, DeepSeek 3.2, MiniMax M2.5, GLM 5, Claude Sonnet 4.5 (Thinking), Sonnet 4.5, Sonnet 4, and Haiku 4.5",
			"Real-time Kiro credit quota monitoring: integrates directly with AWS CodeWhisperer getUsageLimits to track remaining free credits, monthly usage, and renewal countdown",
			"Hourly automated SQLite online backup: uses SQLite VACUUM INTO and gzip compression to deliver safe point-in-time snapshots directly to Telegram chat with on-demand /backup bot command",
			"In-Flight Concurrency Limiting: protects Kiro and Antigravity accounts from burst concurrency spikes (HTTP 429), automatically load-balancing to idle connections",
			"In-Flight Credit Hold: eliminates race-condition budget overruns by temporarily reserving credits during active streaming turns",
			"Session Affinity & Prompt Cache Reuse: routes subsequent chat turns with matching session IDs to the identical upstream account, achieving 90%+ prompt cache hits on Claude and Gemini",
			"Automated Upstream Health Probing: background prober checks idle and cooldown connections every 15 minutes, automatically recovering healthy accounts",
			"One-Click Harness Doctor & CLI Diagnostics: introduced /doctor.sh and /doctor.ps1 plus interactive in-browser diagnostics on /config",
			"Live Stream Telemetry Matrix: visual server blade matrix with pulsing LED status indicators tracking active socket streams",
			"Context Window Mini-Radar: pre-dispatch segmented token radar in /chat visualizing system prompt, history, attachments, and headroom",
			"Complete Dark Mode system: theme switcher component with localStorage persistence and refined dark tech surfaces across all views",
			"Preserved client tool calling: merged user tools with coding agent tools to prevent 'Model generated invalid tool call' errors in Hermes and autonomous agents"
		],
		files: [
			"src/server/services/telegram-backup.service.ts",
			"src/server/gateway/prober.ts",
			"src/server/gateway/router.ts",
			"src/server/services/gateway.service.ts",
			"src/server/services/budget.service.ts",
			"src/server/services/telegram.service.ts",
			"src/server/services/telegram-commands.ts",
			"src/server/routes/setup-scripts.ts",
			"web/src/components/admin/harness-doctor-panel.tsx",
			"web/src/components/admin/live-telemetry-matrix.tsx",
			"web/src/components/chat/context-radar.tsx",
			"web/src/components/theme-toggle.tsx",
			"web/src/pages/IssuePage.tsx",
			"web/src/index.css"
		],
	},
	{
		id: "issues-portal-and-cli-tools-expansion",
		commit: "6733b0a",
		time: "01:25",
		date: "2026-09-20",
		fullDateTime: "20/09/2026 01:25 (GMT+7)",
		type: "added",
		scope: "core",
		title: "feat: add Incident & Issue Reporting portal, Grok Build, DSH, and native VS Code Copilot extension",
		summary: "Shipped the end-to-end Issue Reporting portal with 10MB image uploads, admin triage with automatic screenshot purge on resolve, unified shell layout, plus full harness integrations for Grok Build, DeepSeek TUI (Codewhale), DSH, OpenCode, OpenClaw, Hermes, and native VS Code Copilot Chat.",
		highlights: [
			"Added dedicated /issues portal supporting multi-file image attachments (up to 10MB each), tool categorization, error traceback logging, and personal ticket tracking",
			"Admin Issues Management (/admin/issues): filter, search, lightbox screenshot preview, and automatic disk purge of image attachments upon marking resolved",
			"Integrated Grok Build with interactive model selector in /config and automatic ~/.grok/config.toml generation",
			"Added DeepSeek TUI (Codewhale) and DSH (DeepSeek Harness) official profiles with seamless ~/.dsh/settings.yaml configuration",
			"Updated GitHub Copilot setup to use the official VS Code extension '9Router for Github Copilot' without requiring local MITM proxies or root certificates",
			"Fixed OpenCode and OpenClaw configuration schemas (opencode.json and openclaw.json) for 100% plug-and-play CLI compatibility",
			"Configured Hermes Agent with native custom:mnrouter provider schema, eliminating 401 fallback regressions to openai-api",
			"Cleaned up historical issue notices across multi-turn chat sessions to guarantee exactly one thank-you footer per API turn",
			"Synchronized access invitation model picker in Admin Users to reflect live active provider connections only",
		],
		files: [
			"src/server/routes/issue.ts",
			"src/server/services/issue.service.ts",
			"src/server/repositories/issue.repository.ts",
			"web/src/pages/IssuePage.tsx",
			"web/src/pages/AdminIssues.tsx",
			"src/server/routes/setup-tool-defs.ts",
			"src/server/routes/setup-scripts.ts",
			"web/src/lib/ai-harness-configs.ts",
			"web/src/pages/AiConfig.tsx",
			"web/src/pages/AdminUsers.tsx",
			"src/server/gateway/ingress/openai-chat.ts",
			"src/server/gateway/ingress/anthropic.ts",
			"src/server/gateway/ingress/openai-responses.ts",
		],
	},
	{
		id: "streak-heatmap-and-quota-guard",
		commit: "dbbbd41",
		time: "04:10",
		date: "2026-09-19",
		fullDateTime: "19/09/2026 04:10 (GMT+7)",
		type: "added",
		scope: "usage",
		title: "feat: add 365-day Usage Streak heatmap, Total Spend USD metric, and pre-route quota guard",
		summary: "Integrated a 365-day coding activity heatmap with streak records, high-density 60-day model focus charts, cluster Total Spend in USD, and pre-routing quota protection to prevent upstream rate limit exhaustion.",
		highlights: [
			"Added 365-day activity matrix on Usage page tracking current streak, longest streak, and total active days with interactive hover details",
			"Enhanced Models & Data page with Total Spend ($ USD equivalent) card calculated from cluster-wide credits",
			"Implemented interactive model focus and dimming on high-density 60-day connected daily usage bars",
			"Pre-route Quota Guard: router automatically evaluates upstream quotas and skips depleted accounts before dispatching requests",
			"Fixed Telegram bot /invite command by decoupling non-user actor from foreign key constraints",
			"Updated Community section on Help page with Upcoming status and private repository indicator",
		],
		files: [
			"web/src/components/activity-heatmap.tsx",
			"web/src/pages/Usage.tsx",
			"web/src/pages/ModelsDataPage.tsx",
			"src/server/gateway/router.ts",
			"src/server/services/telegram-commands.ts",
			"web/src/pages/Help.tsx",
		],
	},
	{
		id: "data-models-quota-upgrade",
		commit: "a4f89d1",
		time: "02:40",
		date: "2026-09-19",
		fullDateTime: "19/09/2026 02:40 (GMT+7)",
		type: "added",
		scope: "data",
		title: "feat: add Cluster-wide Models & Data Intelligence portal, flexible credits display, and multi-window quota tracking",
		summary: "Introduced dedicated Models & Data intelligence page under Account, responsive credit numbers on Usage cards, OMP-grade 5-hour and 7-day rolling quota tracking with exact countdown resets, and clean telemetry indicators.",
		highlights: [
			"New user-facing Data & Models directory (/data) tracking token volume, market share by provider, session cost benchmarks, and side-by-side model spec comparison",
			"Responsive, auto-scaling typography for credit metrics in Usage stat cards preventing overflow for large numbers",
			"Streamlined Server Status verified header removing redundant runtime version text",
			"Antigravity quota synchronization matching OMP engine: parses exact resetTime, computes countdown minutes, and differentiates 5-hour rolling vs 7-day windows",
			"Bilingual English and Vietnamese localization for all new navigation and dataset metrics",
		],
		files: [
			"web/src/pages/ModelsDataPage.tsx",
			"src/server/routes/user.ts",
			"src/server/services/antigravity-quota.service.ts",
			"web/src/components/admin/antigravity-quota-view.tsx",
			"web/src/components/usage-widgets.tsx",
			"web/src/pages/Usage.tsx",
			"web/src/pages/ServerStatusPage.tsx",
			"web/src/components/shell.tsx",
		],
	},
	{
		id: "copilot-walkthrough",
		commit: "79f90a6",
		time: "15:25",
		date: "2026-09-18",
		fullDateTime: "18/09/2026 15:25 (GMT+7)",
		type: "added",
		scope: "copilot",
		title: "feat: add autonomous interactive screen spotlight walkthrough and dynamic command bar",
		summary: "Engineered in-app AI Copilot command bar (Cmd+K) with full application context mapping, live AI autonomous step generation, hardware-accelerated spotlight walkthrough, and system guardrails.",
		highlights: [
			"Floating bottom-center command bar with Cmd+K shortcut, auto-focus, and Esc collapse",
			"Full application context mapping across all 17 platform pages, actions, and selectors",
			"Autonomous step generation with live AI model and sub-millisecond semantic intent resolver",
			"Hardware-accelerated 60fps box-shadow spotlight overlay with click-through element interaction",
			"Strict system guardrails explaining passwordless email auth, invite-only signup, and free credit allocation",
			"Complete bilingual i18n localization in Vietnamese and English",
		],
	},
	{
		id: "c5b9e49",
		commit: "c5b9e49",
		time: "01:54",
		date: "2026-09-18",
		fullDateTime: "18/09/2026 01:54 (GMT+7)",
		type: "core",
		scope: "status",
		title: "chore: simplify database service name to Database",
		summary: "Streamlined the service name on the Server Status page from verbose PostgreSQL / SQLite Storage to clean, concise Database indicator.",
		highlights: [
			"Updated server status payload to return Database as the official service name",
			"Maintained backward compatibility with existing telemetry logs",
			"Verified live status API endpoint returns concise naming",
		],
		files: ["src/server/routes/status.ts"],
	},
	{
		id: "6b213e0",
		commit: "6b213e0",
		time: "01:53",
		date: "2026-09-18",
		fullDateTime: "18/09/2026 01:53 (GMT+7)",
		type: "fixed",
		scope: "telegram",
		title: "fix: enforce public HTTPS origin for webhook registration and fix nav.settings i18n",
		summary: "Resolved Bad Request webhook error by enforcing public HTTPS domain through Cloudflare tunnel, and added missing settings translation keys.",
		highlights: [
			"Automatic HTTPS origin resolution prioritizing configured APP_URL",
			"Eliminated internal 127.0.0.1:8787 HTTP URL rejection from Telegram setWebhook API",
			"Added missing settings key in Vietnamese and English sidebar navigation",
			"Passed custom bot token directly from UI state during immediate registration",
		],
		files: ["src/server/routes/admin.ts", "web/src/components/admin/telegram-settings-card.tsx", "web/src/i18n/vi.ts", "web/src/i18n/en.ts"],
	},
	{
		id: "72bd482",
		commit: "72bd482",
		time: "01:49",
		date: "2026-09-18",
		fullDateTime: "18/09/2026 01:49 (GMT+7)",
		type: "added",
		scope: "ui",
		title: "feat: add scrollable sidebar navigation, system section, changelog, and live server status page",
		summary: "Upgraded shell navigation with smooth slim scrolling and introduced dedicated SYSTEM section containing live Status and Changelog views.",
		highlights: [
			"Pinned top branding and bottom profile while enabling middle section scrolling",
			"Integrated status.claude.com style 30-day uptime bars and services health monitors",
			"Built reactive timeline view tracking platform deployments and protocol updates",
			"Fully responsive layout supporting desktop and mobile drawer navigation",
		],
		files: ["web/src/components/shell.tsx", "web/src/App.tsx", "src/server/routes/status.ts", "web/src/pages/ServerStatusPage.tsx", "web/src/pages/ChangelogPage.tsx"],
	},
	{
		id: "b5af981",
		commit: "b5af981",
		time: "01:45",
		date: "2026-09-18",
		fullDateTime: "18/09/2026 01:45 (GMT+7)",
		type: "added",
		scope: "telegram",
		title: "feat: add full slash command suite for monitoring, logs, quotas, invitations, and announcements",
		summary: "Engineered interactive Telegram command suite allowing operators to query status, quotas, recent logs, invite users, and broadcast announcements.",
		highlights: [
			"Supported /status, /usage, /quotas, /cooldowns, and /logs commands",
			"Added administrative /users, /invitations, /invite, and /announce actions",
			"Automated command registration via setMyCommands for native client auto-complete",
			"Enhanced member notification to reflect invitation acceptance workflow",
		],
		files: ["src/server/services/telegram-commands.ts", "src/server/services/telegram.service.ts", "src/server/services/invitation.service.ts"],
	},
	{
		id: "04a317b",
		commit: "04a317b",
		time: "01:39",
		date: "2026-09-18",
		fullDateTime: "18/09/2026 01:39 (GMT+7)",
		type: "added",
		scope: "telegram",
		title: "feat: add auto-detect Chat ID feature using recent /start message from bot",
		summary: "Introduced 1-click automatic Chat ID detection in Admin Settings by querying recent /start updates directly from the bot API.",
		highlights: [
			"Eliminated need for external userinfo bots to find Telegram Chat ID",
			"Detects personal chats and group channels with sender display names",
			"Pre-fills Chat ID input and saves directly to database settings",
		],
		files: ["src/server/services/telegram.service.ts", "src/server/routes/admin.ts", "web/src/components/admin/telegram-settings-card.tsx"],
	},
	{
		id: "198dd26",
		commit: "198dd26",
		time: "01:34",
		date: "2026-09-18",
		fullDateTime: "18/09/2026 01:34 (GMT+7)",
		type: "added",
		scope: "telegram",
		title: "feat: add Telegram server monitoring bot with alerts and status commands",
		summary: "Added automated background monitoring with Telegram alerts for account cooldowns, server errors, and member events.",
		highlights: [
			"Smart 5-minute cooldown debounce preventing message spam on flapping accounts",
			"Instant critical error notifications with error stack traces and timestamps",
			"Direct webhook event handler for asynchronous bot communication",
		],
		files: ["src/server/services/telegram.service.ts", "src/server/routes/admin.ts"],
	},
	{
		id: "572cecb",
		commit: "572cecb",
		time: "01:28",
		date: "2026-09-18",
		fullDateTime: "18/09/2026 01:28 (GMT+7)",
		type: "added",
		scope: "ui",
		title: "feat: auto-detect client OS and preselect macOS/Linux or Windows PowerShell tab in Tools Config",
		summary: "Dynamically inspects client userAgent to determine operating system and automatically pre-selects the appropriate command script tab.",
		highlights: [
			"Instant auto-selection between PowerShell (Windows) and Bash (macOS/Linux)",
			"Smooth manual override tabs remaining available for cross-platform setups",
			"Reduced user onboarding friction in Tools Config page",
		],
		files: ["web/src/pages/AiConfig.tsx"],
	},
	{
		id: "774c1f0",
		commit: "774c1f0",
		time: "23:37",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 23:37 (GMT+7)",
		type: "fixed",
		scope: "gateway",
		title: "fix: stream toolcall_delta with full JSON arguments and set sawTool for finish_reason",
		summary: "Fixed an issue where streaming tool call arguments arrived empty in OpenAI chat completions format by piping delta chunks and setting finish_reason.",
		highlights: [
			"Properly serialized function call arguments as JSON delta streams",
			"Ensured finish_reason equals tool_calls when tools are invoked",
			"Fixed tool calling integration in Cline and Roo Code harnesses",
		],
		files: ["src/server/gateway/ingress/openai-chat.ts"],
	},
	{
		id: "278f5fd",
		commit: "278f5fd",
		time: "23:31",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 23:31 (GMT+7)",
		type: "fixed",
		scope: "antigravity",
		title: "fix: supply skip_thought_signature_validator on functionCall parts in Gemini 3 history",
		summary: "Fixed Google Gemini 3.8 and 3.7 thought signature validation errors by attaching skip_thought_signature_validator on multi-turn functionCall turns.",
		highlights: [
			"Resolved Thought signature validation failed errors on Gemini models",
			"Supported multi-turn agent tool loops in Antigravity wire",
			"Preserved reasoning history across consecutive model interactions",
		],
		files: ["src/server/gateway/egress/antigravity.ts"],
	},
	{
		id: "bec47e1",
		commit: "bec47e1",
		time: "23:28",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 23:28 (GMT+7)",
		type: "fixed",
		scope: "antigravity",
		title: "fix: sanitize tool parameter JSON schemas to comply with Gemini protobuf requirements",
		summary: "Sanitized tool parameters by recursively stripping unsupported keywords like exclusiveMinimum and normalizing array type definitions.",
		highlights: [
			"Recursive schema cleaner stripping exclusiveMinimum, exclusiveMaximum, and invalid unions",
			"Prevented 400 Invalid Argument schema errors from Google backend",
			"Validated compliance against strict Gemini Protobuf specifications",
		],
		files: ["src/server/gateway/egress/antigravity.ts"],
	},
	{
		id: "35d3ddf",
		commit: "35d3ddf",
		time: "23:20",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 23:20 (GMT+7)",
		type: "fixed",
		scope: "omp",
		title: "fix: clean up redundant global env vars in OMP setup and fix YAML path escaping on Windows",
		summary: "Removed duplicate global environment variables in OMP setup scripts and ensured valid backslash escaping for Windows path strings in config.yml.",
		highlights: [
			"Corrected double escaping in Windows PowerShell configuration generator",
			"Ensured OMP agent configuration loads cleanly on Windows 11",
			"Prevented duplicate provider definitions in models.yml",
		],
		files: ["src/server/routes/setup-scripts.ts"],
	},
	{
		id: "8cd15eb",
		commit: "8cd15eb",
		time: "19:49",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 19:49 (GMT+7)",
		type: "changed",
		scope: "budget",
		title: "refactor: migrate all budget fields to weeklyCreditBudget with zero-downtime database compatibility",
		summary: "Migrated monthly token budget system to weekly credit budgets with rolling Monday synchronization and additive database schema.",
		highlights: [
			"Zero-downtime additive database migration preserving existing user balances",
			"Rolling weekly reset aligned to Monday 00:00 local time",
			"Unified credit accounting across Claude, OpenAI, and Google models",
		],
		files: ["src/server/db/schema.ts", "src/server/limits/index.ts", "src/server/services/user.service.ts"],
	},
	{
		id: "848c4e4",
		commit: "848c4e4",
		time: "19:16",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 19:16 (GMT+7)",
		type: "added",
		scope: "ui",
		title: "feat: add smooth stack push animation and glowing green/red pulse for newly arrived requests",
		summary: "Enhanced Admin Request Logs with motion stack entry animations and glowing radar pulses to highlight newly arrived requests on auto-reload.",
		highlights: [
			"motion/react top-of-stack push animations with layout transition",
			"Subtle green pulse for successful 200 requests and red pulse for 4xx/5xx errors",
			"Performance-optimized animation rendering with strict hardware acceleration",
		],
		files: ["web/src/pages/AdminLogs.tsx"],
	},
	{
		id: "bb79c5a",
		commit: "bb79c5a",
		time: "18:31",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 18:31 (GMT+7)",
		type: "added",
		scope: "claude",
		title: "feat: add full anthropic-ratelimit-* headers for Claude Code quota and limit tracking",
		summary: "Emulated native Anthropic rate limit headers allowing Claude Code CLI to accurately track 5-hour rolling quota windows and remaining limits.",
		highlights: [
			"Injected anthropic-ratelimit-unified-5h-* headers into streaming responses",
			"Enabled proactive quota warning displays inside Claude Code TUI",
			"Aligned token consumption tracking with server accounting",
		],
		files: ["src/server/gateway/egress/claude.ts", "src/server/gateway/ingress/anthropic.ts"],
	},
	{
		id: "fe275a9",
		commit: "fe275a9",
		time: "16:56",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 16:56 (GMT+7)",
		type: "added",
		scope: "codex",
		title: "feat: stream rate_limits events and embed rate_limits in response.completed",
		summary: "Streamed OpenAI native rate_limits SSE events and embedded comprehensive rate limit metadata into response.completed payloads for Codex CLI.",
		highlights: [
			"Added rate_limits SSE event streaming for Codex client compatibility",
			"Embedded primary and secondary limit windows into completed response bodies",
			"Synced quota indicators inside Codex status line",
		],
		files: ["src/server/gateway/ingress/openai-responses.ts"],
	},
	{
		id: "c806361",
		commit: "c806361",
		time: "16:33",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 16:33 (GMT+7)",
		type: "fixed",
		scope: "codex",
		title: "fix: accumulate streamed text and reasoning to prevent output wiping on completion",
		summary: "Fixed a bug where final text disappeared in Codex TUI by accumulating streamed text chunks into the final response.completed event.",
		highlights: [
			"Accumulated reasoning and text output buffers during streaming",
			"Prevented empty text payload overwrite on completion in Codex",
			"Maintained full multi-turn assistant answers in session context",
		],
		files: ["src/server/gateway/ingress/openai-responses.ts"],
	},
	{
		id: "fd68e1a",
		commit: "fd68e1a",
		time: "16:24",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 16:24 (GMT+7)",
		type: "fixed",
		scope: "opencode",
		title: "fix: add authentic OpenCode CLI headers and project/session tokens for muse-spark",
		summary: "Emulated official OpenCode v2 CLI headers, project tokens, and session affinity for free execution of muse-spark models.",
		highlights: [
			"Configured authentic OpenCode user agent and client headers",
			"Attached dynamic session and project affinity tokens",
			"Enabled seamless routing to free community models",
		],
		files: ["src/server/gateway/egress/openai-chat.ts"],
	},
	{
		id: "e96a66b",
		commit: "e96a66b",
		time: "16:02",
		date: "2026-09-17",
		fullDateTime: "17/09/2026 16:02 (GMT+7)",
		type: "added",
		scope: "setup",
		title: "feat: auto-inject accessible models for Codex and support full smart reset for Codex and OMP",
		summary: "Automatically fetches authorized models and generates customized config files for Codex and OMP with backup and reset support.",
		highlights: [
			"One-click smart configuration injection for Codex CLI and OMP",
			"Automatic backup of existing config files before replacement",
			"Included restore command script for quick rollback",
		],
		files: ["src/server/routes/setup-scripts.ts"],
	},
];

const FILTER_TABS: { id: "all" | UpdateType; label: string }[] = [
	{ id: "all", label: "ALL" },
	{ id: "added", label: "ADDED" },
	{ id: "fixed", label: "FIXED" },
	{ id: "changed", label: "CHANGED" },
	{ id: "core", label: "CORE" },
];

export default function ChangelogPage() {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState<"all" | UpdateType>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set([CHANGELOG_DATA[0]?.id || ""]));
	const reduceMotion = useReducedMotion();

	const toggleExpand = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const filteredEntries = useMemo(() => {
		return CHANGELOG_DATA.filter((entry) => {
			const matchesTab = activeTab === "all" || entry.type === activeTab;
			if (!matchesTab) return false;

			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase().trim();
			return (
				entry.title.toLowerCase().includes(q) ||
				entry.scope.toLowerCase().includes(q) ||
				entry.commit.toLowerCase().includes(q) ||
				entry.summary.toLowerCase().includes(q) ||
				entry.highlights.some((h) => h.toLowerCase().includes(q))
			);
		});
	}, [activeTab, searchQuery]);

	// Counts per type
	const counts = useMemo(() => {
		const res: Record<string, number> = { all: CHANGELOG_DATA.length };
		for (const item of CHANGELOG_DATA) {
			res[item.type] = (res[item.type] || 0) + 1;
		}
		return res;
	}, []);

	return (
		<div className="space-y-6 max-w-5xl mx-auto pb-16">
			{/* Top Header */}
			<header className="border-b border-line pb-5">
				<div className="flex items-center gap-2 text-xs font-mono text-ink-2 uppercase tracking-wider mb-1">
					<History className="size-3.5 text-accent" />
					<span>Project Changelog</span>
				</div>
				<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
					{t("changelog.title", "Server Changelog")}
				</h1>
				<p className="mt-1 text-xs sm:text-sm text-ink-2">
					{t("changelog.desc", "Real-time stream of platform updates, bug fixes, and protocol improvements.")}
				</p>
			</header>

			{/* Filter Bar & Search */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				{/* Filter Tabs */}
				<div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg border border-line bg-paper/40">
					{FILTER_TABS.map((tab) => {
						const isActive = activeTab === tab.id;
						const count = counts[tab.id] || 0;
						return (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition cursor-pointer ${
									isActive
										? "bg-accent text-white shadow-2xs"
										: "text-ink-2 hover:text-ink hover:bg-white/60"
								}`}
							>
								<span>{tab.label}</span>
								<span
									className={`text-[10px] px-1 py-0.2 rounded ${
										isActive ? "bg-white/20 text-white" : "bg-line/60 text-ink-2"
									}`}
								>
									{count}
								</span>
							</button>
						);
					})}
				</div>

				{/* Search Input */}
				<div className="relative w-full sm:w-64">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-2" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search commit, scope, fix..."
						className="w-full rounded-lg border border-line bg-white pl-8 pr-7 py-1.5 text-xs text-ink placeholder:text-ink-2/60 focus:outline-none focus:border-accent shadow-2xs font-mono"
					/>
					{searchQuery && (
						<button
							onClick={() => setSearchQuery("")}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2 hover:text-ink cursor-pointer"
						>
							<X className="size-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* Feed List */}
			<div className="space-y-2">
				{filteredEntries.length === 0 ? (
					<div className="rounded-xl border border-dashed border-line bg-white/50 p-10 text-center space-y-2">
						<GitCommit className="size-8 mx-auto text-ink-2/50" />
						<p className="text-sm font-medium text-ink">No updates found</p>
						<p className="text-xs text-ink-2">Try adjusting your search query or filter tab.</p>
					</div>
				) : (
					filteredEntries.map((entry) => {
						const isExpanded = expandedIds.has(entry.id);

						return (
							<div
								key={entry.id}
								className={`rounded-xl border transition-all duration-200 overflow-hidden ${
									isExpanded 
										? "border-accent/60 bg-white shadow-xs ring-1 ring-accent/15" 
										: "border-line bg-white hover:border-line-2 hover:shadow-2xs"
								}`}
							>
								{/* Clickable Header Row */}
								<div
									onClick={() => toggleExpand(entry.id)}
									className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 sm:py-3 gap-2 sm:gap-4 cursor-pointer select-none group"
								>
									{/* Left Meta & Title */}
									<div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
										{/* Timestamp Pill */}
										<div className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-ink-2 bg-paper/80 border border-line/60 px-2 py-0.5 rounded shrink-0">
											<Clock className="size-3 text-accent shrink-0" />
											<span>{entry.time}</span>
										</div>

										{/* Type Tag */}
										<span
											className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
												entry.type === "added"
													? "bg-[#1d7a33]/10 text-[#1d7a33] border-[#1d7a33]/30"
													: entry.type === "fixed"
													? "bg-[#0284c7]/10 text-[#0284c7] border-[#0284c7]/30"
													: entry.type === "changed"
													? "bg-[#d97706]/10 text-[#d97706] border-[#d97706]/30"
													: "bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/30"
											}`}
										>
											{entry.type.toUpperCase()}
										</span>

										{/* Scope Tag */}
										<span className="hidden md:inline-block font-mono text-[11px] text-ink-2 bg-paper/60 px-1.5 py-0.5 rounded border border-line/50 shrink-0">
											{entry.scope}
										</span>

										{/* Title */}
										<span className="font-mono text-xs text-ink truncate group-hover:text-accent transition">
											{entry.title}
										</span>
									</div>

									{/* Right Commit & Expand Chevron */}
									<div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-1 sm:pl-0 border-t sm:border-t-0 border-line/40 pt-1 sm:pt-0">
										<div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-2">
											<GitCommit className="size-3 text-ink-2/60" />
											<span>{entry.commit}</span>
										</div>

										<div className="flex items-center gap-1 text-[11px] font-mono text-ink-2/70 hidden lg:inline-flex">
											<span>{entry.date}</span>
										</div>

										{/* Chevron with smooth rotation */}
										<div
											className={`size-6 rounded flex items-center justify-center border border-line/60 text-ink-2 transition-transform duration-200 group-hover:border-accent group-hover:text-accent ${
												isExpanded ? "rotate-180 bg-paper/60" : ""
											}`}
										>
											<ChevronDown className="size-3.5" />
										</div>
									</div>
								</div>

								{/* Animated Expandable Details Panel */}
								<AnimatePresence initial={false}>
									{isExpanded && (
										<motion.div
											key="content"
											initial={reduceMotion ? false : { height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
											transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
											className="overflow-hidden"
										>
											<div className="border-t border-line/80 bg-paper/20 p-4 sm:p-5 space-y-4 text-xs">
												{/* Detailed Summary */}
												<div>
													<h4 className="font-mono text-[11px] font-semibold text-ink uppercase tracking-wider mb-1">
														Overview
													</h4>
													<p className="text-ink-2 leading-relaxed text-xs sm:text-[13px]">
														{entry.summary}
													</p>
												</div>

												{/* Key Changes & Highlights */}
												{entry.highlights && entry.highlights.length > 0 && (
													<div>
														<h4 className="font-mono text-[11px] font-semibold text-ink uppercase tracking-wider mb-2">
															Key Changes
														</h4>
														<ul className="space-y-1.5">
															{entry.highlights.map((item, idx) => (
																<li key={idx} className="flex items-start gap-2 text-ink">
																	<CheckCircle2 className="size-3.5 text-accent mt-0.5 shrink-0" />
																	<span className="leading-normal">{item}</span>
																</li>
															))}
														</ul>
													</div>
												)}

												{/* Deployment Timestamp */}
												<div className="flex items-center gap-1.5 pt-3 border-t border-line/60 text-[11px] font-mono text-ink-2">
													<Clock className="size-3 text-accent shrink-0" />
													<span>Deployed: {entry.fullDateTime}</span>
												</div>
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

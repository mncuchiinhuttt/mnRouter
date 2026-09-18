import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Activity, BarChart3, Boxes, History, KeyRound, LayoutGrid, LineChart, Megaphone, Menu, MessageSquare, MessageSquareWarning, Plug, ScrollText, Settings, SlidersHorizontal, Terminal, Trophy, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@web/lib/utils";
import { setLang } from "@web/i18n";
import { WeeklyCreditsCard } from "./weekly-credits-card";
import { UserMenu } from "./user-menu";
import { OnboardingDialog } from "./onboarding/onboarding-dialog";
import { TourProvider } from "@web/lib/tour-context";
import { FloatingCopilot } from "@web/components/copilot/floating-copilot";
export interface Me {
	id: string;
	email: string;
	role: "admin" | "user";
	displayName: string | null;
	username?: string | null;
	department?: string | null;
	avatarUrl?: string | null;
	packageName: string | null;
	monthlyTokenBudget: number | null;
	onboardedAt?: number | string | null;
}
function NavItem({ to, icon, label, onNavigate, dataTour }: { to: string; icon: ReactNode; label: string; onNavigate?: () => void; dataTour?: string }) {
	return (
		<NavLink
			to={to}
			onClick={onNavigate}
			data-tour={dataTour}
			className={({ isActive }) =>
				cn(
					"group relative mx-3 flex items-center gap-2.5 rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-all",
					isActive
						? "bg-white/15 text-white font-medium shadow-xs"
						: "text-[#8f8fb8] hover:bg-white/10 hover:text-white",
				)
			}
		>
			{({ isActive }) => (
				<>
					<span className={cn("shrink-0 text-accent-bright transition-opacity", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")}>
						{icon}
					</span>
					<span className="truncate">{label}</span>
					<span className="ml-auto hidden min-w-8 flex-1 border-b border-dotted border-white/20 sm:block group-hover:border-white/40" />
				</>
			)}
		</NavLink>
	);
}

function SectionLabel({ children }: { children: string }) {
	return (
		<div className="px-5 pb-2 pt-5">
			<span className="label-mono border border-[#3a3a5c] bg-navy-2 px-1.5 py-0.5 text-[10px] text-[#b9b9dd]">{children}</span>
		</div>
	);
}

export function LangToggle() {
	const { i18n } = useTranslation();
	const lang = i18n.language?.startsWith("en") ? "en" : "vi";
	return (
		<div className="flex overflow-hidden rounded-xs border border-[#3a3a5c] font-mono text-[10px] tracking-widest">
			{(["vi", "en"] as const).map((l) => (
				<button
					key={l}
					onClick={() => setLang(l)}
					className={cn("px-2 py-1 transition-colors cursor-pointer", l === lang ? "bg-accent text-white" : "text-[#8f8fb8] hover:text-white")}
				>
					{l.toUpperCase()}
				</button>
			))}
		</div>
	);
}

function SidebarContent({ me, onNavigate, t }: { me: Me; onNavigate?: () => void; t: (k: string) => string }) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="shrink-0">
				<div className="flex items-center gap-3 px-5 pb-5 pt-6">
					<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white shadow-xs">
						<svg viewBox="0 0 32 32" className="h-7 w-7">
							<path d="M7 23V9l4.5 8L16 9l4.5 8L25 9v14" stroke="#2323e6" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</div>
					<div className="font-mono text-[15px] font-semibold leading-[1.1] tracking-[0.08em] text-white">
						MN
						<br />
						ROUTER
					</div>
				</div>

				<WeeklyCreditsCard packageName={me.packageName} role={me.role} />
			</div>

			<div className="flex-1 overflow-y-auto overscroll-contain pb-4 [scrollbar-width:thin] [scrollbar-color:#3a3a5c_transparent]">
				<SectionLabel>{t("nav.account")}</SectionLabel>
				<nav className="flex flex-col gap-0.5">
					<NavItem to="/" icon={<LayoutGrid className="h-3.5 w-3.5" />} label={t("nav.overview")} onNavigate={onNavigate} dataTour="nav-overview" />
					<NavItem to="/usage" icon={<BarChart3 className="h-3.5 w-3.5" />} label={t("nav.usage")} onNavigate={onNavigate} dataTour="nav-usage" />
					<NavItem to="/leaderboard" icon={<Trophy className="h-3.5 w-3.5" />} label={t("nav.leaderboard")} onNavigate={onNavigate} dataTour="nav-leaderboard" />
					<NavItem to="/keys" icon={<KeyRound className="h-3.5 w-3.5" />} label={t("nav.apiKeys")} onNavigate={onNavigate} dataTour="nav-keys" />
					<NavItem to="/config" icon={<Terminal className="h-3.5 w-3.5" />} label={t("nav.aiConfig")} onNavigate={onNavigate} dataTour="nav-config" />
					<NavItem to="/chat" icon={<MessageSquare className="h-3.5 w-3.5" />} label={t("nav.chat")} onNavigate={onNavigate} dataTour="nav-chat" />
					<NavItem to="/mcp" icon={<Boxes className="h-3.5 w-3.5" />} label={t("nav.mcpSkills")} onNavigate={onNavigate} dataTour="nav-mcp" />
				</nav>

				{me.role === "admin" && (
					<>
						<SectionLabel>{t("nav.admin")}</SectionLabel>
						<nav className="flex flex-col gap-0.5">
							<NavItem to="/admin/users" icon={<Users className="h-3.5 w-3.5" />} label={t("nav.users")} onNavigate={onNavigate} dataTour="nav-users" />
							<NavItem to="/admin/connections" icon={<Plug className="h-3.5 w-3.5" />} label={t("nav.connections")} onNavigate={onNavigate} dataTour="nav-connections" />
							<NavItem to="/admin/models" icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label={t("nav.models")} onNavigate={onNavigate} dataTour="nav-models" />
							<NavItem to="/admin/quotas" icon={<Activity className="h-3.5 w-3.5" />} label={t("nav.quotas")} onNavigate={onNavigate} dataTour="nav-quotas" />
							<NavItem to="/admin/analytics" icon={<LineChart className="h-3.5 w-3.5" />} label={t("nav.analytics")} onNavigate={onNavigate} dataTour="nav-analytics" />
							<NavItem to="/admin/logs" icon={<ScrollText className="h-3.5 w-3.5" />} label={t("nav.logs")} onNavigate={onNavigate} dataTour="nav-logs" />
							<NavItem to="/admin/feedbacks" icon={<MessageSquareWarning className="h-3.5 w-3.5" />} label={t("nav.feedbacks")} onNavigate={onNavigate} dataTour="nav-feedbacks" />
							<NavItem to="/admin/announcements" icon={<Megaphone className="h-3.5 w-3.5" />} label={t("nav.announcements")} onNavigate={onNavigate} dataTour="nav-announcements" />
							<NavItem to="/admin/settings" icon={<Settings className="h-3.5 w-3.5" />} label={t("nav.settings")} onNavigate={onNavigate} dataTour="nav-settings" />
						</nav>
					</>
				)}

				<SectionLabel>{t("nav.system")}</SectionLabel>
				<nav className="flex flex-col gap-0.5">
					<NavItem to="/status" icon={<Activity className="h-3.5 w-3.5" />} label={t("nav.status")} onNavigate={onNavigate} dataTour="nav-status" />
					<NavItem to="/changelog" icon={<History className="h-3.5 w-3.5" />} label={t("nav.changelog")} onNavigate={onNavigate} dataTour="nav-changelog" />
				</nav>
			</div>

			<div className="shrink-0 border-t border-[#26264a] bg-navy px-3 py-3">
				<UserMenu me={me} onNavigate={onNavigate} />
			</div>
		</div>
	);
}

export function Shell({ me }: { me: Me }) {
	const { t } = useTranslation();
	const location = useLocation();
	const [menuOpen, setMenuOpen] = useState(false);
	const needsOnboarding = !me.onboardedAt;
	const [onboardingOpen, setOnboardingOpen] = useState(needsOnboarding);
	const isChat = location.pathname.startsWith("/chat");
	const section = location.pathname.split("/").filter(Boolean)[0]?.toUpperCase() ?? "OVERVIEW";

	return (
		<TourProvider>
			<div className="flex min-h-[100dvh] flex-col lg:flex-row">
				<OnboardingDialog me={me} open={onboardingOpen} onComplete={() => setOnboardingOpen(false)} />
			<header className="halftone sticky top-0 z-40 flex h-14 items-center justify-between bg-navy px-4 lg:hidden">
				<div className="flex items-center gap-2.5">
					<div className="flex h-8 w-8 items-center justify-center rounded-md bg-white">
						<svg viewBox="0 0 32 32" className="h-5 w-5">
							<path d="M7 23V9l4.5 8L16 9l4.5 8L25 9v14" stroke="#2323e6" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</div>
					<span className="font-mono text-[13px] font-semibold tracking-[0.08em] text-white">ROUTER</span>
				</div>
				<div className="flex items-center gap-2">
					<LangToggle />
					<button onClick={() => setMenuOpen(true)} className="rounded-xs p-2 text-white cursor-pointer" aria-label={t("common.menu")}>
						<Menu className="h-5 w-5" />
					</button>
				</div>
			</header>

			{/* mobile drawer */}
			{menuOpen && <div className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-[2px] lg:hidden" onClick={() => setMenuOpen(false)} />}
			<aside
				className={cn(
					"halftone fixed right-0 top-0 z-50 flex h-[100dvh] w-[260px] flex-col bg-navy transition-transform duration-300 lg:hidden",
					menuOpen ? "translate-x-0" : "translate-x-full",
				)}
			>
				<button onClick={() => setMenuOpen(false)} className="absolute right-3 top-3 rounded-xs p-1.5 text-[#8f8fb8] hover:text-white cursor-pointer" aria-label={t("common.close")}>
					<X className="h-4 w-4" />
				</button>
				<SidebarContent me={me} onNavigate={() => setMenuOpen(false)} t={t} />
			</aside>

			{/* desktop sidebar */}
			<aside className="halftone sticky top-0 hidden h-[100dvh] w-[248px] shrink-0 flex-col bg-navy lg:flex">
				<SidebarContent me={me} t={t} />
			</aside>

			<main className={cn("min-w-0 flex-1 flex flex-col", isChat ? "h-[100dvh] overflow-hidden" : "")}>
				<div className="hidden shrink-0 items-center justify-between border-b border-line bg-paper px-8 py-3.5 lg:flex">
					<div className="label-mono text-ink-2">
						<span className="text-accent">//</span>&nbsp; {section}
					</div>
					<LangToggle />
				</div>
				<div className={cn("flex-1", isChat ? "h-full w-full overflow-hidden p-0" : "w-full overflow-auto px-4 py-6 sm:px-8 lg:px-10 lg:py-10")}>
					<Outlet context={me} />
				</div>
				</main>
				<FloatingCopilot />
			</div>
		</TourProvider>
	);
}

import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { BarChart3, ScrollText, KeyRound, LayoutGrid, Users, Plug, Settings, LogOut, SlidersHorizontal, Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@web/lib/utils";
import { api } from "@web/lib/api";
import { setLang } from "@web/i18n";

export interface Me {
	id: string;
	email: string;
	role: "admin" | "user";
	displayName: string | null;
	monthlyTokenBudget: number | null;
}

function NavItem({ to, icon, label, onNavigate }: { to: string; icon: ReactNode; label: string; onNavigate?: () => void }) {
	return (
		<NavLink
			to={to}
			onClick={onNavigate}
			className={({ isActive }) =>
				cn(
					"group relative flex items-center gap-2.5 px-5 py-[7px] font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
					isActive ? "text-white" : "text-[#8f8fb8] hover:text-white",
				)
			}
		>
			{({ isActive }) => (
				<>
					<span className={cn("absolute left-0 top-1/2 h-[16px] w-[2px] -translate-y-1/2 bg-accent-bright transition-opacity", isActive ? "opacity-100" : "opacity-0")} />
					{icon}
					<span className="border-b border-dotted border-[#3a3a5c] pb-[2px] group-hover:border-[#6a6a96]">{label}</span>
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

function LangToggle() {
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
	const navigate = useNavigate();
	const logout = async () => {
		await api("/api/auth/logout", { method: "POST" }).catch(() => {});
		navigate("/login");
	};
	return (
		<>
			<div className="flex items-center gap-3 px-5 pb-6 pt-6">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white">
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

			<SectionLabel>{t("nav.account")}</SectionLabel>
			<nav className="flex flex-col gap-0.5">
				<NavItem to="/" icon={<LayoutGrid className="h-3.5 w-3.5" />} label={t("nav.overview")} onNavigate={onNavigate} />
				<NavItem to="/usage" icon={<BarChart3 className="h-3.5 w-3.5" />} label={t("nav.usage")} onNavigate={onNavigate} />
				<NavItem to="/keys" icon={<KeyRound className="h-3.5 w-3.5" />} label={t("nav.apiKeys")} onNavigate={onNavigate} />
			</nav>

			{me.role === "admin" && (
				<>
					<SectionLabel>{t("nav.admin")}</SectionLabel>
					<nav className="flex flex-col gap-0.5">
						<NavItem to="/admin/users" icon={<Users className="h-3.5 w-3.5" />} label={t("nav.users")} onNavigate={onNavigate} />
						<NavItem to="/admin/connections" icon={<Plug className="h-3.5 w-3.5" />} label={t("nav.connections")} onNavigate={onNavigate} />
						<NavItem to="/admin/models" icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label={t("nav.models")} onNavigate={onNavigate} />
						<NavItem to="/admin/logs" icon={<ScrollText className="h-3.5 w-3.5" />} label={t("nav.logs")} onNavigate={onNavigate} />
						<NavItem to="/admin/settings" icon={<Settings className="h-3.5 w-3.5" />} label={t("nav.settings")} onNavigate={onNavigate} />
					</nav>
				</>
			)}

			<div className="mt-auto border-t border-[#26264a] px-4 py-4">
				<div className="flex items-center gap-2.5">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-semibold text-white">
						{me.email.slice(0, 2).toUpperCase()}
					</div>
					<div className="min-w-0 flex-1">
						<div className="truncate font-mono text-[11px] uppercase tracking-wider text-white">{me.displayName ?? me.email.split("@")[0]}</div>
						<div className="truncate font-mono text-[10px] text-[#8f8fb8]">{me.role}</div>
					</div>
					<button onClick={logout} className="rounded-xs p-1.5 text-[#8f8fb8] transition hover:bg-navy-3 hover:text-white cursor-pointer" title={t("nav.logout")}>
						<LogOut className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</>
	);
}

export function Shell({ me }: { me: Me }) {
	const { t } = useTranslation();
	const location = useLocation();
	const [menuOpen, setMenuOpen] = useState(false);
	const section = location.pathname.split("/").filter(Boolean)[0]?.toUpperCase() ?? "OVERVIEW";

	return (
		<div className="flex min-h-[100dvh] flex-col lg:flex-row">
			{/* mobile topbar */}
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
					<button onClick={() => setMenuOpen(true)} className="rounded-xs p-2 text-white cursor-pointer" aria-label="Menu">
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
				<button onClick={() => setMenuOpen(false)} className="absolute right-3 top-3 rounded-xs p-1.5 text-[#8f8fb8] hover:text-white cursor-pointer" aria-label={t("common.cancel")}>
					<X className="h-4 w-4" />
				</button>
				<SidebarContent me={me} onNavigate={() => setMenuOpen(false)} t={t} />
			</aside>

			{/* desktop sidebar */}
			<aside className="halftone sticky top-0 hidden h-[100dvh] w-[248px] shrink-0 flex-col bg-navy lg:flex">
				<SidebarContent me={me} t={t} />
			</aside>

			<main className="min-w-0 flex-1">
				<div className="hidden items-center justify-between border-b border-line bg-paper px-10 py-5 lg:flex">
					<div className="label-mono text-ink-2">
						<span className="text-accent">//</span>&nbsp; {section}
					</div>
					<LangToggle />
				</div>
				<div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
					<Outlet context={me} />
				</div>
			</main>
		</div>
	);
}

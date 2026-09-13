import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { BarChart3, ScrollText, KeyRound, LayoutGrid, Users, Plug, Settings, LogOut, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@web/lib/utils";
import { api } from "@web/lib/api";

export interface Me {
	id: string;
	email: string;
	role: "admin" | "user";
	displayName: string | null;
	monthlyTokenBudget: number | null;
}

function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
	return (
		<NavLink
			to={to}
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
	return <div className="px-5 pb-2 pt-5"><span className="label-mono border border-[#3a3a5c] bg-navy-2 px-1.5 py-0.5 text-[10px] text-[#b9b9dd]">{children}</span></div>;
}

export function Shell({ me }: { me: Me }) {
	const navigate = useNavigate();
	const location = useLocation();
	const logout = async () => {
		await api("/api/auth/logout", { method: "POST" }).catch(() => {});
		navigate("/login");
	};
	const section = location.pathname.split("/").filter(Boolean)[0]?.toUpperCase() ?? "OVERVIEW";

	return (
		<div className="flex min-h-[100dvh]">
			<aside className="halftone sticky top-0 flex h-[100dvh] w-[248px] shrink-0 flex-col bg-navy">
				<div className="flex items-center gap-3 px-5 pb-6 pt-6">
					<div className="flex h-11 w-11 items-center justify-center rounded-md bg-white">
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

				<SectionLabel>Account</SectionLabel>
				<nav className="flex flex-col gap-0.5">
					<NavItem to="/" icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Overview" />
					<NavItem to="/usage" icon={<BarChart3 className="h-3.5 w-3.5" />} label="Usage" />
					<NavItem to="/keys" icon={<KeyRound className="h-3.5 w-3.5" />} label="API Keys" />
				</nav>

				{me.role === "admin" && (
					<>
						<SectionLabel>Admin</SectionLabel>
						<nav className="flex flex-col gap-0.5">
							<NavItem to="/admin/users" icon={<Users className="h-3.5 w-3.5" />} label="Users" />
							<NavItem to="/admin/connections" icon={<Plug className="h-3.5 w-3.5" />} label="Connections" />
							<NavItem to="/admin/models" icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label="Models" />
							<NavItem to="/admin/logs" icon={<ScrollText className="h-3.5 w-3.5" />} label="Request Logs" />
							<NavItem to="/admin/settings" icon={<Settings className="h-3.5 w-3.5" />} label="Settings" />
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
						<button onClick={logout} className="rounded-xs p-1.5 text-[#8f8fb8] transition hover:bg-navy-3 hover:text-white cursor-pointer" title="Đăng xuất">
							<LogOut className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			</aside>

			<main className="min-w-0 flex-1">
				<div className="border-b border-line bg-paper px-10 py-5">
					<div className="label-mono text-ink-2">
						<span className="text-accent">//</span>&nbsp; {section}
					</div>
				</div>
				<div className="mx-auto max-w-[1200px] px-10 py-10">
					<Outlet context={me} />
				</div>
			</main>
		</div>
	);
}

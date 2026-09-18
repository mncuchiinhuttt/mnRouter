import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { HelpCircle, Power, ChevronsUpDown, UserCog, ShieldCheck } from "lucide-react";
import { api } from "@web/lib/api";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@web/components/ui/dropdown-menu";
import type { Me } from "./shell";
import { UserSettingsDialog } from "./user-settings-dialog";
import { ViewPassDialog } from "./onboarding/view-pass-dialog";

export function UserMenu({ me, onNavigate }: { me: Me; onNavigate?: () => void }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [passOpen, setPassOpen] = useState(false);

	useEffect(() => {
		const handleOpenSettings = () => setSettingsOpen(true);
		window.addEventListener("open-user-settings", handleOpenSettings);
		return () => window.removeEventListener("open-user-settings", handleOpenSettings);
	}, []);

	const logout = async () => {
		await api("/api/auth/logout", { method: "POST" }).catch(() => {});
		onNavigate?.();
		navigate("/login");
	};

	const initials = (me.displayName || me.email).slice(0, 2).toUpperCase();
	const orgName = (me.displayName || me.email.split("@")[0] || "MN").toUpperCase();

	return (
		<>
			<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button data-tour="user-profile-btn" className="flex w-full items-center gap-2.5 rounded-md p-1.5 transition hover:bg-navy-3 text-left cursor-pointer outline-none group">
					{me.avatarUrl ? (
						<img src={me.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover border border-white/20 shadow-xs" />
					) : (
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-semibold text-white">
							{initials}
						</div>
					)}
					<div className="min-w-0 flex-1">
						<div className="truncate font-mono text-[11px] uppercase tracking-wider text-white">
							{me.displayName ?? me.email.split("@")[0]}
						</div>
						<div className="truncate font-mono text-[10px] text-[#8f8fb8]">{me.role}</div>
					</div>
					<ChevronsUpDown className="h-3.5 w-3.5 text-[#8f8fb8] group-hover:text-white transition-colors" />
				</button>
			</DropdownMenuTrigger>

			<DropdownMenuContent side="top" align="start" className="w-56 mb-2 bg-white p-1.5 shadow-xl border border-line rounded-lg">
				<DropdownMenuItem onSelect={() => setPassOpen(true)} className="gap-2.5 font-mono text-xs uppercase tracking-wider text-ink hover:bg-paper-2 cursor-pointer">
					<ShieldCheck className="size-4 text-accent" />
					<span>{t("userMenu.accessPass", "Thẻ truy cập")}</span>
				</DropdownMenuItem>

				<DropdownMenuItem data-tour="user-settings-item" onSelect={() => setSettingsOpen(true)} className="gap-2.5 font-mono text-xs uppercase tracking-wider text-ink hover:bg-paper-2 cursor-pointer">
					<UserCog className="size-4 text-accent" />
					<span>{t("userMenu.profileSettings")}</span>
				</DropdownMenuItem>

				<DropdownMenuItem onSelect={() => { onNavigate?.(); navigate("/help"); }} className="gap-2.5 font-mono text-xs uppercase tracking-wider text-ink hover:bg-paper-2">
					<HelpCircle className="size-4" />
					<span>{t("userMenu.help")}</span>
				</DropdownMenuItem>

				<DropdownMenuItem onSelect={logout} className="gap-2.5 font-mono text-xs uppercase tracking-wider text-[#c6293b] hover:bg-[#fae8eb] focus:text-[#c6293b]">
					<Power className="size-4" />
					<span>{t("userMenu.logout")}</span>
				</DropdownMenuItem>

				<DropdownMenuSeparator className="my-1 border-t border-line" />

				<button type="button" onClick={() => setSettingsOpen(true)} className="flex w-full items-center gap-2 px-2 py-1.5 font-mono text-xs hover:bg-paper-2 rounded transition cursor-pointer text-left">
					{me.avatarUrl ? (
						<img src={me.avatarUrl} alt="" className="size-6 shrink-0 rounded-full object-cover border border-line" />
					) : (
						<div className="flex size-6 items-center justify-center rounded-xs bg-paper-2 font-mono text-[10px] font-bold text-ink">
							{initials}
						</div>
					)}
					<div className="min-w-0 flex-1">
						<div className="truncate font-mono font-semibold uppercase tracking-wider text-ink">
							{me.username ? `@${me.username}` : orgName}
						</div>
						{me.department && (
							<div className="truncate text-[9.5px] text-ink-2 font-normal">
								{me.department}
							</div>
						)}
					</div>
				</button>
			</DropdownMenuContent>
			</DropdownMenu>
			<UserSettingsDialog me={me} open={settingsOpen} onOpenChange={setSettingsOpen} />
			<ViewPassDialog me={me} open={passOpen} onOpenChange={setPassOpen} />
		</>
	);
}

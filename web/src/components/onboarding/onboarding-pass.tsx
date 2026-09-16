import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck, Sparkles, User as UserIcon } from "lucide-react";
import { OnboardingStamp } from "./onboarding-stamp";

export interface PassUserData {
	id: string;
	displayName: string;
	username: string;
	department?: string | null;
	avatarUrl?: string | null;
	role?: string;
	packageName?: string | null;
}

interface OnboardingPassProps {
	user: PassUserData;
	stamped: boolean;
	onStampImpact?: () => void;
}
export function OnboardingPass({ user, stamped, onStampImpact }: OnboardingPassProps) {
	const { t } = useTranslation();
	const shouldReduceMotion = useReducedMotion();
	const [cardShaking, setCardShaking] = useState(false);

	const handleStampLanding = () => {
		if (!shouldReduceMotion) {
			setCardShaking(true);
			setTimeout(() => setCardShaking(false), 350);
		}
		onStampImpact?.();
	};

	const passId = `MNR-${user.id.slice(0, 8).toUpperCase()}`;
	const issueDate = new Date().toISOString().slice(0, 10);

	return (
		<motion.div
			initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.96 }}
			animate={{
				opacity: 1,
				y: 0,
				scale: 1,
				x: cardShaking ? [0, -3, 3, -2, 2, 0] : 0,
			}}
			transition={{ duration: 0.45, ease: "easeOut" }}
			className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-linear-to-b from-[#181838] via-[#101026] to-[#090915] p-6 text-white shadow-2xl backdrop-blur-md"
		>
			{/* Holographic Watermark Glow */}
			<div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/25 blur-3xl" />
			<div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-red-600/15 blur-3xl" />

			{/* Security Guilloche Micro-Pattern */}
			<div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />

			{/* Header Section */}
			<div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
				<div className="flex items-center gap-2">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 border border-white/20">
						<ShieldCheck className="h-4 w-4 text-accent-bright" />
					</div>
					<div>
						<div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-bright">MNROUTER</div>
						<div className="font-mono text-[11px] font-bold tracking-wider text-white">{t("onboarding.accessCredential", "ACCESS CREDENTIAL")}</div>
					</div>
				</div>
				<div className="text-right">
					<div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-400">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
						{t("onboarding.activeStatus", "ACTIVE")}
					</div>
					<div className="font-mono text-[9px] text-white/50 mt-0.5">{passId}</div>
				</div>
			</div>

			{/* User Profile Summary */}
			<div className="relative z-10 my-5 flex items-center gap-4">
				<div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-white/20 bg-white/5 overflow-hidden shadow-inner">
					{user.avatarUrl ? (
						<img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
					) : (
						<div className="flex h-full w-full items-center justify-center bg-accent/20 text-accent-bright font-mono text-xl font-bold">
							{user.displayName.slice(0, 2).toUpperCase() || <UserIcon className="h-8 w-8 text-white/40" />}
						</div>
					)}
					<div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#101026]">
						<Sparkles className="h-2.5 w-2.5 text-white" />
					</div>
				</div>

				<div className="min-w-0 flex-1">
					<h3 className="truncate font-sans text-lg font-bold tracking-tight text-white">{user.displayName}</h3>
					<div className="font-mono text-xs text-accent-bright">@{user.username}</div>
					{user.department && (
						<div className="mt-1 inline-block truncate rounded bg-white/10 px-2 py-0.5 font-mono text-[10.5px] text-white/80 border border-white/10">
							{user.department}
						</div>
					)}
				</div>
			</div>

			{/* Credential Attributes Grid */}
			<div className="relative z-10 grid grid-cols-2 gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 font-mono text-[10px]">
				<div>
					<div className="uppercase tracking-wider text-white/40">{t("onboarding.organization", "ORGANIZATION")}</div>
					<div className="font-semibold text-white/90 truncate">mncuchiinhuttt.dev</div>
				</div>
				<div>
					<div className="uppercase tracking-wider text-white/40">{t("onboarding.rolePackage", "ROLE / PACKAGE")}</div>
					<div className="font-semibold text-white/90 truncate">{user.packageName || (user.role === "admin" ? "ADMINISTRATOR" : "STANDARD")}</div>
				</div>
				<div>
					<div className="uppercase tracking-wider text-white/40">{t("onboarding.issueDate", "ISSUE DATE")}</div>
					<div className="font-semibold text-white/90">{issueDate}</div>
				</div>
				<div>
					<div className="uppercase tracking-wider text-white/40">{t("onboarding.authority", "AUTHORITY")}</div>
					<div className="font-semibold text-accent-bright truncate">MNCUCHIINHUTTT</div>
				</div>
			</div>

			{/* Barcode & Security Microstrip */}
			<div className="relative z-10 mt-4 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[9px] text-white/40">
				<div className="flex gap-1 items-center">
					<span className="h-4 w-1 bg-white/30 rounded-xs" />
					<span className="h-4 w-2 bg-white/50 rounded-xs" />
					<span className="h-4 w-0.5 bg-white/20 rounded-xs" />
					<span className="h-4 w-1.5 bg-white/40 rounded-xs" />
					<span className="h-4 w-3 bg-white/60 rounded-xs" />
					<span className="h-4 w-1 bg-white/30 rounded-xs" />
					<span className="h-4 w-2 bg-white/50 rounded-xs" />
				</div>
				<div className="tracking-[0.18em]">{t("onboarding.securedBy", "SECURED BY MNROUTER GATEWAY")}</div>
			</div>

			{/* The Official Mộc Stamp ("Đóng Mộc") */}
			{stamped && (
				<div className="absolute -bottom-4 -right-4 z-30">
					<OnboardingStamp onImpact={handleStampLanding} />
				</div>
			)}
		</motion.div>
	);
}

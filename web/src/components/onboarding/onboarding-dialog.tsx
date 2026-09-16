import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, AtSign, Building2, CheckCircle2, Sparkles, Upload, User, X } from "lucide-react";
import { Button } from "@web/components/ui/button";
import { Input, Label } from "@web/components/ui/primitives";
import { apiJson } from "@web/lib/api";
import type { Me } from "@web/components/shell";
import { OnboardingPass, type PassUserData } from "./onboarding-pass";

export function OnboardingDialog({ me, open, onComplete }: { me: Me; open: boolean; onComplete: () => void }) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [step, setStep] = useState<"form" | "pass">("form");
	const [loading, setLoading] = useState(false);
	const [stamped, setStamped] = useState(false);

	const [displayName, setDisplayName] = useState(me.displayName || "");
	const defaultU = (me.username || me.email.split("@")[0] || "").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 20);
	const [username, setUsername] = useState(defaultU);
	const [department, setDepartment] = useState(me.department || "");
	const [avatarUrl, setAvatarUrl] = useState<string | null>(me.avatarUrl || null);
	const [passUser, setPassUser] = useState<PassUserData | null>(null);

	if (!open) return null;

	const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) {
			toast.error(t("onboarding.photoSizeLimit"));
			return;
		}
		const reader = new FileReader();
		reader.onload = () => setAvatarUrl(reader.result as string);
		reader.readAsDataURL(file);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedName = displayName.trim();
		const cleanUser = username.trim().toLowerCase().replace(/^@+/, "");

		if (!trimmedName) {
			toast.error(t("onboarding.nameRequired"));
			return;
		}
		if (!cleanUser || !/^[a-zA-Z0-9_.-]{3,30}$/.test(cleanUser)) {
			toast.error(t("onboarding.usernameValidation"));
			return;
		}

		setLoading(true);
		try {
			const res = await apiJson<{ ok: boolean; user: PassUserData }>("/api/me/onboard", "POST", {
				displayName: trimmedName,
				username: cleanUser,
				department: department.trim() || null,
				avatarUrl,
			});
			setPassUser(res.user);
			setStep("pass");
			setTimeout(() => setStamped(true), 250);
			toast.success(t("onboarding.savedToast"));
		} catch (err) {
			const msg = (err as Error).message;
			if (msg === "username_taken") {
				toast.error(t("onboarding.usernameTaken"));
			} else {
				toast.error(msg);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleFinish = async () => {
		await qc.invalidateQueries({ queryKey: ["me"] });
		onComplete();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
			<div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-paper text-ink shadow-2xl">
				{step === "form" ? (
					<form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5">
						<div className="space-y-1.5 text-center sm:text-left">
							<div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-accent border border-accent/20">
								<Sparkles className="h-3 w-3" /> {t("onboarding.chip")}
							</div>
							<h2 className="font-sans text-xl font-bold tracking-tight text-ink">{t("onboarding.title")}</h2>
							<p className="text-xs text-ink-2">{t("onboarding.subtitle")}</p>
						</div>

						{/* Avatar Picker */}
						<div className="flex items-center gap-4 rounded-xl border border-line bg-white p-3.5 shadow-2xs">
							<div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line bg-paper-2 overflow-hidden">
								{avatarUrl ? (
									<img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
								) : (
									<User className="h-6 w-6 text-ink-2" />
								)}
							</div>
							<div className="space-y-1 text-xs">
								<div className="font-medium text-ink">{t("onboarding.avatar")}</div>
								<div className="flex items-center gap-2">
									<label className="inline-flex cursor-pointer items-center gap-1 rounded border border-line bg-paper px-2 py-1 font-mono text-[11px] text-ink hover:bg-paper-2">
										<Upload className="h-3 w-3 text-accent" /> {t("onboarding.uploadPhoto")}
										<input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
									</label>
									{avatarUrl && (
										<button type="button" onClick={() => setAvatarUrl(null)} className="font-mono text-[11px] text-[#c6293b] hover:underline">
											<X className="inline h-3 w-3" /> {t("onboarding.removePhoto")}
										</button>
									)}
								</div>
							</div>
						</div>

						{/* Name & Username */}
						<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
							<div className="space-y-1">
								<Label className="flex items-center gap-1 text-[11px] font-mono text-ink-2">
									<User className="h-3 w-3 text-accent" /> {t("onboarding.displayName")} *
								</Label>
								<Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex Morgan" required className="h-8.5 font-sans text-xs" />
							</div>
							<div className="space-y-1">
								<Label className="flex items-center gap-1 text-[11px] font-mono text-ink-2">
									<AtSign className="h-3 w-3 text-accent" /> {t("onboarding.username")} *
								</Label>
								<Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="alex_dev" required className="h-8.5 font-mono text-xs" />
							</div>
						</div>

						{/* Department */}
						<div className="space-y-1.5">
							<Label className="flex items-center gap-1 text-[11px] font-mono text-ink-2">
								<Building2 className="h-3 w-3 text-accent" /> {t("onboarding.department")}
							</Label>
							<Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering & AI Team" className="h-8.5 font-sans text-xs" />
						</div>

						<Button type="submit" disabled={loading} className="w-full h-9 font-mono text-xs uppercase tracking-wider gap-2">
							{loading ? t("onboarding.processing") : t("onboarding.continue")} <ArrowRight className="h-3.5 w-3.5" />
						</Button>
					</form>
				) : (
					<div className="p-6 sm:p-7 flex flex-col items-center text-center space-y-5">
						<div className="space-y-1">
							<div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-600 border border-emerald-500/20">
								<CheckCircle2 className="h-3.5 w-3.5" /> {t("onboarding.successChip")}
							</div>
							<h2 className="font-sans text-xl font-bold text-ink">{t("onboarding.readyTitle")}</h2>
							<p className="text-xs text-ink-2">{t("onboarding.readySubtitle")}</p>
						</div>

						{/* Render Access Pass Card with Stamp */}
						{passUser && (
							<div className="w-full flex justify-center py-2">
								<OnboardingPass user={passUser} stamped={stamped} />
							</div>
						)}

						<Button onClick={handleFinish} className="w-full h-10 font-mono text-xs uppercase tracking-wider gap-2 shadow-lg">
							{t("onboarding.start")} <ArrowRight className="h-4 w-4" />
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}

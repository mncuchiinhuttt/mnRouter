import { useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "../App";
import { apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/primitives";
import { toast } from "sonner";

export default function Login() {
	const { t } = useTranslation();
	const { data, isLoading } = useMe();
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const [busy, setBusy] = useState(false);

	if (isLoading) return null;
	if (data) return <Navigate to="/" replace />;

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		try {
			const res = await apiJson<{ message: string }>("/api/auth/magic-link", "POST", { email });
			setSent(true);
			toast.success(t("login.sentToast"));
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex min-h-[100dvh] flex-col bg-navy lg:flex-row">
			<div className="halftone flex flex-col justify-between p-8 sm:p-12 lg:min-h-[100dvh] lg:flex-1 lg:p-14">
				<div className="font-mono text-[15px] font-semibold tracking-[0.08em] text-white">
					MN <span className="text-accent-bright">//</span> ROUTER
				</div>
				<div className="py-14 lg:py-0">
					<h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl lg:leading-[1.02]">
						{t("login.hero1")}
						<br />
						{t("login.hero2")}
						<br />
						<span className="text-accent-bright">{t("login.hero3")}</span>
					</h1>
					<p className="mt-6 max-w-md text-[15px] leading-relaxed text-[#a3a3cc]">{t("login.heroDesc")}</p>
				</div>
				<div className="label-mono hidden text-[#6a6a96] lg:block">{t("login.footer")}</div>
			</div>

			<div className="flex flex-1 items-center justify-center bg-paper p-6 sm:p-8">
				<div className="w-full max-w-sm">
					<div className="mb-8 flex items-center gap-3 lg:hidden">
						<div className="flex h-10 w-10 items-center justify-center rounded-md bg-navy font-mono text-xs font-semibold text-white">MN</div>
						<span className="font-mono text-sm font-semibold tracking-[0.08em]">ROUTER</span>
					</div>
					<h2 className="text-3xl font-semibold tracking-tight">{t("login.title")}</h2>
					<p className="mt-2 text-sm leading-relaxed text-ink-2">{t("login.desc")}</p>

					{sent ? (
						<div className="mt-8 rounded-lg border border-line bg-white p-5">
							<div className="label-mono mb-2 text-accent">{t("login.sentLabel")}</div>
							<p className="text-sm leading-relaxed text-ink">
								{t("login.sentTitle")} <b>{email}</b>. {t("login.sentBody")}
							</p>
							<button onClick={() => setSent(false)} className="label-mono mt-4 text-accent hover:underline cursor-pointer">
								{t("login.useOtherEmail")}
							</button>
						</div>
					) : (
						<form onSubmit={submit} className="mt-8 space-y-3">
							<label className="label-mono block text-ink-2" htmlFor="email">
								{t("login.emailLabel")}
							</label>
							<Input
								id="email"
								type="email"
								required
								placeholder={t("login.emailPlaceholder")}
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								autoFocus
							/>
							<Button type="submit" className="w-full" size="lg" disabled={busy}>
								{busy ? t("login.sending") : t("login.sendLink")}
							</Button>
							<p className="pt-1 text-xs text-ink-2">{t("login.noAccount")}</p>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}

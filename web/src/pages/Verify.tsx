import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Input, Label } from "@web/components/ui/primitives";

type VerifyState = "ready" | "verifying" | "ok" | "error";

export default function Verify() {
	const { t } = useTranslation();
	const [params] = useSearchParams();
	const location = useLocation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const isInvitation = location.pathname === "/invite/accept";
	const started = useRef(false);
	const [state, setState] = useState<VerifyState>(isInvitation ? "ready" : "verifying");
	const [message, setMessage] = useState("");
	const [displayName, setDisplayName] = useState("");

	useEffect(() => {
		const token = params.get("token");
		if (!token) {
			setState("error");
			setMessage(t(isInvitation ? "invite.invalid" : "verify.invalid"));
			return;
		}
		if (isInvitation || started.current) return;
		started.current = true;
		void apiJson<{ user: { role: string } }>("/api/auth/verify", "POST", { token })
			.then(() => {
				queryClient.removeQueries({ queryKey: ["me"] });
				setState("ok");
				setTimeout(() => navigate("/", { replace: true }), 600);
			})
			.catch((err: Error) => {
				setState("error");
				setMessage(err.message);
			});
	}, [params, navigate, queryClient, t, isInvitation]);

	const accept = async (event: React.FormEvent) => {
		event.preventDefault();
		const token = params.get("token");
		if (!token) return;
		setState("verifying");
		try {
			await apiJson("/api/auth/invitations/accept", "POST", { token, displayName: displayName.trim() || undefined });
			queryClient.removeQueries({ queryKey: ["me"] });
			setState("ok");
			setTimeout(() => navigate("/", { replace: true }), 600);
		} catch (err) {
			setState("error");
			setMessage((err as Error).message);
		}
	};

	return (
		<div className="flex min-h-[100dvh] items-center justify-center bg-navy p-6">
			<div className="w-full max-w-sm rounded-lg border border-[#2a2a52] bg-navy-2 p-8 text-center">
				<div className="label-mono mb-3 text-accent-bright">{t(isInvitation ? "invite.label" : "verify.label")}</div>
				{state === "ready" && (
					<form onSubmit={accept} className="space-y-4 text-left">
						<p className="text-sm leading-relaxed text-[#c3c3e8]">{t("invite.description")}</p>
						<div>
							<Label className="text-[#b9b9dd]" htmlFor="invite-display-name">
								{t("invite.displayName")}
							</Label>
							<Input id="invite-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t("invite.displayNamePlaceholder")} autoFocus />
						</div>
						<Button type="submit" className="w-full">
							{t("invite.accept")}
						</Button>
					</form>
				)}
				{state === "verifying" && <p className="text-sm text-[#c3c3e8]">{t(isInvitation ? "invite.accepting" : "verify.verifying")}</p>}
				{state === "ok" && <p className="text-sm text-[#c3c3e8]">{t(isInvitation ? "invite.success" : "verify.success")}</p>}
				{state === "error" && (
					<>
						<p className="text-sm text-[#ff8f9d]">{message || t(isInvitation ? "invite.invalid" : "verify.invalid")}</p>
						<button onClick={() => navigate("/login")} className="label-mono mt-4 text-accent-bright hover:underline cursor-pointer">
							{t("verify.backToLogin")}
						</button>
					</>
				)}
			</div>
		</div>
	);
}

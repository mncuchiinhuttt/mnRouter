import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { apiJson } from "@web/lib/api";

export default function Verify() {
	const { t } = useTranslation();
	const [params] = useSearchParams();
	const navigate = useNavigate();
	const [state, setState] = useState<"verifying" | "ok" | "error">("verifying");
	const [message, setMessage] = useState("");

	useEffect(() => {
		const token = params.get("token");
		if (!token) {
			setState("error");
			setMessage(t("verify.invalid"));
			return;
		}
		apiJson<{ user: { role: string } }>("/api/auth/verify", "POST", { token })
			.then(() => {
				setState("ok");
				setTimeout(() => navigate("/", { replace: true }), 600);
			})
			.catch((err: Error) => {
				setState("error");
				setMessage(err.message);
			});
	}, [params, navigate, t]);

	return (
		<div className="flex min-h-[100dvh] items-center justify-center bg-navy p-6">
			<div className="w-full max-w-sm rounded-lg border border-[#2a2a52] bg-navy-2 p-8 text-center">
				<div className="label-mono mb-3 text-accent-bright">{t("verify.label")}</div>
				{state === "verifying" && <p className="text-sm text-[#c3c3e8]">{t("verify.verifying")}</p>}
				{state === "ok" && <p className="text-sm text-[#c3c3e8]">{t("verify.success")}</p>}
				{state === "error" && (
					<>
						<p className="text-sm text-[#ff8f9d]">{message || t("verify.invalid")}</p>
						<button onClick={() => navigate("/login")} className="label-mono mt-4 text-accent-bright hover:underline cursor-pointer">
							{t("verify.backToLogin")}
						</button>
					</>
				)}
			</div>
		</div>
	);
}

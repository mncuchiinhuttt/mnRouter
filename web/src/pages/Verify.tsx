import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { apiJson } from "@web/lib/api";

export default function Verify() {
	const [params] = useSearchParams();
	const navigate = useNavigate();
	const [state, setState] = useState<"verifying" | "ok" | "error">("verifying");
	const [message, setMessage] = useState("");

	useEffect(() => {
		const token = params.get("token");
		if (!token) {
			setState("error");
			setMessage("Thiếu token trong link.");
			return;
		}
		apiJson<{ user: { role: string } }>("/api/auth/verify", "POST", { token })
			.then((res) => {
				setState("ok");
				setTimeout(() => navigate("/", { replace: true }), 600);
				void res;
			})
			.catch((err: Error) => {
				setState("error");
				setMessage(err.message);
			});
	}, [params, navigate]);

	return (
		<div className="flex min-h-[100dvh] items-center justify-center bg-navy p-8">
			<div className="w-full max-w-sm rounded-lg border border-[#2a2a52] bg-navy-2 p-8 text-center">
				<div className="label-mono mb-3 text-accent-bright">auth</div>
				{state === "verifying" && <p className="text-sm text-[#c3c3e8]">Đang xác thực magic link…</p>}
				{state === "ok" && <p className="text-sm text-[#c3c3e8]">Thành công! Đang đưa bạn vào portal…</p>}
				{state === "error" && (
					<>
						<p className="text-sm text-[#ff8f9d]">Link không hợp lệ hoặc đã hết hạn.</p>
						<button onClick={() => navigate("/login")} className="label-mono mt-4 text-accent-bright hover:underline cursor-pointer">
							← quay lại đăng nhập
						</button>
					</>
				)}
			</div>
		</div>
	);
}

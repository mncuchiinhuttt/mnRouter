import { useState } from "react";
import { Navigate } from "react-router";
import { useMe } from "../App";
import { apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/primitives";
import { toast } from "sonner";

export default function Login() {
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
			toast.success(res.message);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex min-h-[100dvh] bg-navy">
			<div className="halftone hidden flex-1 flex-col justify-between p-14 lg:flex">
				<div className="font-mono text-[15px] font-semibold tracking-[0.08em] text-white">
					MN <span className="text-accent-bright">//</span> ROUTER
				</div>
				<div>
					<h1 className="max-w-xl text-6xl font-semibold leading-[1.02] tracking-tight text-white">
						One key.
						<br />
						Every model.
						<br />
						<span className="text-accent-bright">Zero chaos.</span>
					</h1>
					<p className="mt-6 max-w-md text-base leading-relaxed text-[#a3a3cc]">
						Gateway nội bộ chuẩn hoá Claude, ChatGPT/Codex, Gemini/Antigravity và Kiro vào một API duy nhất.
					</p>
				</div>
				<div className="label-mono text-[#6a6a96]">internal use only · mncuchiinhuttt.dev</div>
			</div>

			<div className="flex flex-1 items-center justify-center bg-paper p-8">
				<div className="w-full max-w-sm">
					<div className="mb-8 flex items-center gap-3 lg:hidden">
						<div className="flex h-10 w-10 items-center justify-center rounded-md bg-navy font-mono text-xs font-semibold text-white">MN</div>
						<span className="font-mono text-sm font-semibold tracking-[0.08em]">ROUTER</span>
					</div>
					<h2 className="text-3xl font-semibold tracking-tight">Đăng nhập</h2>
					<p className="mt-2 text-sm leading-relaxed text-ink-2">
						Nhập email đã được admin cấp. Chúng tôi gửi một magic link — bấm vào là vào ngay, không cần mật khẩu.
					</p>

					{sent ? (
						<div className="mt-8 rounded-lg border border-line bg-white p-5">
							<div className="label-mono mb-2 text-accent">check your inbox</div>
							<p className="text-sm leading-relaxed text-ink">
								Magic link đã được gửi tới <b>{email}</b>. Link hết hạn sau 15 phút và chỉ dùng được một lần.
							</p>
							<button onClick={() => setSent(false)} className="label-mono mt-4 text-accent hover:underline cursor-pointer">
								← dùng email khác
							</button>
						</div>
					) : (
						<form onSubmit={submit} className="mt-8 space-y-3">
							<label className="label-mono block text-ink-2" htmlFor="email">
								Email
							</label>
							<Input
								id="email"
								type="email"
								required
								placeholder="you@mncuchiinhuttt.dev"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								autoFocus
							/>
							<Button type="submit" className="w-full" size="lg" disabled={busy}>
								{busy ? "Đang gửi…" : "Gửi magic link"}
							</Button>
							<p className="pt-1 text-xs text-ink-2">Không có tài khoản? Admin phải tạo trước — hệ thống không mở đăng ký.</p>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}

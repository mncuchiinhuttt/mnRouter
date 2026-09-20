import { useState } from "react";
import { CheckCircle2, XCircle, Stethoscope, Copy, Check, Terminal, Zap } from "lucide-react";
import { Button } from "@web/components/ui/button";
import { toast } from "sonner";

interface HarnessDoctorPanelProps {
	baseUrl: string;
	apiKey: string;
}

export function HarnessDoctorPanel({ baseUrl, apiKey }: HarnessDoctorPanelProps) {
	const [isRunning, setIsRunning] = useState(false);
	const [copied, setCopied] = useState(false);
	const [result, setResult] = useState<{
		gatewayOk: boolean;
		authOk: boolean;
		latencyMs: number;
		modelCount: number;
	} | null>(null);

	const effectiveKey = apiKey.trim() || "mr_YOUR_API_KEY";
	const doctorCmd = `curl -fsSL "${baseUrl}/doctor.sh?key=${effectiveKey}" | bash`;

	const runDiagnostics = async () => {
		setIsRunning(true);
		const start = Date.now();
		try {
			// 1. Test Gateway Health
			const healthRes = await fetch(`${baseUrl}/healthz`, { method: "GET" });
			const gatewayOk = healthRes.ok;

			// 2. Test Auth with Models
			let authOk = false;
			let modelCount = 0;
			if (apiKey.trim()) {
				const modelsRes = await fetch(`${baseUrl}/v1/models`, {
					headers: { Authorization: `Bearer ${apiKey.trim()}` },
				});
				if (modelsRes.ok) {
					const data = (await modelsRes.json()) as any;
					authOk = true;
					modelCount = Array.isArray(data.data) ? data.data.length : 0;
				}
			}

			const latencyMs = Date.now() - start;
			setResult({ gatewayOk, authOk, latencyMs, modelCount });
			toast.success("Đã hoàn thành chẩn đoán môi trường!");
		} catch {
			setResult({ gatewayOk: false, authOk: false, latencyMs: Date.now() - start, modelCount: 0 });
			toast.error("Không thể kết nối gateway để chẩn đoán!");
		} finally {
			setIsRunning(false);
		}
	};

	const copyCommand = () => {
		navigator.clipboard.writeText(doctorCmd);
		setCopied(true);
		toast.success("Đã sao chép lệnh Doctor CLI!");
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="rounded-xl border border-line bg-surface p-4 shadow-2xs space-y-3">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line/60 pb-3">
				<div className="flex items-center gap-2">
					<div className="flex size-7 items-center justify-center rounded-md bg-accent/10 text-accent">
						<Stethoscope className="size-4" />
					</div>
					<div>
						<h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ink">
							Harness Doctor & Diagnostics
						</h3>
						<p className="text-[11px] font-mono text-ink-2">
							Tự động chẩn đoán kết nối và phát hiện xung đột cấu hình CLI
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button
						size="sm"
						variant="outline"
						onClick={runDiagnostics}
						disabled={isRunning}
						className="h-7 text-xs font-mono gap-1.5 cursor-pointer"
					>
						<Zap className={`size-3 text-accent ${isRunning ? "animate-pulse" : ""}`} />
						<span>{isRunning ? "Diagnosing..." : "Run Web Doctor"}</span>
					</Button>
				</div>
			</div>

			{/* Diagnostics Results Cards */}
			{result && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs animate-in fade-in">
					<div className="rounded-lg border border-line/70 bg-paper p-2.5 space-y-1">
						<span className="text-[10px] text-ink-2 uppercase">Gateway Socket</span>
						<div className="flex items-center gap-1.5 font-semibold">
							{result.gatewayOk ? (
								<><CheckCircle2 className="size-3.5 text-[#1d7a33]" /><span className="text-[#1d7a33]">Online</span></>
							) : (
								<><XCircle className="size-3.5 text-[#c6293b]" /><span className="text-[#c6293b]">Unreachable</span></>
							)}
						</div>
					</div>

					<div className="rounded-lg border border-line/70 bg-paper p-2.5 space-y-1">
						<span className="text-[10px] text-ink-2 uppercase">API Key Status</span>
						<div className="flex items-center gap-1.5 font-semibold">
							{result.authOk ? (
								<><CheckCircle2 className="size-3.5 text-[#1d7a33]" /><span className="text-[#1d7a33]">Valid</span></>
							) : (
								<><XCircle className="size-3.5 text-[#c6293b]" /><span className="text-[#c6293b]">Invalid / Empty</span></>
							)}
						</div>
					</div>

					<div className="rounded-lg border border-line/70 bg-paper p-2.5 space-y-1">
						<span className="text-[10px] text-ink-2 uppercase">Available Models</span>
						<div className="font-semibold text-ink">
							{result.modelCount} models
						</div>
					</div>

					<div className="rounded-lg border border-line/70 bg-paper p-2.5 space-y-1">
						<span className="text-[10px] text-ink-2 uppercase">Round-Trip Latency</span>
						<div className="font-semibold text-ink tabular-nums">
							{result.latencyMs} ms
						</div>
					</div>
				</div>
			)}

			{/* 1-Line CLI Doctor Command */}
			<div className="flex items-center justify-between gap-2 rounded-lg bg-paper-2/70 border border-line/60 px-3 py-2 font-mono text-xs">
				<div className="flex items-center gap-2 min-w-0 flex-1">
					<Terminal className="size-3.5 text-accent shrink-0" />
					<span className="text-ink-2 shrink-0">Terminal Doctor:</span>
					<code className="text-ink truncate text-[11px]">{doctorCmd}</code>
				</div>
				<button
					type="button"
					onClick={copyCommand}
					className="flex items-center gap-1 rounded bg-surface border border-line px-2 py-1 text-[11px] font-mono text-ink-2 hover:text-ink cursor-pointer shrink-0 transition"
				>
					{copied ? <Check className="size-3 text-[#1d7a33]" /> : <Copy className="size-3" />}
					<span>{copied ? "Copied" : "Copy"}</span>
				</button>
			</div>
		</div>
	);
}

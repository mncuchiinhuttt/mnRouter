import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink, Sparkles, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@web/components/ui/button";

interface CopilotExtensionCardProps {
	baseUrl: string;
	apiKey: string;
}

export function CopilotExtensionCard({ baseUrl, apiKey }: CopilotExtensionCardProps) {
	const { i18n } = useTranslation();
	const isVi = i18n.language?.startsWith("vi");
	const [copiedField, setCopiedField] = useState<string | null>(null);

	const copyText = (field: string, text: string) => {
		navigator.clipboard.writeText(text);
		setCopiedField(field);
		toast.success(isVi ? `Đã sao chép ${field}!` : `Copied ${field}!`);
		setTimeout(() => setCopiedField(null), 2000);
	};

	const v1Url = `${baseUrl}/v1`;

	return (
		<div className="rounded-xl border border-line bg-white p-6 shadow-xs space-y-6">
			{/* Header info */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
				<div className="flex items-center gap-3 min-w-0">
					<img
						src="/harnesses/copilot.png"
						alt="GitHub Copilot"
						className="size-8 object-contain shrink-0 rounded-xs"
					/>
					<div className="min-w-0">
						<h3 className="font-sans text-base font-semibold text-ink">
							GitHub Copilot in VS Code via 9Router Extension
						</h3>
						<p className="text-xs text-ink-2 truncate">
							{isVi
								? "Dùng trực tiếp mô hình AI của mnRouter trong khung Copilot Chat mà không cần cài proxy/root cert"
								: "Native custom model provider inside GitHub Copilot Chat without MITM proxy or root certificates"}
						</p>
					</div>
				</div>
				<span className="font-mono text-[10px] uppercase tracking-wider rounded bg-paper-2 border border-line px-2.5 py-1 text-ink-2 shrink-0 w-fit">
					VS Code Extension
				</span>
			</div>

			{/* Step 1 */}
			<div className="flex items-start gap-3.5">
				<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-white font-mono text-xs font-bold">
					1
				</div>
				<div className="space-y-1.5 flex-1 min-w-0">
					<h4 className="text-sm font-semibold text-ink">
						{isVi ? "Cài đặt Extension trong VS Code" : "Install Extension in VS Code"}
					</h4>
					<p className="text-xs text-ink-2 leading-relaxed">
						{isVi
							? "Mở VS Code, nhấn tổ hợp phím Cmd+Shift+X (hoặc Ctrl+Shift+X trên Windows/Linux), tìm kiếm từ khoá "
							: "In VS Code, open Extensions (Cmd+Shift+X or Ctrl+Shift+X), search for "}
						<code className="font-mono font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
							9Router for Github Copilot
						</code>
						{isVi ? " và bấm Install." : " and click Install."}
					</p>
				</div>
			</div>

			{/* Step 2 */}
			<div className="flex items-start gap-3.5">
				<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-white font-mono text-xs font-bold">
					2
				</div>
				<div className="space-y-3 flex-1 min-w-0">
					<div>
						<h4 className="text-sm font-semibold text-ink">
							{isVi ? "Cấu hình Server Endpoint" : "Configure Server"}
						</h4>
						<p className="text-xs text-ink-2 leading-relaxed">
							{isVi
								? "Nhấn Cmd+Shift+P (hoặc Ctrl+Shift+P), gõ lệnh và chạy "
								: "Press Cmd+Shift+P (or Ctrl+Shift+P), run "}
							<code className="font-mono font-bold text-ink bg-paper-2 px-1.5 py-0.5 rounded border border-line">
								9Router: Configure Server
							</code>
							{isVi ? ", sau đó điền Server URL và API Key của bạn:" : ", then enter your Server URL and API Key:"}
						</p>
					</div>

					{/* Server URL field */}
					<div className="space-y-1">
						<label className="text-[11px] font-mono uppercase tracking-wider text-ink-2">Server URL</label>
						<div className="flex items-center gap-2">
							<input
								type="text"
								readOnly
								value={v1Url}
								className="h-9 flex-1 rounded border border-line bg-paper px-3 font-mono text-xs text-ink select-all focus:outline-none"
							/>
							<Button
								size="sm"
								variant="outline"
								className="h-9 px-3.5 gap-1.5 font-mono text-xs"
								onClick={() => copyText("Server URL", v1Url)}
							>
								{copiedField === "Server URL" ? <Check className="size-3.5 text-[#1d7a33]" /> : <Copy className="size-3.5" />}
								<span>{copiedField === "Server URL" ? "Copied" : "Copy"}</span>
							</Button>
						</div>
					</div>

					{/* API Key field */}
					<div className="space-y-1">
						<label className="text-[11px] font-mono uppercase tracking-wider text-ink-2">API Key</label>
						<div className="flex items-center gap-2">
							<input
								type="text"
								readOnly
								value={apiKey}
								className="h-9 flex-1 rounded border border-line bg-paper px-3 font-mono text-xs text-ink select-all focus:outline-none"
							/>
							<Button
								size="sm"
								variant="outline"
								className="h-9 px-3.5 gap-1.5 font-mono text-xs"
								onClick={() => copyText("API Key", apiKey)}
							>
								{copiedField === "API Key" ? <Check className="size-3.5 text-[#1d7a33]" /> : <Copy className="size-3.5" />}
								<span>{copiedField === "API Key" ? "Copied" : "Copy"}</span>
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Step 3 */}
			<div className="flex items-start gap-3.5">
				<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-white font-mono text-xs font-bold">
					3
				</div>
				<div className="space-y-1.5 flex-1 min-w-0">
					<h4 className="text-sm font-semibold text-ink">
						{isVi ? "Chọn Model trong Copilot Chat" : "Select Model in Copilot Chat"}
					</h4>
					<p className="text-xs text-ink-2 leading-relaxed">
						{isVi
							? "Mở cửa sổ Copilot Chat trong VS Code, bấm vào ô chọn model ở góc dưới cùng → chọn "
							: "Open Copilot Chat in VS Code, click the model selector at the bottom → select "}
						<span className="font-semibold text-ink font-mono bg-paper-2 px-1.5 py-0.5 rounded border border-line">
							Manage Models...
						</span>
						{isVi
							? " → tích chọn các model của mnRouter (như gemini-3.8-flash, claude-sonnet-4-6-ag, big-pickle) để bắt đầu sử dụng."
							: " → check the mnRouter models you want to use."}
					</p>
				</div>
			</div>
		</div>
	);
}

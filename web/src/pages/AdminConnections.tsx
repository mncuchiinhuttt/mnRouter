import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, PlugZap, RefreshCw, Link2 } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { fmtDate } from "@web/lib/utils";
import { Button } from "@web/components/ui/button";
import { Badge, Input, Label, Textarea, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Switch } from "@web/components/ui/tabs-switch";

interface ConnectionsResp {
	connections: {
		id: string;
		provider: string;
		label: string;
		priority: number;
		isActive: boolean;
		status: string;
		expiresAt: number | null;
		lastError: string | null;
		lastUsedAt: number | null;
		backoffLevel: number;
		cooldownRemainingMs: number;
		email: string | null;
	}[];
}

const PROVIDER_HELP: Record<string, string> = {
	claude: "Lấy tokens từ Claude Code (OAuth). Paste JSON: {accessToken, refreshToken, expiresAt}.",
	codex: "Lấy tokens từ Codex CLI auth.json. Paste JSON: {accessToken, refreshToken, idToken?, accountId?}.",
	antigravity: "Google OAuth của Antigravity/Gemini CLI. Paste JSON: {accessToken, refreshToken, projectId, expiresAt}.",
	kiro: "Kiro/AWS SSO. Paste JSON: {accessToken, refreshToken, expiresAt?, ssoClientId?, ssoClientSecret?, ssoRegion?}.",
};

export default function AdminConnections() {
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({ queryKey: ["connections"], queryFn: () => api<ConnectionsResp>("/api/admin/connections") });
	const [importOpen, setImportOpen] = useState(false);
	const [form, setForm] = useState({ provider: "claude", label: "", priority: 100, tokensJson: "", baseUrlOverride: "" });
	const [oauthBusy, setOauthBusy] = useState<string | null>(null);

	const invalidate = () => qc.invalidateQueries({ queryKey: ["connections"] });

	const importConn = useMutation({
		mutationFn: () =>
			apiJson("/api/admin/connections", "POST", {
				provider: form.provider,
				label: form.label || form.provider,
				priority: Number(form.priority),
				baseUrlOverride: form.baseUrlOverride || undefined,
				tokens: JSON.parse(form.tokensJson || "{}"),
			}),
		onSuccess: () => {
			invalidate();
			setImportOpen(false);
			setForm({ provider: form.provider, label: "", priority: 100, tokensJson: "", baseUrlOverride: "" });
			toast.success("Đã import connection");
		},
		onError: (e) => toast.error((e as Error).message),
	});

	const patch = useMutation({
		mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => apiJson(`/api/admin/connections/${id}`, "PATCH", body),
		onSuccess: invalidate,
		onError: (e) => toast.error((e as Error).message),
	});

	const del = useMutation({
		mutationFn: (id: string) => apiJson(`/api/admin/connections/${id}`, "DELETE", {}),
		onSuccess: invalidate,
		onError: (e) => toast.error((e as Error).message),
	});

	const test = useMutation({
		mutationFn: (id: string) => apiJson<{ ok: boolean; error?: string }>(`/api/admin/connections/${id}/test`, "POST", {}),
		onSuccess: (res) => (res.ok ? toast.success("Token OK (refresh được)") : toast.error("Test fail: " + res.error)),
		onError: (e) => toast.error((e as Error).message),
	});

	const startOauth = async (provider: string) => {
		setOauthBusy(provider);
		try {
			const res = await apiJson<{ flow: string; authorizeUrl?: string; state?: string; userCode?: string; verificationUri?: string; hint?: string }>(`/api/admin/oauth/${provider}/start`, "GET", undefined);
			if (res.flow === "device") {
				toast.message(`Kiro device code: ${res.userCode}`, { description: "Mở " + res.verificationUri + " và nhập code. Sau đó bấm Import paste state.", duration: 15000 });
				// store state for exchange
				sessionStorage.setItem("kiro-oauth-state", res.state ?? "");
			} else {
				window.open(res.authorizeUrl, "_blank");
				const code = window.prompt(res.hint ?? "Dán code từ URL redirect:");
				if (!code) return;
				const ex = await apiJson<{ ok?: boolean; pending?: boolean; error?: string }>(`/api/admin/oauth/${provider}/exchange`, "POST", { code, state: res.state });
				if (ex.pending) toast.error("Kiro chưa approve — thử lại sau vài giây");
				else if (ex.error) toast.error(ex.error);
				else {
					toast.success("Đã kết nối " + provider);
					invalidate();
				}
			}
		} catch (e) {
			toast.error((e as Error).message);
		} finally {
			setOauthBusy(null);
		}
	};

	return (
		<div className="space-y-8">
			<header className="flex items-end justify-between">
				<div>
					<h1 className="text-[44px] font-semibold leading-none tracking-tight">Connections</h1>
					<p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
						Tài khoản OAuth upstream. Router tự refresh token, failover theo priority, cooldown khi lỗi.
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => startOauth("claude")} disabled={oauthBusy !== null}>
						<Link2 /> OAuth Claude
					</Button>
					<Button variant="outline" onClick={() => startOauth("kiro")} disabled={oauthBusy !== null}>
						<Link2 /> OAuth Kiro
					</Button>
					<Button onClick={() => setImportOpen(true)}>
						<Plus /> Import tokens
					</Button>
				</div>
			</header>

			<div className="rounded-lg border border-line bg-white">
				<Table>
					<THead>
						<TR>
							<TH>Provider</TH>
							<TH>Label</TH>
							<TH>Priority</TH>
							<TH>Status</TH>
							<TH>Token hết hạn</TH>
							<TH>Last used</TH>
							<TH className="text-right">Actions</TH>
						</TR>
					</THead>
					<TBody>
						{isLoading && (
							<TR>
								<TD colSpan={7} className="py-8 text-center text-sm text-ink-2">Đang tải…</TD>
							</TR>
						)}
						{(data?.connections ?? []).map((conn) => (
							<TR key={conn.id}>
								<TD><Badge className="border-accent text-accent">{conn.provider.toUpperCase()}</Badge></TD>
								<TD>
									<div className="text-[13px]">{conn.label}</div>
									{conn.email && <div className="font-mono text-[11px] text-ink-2">{conn.email}</div>}
									{conn.lastError && <div className="max-w-[280px] truncate font-mono text-[11px] text-[#c6293b]" title={conn.lastError}>{conn.lastError}</div>}
								</TD>
								<TD>
									<Input
										className="h-7 w-16 px-2 font-mono text-[12px]"
										defaultValue={conn.priority}
										onBlur={(e) => {
											const v = Number(e.target.value);
											if (v !== conn.priority) patch.mutate({ id: conn.id, priority: v });
										}}
									/>
								</TD>
								<TD>
									<div className="flex items-center gap-2">
										<Switch checked={conn.isActive} onCheckedChange={(v) => patch.mutate({ id: conn.id, isActive: v })} />
										{conn.status === "cooldown" && <Badge className="border-[#e8d3a1] text-[#9a6b0a]">COOLDOWN {Math.ceil(conn.cooldownRemainingMs / 1000)}s</Badge>}
										{conn.status === "expired" && <Badge className="border-[#e5bfc4] text-[#c6293b]">EXPIRED</Badge>}
										{conn.status === "active" && conn.isActive && <Badge className="border-[#bcd9c0] text-[#1d7a33]">OK</Badge>}
									</div>
								</TD>
								<TD className="font-mono text-[12px] text-ink-2">{conn.expiresAt ? fmtDate(new Date(conn.expiresAt)) : "—"}</TD>
								<TD className="font-mono text-[12px] text-ink-2">{conn.lastUsedAt ? fmtDate(new Date(conn.lastUsedAt)) : "—"}</TD>
								<TD>
									<div className="flex justify-end gap-1">
										<Button size="icon" variant="ghost" title="Refresh token ngay" onClick={() => test.mutate(conn.id)}>
											<RefreshCw />
										</Button>
										<Button size="icon" variant="ghost" title="Reset health/cooldown" onClick={() => patch.mutate({ id: conn.id, resetHealth: true })}>
											<PlugZap />
										</Button>
										<Button size="icon" variant="ghost" title="Xoá" onClick={() => del.mutate(conn.id)}>
											<Trash2 className="text-[#c6293b]" />
										</Button>
									</div>
								</TD>
							</TR>
						))}
						{!isLoading && (data?.connections.length ?? 0) === 0 && (
							<TR>
								<TD colSpan={7} className="py-10 text-center text-sm text-ink-2">Chưa có connection — import token hoặc dùng OAuth ở trên.</TD>
							</TR>
						)}
					</TBody>
				</Table>
			</div>

			{/* import dialog */}
			<Dialog open={importOpen} onOpenChange={setImportOpen}>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>Import connection</DialogTitle>
						<DialogDescription>{PROVIDER_HELP[form.provider]}</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="grid grid-cols-3 gap-3">
							<div>
								<Label>Provider</Label>
								<select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="h-9 w-full rounded-sm border border-line bg-white px-3 text-sm">
									<option value="claude">claude</option>
									<option value="codex">codex</option>
									<option value="antigravity">antigravity</option>
									<option value="kiro">kiro</option>
								</select>
							</div>
							<div>
								<Label>Label</Label>
								<Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="acc-1" />
							</div>
							<div>
								<Label>Priority (thấp = ưu tiên)</Label>
								<Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
							</div>
						</div>
						<div>
							<Label>Tokens JSON</Label>
							<Textarea
								rows={6}
								value={form.tokensJson}
								onChange={(e) => setForm({ ...form, tokensJson: e.target.value })}
								placeholder={'{\n  "accessToken": "...",\n  "refreshToken": "...",\n  "expiresAt": 1730000000000\n}'}
							/>
						</div>
						<div>
							<Label>Base URL override (để test/mock — bỏ trống là chuẩn)</Label>
							<Input value={form.baseUrlOverride} onChange={(e) => setForm({ ...form, baseUrlOverride: e.target.value })} placeholder="http://127.0.0.1:9991" />
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setImportOpen(false)}>Hủy</Button>
						<Button onClick={() => importConn.mutate()} disabled={importConn.isPending}>Import</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

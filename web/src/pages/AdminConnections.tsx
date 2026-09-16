import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, PlugZap, RefreshCw, Link2 } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { fmtDate } from "@web/lib/utils";
import { Button } from "@web/components/ui/button";
import { Badge, Input, Label, Textarea, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Switch } from "@web/components/ui/tabs-switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@web/components/ui/dropdown-menu";

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

export default function AdminConnections() {
	const { t } = useTranslation();
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
			toast.success(t("adminConnections.imported"));
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
		onSuccess: (res) => (res.ok ? toast.success(t("adminConnections.testOk")) : toast.error(`${t("adminConnections.testFailed")}${res.error ? `: ${res.error}` : ""}`)),
		onError: (e) => toast.error((e as Error).message),
	});

	const startOauth = async (provider: string) => {
		setOauthBusy(provider);
		try {
			const res = await apiJson<{ flow: string; authorizeUrl?: string; state?: string; userCode?: string; verificationUri?: string; hint?: string }>(`/api/admin/oauth/${provider}/start`, "GET", undefined);
			if (res.flow === "device") {
				toast.message(`${t("adminConnections.kiroDeviceCode")}: ${res.userCode}`, { description: `${t("adminConnections.kiroOpenUrl")} ${res.verificationUri}`, duration: 15000 });
				sessionStorage.setItem("kiro-oauth-state", res.state ?? "");
			} else {
				window.open(res.authorizeUrl, "_blank");
				const code = window.prompt(res.hint ?? t("adminConnections.oauthCodePrompt"));
				if (!code) return;
				const ex = await apiJson<{ ok?: boolean; pending?: boolean; error?: string }>(`/api/admin/oauth/${provider}/exchange`, "POST", { code, state: res.state });
				if (ex.pending) toast.error(t("adminConnections.oauthNotApproved"));
				else if (ex.error) toast.error(ex.error);
				else {
					toast.success(`${t("adminConnections.oauthConnected")} ${provider}`);
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
			<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("adminConnections.title")}</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("adminConnections.desc")}</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button disabled={oauthBusy !== null} className="min-w-[132px]">
							<Link2 /> {t("adminConnections.connect")}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-64">
						<DropdownMenuLabel>{t("adminConnections.connectWith")}</DropdownMenuLabel>
						<DropdownMenuItem onSelect={() => void startOauth("claude")}><Link2 /> {t("adminConnections.oauthClaude")}</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => setImportOpen(true)}><Plus /> {t("adminConnections.importTokens")}</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</header>

			<div className="rounded-lg border border-line bg-white">
				<Table>
					<THead>
						<TR>
							<TH>{t("common.provider")}</TH>
							<TH>{t("common.label")}</TH>
							<TH>{t("common.priority")}</TH>
							<TH>{t("common.status")}</TH>
							<TH>{t("adminConnections.colTokenExpiry")}</TH>
							<TH>{t("adminConnections.colLastUsed")}</TH>
							<TH className="text-right">{t("common.actions")}</TH>
						</TR>
					</THead>
					<TBody>
						{isLoading && (
							<TR>
								<TD colSpan={7} className="py-8 text-center text-sm text-ink-2">
									{t("common.loading")}
								</TD>
							</TR>
						)}
						{(data?.connections ?? []).map((conn) => (
							<TR key={conn.id}>
								<TD>
									<Badge className="border-accent text-accent">{conn.provider.toUpperCase()}</Badge>
								</TD>
								<TD>
									<div className="text-[13px]">{conn.label}</div>
									{conn.email && <div className="font-mono text-[11px] text-ink-2">{conn.email}</div>}
									{conn.lastError && (
										<div className="max-w-[280px] truncate font-mono text-[11px] text-[#c6293b]" title={conn.lastError}>
											{conn.lastError}
										</div>
									)}
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
									<div className="flex flex-wrap items-center gap-2">
										<Switch checked={conn.isActive} onCheckedChange={(v) => patch.mutate({ id: conn.id, isActive: v })} />
										{conn.status === "cooldown" && <Badge className="border-[#e8d3a1] text-[#9a6b0a]">{t("adminConnections.cooldown")} {Math.ceil(conn.cooldownRemainingMs / 1000)}s</Badge>}
										{conn.status === "expired" && <Badge className="border-[#e5bfc4] text-[#c6293b]">{t("adminConnections.expired")}</Badge>}
										{conn.status === "active" && conn.isActive && <Badge className="border-[#bcd9c0] text-[#1d7a33]">{t("adminConnections.ok")}</Badge>}
									</div>
								</TD>
								<TD className="font-mono text-[12px] text-ink-2">{conn.expiresAt ? fmtDate(new Date(conn.expiresAt)) : "—"}</TD>
								<TD className="font-mono text-[12px] text-ink-2">{conn.lastUsedAt ? fmtDate(new Date(conn.lastUsedAt)) : "—"}</TD>
								<TD>
									<div className="flex justify-end gap-1">
										<Button size="icon" variant="ghost" title={t("adminConnections.refreshTooltip")} onClick={() => test.mutate(conn.id)}>
											<RefreshCw />
										</Button>
										<Button size="icon" variant="ghost" title={t("adminConnections.resetTooltip")} onClick={() => patch.mutate({ id: conn.id, resetHealth: true })}>
											<PlugZap />
										</Button>
										<Button size="icon" variant="ghost" title={t("adminConnections.deleteTooltip")} onClick={() => del.mutate(conn.id)}>
											<Trash2 className="text-[#c6293b]" />
										</Button>
									</div>
								</TD>
							</TR>
						))}
						{!isLoading && (data?.connections.length ?? 0) === 0 && (
							<TR>
								<TD colSpan={7} className="py-10 text-center text-sm text-ink-2">
									{t("adminConnections.noConnections")}
								</TD>
							</TR>
						)}
					</TBody>
				</Table>
			</div>

			{/* import dialog */}
			<Dialog open={importOpen} onOpenChange={setImportOpen}>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>{t("adminConnections.importTitle")}</DialogTitle>
						<DialogDescription>{t(`adminConnections.help_${form.provider}`)}</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="grid gap-3 sm:grid-cols-3">
							<div>
								<Label>{t("common.provider")}</Label>
								<Select value={form.provider} onValueChange={(provider) => setForm({ ...form, provider })}>
									<SelectTrigger aria-label={t("common.provider")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="claude">Claude</SelectItem>
										<SelectItem value="codex">Codex</SelectItem>
										<SelectItem value="antigravity">Antigravity</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>{t("common.label")}</Label>
								<Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="acc-1" />
							</div>
							<div>
								<Label>{t("common.priority")}</Label>
								<Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
							</div>
						</div>
						<div>
							<Label>{t("adminConnections.tokensJson")}</Label>
							<Textarea
								rows={6}
								value={form.tokensJson}
								onChange={(e) => setForm({ ...form, tokensJson: e.target.value })}
								placeholder={'{\n  "accessToken": "...",\n  "refreshToken": "...",\n  "expiresAt": 1730000000000\n}'}
							/>
						</div>
						<div>
							<Label>{t("adminConnections.baseUrlOverride")}</Label>
							<Input value={form.baseUrlOverride} onChange={(e) => setForm({ ...form, baseUrlOverride: e.target.value })} placeholder="http://127.0.0.1:9991" />
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setImportOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button onClick={() => importConn.mutate()} disabled={importConn.isPending}>
							{t("adminConnections.importTokens")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

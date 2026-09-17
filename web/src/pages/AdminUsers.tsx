import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Infinity, KeyRound, Send, Trash2, UserRound } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { fmtCompact, fmtDate } from "@web/lib/utils";
import { Button } from "@web/components/ui/button";
import { Badge, Input, Label, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { EmailTagsInput } from "@web/components/admin/email-tags-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Switch } from "@web/components/ui/tabs-switch";
import { ModelPicker } from "@web/components/admin/model-picker";
interface ModelOption {
	id: string;
	displayName: string;
	provider: string;
	enabled: boolean;
}

interface UserRow {
	id: string;
	email: string;
	role: "admin" | "user";
	displayName: string | null;
	packageName: string | null;
	status: "active" | "disabled";
	maxApiKeys: number;
	weeklyTokenBudget?: number | null;
	weeklyCreditBudget?: number | null;
	monthlyTokenBudget?: number | null;
	monthlyCreditBudget?: number | null;
	allModels: boolean;
	createdAt: string;
	activeKeys: number;
	totalTokens: number;
	totalCredits: number;
	allowedModelCount?: number;
}

interface UserKeyItem {
	id: string;
	name: string;
	prefix: string;
	userId: string;
	createdAt: string;
	lastUsedAt: string | null;
	revokedAt: string | null;
	active: boolean;
}

interface UsersResp {
	users: UserRow[];
}

interface ModelsResp {
	models: ModelOption[];
}

interface InvitationsResp {
	invitations: {
		id: string;
		email: string;
		packageName: string | null;
		maxApiKeys: number;
		weeklyTokenBudget?: number | null;
		weeklyCreditBudget?: number | null;
		monthlyTokenBudget?: number | null;
		monthlyCreditBudget?: number | null;
		allModels: boolean;
		allowedModels: string[];
		status: "pending" | "accepted" | "revoked";
		expiresAt: string;
		acceptedAt: string | null;
		createdAt: string;
	}[];
}

interface AccessResp {
	allModels: boolean;
	modelIds: string[];
}

const EMPTY_INVITE = {
	emails: [] as string[],
	packageName: "",
	maxApiKeys: 1,
	weeklyCreditBudget: "",
	unlimitedBudget: true,
	allModels: true,
	modelIds: [] as string[],
};

function optionalNumber(value: string): number | null {
	const digits = value.replace(/\D/g, "");
	return digits ? Number(digits) : null;
}

export default function AdminUsers() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: () => api<UsersResp>("/api/admin/users") });
	const modelsQuery = useQuery({ queryKey: ["models"], queryFn: () => api<ModelsResp>("/api/admin/models") });
	const invitationsQuery = useQuery({ queryKey: ["admin-invitations"], queryFn: () => api<InvitationsResp>("/api/admin/invitations") });
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
	const [managingKeysUser, setManagingKeysUser] = useState<UserRow | null>(null);
	const userKeysQuery = useQuery({
		queryKey: ["admin-user-keys", managingKeysUser?.id],
		queryFn: () => api<{ keys: UserKeyItem[] }>(`/api/admin/users/${managingKeysUser!.id}/keys`),
		enabled: managingKeysUser !== null,
	});
	const [editing, setEditing] = useState<UserRow | null>(null);
	const [editingUnlimited, setEditingUnlimited] = useState(true);
	const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
	const [accessAllModels, setAccessAllModels] = useState(true);
	const [accessModelIds, setAccessModelIds] = useState<string[]>([]);
	const accessQuery = useQuery({
		queryKey: ["user-models", editing?.id],
		queryFn: () => api<AccessResp>(`/api/admin/users/${editing!.id}/models`),
		enabled: editing !== null,
	});

	useEffect(() => {
		if (!editing) return;
		setAccessAllModels(editing.allModels);
		setAccessModelIds([]);
		setEditingUnlimited((editing.weeklyCreditBudget ?? editing.monthlyCreditBudget) == null);
	}, [editing]);

	useEffect(() => {
		if (!accessQuery.data) return;
		setAccessAllModels(accessQuery.data.allModels);
		setAccessModelIds(accessQuery.data.modelIds);
	}, [accessQuery.data]);

	const invite = useMutation({
		mutationFn: () =>
			apiJson<{ count?: number; created?: any[]; failed?: any[]; message?: string }>("/api/admin/invitations", "POST", {
				emails: inviteForm.emails,
				packageName: inviteForm.packageName || undefined,
				maxApiKeys: Number(inviteForm.maxApiKeys),
				weeklyCreditBudget: inviteForm.unlimitedBudget ? null : optionalNumber(inviteForm.weeklyCreditBudget),
				allModels: inviteForm.allModels,
				allowedModels: inviteForm.allModels ? [] : inviteForm.modelIds,
			}),
		onSuccess: (res) => {
			qc.invalidateQueries({ queryKey: ["admin-invitations"] });
			setInviteOpen(false);
			setInviteForm({ ...EMPTY_INVITE, modelIds: [] });
			if (res.count && res.count > 1) {
				toast.success(`Successfully sent ${res.count} invitations!`);
			} else {
				toast.success(t("adminUsers.inviteSent"));
			}
			if (res.failed && res.failed.length > 0) {
				toast.error(`Skipped ${res.failed.length} email(s): ${res.failed.map((f: any) => `${f.email} (${f.reason})`).join(", ")}`);
			}
		},
		onError: (error) => toast.error((error as Error).message),
	});
	const revokeKey = useMutation({
		mutationFn: (keyId: string) => apiJson(`/api/admin/keys/${keyId}`, "DELETE", {}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin-user-keys", managingKeysUser?.id] });
			qc.invalidateQueries({ queryKey: ["admin-users"] });
			toast.success(t("adminUsers.keyRevokedToast"));
		},
		onError: (error) => toast.error((error as Error).message),
	});

	const saveUser = useMutation({
		mutationFn: async () => {
			if (!editing) throw new Error("No user selected");
			await apiJson(`/api/admin/users/${editing.id}`, "PATCH", {
				maxApiKeys: editing.maxApiKeys,
				weeklyCreditBudget: editingUnlimited ? null : (editing.weeklyCreditBudget ?? editing.monthlyCreditBudget),
				packageName: editing.packageName,
			});
			return apiJson(`/api/admin/users/${editing.id}/models`, "PUT", { allModels: accessAllModels, modelIds: accessAllModels ? [] : accessModelIds });
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin-users"] });
			qc.invalidateQueries({ queryKey: ["user-models", editing?.id] });
			setEditing(null);
			toast.success(t("adminUsers.savedToast"));
		},
		onError: (error) => toast.error((error as Error).message),
	});

	const revokeInvitation = useMutation({
		mutationFn: (id: string) => apiJson(`/api/admin/invitations/${id}`, "DELETE", {}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin-invitations"] });
			toast.success(t("adminUsers.invitationRevoked"));
		},
		onError: (error) => toast.error((error as Error).message),
	});
	const deleteUser = useMutation({
		mutationFn: (id: string) => apiJson(`/api/admin/users/${id}`, "DELETE", {}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin-users"] });
			setDeletingUser(null);
			toast.success(t("adminUsers.deletedToast"));
		},
		onError: (error) => toast.error((error as Error).message),
	});


	const models = modelsQuery.data?.models ?? [];
	const users = usersQuery.data?.users ?? [];
	const invitations = invitationsQuery.data?.invitations ?? [];

	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("adminUsers.title")}</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("adminUsers.desc")}</p>
				</div>
				<Button onClick={() => setInviteOpen(true)} className="shrink-0">
					<Send /> {t("adminUsers.invite")}
				</Button>
			</header>

			<section className="w-full overflow-hidden rounded-lg border border-line bg-white shadow-xs">
				<Table className="w-full min-w-[860px]">
					<THead>
						<TR>
							<TH className="min-w-[180px]">{t("common.email")}</TH>
							<TH className="w-[110px]">{t("adminUsers.packageName")}</TH>
							<TH className="w-[140px]">{t("adminUsers.colKeys")}</TH>
							<TH className="w-[140px]">{t("adminUsers.accessTitle")}</TH>
							<TH className="w-[120px] text-right">{t("credits.totalSpend")}</TH>
							<TH className="w-[120px]">{t("credits.weeklyBudget")}</TH>
							<TH className="w-[110px]">{t("common.status")}</TH>
							<TH className="w-[140px] text-right">{t("common.actions")}</TH>
						</TR>
					</THead>
					<TBody>
						{usersQuery.isLoading && (
							<TR>
								<TD colSpan={8} className="py-8 text-center text-sm text-ink-2">{t("common.loading")}</TD>
							</TR>
						)}
						{users.map((user) => (
							<TR key={user.id}>
								<TD>
									<div className="font-mono text-[13px]">{user.email}</div>
									<div className="text-xs text-ink-2">{user.displayName ?? user.role}</div>
								</TD>
								<TD className="font-mono text-[12px]">{user.packageName ?? "—"}</TD>
								<TD className="font-mono text-[13px]">
									<div className="flex items-center gap-2">
										<span>{user.activeKeys}/{user.maxApiKeys}</span>
										<Button
											size="sm"
											variant="outline"
											className="h-6 px-2 font-sans text-xs"
											onClick={() => setManagingKeysUser(user)}
										>
											<KeyRound className="!size-3" /> {t("adminUsers.manageKeys")}
										</Button>
									</div>
								</TD>
								<TD>
									<Badge>{user.allModels ? t("adminUsers.allModelsShort", "All Models") : t("adminUsers.selectedModelCount", { count: user.allowedModelCount ?? 0 })}</Badge>
								</TD>
								<TD className="text-right font-mono text-[13px] tabular-nums">{(Number(user.totalCredits) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} cr</TD>
								<TD className="font-mono text-[13px]">
									{(user.weeklyCreditBudget ?? user.monthlyCreditBudget) == null ? (
										<span className="text-ink-2">{t("credits.unlimited")}</span>
									) : (
										<span>{fmtCompact(user.weeklyCreditBudget ?? user.monthlyCreditBudget ?? 0)} cr</span>
									)}
								</TD>
								<TD>
									<div className="flex items-center gap-2">
										<Switch checked={user.status === "active"} onCheckedChange={(value) => void apiJson(`/api/admin/users/${user.id}`, "PATCH", { status: value ? "active" : "disabled" }).then(() => qc.invalidateQueries({ queryKey: ["admin-users"] })).catch((error) => toast.error((error as Error).message))} />
										<span className="label-mono text-ink-2">{user.status}</span>
									</div>
								</TD>
								<TD className="whitespace-nowrap text-right">
									<div className="flex items-center justify-end gap-1">
										<Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditing(user); setEditingUnlimited((user.weeklyCreditBudget ?? user.monthlyCreditBudget) == null); }}>
											<UserRound className="size-3.5" /> {t("common.edit")}
										</Button>
										<Button size="sm" variant="ghost" className="h-7 px-2 text-[#c6293b] hover:bg-[#faebec] hover:text-[#a01828]" title={t("adminUsers.deleteUser")} onClick={() => setDeletingUser(user)}>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
								</TD>
							</TR>
						))}
						{!usersQuery.isLoading && users.length === 0 && (
							<TR>
								<TD colSpan={8} className="py-10 text-center text-sm text-ink-2">{t("adminUsers.noUsers")}</TD>
							</TR>
						)}
					</TBody>
				</Table>
			</section>

			<section className="space-y-3">
				<div className="flex items-end justify-between gap-3">
					<div>
						<h2 className="text-2xl font-semibold tracking-tight">{t("adminUsers.invitationList")}</h2>
						<p className="mt-1 text-sm text-ink-2">{t("adminUsers.inviteDesc")}</p>
					</div>
					<Badge>{t("adminUsers.pendingCount", { count: invitations.filter((invitation) => invitation.status === "pending").length })}</Badge>
				</div>
				<div className="w-full overflow-hidden rounded-lg border border-line bg-white shadow-xs">
					<Table className="w-full min-w-[780px]">
						<THead>
							<TR>
								<TH>{t("common.email")}</TH>
								<TH>{t("adminUsers.packageName")}</TH>
								<TH>{t("adminUsers.accessTitle")}</TH>
								<TH>{t("adminUsers.invitationStatus")}</TH>
								<TH>{t("adminUsers.invitationExpires")}</TH>
								<TH className="text-right">{t("common.actions")}</TH>
							</TR>
						</THead>
						<TBody>
							{invitations.map((invitation) => (
								<TR key={invitation.id}>
									<TD className="font-mono text-[12px]">{invitation.email}</TD>
									<TD className="font-mono text-[12px]">{invitation.packageName ?? "—"}</TD>
									<TD><Badge>{invitation.allModels ? t("adminUsers.allModelsShort", "All Models") : t("adminUsers.selectedModelCount", { count: invitation.allowedModels.length })}</Badge></TD>
									<TD><Badge className={invitation.status === "pending" ? "border-accent text-accent" : ""}>{invitation.status}</Badge></TD>
									<TD className="font-mono text-[12px] text-ink-2">{fmtDate(invitation.expiresAt)}</TD>
									<TD className="text-right">
										{invitation.status === "pending" && <Button size="sm" variant="ghost" onClick={() => revokeInvitation.mutate(invitation.id)} disabled={revokeInvitation.isPending}>{t("adminUsers.revokeInvitation")}</Button>}
									</TD>
								</TR>
							))}
							{!invitationsQuery.isLoading && invitations.length === 0 && (
								<TR><TD colSpan={6} className="py-8 text-center text-sm text-ink-2">{t("adminUsers.noInvitations")}</TD></TR>
							)}
						</TBody>
					</Table>
				</div>
			</section>

			<Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>{t("adminUsers.inviteTitle")}</DialogTitle>
						<DialogDescription>{t("adminUsers.inviteDesc")}</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}>
						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between">
								<Label htmlFor="invite-emails">{t("adminUsers.inviteEmail")}</Label>
								{inviteForm.emails.length > 0 && (
									<span className="font-mono text-[11px] font-semibold text-[#1d7a33] bg-[#f4faf5] border border-[#bcd9c0] px-2 py-0.5 rounded">
										{inviteForm.emails.length} {inviteForm.emails.length > 1 ? "recipients" : "recipient"}
									</span>
								)}
							</div>
							<EmailTagsInput
								id="invite-emails"
								emails={inviteForm.emails}
								onChange={(emails) => setInviteForm({ ...inviteForm, emails })}
								placeholder="user@example.com (Press Enter to add, or paste multiple)"
							/>
						</div>

						<div className="grid gap-3 sm:grid-cols-3">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="invite-package" className="truncate">{t("adminUsers.packageName")}</Label>
								<Input id="invite-package" value={inviteForm.packageName} onChange={(event) => setInviteForm({ ...inviteForm, packageName: event.target.value })} placeholder={t("adminUsers.packagePlaceholder")} />
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="invite-keys" className="truncate">{t("adminUsers.maxKeys")}</Label>
								<Input id="invite-keys" type="number" min={0} max={50} value={inviteForm.maxApiKeys} onChange={(event) => setInviteForm({ ...inviteForm, maxApiKeys: Number(event.target.value) })} />
							</div>
							<div className="flex flex-col gap-1.5">
								<div className="flex items-center justify-between">
									<Label htmlFor="invite-credit-budget" className="truncate">{t("credits.creditBudget")}</Label>
									<button
										type="button"
										onClick={() => setInviteForm((prev) => ({
											...prev,
											unlimitedBudget: !prev.unlimitedBudget,
											weeklyCreditBudget: !prev.unlimitedBudget ? "" : (prev.weeklyCreditBudget || "50000"),
										}))}
										className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent hover:underline cursor-pointer"
									>
										<span className={`inline-block size-1.5 rounded-full ${inviteForm.unlimitedBudget ? "bg-[#1d7a33]" : "bg-ink-2/40"}`} />
										{inviteForm.unlimitedBudget ? t("credits.unlimitedUsage") : t("credits.setLimit")}
									</button>
								</div>
								{inviteForm.unlimitedBudget ? (
									<div className="flex h-9 items-center justify-between rounded-md border border-[#bcd9c0] bg-[#f4faf5] px-3 font-mono text-xs text-[#1d7a33]">
										<span className="flex items-center gap-1.5 font-medium">
											<Infinity className="size-4" /> {t("credits.unlimitedUsage")}
										</span>
										<button
											type="button"
											onClick={() => setInviteForm((prev) => ({ ...prev, unlimitedBudget: false, weeklyCreditBudget: "50000" }))}
											className="text-[11px] text-ink-2 hover:text-ink underline cursor-pointer"
										>
											{t("credits.setLimit")}
										</button>
									</div>
								) : (
									<div className="relative">
										<Input
											id="invite-credit-budget"
											inputMode="numeric"
											value={inviteForm.weeklyCreditBudget}
											onChange={(event) => setInviteForm({ ...inviteForm, weeklyCreditBudget: event.target.value.replace(/\D/g, "") })}
											placeholder="50000"
											className="font-mono pr-24"
										/>
										<button
											type="button"
											onClick={() => setInviteForm((prev) => ({ ...prev, unlimitedBudget: true, weeklyCreditBudget: "" }))}
											className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded bg-paper-2 px-2 py-1 font-mono text-[10.5px] text-ink-2 hover:text-ink cursor-pointer border border-line"
										>
											<Infinity className="size-3 text-[#1d7a33]" /> {t("credits.unlimited")}
										</button>
									</div>
								)}
							</div>
						</div>
						<ModelPicker models={models} allModels={inviteForm.allModels} modelIds={inviteForm.modelIds} onAllModelsChange={(value) => setInviteForm({ ...inviteForm, allModels: value })} onModelIdsChange={(value) => setInviteForm({ ...inviteForm, modelIds: value })} t={t} />
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>{t("common.cancel")}</Button>
							<Button type="submit" disabled={invite.isPending || inviteForm.emails.length === 0 || (!inviteForm.allModels && inviteForm.modelIds.length === 0)}>
								<Send />
								{inviteForm.emails.length > 1
									? `Send ${inviteForm.emails.length} invitations`
									: t("adminUsers.invite")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>{t("adminUsers.editTitle")}</DialogTitle>
						<DialogDescription>{editing?.email}</DialogDescription>
					</DialogHeader>
					{editing && (
						<div className="space-y-4">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="edit-package" className="truncate">{t("adminUsers.packageName")}</Label>
								<Input id="edit-package" value={editing.packageName ?? ""} onChange={(event) => setEditing({ ...editing, packageName: event.target.value || null })} placeholder={t("adminUsers.packagePlaceholder")} />
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="edit-keys" className="truncate">{t("adminUsers.maxKeys")}</Label>
									<Input id="edit-keys" type="number" min={0} max={50} value={editing.maxApiKeys} onChange={(event) => setEditing({ ...editing, maxApiKeys: Number(event.target.value) })} />
								</div>
								<div className="flex flex-col gap-1.5">
									<div className="flex items-center justify-between">
										<Label htmlFor="edit-credit-budget" className="truncate">{t("credits.creditBudget")}</Label>
										<button
											type="button"
											onClick={() => {
												const next = !editingUnlimited;
												setEditingUnlimited(next);
												setEditing({
													...editing,
													weeklyCreditBudget: next ? null : (editing.weeklyCreditBudget ?? editing.monthlyCreditBudget ?? 50000),
													monthlyCreditBudget: next ? null : (editing.weeklyCreditBudget ?? editing.monthlyCreditBudget ?? 50000),
												});
											}}
											className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent hover:underline cursor-pointer"
										>
											<span className={`inline-block size-1.5 rounded-full ${editingUnlimited ? "bg-[#1d7a33]" : "bg-ink-2/40"}`} />
											{editingUnlimited ? t("credits.unlimitedUsage") : t("credits.setLimit")}
										</button>
									</div>
									{editingUnlimited ? (
										<div className="flex h-9 items-center justify-between rounded-md border border-[#bcd9c0] bg-[#f4faf5] px-3 font-mono text-xs text-[#1d7a33]">
											<span className="flex items-center gap-1.5 font-medium">
												<Infinity className="size-4" /> {t("credits.unlimitedUsage")}
											</span>
											<button
												type="button"
												onClick={() => {
													setEditingUnlimited(false);
													setEditing({ ...editing, weeklyCreditBudget: 50000, monthlyCreditBudget: 50000 });
												}}
												className="text-[11px] text-ink-2 hover:text-ink underline cursor-pointer"
											>
												{t("credits.setLimit")}
											</button>
										</div>
									) : (
										<div className="relative">
											<Input
												id="edit-credit-budget"
												inputMode="numeric"
												value={editing.weeklyCreditBudget ?? editing.monthlyCreditBudget ?? ""}
												placeholder="50000"
												onChange={(event) => setEditing({ ...editing, weeklyCreditBudget: optionalNumber(event.target.value), monthlyCreditBudget: optionalNumber(event.target.value) })}
												className="font-mono pr-24"
											/>
											<button
												type="button"
												onClick={() => {
													setEditingUnlimited(true);
													setEditing({ ...editing, monthlyCreditBudget: null });
												}}
												className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded bg-paper-2 px-2 py-1 font-mono text-[10.5px] text-ink-2 hover:text-ink cursor-pointer border border-line"
											>
												<Infinity className="size-3 text-[#1d7a33]" /> {t("credits.unlimited")}
											</button>
										</div>
									)}
								</div>
							</div>
							{accessQuery.isLoading ? <div className="rounded-md bg-paper p-4 text-sm text-ink-2">{t("common.loading")}</div> : <ModelPicker models={models} allModels={accessAllModels} modelIds={accessModelIds} onAllModelsChange={setAccessAllModels} onModelIdsChange={setAccessModelIds} t={t} />}
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
						<Button onClick={() => saveUser.mutate()} disabled={saveUser.isPending || !editing || (!accessAllModels && accessModelIds.length === 0)}>{t("common.save")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* manage keys dialog */}
			<Dialog open={managingKeysUser !== null} onOpenChange={(open) => !open && setManagingKeysUser(null)}>
				<DialogContent className="max-w-5xl w-full max-h-[88vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<KeyRound className="size-5 text-accent" />
							{t("adminUsers.manageKeysTitle")} <span className="font-mono text-base font-normal">{managingKeysUser?.email}</span>
						</DialogTitle>
						<DialogDescription>
							{t("adminUsers.manageKeysDesc")}
						</DialogDescription>
					</DialogHeader>
					<div className="rounded-md border border-line bg-white overflow-x-auto">
						<Table>
							<THead>
								<TR>
									<TH>{t("keys.colKey")}</TH>
									<TH>{t("keys.colName")}</TH>
									<TH>{t("keys.colCreated")}</TH>
									<TH>{t("keys.colLastUsed")}</TH>
									<TH>{t("keys.colStatus")}</TH>
									<TH className="text-right">{t("common.actions")}</TH>
								</TR>
							</THead>
							<TBody>
								{userKeysQuery.isLoading && (
									<TR>
										<TD colSpan={6} className="py-6 text-center text-sm text-ink-2">
											{t("common.loading")}
										</TD>
									</TR>
								)}
								{(userKeysQuery.data?.keys ?? []).map((k) => (
									<TR key={k.id}>
										<TD className="font-mono text-[13px]">
											{k.prefix}
											<span className="text-ink-2">{"•".repeat(8)}</span>
										</TD>
										<TD className="text-sm">{k.name}</TD>
										<TD className="font-mono text-[12px] text-ink-2">{fmtDate(k.createdAt)}</TD>
										<TD className="font-mono text-[12px] text-ink-2">{fmtDate(k.lastUsedAt)}</TD>
										<TD>
											{k.active ? (
												<Badge className="border-[#bcd9c0] text-[#1d7a33]">{t("common.active")}</Badge>
											) : (
												<Badge className="border-[#e5bfc4] text-[#c6293b]">{t("common.revoked")}</Badge>
											)}
										</TD>
										<TD className="text-right">
											{k.active ? (
												<Button
													size="sm"
													variant="ghost"
													className="h-7 text-xs text-[#c6293b] hover:bg-[#fae8eb] hover:text-[#c6293b]"
													onClick={() => revokeKey.mutate(k.id)}
													disabled={revokeKey.isPending}
												>
													<Ban className="!size-3.5" /> {t("adminUsers.revokeKey")}
												</Button>
											) : (
												<span className="font-mono text-xs text-ink-2">—</span>
											)}
										</TD>
									</TR>
								))}
								{!userKeysQuery.isLoading && (userKeysQuery.data?.keys.length ?? 0) === 0 && (
									<TR>
										<TD colSpan={6} className="py-8 text-center text-sm text-ink-2">
											{t("adminUsers.noUserKeys")}
										</TD>
									</TR>
								)}
							</TBody>
						</Table>
					</div>
					<DialogFooter>
						<Button onClick={() => setManagingKeysUser(null)}>{t("adminUsers.done")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog open={deletingUser !== null} onOpenChange={(open) => !open && setDeletingUser(null)}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-[#c6293b]">
							<Trash2 className="size-5" /> {t("adminUsers.deleteUser")}
						</DialogTitle>
						<DialogDescription>
							{t("adminUsers.deleteConfirm", { email: deletingUser?.email })}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeletingUser(null)}>{t("common.cancel")}</Button>
						<Button
							className="bg-[#c6293b] text-white hover:bg-[#a01828]"
							disabled={deleteUser.isPending}
							onClick={() => deletingUser && deleteUser.mutate(deletingUser.id)}
						>
							{deleteUser.isPending ? t("common.loading") : t("common.delete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

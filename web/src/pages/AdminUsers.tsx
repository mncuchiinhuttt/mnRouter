import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, KeyRound, Copy } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { fmtCompact } from "@web/lib/utils";
import { Button } from "@web/components/ui/button";
import { Badge, Input, Label, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Switch } from "@web/components/ui/tabs-switch";

interface UsersResp {
	users: {
		id: string;
		email: string;
		role: "admin" | "user";
		displayName: string | null;
		status: "active" | "disabled";
		maxApiKeys: number;
		monthlyTokenBudget: number | null;
		createdAt: string;
		activeKeys: number;
		totalTokens: number;
	}[];
}

export default function AdminUsers() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => api<UsersResp>("/api/admin/users") });
	const [createOpen, setCreateOpen] = useState(false);
	const [form, setForm] = useState({ email: "", displayName: "", maxApiKeys: 1, monthlyTokenBudget: "" as string, role: "user" as "user" | "admin" });
	const [newKey, setNewKey] = useState<{ key: string; email: string } | null>(null);
	const [editing, setEditing] = useState<UsersResp["users"][number] | null>(null);

	const create = useMutation({
		mutationFn: () =>
			apiJson("/api/admin/users", "POST", {
				email: form.email,
				displayName: form.displayName || undefined,
				maxApiKeys: Number(form.maxApiKeys),
				monthlyTokenBudget: form.monthlyTokenBudget ? Number(form.monthlyTokenBudget) : null,
				role: form.role,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin-users"] });
			setCreateOpen(false);
			setForm({ email: "", displayName: "", maxApiKeys: 1, monthlyTokenBudget: "", role: "user" });
			toast.success(t("adminUsers.createdToast"));
		},
		onError: (e) => toast.error((e as Error).message),
	});

	const createKey = useMutation({
		mutationFn: (userId: string) => apiJson<{ key: string }>("/api/admin/users/" + userId + "/keys", "POST", { name: "default" }),
		onSuccess: (res, userId) => {
			const email = data?.users.find((u) => u.id === userId)?.email ?? "";
			setNewKey({ key: res.key, email });
			qc.invalidateQueries({ queryKey: ["admin-users"] });
		},
		onError: (e) => toast.error((e as Error).message),
	});

	const patchUser = useMutation({
		mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => apiJson(`/api/admin/users/${id}`, "PATCH", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin-users"] });
			setEditing(null);
			toast.success(t("adminUsers.savedToast"));
		},
		onError: (e) => toast.error((e as Error).message),
	});

	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("adminUsers.title")}</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("adminUsers.desc")}</p>
				</div>
				<Button onClick={() => setCreateOpen(true)} className="shrink-0">
					<Plus /> {t("adminUsers.create")}
				</Button>
			</header>

			<div className="rounded-lg border border-line bg-white">
				<Table>
					<THead>
						<TR>
							<TH>{t("common.email")}</TH>
							<TH>Role</TH>
							<TH>{t("adminUsers.colKeys")}</TH>
							<TH className="text-right">{t("adminUsers.colTotalTokens")}</TH>
							<TH>{t("adminUsers.colBudget")}</TH>
							<TH>{t("common.status")}</TH>
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
						{(data?.users ?? []).map((u) => (
							<TR key={u.id}>
								<TD className="font-mono text-[13px]">{u.email}</TD>
								<TD>
									<Badge className={u.role === "admin" ? "border-accent text-accent" : ""}>{u.role.toUpperCase()}</Badge>
								</TD>
								<TD className="font-mono text-[13px]">
									{u.activeKeys}/{u.maxApiKeys}
									{u.activeKeys < u.maxApiKeys && u.status === "active" && (
										<Button size="sm" variant="outline" className="ml-2 h-6 px-2" onClick={() => createKey.mutate(u.id)}>
											<KeyRound className="!size-3" /> {t("adminUsers.grantKey")}
										</Button>
									)}
								</TD>
								<TD className="text-right font-mono text-[13px] tabular-nums">{fmtCompact(u.totalTokens)}</TD>
								<TD className="font-mono text-[13px]">{u.monthlyTokenBudget ? fmtCompact(u.monthlyTokenBudget) : "∞"}</TD>
								<TD>
									<div className="flex items-center gap-2">
										<Switch checked={u.status === "active"} onCheckedChange={(v) => patchUser.mutate({ id: u.id, status: v ? "active" : "disabled" })} />
										<span className="label-mono text-ink-2">{u.status}</span>
									</div>
								</TD>
								<TD className="text-right">
									<Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
										{t("common.edit")}
									</Button>
								</TD>
							</TR>
						))}
					</TBody>
				</Table>
			</div>

			{/* create user */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("adminUsers.createTitle")}</DialogTitle>
						<DialogDescription>{t("adminUsers.createDesc")}</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div>
							<Label htmlFor="u-email">{t("common.email")}</Label>
							<Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@mncuchiinhuttt.dev" />
						</div>
						<div>
							<Label htmlFor="u-name">{t("adminUsers.displayName")}</Label>
							<Input id="u-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<Label htmlFor="u-keys">{t("adminUsers.maxKeys")}</Label>
								<Input id="u-keys" type="number" min={0} value={form.maxApiKeys} onChange={(e) => setForm({ ...form, maxApiKeys: Number(e.target.value) })} />
							</div>
							<div>
								<Label htmlFor="u-budget">{t("adminUsers.budgetLabel")}</Label>
								<Input id="u-budget" inputMode="numeric" value={form.monthlyTokenBudget} onChange={(e) => setForm({ ...form, monthlyTokenBudget: e.target.value.replace(/\D/g, "") })} placeholder={t("adminUsers.budgetPlaceholder")} />
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Label className="pt-1">{t("adminUsers.role")}</Label>
							<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "user" | "admin" })} className="h-9 rounded-sm border border-line bg-white px-3 text-sm">
								<option value="user">user</option>
								<option value="admin">admin</option>
							</select>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button onClick={() => create.mutate()} disabled={!form.email || create.isPending}>
							{t("common.create")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* edit user */}
			<Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>{t("adminUsers.editTitle")}</DialogTitle>
						<DialogDescription>{editing?.email}</DialogDescription>
					</DialogHeader>
					{editing && (
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<Label>{t("adminUsers.maxKeys")}</Label>
								<Input type="number" min={0} defaultValue={editing.maxApiKeys} onChange={(e) => setEditing({ ...editing, maxApiKeys: Number(e.target.value) })} />
							</div>
							<div>
								<Label>{t("adminUsers.budgetLabel")}</Label>
								<Input
									inputMode="numeric"
									value={editing.monthlyTokenBudget ?? ""}
									placeholder="∞"
									onChange={(e) => setEditing({ ...editing, monthlyTokenBudget: e.target.value.replace(/\D/g, "") ? Number(e.target.value.replace(/\D/g, "")) : null })}
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditing(null)}>
							{t("common.cancel")}
						</Button>
						<Button onClick={() => editing && patchUser.mutate({ id: editing.id, maxApiKeys: editing.maxApiKeys, monthlyTokenBudget: editing.monthlyTokenBudget })}>{t("common.save")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* key reveal */}
			<Dialog open={newKey !== null} onOpenChange={(o) => !o && setNewKey(null)}>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>
							{t("adminUsers.keyTitle")} {newKey?.email}
						</DialogTitle>
						<DialogDescription>{t("adminUsers.keyDesc")}</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-2 rounded-md border border-line bg-paper-2 p-3">
						<code className="flex-1 break-all font-mono text-[13px]">{newKey?.key}</code>
						<Button
							size="icon"
							variant="secondary"
							onClick={() => {
								void navigator.clipboard.writeText(newKey?.key ?? "");
								toast.success(t("common.copied"));
							}}
						>
							<Copy />
						</Button>
					</div>
					<DialogFooter>
						<Button onClick={() => setNewKey(null)}>{t("adminUsers.done")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

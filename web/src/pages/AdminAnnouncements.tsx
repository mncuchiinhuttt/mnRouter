import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Edit2, Info, Megaphone, Plus, Trash2, Wrench } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { fmtDate } from "@web/lib/utils";
import { Button } from "@web/components/ui/button";
import { Badge, Input, Label, TD, TH, TBody, THead, TR, Table, Textarea } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Switch } from "@web/components/ui/tabs-switch";

export interface AnnouncementItem {
	id: string;
	title: string;
	content: string;
	type: "info" | "warning" | "maintenance" | "success";
	active: boolean;
	expiresAt: string | null;
	createdAt: string;
}

const EMPTY_FORM: {
	title: string;
	content: string;
	type: "info" | "warning" | "maintenance" | "success";
	active: boolean;
	expiresAt: string;
} = {
	title: "",
	content: "",
	type: "info",
	active: true,
	expiresAt: "",
};

export default function AdminAnnouncements() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({
		queryKey: ["admin-announcements"],
		queryFn: () => api<{ announcements: AnnouncementItem[] }>("/api/admin/announcements"),
	});

	const [editing, setEditing] = useState<AnnouncementItem | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [form, setForm] = useState(EMPTY_FORM);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const announcements = data?.announcements ?? [];

	const openCreate = () => {
		setEditing(null);
		setForm(EMPTY_FORM);
		setIsOpen(true);
	};

	const openEdit = (item: AnnouncementItem) => {
		setEditing(item);
		setForm({
			title: item.title,
			content: item.content,
			type: item.type,
			active: item.active,
			expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : "",
		});
		setIsOpen(true);
	};

	const applyPreset = (days: number | null) => {
		if (days == null) {
			setForm((prev) => ({ ...prev, expiresAt: "" }));
			return;
		}
		const d = new Date();
		d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
		setForm((prev) => ({ ...prev, expiresAt: d.toISOString().slice(0, 16) }));
	};

	const saveMutation = useMutation({
		mutationFn: async () => {
			const payload = {
				title: form.title,
				content: form.content,
				type: form.type,
				active: form.active,
				expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
			};
			if (editing) {
				return apiJson(`/api/admin/announcements/${editing.id}`, "PATCH", payload);
			}
			return apiJson("/api/admin/announcements", "POST", payload);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin-announcements"] });
			qc.invalidateQueries({ queryKey: ["announcements"] });
			setIsOpen(false);
			toast.success(editing ? t("announcements.updatedToast") : t("announcements.createdToast"));
		},
		onError: (e) => toast.error((e as Error).message),
	});

	const toggleActive = async (item: AnnouncementItem, active: boolean) => {
		await apiJson(`/api/admin/announcements/${item.id}`, "PATCH", { active });
		qc.invalidateQueries({ queryKey: ["admin-announcements"] });
		qc.invalidateQueries({ queryKey: ["announcements"] });
	};

	const deleteMutation = useMutation({
		mutationFn: (id: string) => apiJson(`/api/admin/announcements/${id}`, "DELETE", {}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin-announcements"] });
			qc.invalidateQueries({ queryKey: ["announcements"] });
			setDeletingId(null);
			toast.success(t("announcements.deletedToast"));
		},
		onError: (e) => toast.error((e as Error).message),
	});

	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("announcements.title")}</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("announcements.desc")}</p>
				</div>
				<Button onClick={openCreate} className="shrink-0 gap-1.5"><Plus className="size-4" /> {t("announcements.create")}</Button>
			</header>

			<section className="w-full overflow-hidden rounded-lg border border-line bg-white shadow-xs">
				<Table className="w-full min-w-[800px]">
					<THead>
						<TR>
							<TH className="min-w-[220px]">{t("announcements.announcementTitle")}</TH>
							<TH className="w-[120px]">{t("announcements.type")}</TH>
							<TH className="w-[160px]">{t("announcements.expiresAt")}</TH>
							<TH className="w-[100px]">{t("announcements.status")}</TH>
							<TH className="w-[120px] text-right">{t("common.actions")}</TH>
						</TR>
					</THead>
					<TBody>
						{isLoading && <TR><TD colSpan={5} className="py-8 text-center text-sm text-ink-2">{t("common.loading")}</TD></TR>}
						{announcements.map((item) => (
							<TR key={item.id}>
								<TD>
									<div className="font-medium text-sm text-ink">{item.title}</div>
									<div className="line-clamp-1 text-xs text-ink-2 mt-0.5">{item.content}</div>
								</TD>
								<TD><TypeBadge type={item.type} t={t} /></TD>
								<TD className="font-mono text-xs text-ink-2">
									{item.expiresAt ? (
										<span className={new Date(item.expiresAt) <= new Date() ? "text-[#c6293b]" : ""}>
											{fmtDate(item.expiresAt)}
										</span>
									) : (
										<span>{t("announcements.noExpiry")}</span>
									)}
								</TD>
								<TD>
									<div className="flex items-center gap-2">
										<Switch checked={item.active} onCheckedChange={(val) => void toggleActive(item, val)} />
										<span className="label-mono text-[11px] text-ink-2">{item.active ? t("announcements.active") : t("announcements.inactive")}</span>
									</div>
								</TD>
								<TD className="text-right">
									<div className="flex items-center justify-end gap-1">
										<Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(item)}><Edit2 className="size-3.5" /></Button>
										<Button size="sm" variant="ghost" className="h-7 px-2 text-[#c6293b] hover:bg-[#faebec]" onClick={() => setDeletingId(item.id)}><Trash2 className="size-3.5" /></Button>
									</div>
								</TD>
							</TR>
						))}
						{!isLoading && announcements.length === 0 && (
							<TR><TD colSpan={5} className="py-10 text-center text-sm text-ink-2">{t("announcements.noAnnouncements")}</TD></TR>
						)}
					</TBody>
				</Table>
			</section>

			{/* Create/Edit Dialog */}
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2"><Megaphone className="size-4 text-accent" /> {editing ? t("announcements.editTitle") : t("announcements.newTitle")}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="title">{t("announcements.announcementTitle")}</Label>
							<Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("announcements.titlePlaceholder")} />
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="flex flex-col gap-1.5">
								<Label>{t("announcements.type")}</Label>
								<Select value={form.type} onValueChange={(val) => setForm({ ...form, type: val as any })}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value="info">{t("announcements.typeInfo")}</SelectItem>
										<SelectItem value="warning">{t("announcements.typeWarning")}</SelectItem>
										<SelectItem value="maintenance">{t("announcements.typeMaintenance")}</SelectItem>
										<SelectItem value="success">{t("announcements.typeSuccess")}</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>{t("announcements.status")}</Label>
								<div className="flex h-9 items-center gap-2 rounded-md border border-line px-3">
									<Switch checked={form.active} onCheckedChange={(val) => setForm({ ...form, active: val })} />
									<span className="text-xs text-ink-2">{form.active ? t("announcements.active") : t("announcements.inactive")}</span>
								</div>
							</div>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="content">{t("announcements.content")}</Label>
							<Textarea id="content" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={t("announcements.contentPlaceholder")} />
						</div>
						<div className="space-y-2 rounded-md border border-line bg-paper p-3">
							<div className="flex items-center justify-between">
								<Label className="flex items-center gap-1.5 text-xs"><Clock className="size-3.5 text-ink-2" /> {t("announcements.expiresAt")}</Label>
								{form.expiresAt && <button type="button" onClick={() => applyPreset(null)} className="font-mono text-[11px] text-[#c6293b] hover:underline cursor-pointer">Xoá hạn</button>}
							</div>
							<div className="flex flex-wrap gap-1.5">
								<Button size="sm" variant={!form.expiresAt ? "default" : "outline"} className="h-6 text-[11px] font-mono px-2" onClick={() => applyPreset(null)}>Không hết hạn</Button>
								<Button size="sm" variant="outline" className="h-6 text-[11px] font-mono px-2" onClick={() => applyPreset(1)}>+24h</Button>
								<Button size="sm" variant="outline" className="h-6 text-[11px] font-mono px-2" onClick={() => applyPreset(3)}>+3 ngày</Button>
								<Button size="sm" variant="outline" className="h-6 text-[11px] font-mono px-2" onClick={() => applyPreset(7)}>+7 ngày</Button>
								<Button size="sm" variant="outline" className="h-6 text-[11px] font-mono px-2" onClick={() => applyPreset(30)}>+30 ngày</Button>
							</div>
							<Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="h-8 font-mono text-xs" />
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsOpen(false)}>{t("common.cancel")}</Button>
						<Button disabled={!form.title.trim() || !form.content.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{t("common.save")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirm */}
			<Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-[#c6293b]"><Trash2 className="size-5" /> {t("common.delete")}</DialogTitle>
						<DialogDescription>{t("announcements.deleteConfirm")}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeletingId(null)}>{t("common.cancel")}</Button>
						<Button className="bg-[#c6293b] text-white hover:bg-[#a01828]" disabled={deleteMutation.isPending} onClick={() => deletingId && deleteMutation.mutate(deletingId)}>{t("common.delete")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function TypeBadge({ type, t }: { type: AnnouncementItem["type"]; t: (k: string) => string }) {
	const map = {
		info: { icon: Info, cls: "border-[#d5daff] bg-[#eef0ff] text-[#2323e6]", label: t("announcements.typeInfo") },
		warning: { icon: AlertTriangle, cls: "border-[#f0d49e] bg-[#fffaf0] text-[#9a6b0a]", label: t("announcements.typeWarning") },
		maintenance: { icon: Wrench, cls: "border-[#e0d4f7] bg-[#faf7fd] text-[#6b38c2]", label: t("announcements.typeMaintenance") },
		success: { icon: CheckCircle2, cls: "border-[#bcd9c0] bg-[#f4faf5] text-[#1d7a33]", label: t("announcements.typeSuccess") },
	};
	const conf = map[type] || map.info;
	const Icon = conf.icon;
	return (
		<span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider border ${conf.cls}`}>
			<Icon className="size-3" /> {conf.label}
		</span>
	);
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw, Copy, Ban } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { fmtDate } from "@web/lib/utils";
import { Button } from "@web/components/ui/button";
import { Badge, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";

interface KeysResp {
	keys: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; active: boolean }[];
	maxKeys: number;
}

export default function ApiKeys() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({ queryKey: ["my-keys"], queryFn: () => api<KeysResp>("/api/me/keys") });
	const [newKey, setNewKey] = useState<string | null>(null);
	const [confirmRotate, setConfirmRotate] = useState<string | null>(null);

	const rotate = useMutation({
		mutationFn: (id: string) => apiJson<{ key: string }>(`/api/me/keys/${id}/rotate`, "POST", {}),
		onSuccess: () => {
			setNewKey("pending");
			setConfirmRotate(null);
			qc.invalidateQueries({ queryKey: ["my-keys"] });
			toast.success(t("keys.rotateToast"));
		},
		onError: (e) => toast.error((e as Error).message),
	});

	const rotateMutationKey = rotate.data?.key;
	const revealedKey = newKey === "pending" ? rotateMutationKey ?? null : newKey;

	const revoke = useMutation({
		mutationFn: (id: string) => apiJson(`/api/me/keys/${id}/revoke`, "POST", {}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["my-keys"] });
			toast.success(t("keys.revokeToast"));
		},
		onError: (e) => toast.error((e as Error).message),
	});

	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("keys.title")}</h1>
					<p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">
						{t("keys.desc1")} <b>{t("keys.descRotate")}</b> {t("keys.desc2")} <b className="font-mono">{data?.maxKeys ?? "?"}</b>
					</p>
				</div>
				<div className="sm:text-right">
					<div className="label-mono text-ink-2">{t("keys.baseUrlLabel")}</div>
					<code className="rounded-xs bg-paper-2 px-2 py-1 font-mono text-[12px] break-all">{location.origin}/v1</code>
				</div>
			</header>

			<div className="rounded-lg border border-line bg-white">
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
						{isLoading && (
							<TR>
								<TD colSpan={6} className="py-8 text-center text-sm text-ink-2">
									{t("common.loading")}
								</TD>
							</TR>
						)}
						{(data?.keys ?? []).map((k) => (
							<TR key={k.id}>
								<TD className="font-mono text-[13px]">
									{k.prefix}
									<span className="text-ink-2">{"•".repeat(12)}</span>
								</TD>
								<TD>{k.name}</TD>
								<TD className="font-mono text-[12px] text-ink-2">{fmtDate(k.createdAt)}</TD>
								<TD className="font-mono text-[12px] text-ink-2">{fmtDate(k.lastUsedAt)}</TD>
								<TD>
									{k.active ? (
										<Badge className="border-[#bcd9c0] text-[#1d7a33]">{t("common.active")}</Badge>
									) : (
										<Badge className="border-[#e5bfc4] text-[#c6293b]">{t("common.revoked")}</Badge>
									)}
								</TD>
								<TD>
									<div className="flex justify-end gap-2">
										<Button size="sm" variant="outline" disabled={!k.active} onClick={() => setConfirmRotate(k.id)}>
											<RotateCcw /> {t("common.rotate")}
										</Button>
										<Button size="sm" variant="ghost" disabled={!k.active} onClick={() => revoke.mutate(k.id)}>
											<Ban /> {t("common.revoke")}
										</Button>
									</div>
								</TD>
							</TR>
						))}
						{!isLoading && (data?.keys.length ?? 0) === 0 && (
							<TR>
								<TD colSpan={6} className="py-10 text-center text-sm text-ink-2">
									{t("keys.noKeys")}
								</TD>
							</TR>
						)}
					</TBody>
				</Table>
			</div>

			{/* confirm rotate */}
			<Dialog open={confirmRotate !== null} onOpenChange={(o) => !o && setConfirmRotate(null)}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>{t("keys.rotateTitle")}</DialogTitle>
						<DialogDescription>{t("keys.rotateDesc")}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmRotate(null)}>
							{t("common.cancel")}
						</Button>
						<Button onClick={() => confirmRotate && rotate.mutate(confirmRotate)}>{t("common.rotateNow")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* new key reveal */}
			<Dialog open={revealedKey !== null} onOpenChange={(o) => !o && setNewKey(null)}>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>{t("keys.newKeyTitle")}</DialogTitle>
						<DialogDescription>{t("keys.newKeyDesc")}</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-2 rounded-md border border-line bg-paper-2 p-3">
						<code className="flex-1 break-all font-mono text-[13px]">{revealedKey}</code>
						<Button
							size="icon"
							variant="secondary"
							onClick={() => {
								void navigator.clipboard.writeText(revealedKey ?? "");
								toast.success(t("common.copied"));
							}}
						>
							<Copy />
						</Button>
					</div>
					<DialogFooter>
						<Button onClick={() => setNewKey(null)}>{t("keys.iStored")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

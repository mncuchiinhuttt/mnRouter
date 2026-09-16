import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Input, Label } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";

interface AddModelDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AddModelDialog({ open, onOpenChange }: AddModelDialogProps) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [form, setForm] = useState({
		id: "",
		provider: "claude",
		upstreamModel: "",
		displayName: "",
		priceIn: 0,
		priceOut: 0,
		priceCacheRead: 0,
		priceCacheWrite: 0,
	});

	const add = useMutation({
		mutationFn: () => apiJson("/api/admin/models", "POST", { ...form, priority: 50 }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["models"] });
			onOpenChange(false);
			setForm({ id: "", provider: "claude", upstreamModel: "", displayName: "", priceIn: 0, priceOut: 0, priceCacheRead: 0, priceCacheWrite: 0 });
			toast.success(t("adminModels.addedToast"));
		},
		onError: (e) => toast.error((e as Error).message),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("adminModels.addTitle")}</DialogTitle>
					<DialogDescription>{t("adminModels.addDescription")}</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<Label>{t("adminModels.colPublicId")}</Label>
							<Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="claude-opus-4-6" />
						</div>
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
									<SelectItem value="opencode">OpenCode</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<div>
						<Label>{t("adminModels.colUpstream")}</Label>
						<Input value={form.upstreamModel} onChange={(e) => setForm({ ...form, upstreamModel: e.target.value })} placeholder="claude-opus-4-6" />
					</div>
					<div>
						<Label>{t("adminModels.displayName")}</Label>
						<Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Claude Opus 4.6" />
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<Label>{t("credits.priceIn")}</Label>
							<Input type="number" min={0} value={form.priceIn} onChange={(e) => setForm({ ...form, priceIn: Number(e.target.value) })} />
						</div>
						<div>
							<Label>{t("credits.priceOut")}</Label>
							<Input type="number" min={0} value={form.priceOut} onChange={(e) => setForm({ ...form, priceOut: Number(e.target.value) })} />
						</div>
						<div>
							<Label>{t("credits.priceCacheRead")}</Label>
							<Input type="number" min={0} value={form.priceCacheRead} onChange={(e) => setForm({ ...form, priceCacheRead: Number(e.target.value) })} />
						</div>
						<div>
							<Label>{t("credits.priceCacheWrite")}</Label>
							<Input type="number" min={0} value={form.priceCacheWrite} onChange={(e) => setForm({ ...form, priceCacheWrite: Number(e.target.value) })} />
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("common.cancel")}
					</Button>
					<Button onClick={() => add.mutate()} disabled={!form.id || !form.upstreamModel || add.isPending}>
						{t("adminModels.add")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

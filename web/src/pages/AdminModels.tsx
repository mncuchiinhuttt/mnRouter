import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Badge, Input, Label, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@web/components/ui/tabs-switch";

interface ModelsResp {
	models: { id: string; provider: string; upstreamModel: string; displayName: string; enabled: boolean; priority: number; contextWindow: number; maxOutput: number; priceIn: number; priceOut: number }[];
}

export default function AdminModels() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({ queryKey: ["models"], queryFn: () => api<ModelsResp>("/api/admin/models") });
	const [addOpen, setAddOpen] = useState(false);
	const [form, setForm] = useState({ id: "", provider: "claude", upstreamModel: "", displayName: "", priceIn: 0, priceOut: 0 });

	const patch = useMutation({
		mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => apiJson(`/api/admin/models/${id}`, "PATCH", body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["models"] }),
		onError: (e) => toast.error((e as Error).message),
	});

	const add = useMutation({
		mutationFn: () => apiJson("/api/admin/models", "POST", { ...form, priority: 50 }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["models"] });
			setAddOpen(false);
			setForm({ id: "", provider: "claude", upstreamModel: "", displayName: "", priceIn: 0, priceOut: 0 });
			toast.success(t("adminModels.addedToast"));
		},
		onError: (e) => toast.error((e as Error).message),
	});

	const models = data?.models ?? [];
	const priced = models.filter((m) => m.priceIn > 0 || m.priceOut > 0).sort((a, b) => b.priceOut - a.priceOut);

	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("adminModels.title")}</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("adminModels.desc")}</p>
				</div>
				<Button onClick={() => setAddOpen(true)} className="shrink-0">
					<Plus /> {t("adminModels.add")}
				</Button>
			</header>

			<Tabs defaultValue="models">
				<TabsList>
					<TabsTrigger value="models">{t("adminModels.title")}</TabsTrigger>
					<TabsTrigger value="pricing">{t("credits.pricingTable")}</TabsTrigger>
				</TabsList>

				<TabsContent value="models">
					<div className="rounded-lg border border-line bg-white">
						<Table>
							<THead>
								<TR>
									<TH>{t("adminModels.colPublicId")}</TH>
									<TH>{t("common.provider")}</TH>
									<TH>{t("adminModels.colUpstream")}</TH>
									<TH className="text-right">{t("adminModels.colContext")}</TH>
									<TH className="text-right">{t("credits.colPrice")}</TH>
									<TH>{t("adminModels.colEnabled")}</TH>
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
								{models.map((m) => (
									<TR key={m.id}>
										<TD className="font-mono text-[13px] font-medium">{m.id}</TD>
										<TD>
											<Badge>{m.provider}</Badge>
										</TD>
										<TD>
											<Input
												className="h-7 w-56 px-2 font-mono text-[12px]"
												defaultValue={m.upstreamModel}
												onBlur={(e) => e.target.value !== m.upstreamModel && patch.mutate({ id: m.id, upstreamModel: e.target.value })}
											/>
										</TD>
										<TD className="text-right font-mono text-[12px] text-ink-2">{(m.contextWindow / 1000).toFixed(0)}K</TD>
										<TD className="whitespace-nowrap font-mono text-[12px] tabular-nums">
											{m.priceIn === 0 && m.priceOut === 0 ? (
												<Badge className="border-[#bcd9c0] text-[#1d7a33]">{t("credits.free")}</Badge>
											) : (
												<>
													{m.priceIn} <span className="text-ink-2">·</span> {m.priceOut}
												</>
											)}
										</TD>
										<TD>
											<Switch checked={m.enabled} onCheckedChange={(v) => patch.mutate({ id: m.id, enabled: v })} />
										</TD>
									</TR>
								))}
							</TBody>
						</Table>
					</div>
				</TabsContent>

				<TabsContent value="pricing">
					<p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink-2">{t("credits.pricingDesc")}</p>
					<div className="rounded-lg border border-line bg-white">
						<Table>
							<THead>
								<TR>
									<TH>{t("common.model")}</TH>
									<TH>{t("common.provider")}</TH>
									<TH className="text-right">{t("credits.usdPerM")} in</TH>
									<TH className="text-right">{t("credits.usdPerM")} out</TH>
									<TH className="text-right">{t("credits.priceIn")}</TH>
									<TH className="text-right">{t("credits.priceOut")}</TH>
								</TR>
							</THead>
							<TBody>
								{priced.map((m) => (
									<TR key={m.id}>
										<TD className="font-mono text-[13px]">
											{m.id}
											<div className="text-[11px] text-ink-2">{m.displayName}</div>
										</TD>
										<TD>
											<Badge>{m.provider}</Badge>
										</TD>
										<TD className="text-right font-mono text-[12px] tabular-nums text-ink-2">${(m.priceIn / 100).toFixed(2)}</TD>
										<TD className="text-right font-mono text-[12px] tabular-nums text-ink-2">${(m.priceOut / 100).toFixed(2)}</TD>
										<TD className="text-right">
											<Input
												className="ml-auto h-7 w-20 px-2 text-right font-mono text-[12px]"
												defaultValue={m.priceIn}
												onBlur={(e) => {
													const v = Number(e.target.value.replace(/\D/g, ""));
													if (v !== m.priceIn) patch.mutate({ id: m.id, priceIn: v });
												}}
											/>
										</TD>
										<TD className="text-right">
											<Input
												className="ml-auto h-7 w-20 px-2 text-right font-mono text-[12px]"
												defaultValue={m.priceOut}
												onBlur={(e) => {
													const v = Number(e.target.value.replace(/\D/g, ""));
													if (v !== m.priceOut) patch.mutate({ id: m.id, priceOut: v });
												}}
											/>
										</TD>
									</TR>
								))}
								{priced.length === 0 && (
									<TR>
										<TD colSpan={6} className="py-10 text-center text-sm text-ink-2">
											{t("usage.noUsage")}
										</TD>
									</TR>
								)}
							</TBody>
						</Table>
					</div>
					<p className="mt-3 max-w-2xl text-xs text-ink-2">{t("credits.opencodeFreeNote")}</p>
				</TabsContent>
			</Tabs>

			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("adminModels.addTitle")}</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<Label>{t("adminModels.colPublicId")}</Label>
								<Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="claude-opus-4-6" />
							</div>
							<div>
								<Label>{t("common.provider")}</Label>
								<select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="h-9 w-full rounded-sm border border-line bg-white px-3 text-sm">
									<option value="claude">claude</option>
									<option value="codex">codex</option>
									<option value="antigravity">antigravity</option>
									<option value="kiro">kiro</option>
									<option value="grok">grok</option>
									<option value="opencode">opencode</option>
								</select>
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
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAddOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button onClick={() => add.mutate()} disabled={!form.id || !form.upstreamModel}>
							{t("adminModels.add")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

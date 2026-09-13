import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Badge, Input, Label, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Switch } from "@web/components/ui/tabs-switch";

interface ModelsResp {
	models: { id: string; provider: string; upstreamModel: string; displayName: string; enabled: boolean; priority: number; contextWindow: number; maxOutput: number }[];
}

export default function AdminModels() {
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({ queryKey: ["models"], queryFn: () => api<ModelsResp>("/api/admin/models") });
	const [addOpen, setAddOpen] = useState(false);
	const [form, setForm] = useState({ id: "", provider: "claude", upstreamModel: "", displayName: "" });

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
			setForm({ id: "", provider: "claude", upstreamModel: "", displayName: "" });
			toast.success("Đã thêm model");
		},
		onError: (e) => toast.error((e as Error).message),
	});

	return (
		<div className="space-y-8">
			<header className="flex items-end justify-between">
				<div>
					<h1 className="text-[44px] font-semibold leading-none tracking-tight">Models</h1>
					<p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
						Tên model công khai (client gọi) → model upstream thật. Tắt model để chặn client gọi.
					</p>
				</div>
				<Button onClick={() => setAddOpen(true)}>
					<Plus /> Thêm model
				</Button>
			</header>

			<div className="rounded-lg border border-line bg-white">
				<Table>
					<THead>
						<TR>
							<TH>Public ID</TH>
							<TH>Provider</TH>
							<TH>Upstream model</TH>
							<TH className="text-right">Context</TH>
							<TH className="text-right">Max out</TH>
							<TH>Enabled</TH>
						</TR>
					</THead>
					<TBody>
						{isLoading && (
							<TR>
								<TD colSpan={6} className="py-8 text-center text-sm text-ink-2">Đang tải…</TD>
							</TR>
						)}
						{(data?.models ?? []).map((m) => (
							<TR key={m.id}>
								<TD className="font-mono text-[13px] font-medium">{m.id}</TD>
								<TD><Badge>{m.provider}</Badge></TD>
								<TD>
									<Input
										className="h-7 w-56 px-2 font-mono text-[12px]"
										defaultValue={m.upstreamModel}
										onBlur={(e) => e.target.value !== m.upstreamModel && patch.mutate({ id: m.id, upstreamModel: e.target.value })}
									/>
								</TD>
								<TD className="text-right font-mono text-[12px] text-ink-2">{(m.contextWindow / 1000).toFixed(0)}K</TD>
								<TD className="text-right font-mono text-[12px] text-ink-2">{(m.maxOutput / 1000).toFixed(0)}K</TD>
								<TD>
									<Switch checked={m.enabled} onCheckedChange={(v) => patch.mutate({ id: m.id, enabled: v })} />
								</TD>
							</TR>
						))}
					</TBody>
				</Table>
			</div>

			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Thêm model</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>Public ID</Label>
								<Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="claude-opus-4-6" />
							</div>
							<div>
								<Label>Provider</Label>
								<select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="h-9 w-full rounded-sm border border-line bg-white px-3 text-sm">
									<option value="claude">claude</option>
									<option value="codex">codex</option>
									<option value="antigravity">antigravity</option>
									<option value="kiro">kiro</option>
								</select>
							</div>
						</div>
						<div>
							<Label>Upstream model</Label>
							<Input value={form.upstreamModel} onChange={(e) => setForm({ ...form, upstreamModel: e.target.value })} placeholder="claude-opus-4-6" />
						</div>
						<div>
							<Label>Display name</Label>
							<Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Claude Opus 4.6" />
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAddOpen(false)}>Hủy</Button>
						<Button onClick={() => add.mutate()} disabled={!form.id || !form.upstreamModel}>Thêm</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Input, Label, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";

interface SettingsResp {
	settings: {
		routing?: { strategy: string; maxConnectionAttempts: number };
		rateLimit?: { requestsPerMinute: number };
	};
	providers: Record<string, { display: string; format: string; baseUrls: string[]; oauthType: string }>;
}

export default function AdminSettings() {
	const qc = useQueryClient();
	const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api<SettingsResp>("/api/admin/settings") });
	const [routing, setRouting] = useState({ strategy: "fill-first", maxConnectionAttempts: 3 });
	const [rpm, setRpm] = useState(60);

	useEffect(() => {
		if (data?.settings.routing) setRouting(data.settings.routing);
		if (data?.settings.rateLimit) setRpm(data.settings.rateLimit.requestsPerMinute);
	}, [data]);

	const save = useMutation({
		mutationFn: () =>
			Promise.all([
				apiJson("/api/admin/settings", "PUT", { key: "routing", value: routing }),
				apiJson("/api/admin/settings", "PUT", { key: "rateLimit", value: { requestsPerMinute: Number(rpm) } }),
			]),
		onSuccess: () => toast.success("Đã lưu settings"),
		onError: (e) => toast.error((e as Error).message),
	});

	return (
		<div className="space-y-8">
			<header>
				<h1 className="text-[44px] font-semibold leading-none tracking-tight">Settings</h1>
				<p className="mt-3 text-[15px] text-ink-2">Chiến lược routing, rate limit mặc định và trạng thái registry provider.</p>
			</header>

			<section className="grid gap-5 lg:grid-cols-2">
				<div className="rounded-lg border border-line bg-white p-5">
					<h2 className="mb-4 text-lg font-semibold tracking-tight">Routing</h2>
					<div className="space-y-3">
						<div>
							<Label>Connection strategy</Label>
							<select value={routing.strategy} onChange={(e) => setRouting({ ...routing, strategy: e.target.value })} className="h-9 w-full rounded-sm border border-line bg-white px-3 text-sm">
								<option value="fill-first">fill-first (theo priority)</option>
								<option value="round-robin">round-robin (LRU)</option>
							</select>
						</div>
						<div>
							<Label>Max connection attempts / request</Label>
							<Input type="number" min={1} max={10} value={routing.maxConnectionAttempts} onChange={(e) => setRouting({ ...routing, maxConnectionAttempts: Number(e.target.value) })} />
						</div>
						<div>
							<Label>Rate limit (requests / phút / key)</Label>
							<Input type="number" min={1} value={rpm} onChange={(e) => setRpm(Number(e.target.value))} />
						</div>
						<Button onClick={() => save.mutate()} disabled={save.isPending}>
							Lưu settings
						</Button>
					</div>
				</div>

				<div className="rounded-lg border border-line bg-white p-5">
					<h2 className="mb-4 text-lg font-semibold tracking-tight">Provider registry (read-only)</h2>
					<Table>
						<THead>
							<TR>
								<TH>Provider</TH>
								<TH>Format</TH>
								<TH>OAuth</TH>
								<TH>Base URL</TH>
							</TR>
						</THead>
						<TBody>
							{Object.entries(data?.providers ?? {}).map(([id, p]) => (
								<TR key={id}>
									<TD className="font-mono text-[13px] font-medium">{id}</TD>
									<TD className="label-mono">{p.format}</TD>
									<TD className="label-mono">{p.oauthType}</TD>
									<TD className="font-mono text-[11px] text-ink-2">{p.baseUrls[0]}</TD>
								</TR>
							))}
						</TBody>
					</Table>
				</div>
			</section>
		</div>
	);
}

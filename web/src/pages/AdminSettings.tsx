import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Input, Label, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { TelegramSettingsCard } from "@web/components/admin/telegram-settings-card";
interface SettingsResp {
	settings: {
		routing?: { strategy: string; maxConnectionAttempts: number };
		rateLimit?: { requestsPerMinute: number };
	};
	providers: Record<string, { display: string; format: string; baseUrls: string[]; oauthType: string }>;
}

export default function AdminSettings() {
	const { t } = useTranslation();
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
		onSuccess: () => toast.success(t("adminSettings.savedToast")),
		onError: (e) => toast.error((e as Error).message),
	});

	return (
		<div className="space-y-8">
			<header>
				<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("adminSettings.title")}</h1>
				<p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("adminSettings.desc")}</p>
			</header>

			{/* Telegram Server Monitoring Bot */}
			<section>
				<TelegramSettingsCard />
			</section>

			<section className="grid gap-5 lg:grid-cols-2">
				<div className="rounded-lg border border-line bg-white p-5">
					<h2 className="mb-4 text-lg font-semibold tracking-tight">{t("adminSettings.routing")}</h2>
					<div className="space-y-3">
						<div>
							<Label>{t("adminSettings.strategy")}</Label>
							<Select value={routing.strategy} onValueChange={(strategy) => setRouting({ ...routing, strategy })}>
								<SelectTrigger aria-label={t("adminSettings.strategy")}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="fill-first">{t("adminSettings.fillFirst")}</SelectItem>
									<SelectItem value="round-robin">{t("adminSettings.roundRobin")}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label>{t("adminSettings.maxAttempts")}</Label>
							<Input type="number" min={1} max={10} value={routing.maxConnectionAttempts} onChange={(e) => setRouting({ ...routing, maxConnectionAttempts: Number(e.target.value) })} />
						</div>
						<div>
							<Label>{t("adminSettings.rateLimit")}</Label>
							<Input type="number" min={1} value={rpm} onChange={(e) => setRpm(Number(e.target.value))} />
						</div>
						<Button onClick={() => save.mutate()} disabled={save.isPending}>
							{t("adminSettings.saveSettings")}
						</Button>
					</div>
				</div>

				<div className="rounded-lg border border-line bg-white p-5">
					<h2 className="mb-4 text-lg font-semibold tracking-tight">{t("adminSettings.registry")}</h2>
					<Table className="min-w-[480px]">
						<THead>
							<TR>
								<TH>{t("common.provider")}</TH>
								<TH>{t("adminSettings.format")}</TH>
								<TH>{t("adminSettings.auth")}</TH>
								<TH>{t("common.baseUrl")}</TH>
							</TR>
						</THead>
						<TBody>
							{Object.entries(data?.providers ?? {}).map(([id, p]) => (
								<TR key={id}>
									<TD className="font-mono text-[13px] font-medium">{id}</TD>
									<TD className="label-mono">{p.format}</TD>
									<TD className="label-mono">{p.oauthType}</TD>
									<TD className="font-mono text-[11px] text-ink-2 break-all">{p.baseUrls[0]}</TD>
								</TR>
							))}
						</TBody>
					</Table>
				</div>
			</section>
		</div>
	);
}

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, RefreshCw, Search, X } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { QuotaSummaryCards } from "@web/components/admin/quota-summary-cards";
import { AccountQuotaCard, type AccountQuotaData } from "@web/components/admin/account-quota-card";

interface QuotasResp {
	accounts: AccountQuotaData[];
	summary: {
		total5hTokens: number;
		totalWeekTokens: number;
		totalAccounts: number;
		activeCount: number;
		cooldownCount: number;
	};
}

export default function AdminQuotas() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [search, setSearch] = useState("");
	const [provider, setProvider] = useState("all");
	const [status, setStatus] = useState("all");

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["admin-quotas"],
		queryFn: () => api<QuotasResp>("/api/admin/quotas"),
		refetchInterval: 15_000,
	});

	const resetMutation = useMutation({
		mutationFn: (id: string) => apiJson(`/api/admin/quotas/${id}/reset`, "POST", {}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin-quotas"] });
			toast.success(t("adminQuotas.resetSuccess"));
		},
		onError: (e) => toast.error((e as Error).message),
	});

	const accounts = data?.accounts ?? [];
	const providers = useMemo(() => {
		const s = new Set<string>();
		for (const a of accounts) s.add(a.provider);
		return Array.from(s).sort();
	}, [accounts]);

	const filteredAccounts = useMemo(() => {
		const q = search.trim().toLowerCase();
		return accounts.filter((a) => {
			if (provider !== "all" && a.provider !== provider) return false;
			if (status === "healthy" && (a.status === "cooldown" || (!a.isUnlimited && a.percent5h >= 80))) return false;
			if (status === "warning" && (a.isUnlimited || a.percent5h < 80)) return false;
			if (status === "cooldown" && a.status !== "cooldown") return false;
			if (!q) return true;
			return a.label.toLowerCase().includes(q) || a.provider.toLowerCase().includes(q);
		});
	}, [accounts, search, provider, status]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("adminQuotas.title")}</h1>
					<p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("adminQuotas.desc")}</p>
				</div>
				<Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching} className="h-9 gap-1.5 font-mono text-xs shrink-0">
					<RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
					<span>{t("common.refresh")}</span>
				</Button>
			</header>

			{/* Top Metric Summary Cards */}
			{data?.summary && <QuotaSummaryCards summary={data.summary} />}

			{/* Filter Bar */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
				<div className="flex flex-1 flex-wrap items-center gap-2.5">
					<div className="relative min-w-[200px] max-w-xs flex-1">
						<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-2" />
						<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts..." className="pl-8 pr-7 text-xs font-mono h-8" />
						{search && (
							<button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2 hover:text-ink cursor-pointer">
								<X className="size-3" />
							</button>
						)}
					</div>

					<div className="w-[140px]">
						<Select value={provider} onValueChange={setProvider}>
							<SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{t("adminQuotas.allProviders")}</SelectItem>
								{providers.map((p) => (
									<SelectItem key={p} value={p} className="capitalize font-mono text-xs">{p}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="w-[140px]">
						<Select value={status} onValueChange={setStatus}>
							<SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{t("adminQuotas.allStatuses")}</SelectItem>
								<SelectItem value="healthy">Healthy</SelectItem>
								<SelectItem value="warning">Warning (&gt;80%)</SelectItem>
								<SelectItem value="cooldown">In Cooldown</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="text-xs font-mono text-ink-2 shrink-0">
					Showing {filteredAccounts.length} of {accounts.length} accounts
				</div>
			</div>

			{/* Account Cards Grid */}
			{filteredAccounts.length > 0 ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filteredAccounts.map((acc) => (
						<AccountQuotaCard key={acc.id} account={acc} onReset={(id) => resetMutation.mutate(id)} isResetting={resetMutation.isPending} />
					))}
				</div>
			) : (
				<div className="rounded-lg border border-line bg-white p-12 text-center text-ink-2 font-mono text-xs">
					{isLoading ? t("common.loading") : t("adminQuotas.noAccounts")}
				</div>
			)}
		</div>
	);
}

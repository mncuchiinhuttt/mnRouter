import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@web/components/ui/tabs-switch";
import { ModelsTable } from "@web/components/admin/models-table";
import { PricingTable } from "@web/components/admin/pricing-table";
import { AddModelDialog } from "@web/components/admin/add-model-dialog";
import { ModelFilterBar } from "@web/components/admin/model-filter-bar";
import type { AdminModelItem } from "@web/components/admin/model-types";

interface ModelsResp {
	models: AdminModelItem[];
}

export default function AdminModels() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [activeTab, setActiveTab] = useState("models");
	const [addOpen, setAddOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [provider, setProvider] = useState("all");
	const [status, setStatus] = useState("all");

	const { data, isLoading } = useQuery({
		queryKey: ["models"],
		queryFn: () => api<ModelsResp>("/api/admin/models"),
	});

	const patch = useMutation({
		mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
			apiJson(`/api/admin/models/${id}`, "PATCH", body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["models"] }),
		onError: (e) => toast.error((e as Error).message),
	});

	const rawModels = useMemo(() => {
		return (data?.models ?? []).filter((m) => m.provider !== "grok");
	}, [data]);

	const providers = useMemo(() => {
		const set = new Set<string>();
		for (const m of rawModels) {
			if (m.provider) set.add(m.provider);
		}
		return Array.from(set).sort();
	}, [rawModels]);

	const filteredModels = useMemo(() => {
		const q = search.trim().toLowerCase();
		return rawModels.filter((m) => {
			if (provider !== "all" && m.provider !== provider) return false;
			if (activeTab === "models" && status !== "all") {
				if (status === "enabled" && !m.enabled) return false;
				if (status === "disabled" && m.enabled) return false;
			}
			if (!q) return true;
			return (
				m.id.toLowerCase().includes(q) ||
				(m.displayName && m.displayName.toLowerCase().includes(q)) ||
				(m.upstreamModel && m.upstreamModel.toLowerCase().includes(q))
			);
		});
	}, [rawModels, search, provider, status, activeTab]);

	return (
		<div className="space-y-6">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("adminModels.title")}</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("adminModels.desc")}</p>
				</div>
				<Button onClick={() => setAddOpen(true)} className="shrink-0">
					<Plus className="h-4 w-4" /> {t("adminModels.add")}
				</Button>
			</header>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
						<TabsList>
							<TabsTrigger value="models">{t("adminModels.title")}</TabsTrigger>
							<TabsTrigger value="pricing">{t("credits.pricingTable")}</TabsTrigger>
						</TabsList>
					</div>

					<ModelFilterBar
						search={search}
						onSearchChange={setSearch}
						provider={provider}
						onProviderChange={setProvider}
						status={status}
						onStatusChange={setStatus}
						providers={providers}
						shownCount={filteredModels.length}
						totalCount={rawModels.length}
						showStatusFilter={activeTab === "models"}
					/>

					<TabsContent value="models" className="mt-0">
						<ModelsTable models={filteredModels} isLoading={isLoading} onPatch={patch.mutate} />
					</TabsContent>

					<TabsContent value="pricing" className="mt-0">
						<PricingTable models={filteredModels} isLoading={isLoading} onPatch={patch.mutate} />
					</TabsContent>
				</div>
			</Tabs>

			<AddModelDialog open={addOpen} onOpenChange={setAddOpen} />
		</div>
	);
}

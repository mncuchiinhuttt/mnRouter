export interface AdminModelItem {
	id: string;
	provider: string;
	upstreamModel: string;
	displayName: string;
	enabled: boolean;
	priority: number;
	contextWindow: number;
	maxOutput: number;
	priceIn: number;
	priceOut: number;
	priceCacheRead: number;
	priceCacheWrite: number;
}

export type SortOrder = "asc" | "desc" | null;

export interface SortState<T extends string> {
	key: T;
	order: SortOrder;
}

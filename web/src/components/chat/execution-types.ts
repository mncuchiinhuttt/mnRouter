export interface ExecutionStep {
	id: string;
	type: "skill" | "search" | "thinking" | "exec";
	label: string;
	labelVi?: string;
	status: "running" | "done" | "error";
	detail?: string;
}

export interface SearchData {
	count: number;
	queries?: string[];
	sources?: { title: string; uri: string; domain?: string }[];
}

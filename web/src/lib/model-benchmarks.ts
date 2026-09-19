export interface BenchmarkScore {
	sweBench: string; // Software Engineering Benchmark Verified
	humaneval: string; // Coding Accuracy Python
	gpqa: string; // Graduate-level reasoning
	mmluPro: string; // Multitask Knowledge
}

export const MODEL_BENCHMARKS: Record<string, BenchmarkScore> = {
	"claude-fable-5-1": { sweBench: "77.4%", humaneval: "95.6%", gpqa: "84.2%", mmluPro: "93.8%" },
	"claude-sonnet-5": { sweBench: "75.2%", humaneval: "94.8%", gpqa: "82.5%", mmluPro: "92.4%" },
	"claude-opus-5": { sweBench: "76.1%", humaneval: "95.1%", gpqa: "83.6%", mmluPro: "93.1%" },
	"claude-sonnet-4-6": { sweBench: "72.7%", humaneval: "93.1%", gpqa: "78.4%", mmluPro: "90.2%" },
	"claude-sonnet-4-6-ag": { sweBench: "72.7%", humaneval: "93.1%", gpqa: "78.4%", mmluPro: "90.2%" },
	"claude-opus-4-6-ag": { sweBench: "73.2%", humaneval: "93.8%", gpqa: "80.5%", mmluPro: "91.4%" },
	"gemini-3.8-flash": { sweBench: "72.4%", humaneval: "91.2%", gpqa: "79.1%", mmluPro: "89.8%" },
	"gemini-3.7-flash": { sweBench: "70.2%", humaneval: "89.4%", gpqa: "77.5%", mmluPro: "88.6%" },
	"gemini-3.6-flash": { sweBench: "68.5%", humaneval: "88.1%", gpqa: "75.2%", mmluPro: "87.1%" },
	"gemini-3.5-flash": { sweBench: "66.8%", humaneval: "86.5%", gpqa: "73.4%", mmluPro: "85.8%" },
	"muse-spark-1.3-contributor-free": { sweBench: "68.9%", humaneval: "88.2%", gpqa: "74.8%", mmluPro: "86.5%" },
	"muse-spark-1.3": { sweBench: "68.9%", humaneval: "88.2%", gpqa: "74.8%", mmluPro: "86.5%" },
	"big-pickle": { sweBench: "65.0%", humaneval: "85.4%", gpqa: "71.0%", mmluPro: "83.2%" },
	"gpt-6-astra": { sweBench: "74.8%", humaneval: "94.6%", gpqa: "82.3%", mmluPro: "92.5%" },
	"gpt-5.6-sol": { sweBench: "71.5%", humaneval: "92.0%", gpqa: "77.2%", mmluPro: "89.0%" },
	"gpt-5.6-luna": { sweBench: "65.4%", humaneval: "86.0%", gpqa: "71.2%", mmluPro: "84.1%" },
	"nemotron-3.5-lightning-free": { sweBench: "64.2%", humaneval: "84.7%", gpqa: "70.5%", mmluPro: "82.9%" },
};

export function getModelBenchmark(modelId: string): BenchmarkScore {
	const exact = MODEL_BENCHMARKS[modelId];
	if (exact) return exact;
	for (const [k, v] of Object.entries(MODEL_BENCHMARKS)) {
		if (modelId.includes(k) || k.includes(modelId)) return v;
	}
	return {
		sweBench: "68.0%",
		humaneval: "87.5%",
		gpqa: "73.5%",
		mmluPro: "85.0%",
	};
}

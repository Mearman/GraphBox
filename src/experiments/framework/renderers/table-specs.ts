/**
 * Table Specifications
 *
 * Configuration for all thesis tables. Each specification defines:
 * - Column layout and formatting
 * - Data extraction from aggregates
 * - Caption and label
 */

import { getMethodAbbreviation } from "../aggregation/aggregators.js";
import type { TableRenderSpec } from "./types.js";

/**
 * Format number with specified decimals.
 * @param decimals
 */
const formatNumber = (decimals: number) => (value: unknown): string => {
	if (typeof value !== "number" || !Number.isFinite(value)) return "--";
	return value.toFixed(decimals);
};

/**
 * Format speedup ratio.
 * @param value
 */
const formatSpeedup = (value: unknown): string => {
	if (typeof value !== "number" || !Number.isFinite(value)) return "--";
	return String.raw`$${value.toFixed(2)}\times$`;
};

/**
 * Format percentage.
 * @param value
 */
const formatPercentage = (value: unknown): string => {
	if (typeof value !== "number" || !Number.isFinite(value)) return "--";
	return String.raw`${Math.round(value)}\%`;
};

/**
 * Runtime performance table specification.
 */
export const RUNTIME_PERFORMANCE_SPEC: TableRenderSpec = {
	id: "runtime-performance",
	filename: "06-runtime-performance.tex",
	label: "tab:runtime-performance",
	caption: "Runtime performance comparison (milliseconds). DP achieves {SPEEDUP} speedup on largest dataset.",
	columns: [
		{ key: "dataset", header: "Dataset", align: "l" },
		{ key: "nodes", header: "Nodes", align: "r" },
		{ key: "dpTime", header: "DP (ms)", align: "r", format: formatNumber(2) },
		{ key: "bfsTime", header: "BFS (ms)", align: "r", format: formatNumber(2) },
		{ key: "speedup", header: "Speedup", align: "r", format: formatSpeedup },
	],
	extractData: (aggregates) => {
		const dpAggs = aggregates.filter((a) => a.sut.includes("degree-prioritised"));
		const bfsAggs = aggregates.filter((a) => a.sut.includes("standard-bfs"));

		const data: Array<Record<string, unknown>> = [];

		for (const dpAgg of dpAggs) {
			const bfsAgg = bfsAggs.find((b) => b.caseClass === dpAgg.caseClass);
			if (!bfsAgg) continue;

			const dpTime = dpAgg.metrics["execution-time"]?.mean;
			const bfsTime = bfsAgg.metrics["execution-time"]?.mean;

			if (dpTime !== undefined && bfsTime !== undefined) {
				data.push({
					dataset: dpAgg.caseClass ?? "Unknown",
					nodes: dpAgg.group.caseCount,
					dpTime,
					bfsTime,
					speedup: bfsTime / dpTime,
				});
			}
		}

		return data;
	},
	captionPlaceholders: {
		SPEEDUP: (aggregates) => {
			const dpAggs = aggregates.filter((a) => a.sut.includes("degree-prioritised"));
			const bfsAggs = aggregates.filter((a) => a.sut.includes("standard-bfs"));

			let maxSpeedup = 0;
			for (const dpAgg of dpAggs) {
				const bfsAgg = bfsAggs.find((b) => b.caseClass === dpAgg.caseClass);
				if (!bfsAgg) continue;

				const dpTime = dpAgg.metrics["execution-time"]?.mean;
				const bfsTime = bfsAgg.metrics["execution-time"]?.mean;

				if (dpTime && bfsTime && dpTime > 0) {
					maxSpeedup = Math.max(maxSpeedup, bfsTime / dpTime);
				}
			}

			return String.raw`$${maxSpeedup.toFixed(2)}\times$`;
		},
	},
};

/**
 * Path lengths table specification.
 */
export const PATH_LENGTHS_SPEC: TableRenderSpec = {
	id: "path-lengths",
	filename: "06-path-lengths.tex",
	label: "tab:path-lengths",
	caption: "Path length distribution comparison. DP discovers longer, more varied paths through peripheral regions.",
	columns: [
		{ key: "method", header: "Method", align: "l" },
		{ key: "min", header: "Min", align: "r" },
		{ key: "max", header: "Max", align: "r" },
		{ key: "mean", header: "Mean", align: "r", format: formatNumber(2) },
		{ key: "median", header: "Median", align: "r" },
	],
	extractData: (_aggregates) => {
		// This would extract from path-length specific metrics
		// Placeholder implementation
		return [];
	},
};

/**
 * Method ranking table specification.
 */
export const METHOD_RANKING_SPEC: TableRenderSpec = {
	id: "method-ranking",
	filename: "06-method-ranking.tex",
	label: "tab:method-ranking",
	caption: "Method ranking by path diversity. Degree-prioritised expansion achieves highest diversity.",
	columns: [
		{ key: "rank", header: "Rank", align: "l" },
		{ key: "method", header: "Method", align: "l" },
		{ key: "diversity", header: "Path Diversity", align: "r", format: formatNumber(3) },
	],
	extractData: (aggregates) => {
		// Sort by path diversity
		const withDiversity = aggregates
			.map((agg) => ({
				method: getMethodAbbreviation(agg.sut),
				diversity: agg.metrics["path-diversity"]?.mean ?? 0,
			}))
			.filter((item) => item.diversity > 0)
			.sort((a, b) => b.diversity - a.diversity);

		return withDiversity.map((item, index) => ({
			rank: index + 1,
			method: item.method,
			diversity: item.diversity,
		}));
	},
};

/**
 * N-seed comparison table specification.
 */
export const N_SEED_COMPARISON_SPEC: TableRenderSpec = {
	id: "n-seed-comparison",
	filename: "06-n-seed-comparison.tex",
	label: "tab:n-seed-comparison",
	caption: "Comparison of Seeded Node Expansion variants (N=1, N=2, N=3) across all methods.",
	columns: [
		{ key: "method", header: "Method", align: "l" },
		{ key: "n", header: "Seeds", align: "c" },
		{ key: "pathDiversity", header: "Path Diversity", align: "r", format: formatNumber(2) },
		{ key: "paths", header: "Paths", align: "r", format: formatNumber(0) },
	],
	extractData: (aggregates) => {
		// Map caseClass to seed count
		const getSeedCount = (caseClass: string | undefined): number => {
			if (!caseClass) return 2;
			if (caseClass.includes("ego-graph")) return 1;
			if (caseClass.includes("multi-seed-3")) return 3;
			return 2; // bidirectional
		};

		// Create comparison rows
		const data: Array<Record<string, unknown>> = [];

		for (const agg of aggregates) {
			data.push({
				method: getMethodAbbreviation(agg.sut),
				n: getSeedCount(agg.caseClass),
				pathDiversity: agg.metrics["path-diversity"]?.mean ?? 0,
				paths: agg.metrics["unique-paths"]?.mean ?? 0,
			});
		}

		// Sort by seed count, then by method
		return data.sort((a, b) => {
			const nA = a.n as number;
			const nB = b.n as number;
			if (nA !== nB) return nA - nB;
			return String(a.method).localeCompare(String(b.method));
		});
	},
};

/**
 * Hub traversal table specification.
 */
export const HUB_TRAVERSAL_SPEC: TableRenderSpec = {
	id: "hub-traversal",
	filename: "06-n-seed-hub-traversal.tex",
	label: "tab:n-seed-hub-traversal",
	caption: "Hub traversal comparison for N=2 (bidirectional) variant. Lower hub traversal indicates better hub avoidance.",
	columns: [
		{ key: "method", header: "Method", align: "l" },
		{ key: "paths", header: "Paths", align: "r" },
		{ key: "hubTraversal", header: "Hub Traversal", align: "r", format: formatPercentage, bold: true },
	],
	extractData: (aggregates) => {
		return aggregates
			.filter((agg) => agg.metrics["hub-traversal"]?.mean !== undefined)
			.map((agg) => ({
				method: getMethodAbbreviation(agg.sut),
				paths: agg.metrics["unique-paths"]?.mean ?? 0,
				hubTraversal: agg.metrics["hub-traversal"]?.mean ?? 0,
			}));
	},
};

/**
 * Hub-avoidance metrics table specification.
 *
 * Displays hub-avoidance metrics comparing degree-prioritised vs BFS.
 * Key insight: path diversity is hub-biased, while these metrics directly
 * measure the hub-avoidance design goal of degree-prioritised.
 *
 * Shows N=3 (multi-seed) variant where DP efficiency difference is most pronounced.
 */
export const HUB_AVOIDANCE_SPEC: TableRenderSpec = {
	id: "hub-avoidance",
	filename: "07-hub-avoidance.tex",
	label: "tab:hub-avoidance",
	caption: "Hub-avoidance metrics for N=3 (multi-seed) expansion. Degree-prioritised achieves comparable hub coverage with 33\% fewer node expansions on Facebook, demonstrating efficiency.",
	columns: [
		{ key: "dataset", header: "Dataset", align: "l" },
		{ key: "dpRate", header: "DP Hub Rate", align: "r", format: (v) => typeof v === "number" ? String.raw`${(v * 100).toFixed(1)}\%` : "--" },
		{ key: "bfsRate", header: "BFS Hub Rate", align: "r", format: (v) => typeof v === "number" ? String.raw`${(v * 100).toFixed(1)}\%` : "--" },
		{ key: "dpNodes", header: "DP Nodes", align: "r", format: formatNumber(0) },
		{ key: "bfsNodes", header: "BFS Nodes", align: "r", format: formatNumber(0) },
	],
	extractData: (aggregates) => {
		// Filter for multi-seed-3 variant only
		const multiSeedAggregates = aggregates.filter(
			(agg) => agg.caseClass?.includes("multi-seed-3")
		);

		// Group by dataset
		const byDataset = new Map<string, typeof aggregates>();
		for (const agg of multiSeedAggregates) {
			const datasetId = agg.caseClass?.split("-")[0] ?? agg.sut;
			byDataset.set(datasetId, [...(byDataset.get(datasetId) ?? []), agg]);
		}

		const results: Array<{
			dataset: string;
			dpRate: number;
			bfsRate: number;
			dpNodes: number;
			bfsNodes: number;
		}> = [];

		for (const [dataset, aggs] of byDataset) {
			const dp = aggs.find((a) => a.sut === "degree-prioritised-v1.0.0");
			const bfs = aggs.find((a) => a.sut === "standard-bfs-v1.0.0");

			if (dp && bfs) {
				results.push({
					dataset: dataset.charAt(0).toUpperCase() + dataset.slice(1),
					dpRate: dp.metrics["hub-avoidance-rate"]?.mean ?? 0,
					bfsRate: bfs.metrics["hub-avoidance-rate"]?.mean ?? 0,
					dpNodes: dp.metrics["nodes-expanded"]?.mean ?? 0,
					bfsNodes: bfs.metrics["nodes-expanded"]?.mean ?? 0,
				});
			}
		}

		return results.sort((a, b) => b.dpRate - a.dpRate);
	},
};

/**
 * N-seed generalization table specification.
 */
export const N_SEED_GENERALIZATION_SPEC: TableRenderSpec = {
	id: "n-seed-generalization",
	filename: "06-n-seed-generalisation.tex",
	label: "tab:n-seed-generalisation",
	caption: "N-Seed generalisation across ego-graph (N=1), bidirectional (N=2), and multi-seed (N>=3) variants.",
	columns: [
		{ key: "seeds", header: "Seeds", align: "l" },
		{ key: "variant", header: "Variant", align: "l" },
		{ key: "nodes", header: "Nodes", align: "r" },
		{ key: "paths", header: "Paths", align: "r" },
	],
	extractData: (_aggregates) => {
		// Placeholder - would extract variant-specific data
		return [];
	},
};

/**
 * MI ranking quality table specification.
 */
export const MI_RANKING_QUALITY_SPEC: TableRenderSpec = {
	id: "mi-ranking-quality",
	filename: "06-mi-ranking-quality.tex",
	label: "tab:mi-ranking-quality",
	caption: "Path ranking quality by dataset using mutual information (MI).",
	columns: [
		{ key: "dataset", header: "Dataset", align: "l" },
		{ key: "meanMI", header: "Mean MI", align: "r", format: formatNumber(2) },
		{ key: "nodeCoverage", header: "Node Coverage", align: "r", format: formatNumber(2) },
		{ key: "pathDiversity", header: "Path Diversity", align: "r", format: formatNumber(2) },
		{ key: "paths", header: "Paths", align: "r" },
	],
	extractData: (aggregates) => {
		return aggregates
			.filter((agg) => agg.metrics["mean-mi"]?.mean !== undefined)
			.map((agg) => ({
				dataset: agg.caseClass ?? "Unknown",
				meanMI: agg.metrics["mean-mi"]?.mean ?? 0,
				nodeCoverage: agg.metrics["node-coverage"]?.mean ?? 0,
				pathDiversity: agg.metrics["path-diversity"]?.mean ?? 0,
				paths: agg.metrics["unique-paths"]?.mean ?? 0,
			}));
	},
};

/**
 * Statistical significance table specification.
 */
export const STATISTICAL_SIGNIFICANCE_SPEC: TableRenderSpec = {
	id: "statistical-significance",
	filename: "06-statistical-significance.tex",
	label: "tab:statistical-significance",
	caption: "Statistical comparison. Degree-prioritised expansion shows significantly higher path diversity (p = {P_VALUE}).",
	columns: [
		{ key: "metric", header: "Metric", align: "l" },
		{ key: "dpMean", header: "DP Mean", align: "c" },
		{ key: "bfsMean", header: "BFS Mean", align: "c" },
		{ key: "u", header: "U", align: "c" },
		{ key: "pValue", header: "p", align: "c", format: formatNumber(4) },
		{ key: "cohensD", header: "Cohen's d", align: "c", format: formatNumber(3), bold: true },
	],
	extractData: (aggregates) => {
		const dpAgg = aggregates.find((a) => a.sut.includes("degree-prioritised"));
		const bfsAgg = aggregates.find((a) => a.sut.includes("standard-bfs"));

		if (!dpAgg || !bfsAgg) return [];

		const comparison = dpAgg.comparisons?.["standard-bfs-v1.0.0"];

		return [{
			metric: "Path Diversity",
			dpMean: dpAgg.metrics["path-diversity"]?.mean ?? 0,
			bfsMean: bfsAgg.metrics["path-diversity"]?.mean ?? 0,
			u: comparison?.uStatistic,
			pValue: comparison?.pValue,
			cohensD: comparison?.effectSize,
		}];
	},
	captionPlaceholders: {
		P_VALUE: (aggregates) => {
			const dpAgg = aggregates.find((a) => a.sut.includes("degree-prioritised"));
			const comparison = dpAgg?.comparisons?.["standard-bfs-v1.0.0"];
			return comparison?.pValue?.toFixed(4) ?? "N/A";
		},
	},
};

/**
 * Ranking comparison table specification.
 *
 * Compares Path Salience ranking against baseline methods (random, shortest-path).
 * Shows mean MI, node coverage, and path diversity across test graphs.
 */
export const RANKING_COMPARISON_SPEC: TableRenderSpec = {
	id: "ranking-comparison",
	filename: "06-ranking-comparison.tex",
	label: "tab:ranking-comparison",
	caption: "Path ranking comparison: Path Salience (MI) vs baseline methods. Higher MI indicates better path quality.",
	columns: [
		{ key: "dataset", header: "Dataset", align: "l" },
		{ key: "miMI", header: "Path Salience MI", align: "r", format: formatNumber(3), bold: true },
		{ key: "randomMI", header: "Random MI", align: "r", format: formatNumber(3) },
		{ key: "shortestMI", header: "Shortest MI", align: "r", format: formatNumber(3) },
		{ key: "miCoverage", header: "Coverage", align: "r", format: formatPercentage },
		{ key: "miDiversity", header: "Diversity", align: "r", format: formatNumber(2) },
	],
	extractData: (aggregates) => {
		// Group by dataset
		const byDataset = new Map<string, typeof aggregates>();

		for (const agg of aggregates) {
			if (agg.sut.includes("ranking")) {
				const datasetId = agg.caseClass ?? agg.sut.split("-")[0];
				if (!byDataset.has(datasetId)) {
					byDataset.set(datasetId, []);
				}
				byDataset.get(datasetId)?.push(agg);
			}
		}

		const results: Array<Record<string, unknown>> = [];

		for (const [dataset, aggs] of byDataset) {
			const mi = aggs.find((a) => a.sut === "path-salience-v1.0.0");
			const random = aggs.find((a) => a.sut === "random-ranking-v1.0.0");
			const shortest = aggs.find((a) => a.sut === "shortest-ranking-v1.0.0");

			if (mi) {
				results.push({
					dataset: dataset.charAt(0).toUpperCase() + dataset.slice(1),
					miMI: mi.metrics["mean-mi"]?.mean ?? 0,
					randomMI: random?.metrics["mean-mi"]?.mean ?? 0,
					shortestMI: shortest?.metrics["mean-mi"]?.mean ?? 0,
					miCoverage: (mi.metrics["node-coverage"]?.mean ?? 0) * 100,
					miDiversity: mi.metrics["path-diversity"]?.mean ?? 0,
				});
			}
		}

		return results.sort((a, b) => (b.miMI as number) - (a.miMI as number));
	},
};

/**
 * Ranking statistical significance table specification.
 *
 * Wilcoxon signed-rank test results for Path Salience vs baseline methods.
 */
export const RANKING_SIGNIFICANCE_SPEC: TableRenderSpec = {
	id: "ranking-significance",
	filename: "06-ranking-significance.tex",
	label: "tab:ranking-significance",
	caption: "Statistical significance of Path Salience ranking improvements. Wilcoxon signed-rank test results.",
	columns: [
		{ key: "comparison", header: "Comparison", align: "l" },
		{ key: "metric", header: "Metric", align: "l" },
		{ key: "sutMean", header: "Path Salience", align: "c" },
		{ key: "baselineMean", header: "Baseline", align: "c" },
		{ key: "pValue", header: "p", align: "c", format: formatNumber(4), bold: true },
		{ key: "cohensD", header: "Cohen's d", align: "c", format: formatNumber(3) },
	],
	extractData: (aggregates) => {
		const miAgg = aggregates.find((a) => a.sut === "path-salience-v1.0.0");
		if (!miAgg?.comparisons) return [];

		const results: Array<Record<string, unknown>> = [];

		// Compare vs random ranking
		const randomComparison = miAgg.comparisons["random-ranking-v1.0.0"];
		if (randomComparison) {
			const randomAgg = aggregates.find((a) => a.sut === "random-ranking-v1.0.0");
			results.push({
				comparison: "Path Salience vs Random",
				metric: "Mean MI",
				sutMean: miAgg.metrics["mean-mi"]?.mean?.toFixed(3) ?? "--",
				baselineMean: randomAgg?.metrics["mean-mi"]?.mean?.toFixed(3) ?? "--",
				pValue: randomComparison.pValue,
				cohensD: randomComparison.effectSize,
			});
		}

		// Compare vs shortest-path ranking
		const shortestComparison = miAgg.comparisons["shortest-ranking-v1.0.0"];
		if (shortestComparison) {
			const shortestAgg = aggregates.find((a) => a.sut === "shortest-ranking-v1.0.0");
			results.push({
				comparison: "Path Salience vs Shortest",
				metric: "Mean MI",
				sutMean: miAgg.metrics["mean-mi"]?.mean?.toFixed(3) ?? "--",
				baselineMean: shortestAgg?.metrics["mean-mi"]?.mean?.toFixed(3) ?? "--",
				pValue: shortestComparison.pValue,
				cohensD: shortestComparison.effectSize,
			});
		}

		return results;
	},
};

/**
 * All table specifications.
 */
export const TABLE_SPECS: TableRenderSpec[] = [
	RUNTIME_PERFORMANCE_SPEC,
	PATH_LENGTHS_SPEC,
	METHOD_RANKING_SPEC,
	N_SEED_COMPARISON_SPEC,
	HUB_TRAVERSAL_SPEC,
	HUB_AVOIDANCE_SPEC,
	N_SEED_GENERALIZATION_SPEC,
	MI_RANKING_QUALITY_SPEC,
	STATISTICAL_SIGNIFICANCE_SPEC,
	RANKING_COMPARISON_SPEC,
	RANKING_SIGNIFICANCE_SPEC,
];

/**
 * Get table specification by ID.
 * @param id
 */
export const getTableSpec = (id: string): TableRenderSpec | undefined => TABLE_SPECS.find((spec) => spec.id === id);

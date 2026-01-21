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
 * All table specifications.
 */
export const TABLE_SPECS: TableRenderSpec[] = [
	RUNTIME_PERFORMANCE_SPEC,
	PATH_LENGTHS_SPEC,
	METHOD_RANKING_SPEC,
	N_SEED_COMPARISON_SPEC,
	HUB_TRAVERSAL_SPEC,
	N_SEED_GENERALIZATION_SPEC,
	MI_RANKING_QUALITY_SPEC,
	STATISTICAL_SIGNIFICANCE_SPEC,
];

/**
 * Get table specification by ID.
 * @param id
 */
export const getTableSpec = (id: string): TableRenderSpec | undefined => TABLE_SPECS.find((spec) => spec.id === id);

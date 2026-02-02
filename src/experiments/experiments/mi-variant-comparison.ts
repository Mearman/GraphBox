/**
 * MI Variant Comparison Experiments
 *
 * Compares different MI formulations for path ranking:
 * - Jaccard (baseline Path Salience)
 * - Adamic-Adar
 * - Density-Normalized Jaccard
 * - IDF-Weighted
 * - Clustering-Penalized
 *
 * Addresses examiner feedback on narrow margin (rho=0.181 vs 0.131)
 * and negative correlation on dense social networks (Facebook).
 */

import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking.js";
import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers.js";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/index.js";
import { metrics } from "@graph/experiments/metrics/index.js";
import type { MIVariantComparisonMetric } from "@graph/experiments/metrics/types.js";

/**
 * MI configuration options (subset used by variants).
 */
interface MIConfigOptions {
	useAdamicAdar?: boolean;
	useDensityNormalization?: boolean;
	useIDFWeighting?: boolean;
	useClusteringPenalty?: boolean;
	/** Estimated total nodes for IDF weighting (streaming context) */
	estimatedTotalNodes?: number;
}

/**
 * MI variant configuration.
 */
interface MIVariantConfig {
	/** Display name for the variant */
	name: string;
	/** MI configuration options */
	miConfig: MIConfigOptions;
}

/**
 * Available MI variants.
 */
const MI_VARIANTS: MIVariantConfig[] = [
	{
		name: "Jaccard (baseline)",
		miConfig: {},
	},
	{
		name: "Adamic-Adar",
		miConfig: { useAdamicAdar: true },
	},
	{
		name: "Density-Normalized",
		miConfig: { useDensityNormalization: true },
	},
	{
		name: "IDF-Weighted",
		miConfig: { useIDFWeighting: true },
	},
	{
		name: "IDF-Weighted (N=250M)",
		miConfig: { useIDFWeighting: true, estimatedTotalNodes: 250_000_000 },
	},
	{
		name: "Clustering-Penalized",
		miConfig: { useClusteringPenalty: true },
	},
];

/**
 * Benchmark datasets for comparison.
 *
 * Includes:
 * - Small social networks (Karate, Les Mis)
 * - Citation networks (Cora, CiteSeer, Cit-HepTH)
 * - Collaboration networks (CA-CondMat, CA-HepPh, CA-Astroph)
 * - Dense social network (Facebook) - key for addressing negative correlation issue
 */
const DATASETS = [
	// Small social networks
	{ id: "karate", name: "Karate Club", source: "1", target: "34", maxPaths: 15, category: "social" },
	{ id: "lesmis", name: "Les Misérables", source: "Myriel", target: "Marius", maxPaths: 18, category: "social" },

	// Citation networks
	{ id: "cora", name: "Cora", source: "11342", target: "379288", maxPaths: 10, category: "citation" },
	{ id: "citeseer", name: "CiteSeer", source: "527452", target: "tzitzikas01democratic", maxPaths: 10, category: "citation" },
	{ id: "cit-hepth", name: "Cit-HepTH", source: "9711083", target: "9903207", maxPaths: 10, category: "citation" },

	// Collaboration networks
	{ id: "ca-astroph", name: "CA-Astroph", source: "34890", target: "8744", maxPaths: 10, category: "collaboration" },
	{ id: "ca-condmat", name: "CA-CondMat", source: "12648", target: "27230", maxPaths: 10, category: "collaboration" },
	{ id: "ca-hepph", name: "CA-HepPh", source: "50500", target: "82081", maxPaths: 10, category: "collaboration" },

	// Dense social network (key for addressing examiner concern)
	{ id: "facebook", name: "Facebook", source: "0", target: "4000", maxPaths: 15, category: "dense-social" },
];

/**
 * Run MI variant comparison on a single dataset.
 * @param dataset
 */
const runVariantComparisonOnDataset = async (
	dataset: typeof DATASETS[number],
): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl(dataset.id);
	const graph = benchmark.graph;

	for (const variant of MI_VARIANTS) {
		const result = rankPaths(graph, dataset.source, dataset.target, {
			maxPaths: dataset.maxPaths,
			miConfig: variant.miConfig,
		});

		if (result.ok && result.value.some) {
			const paths = result.value.value;
			const rankingMetrics = computeRankingMetrics(paths, graph);

			metrics.record("mi-variant-comparison", {
				dataset: dataset.name,
				variant: variant.name,
				// Store full precision for MI values (sparse graphs have very small values)
				meanMI: rankingMetrics.meanMI,
				stdMI: rankingMetrics.stdMI,
				nodeCoverage: Math.round(rankingMetrics.nodeCoverage * 1000) / 1000,
				pathDiversity: Math.round(rankingMetrics.pathDiversity * 1000) / 1000,
				hubAvoidance: Math.round(rankingMetrics.hubAvoidance * 1000) / 1000,
				pathsFound: paths.length,
			} satisfies MIVariantComparisonMetric);
		} else {
			// Record empty result for failed ranking
			metrics.record("mi-variant-comparison", {
				dataset: dataset.name,
				variant: variant.name,
				meanMI: 0,
				stdMI: 0,
				nodeCoverage: 0,
				pathDiversity: 0,
				hubAvoidance: 0,
				pathsFound: 0,
			} satisfies MIVariantComparisonMetric);
		}
	}
};

/**
 * Run MI variant comparison experiments across all benchmark datasets.
 *
 * Generates data for thesis table comparing MI formulations.
 */
export const runMIVariantComparison = async (): Promise<void> => {
	console.log("Running MI Variant Comparison experiments...");

	for (const dataset of DATASETS) {
		await runVariantComparisonOnDataset(dataset);
		console.log(`  ✓ ${dataset.name} complete`);
	}

	console.log("MI Variant Comparison experiments complete!");
};

/**
 * Export MI variant comparison results to console (for debugging).
 */
export const printMIVariantSummary = async (): Promise<void> => {
	const allMetrics = metrics.getAll();
	const variantMetrics = allMetrics["mi-variant-comparison"] as MIVariantComparisonMetric[] | undefined;

	if (!variantMetrics || variantMetrics.length === 0) {
		console.log("No MI variant comparison data available. Run experiments first.");
		return;
	}

	console.log("\n=== MI Variant Comparison Summary ===\n");

	// Group by dataset
	const byDataset = new Map<string, MIVariantComparisonMetric[]>();
	for (const m of variantMetrics) {
		const existing = byDataset.get(m.dataset) ?? [];
		existing.push(m);
		byDataset.set(m.dataset, existing);
	}

	for (const [dataset, variantResults] of byDataset) {
		console.log(`\n${dataset}:`);
		console.log("─".repeat(100));
		console.log(
			"Variant".padEnd(26),
			"Mean MI".padStart(12),
			"Std MI".padStart(12),
			"Coverage".padStart(10),
			"Diversity".padStart(10),
			"Hub Avoid".padStart(10),
		);
		console.log("─".repeat(100));

		for (const v of variantResults) {
			// Use scientific notation for very small values
			const formatMI = (val: number): string => {
				if (val === 0) return "0".padStart(12);
				if (val < 0.001) return val.toExponential(2).padStart(12);
				return val.toFixed(4).padStart(12);
			};

			console.log(
				v.variant.padEnd(26),
				formatMI(v.meanMI),
				formatMI(v.stdMI),
				v.nodeCoverage.toFixed(3).padStart(10),
				v.pathDiversity.toFixed(3).padStart(10),
				v.hubAvoidance.toFixed(3).padStart(10),
			);
		}
	}
};

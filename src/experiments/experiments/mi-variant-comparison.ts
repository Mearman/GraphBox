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
		name: "Clustering-Penalized",
		miConfig: { useClusteringPenalty: true },
	},
];

/**
 * Benchmark datasets for comparison.
 */
const DATASETS = [
	{ id: "karate", name: "Karate Club", source: "1", target: "34", maxPaths: 15, category: "social" },
	{ id: "lesmis", name: "Les Misérables", source: "Myriel", target: "Marius", maxPaths: 18, category: "social" },
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
				meanMI: Math.round(rankingMetrics.meanMI * 1000) / 1000,
				stdMI: Math.round(rankingMetrics.stdMI * 1000) / 1000,
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
		console.log("─".repeat(80));
		console.log(
			"Variant".padEnd(22),
			"Mean MI".padStart(10),
			"Std MI".padStart(10),
			"Coverage".padStart(10),
			"Diversity".padStart(10),
			"Hub Avoid".padStart(10),
		);
		console.log("─".repeat(80));

		for (const v of variantResults) {
			console.log(
				v.variant.padEnd(22),
				v.meanMI.toFixed(3).padStart(10),
				v.stdMI.toFixed(3).padStart(10),
				v.nodeCoverage.toFixed(3).padStart(10),
				v.pathDiversity.toFixed(3).padStart(10),
				v.hubAvoidance.toFixed(3).padStart(10),
			);
		}
	}
};

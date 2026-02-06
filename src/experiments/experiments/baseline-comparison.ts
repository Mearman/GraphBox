/**
 * Comprehensive Baseline Comparison Experiments
 *
 * Compares all MI variants against established baselines from the literature:
 * - Betweenness Centrality (Brandes' algorithm)
 * - PageRank (power iteration)
 * - Degree Sum (simple baseline)
 * - Shortest Path (conventional)
 * - Random (null hypothesis)
 *
 * Addresses examiner feedback by showing significant improvement over
 * established methods, not just narrow margin vs random.
 */

import type { Graph } from "@graph/algorithms/graph/graph.js";
import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking.js";
import type { Edge, Node } from "@graph/algorithms/types/graph.js";
import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers.js";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/index.js";
import { betweennessRanking, computeBetweennessCentrality } from "@graph/experiments/baselines/betweenness-ranking.js";
import { degreeSumRanking } from "@graph/experiments/baselines/degree-sum-ranking.js";
import { computePageRank, pageRankSumRanking } from "@graph/experiments/baselines/pagerank-sum-ranking.js";
import { randomPathRanking } from "@graph/experiments/baselines/random-path-ranking.js";
import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking.js";
import { metrics } from "@graph/experiments/metrics/index.js";
import { kendallTauB } from "@graph/experiments/metrics/kendall-tau.js";
import { geometricMeanPathScore } from "@graph/experiments/metrics/path-level-scoring.js";
import type { BaselineComparisonMetric, RankingOrderComparisonMetric } from "@graph/experiments/metrics/types.js";

/**
 * Method configuration for ranking algorithms.
 */
interface MethodConfig {
	/** Display name for the method */
	name: string;
	/** Method category: 'ours' for MI variants, 'baseline' for established methods */
	category: "ours" | "baseline";
	/** MI configuration options (for 'ours' methods) */
	miConfig?: {
		useAdamicAdar?: boolean;
		useDensityNormalization?: boolean;
		useIDFWeighting?: boolean;
		useClusteringPenalty?: boolean;
		estimatedTotalNodes?: number;
	};
}

/**
 * All methods to compare (our MI variants + established baselines).
 */
const METHODS: MethodConfig[] = [
	// Our MI variants
	{ name: "Jaccard MI", category: "ours", miConfig: {} },
	{ name: "Adamic-Adar MI", category: "ours", miConfig: { useAdamicAdar: true } },
	{ name: "Density-Normalized MI", category: "ours", miConfig: { useDensityNormalization: true } },
	{ name: "IDF-Weighted MI", category: "ours", miConfig: { useIDFWeighting: true } },
	{ name: "IDF-Weighted MI (N=250M)", category: "ours", miConfig: { useIDFWeighting: true, estimatedTotalNodes: 250_000_000 } },
	{ name: "Clustering-Penalized MI", category: "ours", miConfig: { useClusteringPenalty: true } },

	// Established baselines (for comparison, not as SUTs to test)
	{ name: "Betweenness Centrality", category: "baseline" },
	{ name: "PageRank", category: "baseline" },
	{ name: "Degree Sum", category: "baseline" },
	{ name: "Shortest Path", category: "baseline" },
	{ name: "Random", category: "baseline" },
];

/**
 * Dataset→category mapping for per-category table splitting.
 */
const GRAPH_CATEGORIES: Record<string, string> = {
	"Karate Club": "small",
	"Les Misérables": "small",
	"Cora": "citation",
	"CiteSeer": "citation",
	"Cit-HepTH": "citation",
	"CA-Astroph": "collaboration",
	"CA-CondMat": "collaboration",
	"CA-HepPh": "collaboration",
	"Facebook": "social",
};

/**
 * Benchmark datasets (same 9 datasets from MI variant comparison).
 */
const DATASETS = [
	{ id: "karate", name: "Karate Club", source: "1", target: "34", maxPaths: 15 },
	{ id: "lesmis", name: "Les Misérables", source: "Myriel", target: "Marius", maxPaths: 18 },
	{ id: "cora", name: "Cora", source: "11342", target: "379288", maxPaths: 10 },
	{ id: "citeseer", name: "CiteSeer", source: "527452", target: "tzitzikas01democratic", maxPaths: 10 },
	{ id: "cit-hepth", name: "Cit-HepTH", source: "9711083", target: "9903207", maxPaths: 10 },
	{ id: "ca-astroph", name: "CA-Astroph", source: "34890", target: "8744", maxPaths: 10 },
	{ id: "ca-condmat", name: "CA-CondMat", source: "12648", target: "27230", maxPaths: 10 },
	{ id: "ca-hepph", name: "CA-HepPh", source: "50500", target: "82081", maxPaths: 10 },
	{ id: "facebook", name: "Facebook", source: "0", target: "4000", maxPaths: 15 },
];

/**
 * Run baseline comparison on a single dataset.
 * @param dataset
 */
const runBaselineComparisonOnDataset = async (dataset: typeof DATASETS[number]): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl(dataset.id);
	const graph = benchmark.graph;

	for (const method of METHODS) {
		let result;

		// Call appropriate ranking function based on category
		if (method.category === "ours") {
			result = rankPaths(graph, dataset.source, dataset.target, {
				maxPaths: dataset.maxPaths,
				miConfig: method.miConfig ?? {},
			});
		} else {
			// Established baselines
			switch (method.name) {
				case "Betweenness Centrality": {
					result = betweennessRanking(graph, dataset.source, dataset.target, { maxPaths: dataset.maxPaths });
					break;
				}
				case "PageRank": {
					result = pageRankSumRanking(graph, dataset.source, dataset.target, { maxPaths: dataset.maxPaths });
					break;
				}
				case "Degree Sum": {
					result = degreeSumRanking(graph, dataset.source, dataset.target, { maxPaths: dataset.maxPaths });
					break;
				}
				case "Shortest Path": {
					result = shortestPathRanking(graph, dataset.source, dataset.target, { maxPaths: dataset.maxPaths });
					break;
				}
				case "Random": {
					result = randomPathRanking(graph, dataset.source, dataset.target, { maxPaths: dataset.maxPaths });
					break;
				}
				default: {
					continue;
				}
			}
		}

		if (result.ok && result.value.some) {
			const paths = result.value.value;
			const rankingMetrics = computeRankingMetrics(paths, graph);

			metrics.record("ranking-method-comparison", {
				dataset: dataset.name,
				method: method.name,
				category: method.category,
				graphCategory: GRAPH_CATEGORIES[dataset.name] ?? "unknown",
				meanMI: rankingMetrics.meanMI,
				nodeCoverage: Math.round(rankingMetrics.nodeCoverage * 10_000) / 10_000,
				pathDiversity: Math.round(rankingMetrics.pathDiversity * 10_000) / 10_000,
				hubAvoidance: Math.round(rankingMetrics.hubAvoidance * 10_000) / 10_000,
				pathsFound: paths.length,
			} satisfies BaselineComparisonMetric);
		} else {
			// Record empty result for failed ranking
			metrics.record("ranking-method-comparison", {
				dataset: dataset.name,
				method: method.name,
				category: method.category,
				graphCategory: GRAPH_CATEGORIES[dataset.name] ?? "unknown",
				meanMI: 0,
				nodeCoverage: 0,
				pathDiversity: 0,
				hubAvoidance: 0,
				pathsFound: 0,
			} satisfies BaselineComparisonMetric);
		}
	}
};

/**
 * Centrality baselines for ranking order comparison.
 * Each entry specifies how to compute node-level scores for a baseline.
 */
const CENTRALITY_BASELINES: Array<{
	name: string;
	computeScores: <N extends Node, E extends Edge>(graph: Graph<N, E>) => Map<string, number>;
}> = [
	{
		name: "Betweenness Centrality",
		computeScores: (graph) => computeBetweennessCentrality(graph, "undirected"),
	},
	{
		name: "PageRank",
		computeScores: (graph) => computePageRank(graph, 0.85, 100),
	},
	{
		name: "Degree Sum",
		computeScores: (graph) => {
			const scores = new Map<string, number>();
			for (const node of graph.getAllNodes()) {
				const neighbours = graph.getNeighbors(node.id);
				scores.set(node.id, neighbours.ok ? neighbours.value.length : 0);
			}
			return scores;
		},
	},
];

/**
 * Run ranking order comparison on a single dataset.
 *
 * Computes MI-ranked paths, then scores the SAME paths using each
 * centrality baseline's geometric mean. Records Kendall's tau-b
 * between MI ranking order and each baseline's ranking order.
 * @param dataset
 */
const runRankingOrderComparisonOnDataset = async (dataset: typeof DATASETS[number]): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl(dataset.id);
	const graph = benchmark.graph;

	// Get MI-ranked paths (Jaccard MI as reference)
	const miResult = rankPaths(graph, dataset.source, dataset.target, {
		maxPaths: dataset.maxPaths,
		miConfig: {},
	});

	if (!miResult.ok || !miResult.value.some || miResult.value.value.length < 2) {
		return;
	}

	const miPaths = miResult.value.value;
	const miScores = miPaths.map((p) => p.geometricMeanMI);
	const miMean = miScores.reduce((a, b) => a + b, 0) / miScores.length;

	// Extract node IDs for each path (used for geometric mean scoring)
	const pathNodeIds = miPaths.map((p) => p.path.nodes.map((n) => n.id));

	for (const baseline of CENTRALITY_BASELINES) {
		const nodeScores = baseline.computeScores(graph);

		// Score each MI-ranked path using baseline's geometric mean
		const baselineScores = pathNodeIds.map(
			(nodes) => geometricMeanPathScore(nodeScores, nodes),
		);

		// Mean geometric mean path score for this baseline
		const meanPathScore = baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length;

		// Kendall's tau-b between MI scores and baseline scores
		const tau = kendallTauB(miScores, baselineScores);

		metrics.record("ranking-order-comparison", {
			dataset: dataset.name,
			method: baseline.name,
			graphCategory: GRAPH_CATEGORIES[dataset.name] ?? "unknown",
			kendallTau: Math.round(tau * 10_000) / 10_000,
			pathScore: Math.round(meanPathScore * 10_000) / 10_000,
			meanMI: Math.round(miMean * 10_000) / 10_000,
			pathsCompared: miPaths.length,
		} satisfies RankingOrderComparisonMetric);
	}
};

/**
 * Run all baseline comparison experiments.
 *
 * Generates data for thesis table comparing all methods against established baselines.
 */
export const runBaselineComparison = async (): Promise<void> => {
	console.log("Running Baseline Comparison experiments...");

	for (const dataset of DATASETS) {
		await runBaselineComparisonOnDataset(dataset);
		console.log(`  ✓ ${dataset.name} complete`);
	}

	console.log("Running Ranking Order Comparison experiments...");

	for (const dataset of DATASETS) {
		await runRankingOrderComparisonOnDataset(dataset);
		console.log(`  ✓ ${dataset.name} ranking order complete`);
	}

	console.log("Baseline Comparison experiments complete!");
};

/**
 * Print baseline comparison summary (for debugging).
 */
export const printBaselineSummary = async (): Promise<void> => {
	const allMetrics = metrics.getAll();
	const baselineMetrics = allMetrics["ranking-method-comparison"] as BaselineComparisonMetric[] | undefined;

	if (!baselineMetrics || baselineMetrics.length === 0) {
		console.log("No baseline comparison data available. Run experiments first.");
		return;
	}

	console.log("\n=== Baseline Comparison Summary ===\n");

	// Group by dataset
	const byDataset = new Map<string, BaselineComparisonMetric[]>();
	for (const m of baselineMetrics) {
		const existing = byDataset.get(m.dataset) ?? [];
		existing.push(m);
		byDataset.set(m.dataset, existing);
	}

	for (const [dataset, methodResults] of byDataset) {
		console.log(`\n${dataset}:`);
		console.log("─".repeat(110));
		console.log(
			"Method".padEnd(30),
			"Category".padEnd(12),
			"Mean MI".padStart(12),
			"Coverage".padStart(10),
			"Diversity".padStart(10),
			"Hub Avoid".padStart(10),
			"Paths".padStart(6),
		);
		console.log("─".repeat(110));

		// Sort: our methods first, then baselines
		const sorted = methodResults.toSorted((a, b) => {
			if (a.category === b.category) return a.method.localeCompare(b.method);
			return a.category === "ours" ? -1 : 1;
		});

		for (const m of sorted) {
			const formatMI = (val: number): string => {
				if (val === 0) return "0".padStart(12);
				if (val < 0.001) return val.toExponential(2).padStart(12);
				return val.toFixed(4).padStart(12);
			};

			console.log(
				m.method.padEnd(30),
				m.category.padEnd(12),
				formatMI(m.meanMI),
				m.nodeCoverage.toFixed(4).padStart(10),
				m.pathDiversity.toFixed(4).padStart(10),
				m.hubAvoidance.toFixed(4).padStart(10),
				String(m.pathsFound).padStart(6),
			);
		}
	}
};

// Run experiments if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runBaselineComparison().catch(console.error);
}

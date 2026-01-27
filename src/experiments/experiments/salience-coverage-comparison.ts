/**
 * Salience Coverage Comparison Experiments
 *
 * Evaluates novel expansion algorithms (EGE, PPME, RSGE) and baseline variants
 * on their ability to discover high-salience paths.
 *
 * Ground truth: Paths ranked highly by Path Salience algorithm (MI-based ranking)
 * Metric: What percentage of top-K salient paths does each method discover?
 */

import { Graph } from "@graph/algorithms/graph/graph.js";
import { DegreePrioritisedExpansion } from "@graph/algorithms/traversal/degree-prioritised-expansion.js";
import { EntropyGuidedExpansion } from "@graph/algorithms/traversal/entropy-guided-expansion.js";
import { PathPreservingExpansion } from "@graph/algorithms/traversal/path-preserving-expansion.js";
import { RetrospectiveSalienceExpansion } from "@graph/algorithms/traversal/retrospective-salience-expansion.js";
import type { Edge, Node } from "@graph/algorithms/types/graph.js";
import { BenchmarkGraphExpander } from "@graph/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/index.js";
import {
	computeSalienceCoverage,
	computeSalienceGroundTruth,
} from "@graph/evaluation/metrics/salience-coverage.js";
import { CrossSeedAffinityExpansion } from "@graph/experiments/baselines/cross-seed-affinity.js";
import { DegreeSurpriseExpansion } from "@graph/experiments/baselines/degree-surprise.js";
import { DelayedTerminationExpansion } from "@graph/experiments/baselines/delayed-termination.js";
import { EnsembleExpansion } from "@graph/experiments/baselines/ensemble-expansion.js";
import { FrontierBalancedExpansion } from "@graph/experiments/baselines/frontier-balanced.js";
import { RandomPriorityExpansion } from "@graph/experiments/baselines/random-priority.js";
import { StandardBfsExpansion } from "@graph/experiments/baselines/standard-bfs.js";
import { metrics } from "@graph/experiments/metrics/index.js";

/**
 * Configuration for a test case
 */
interface TestCase {
	name: string;
	getGraph: () => Promise<{ graph: Graph<Node, Edge>; directed: boolean }>;
	seeds: string[];
	topK: number;
}

/**
 * Define test cases covering real-world social networks
 */
const getTestCases = (): TestCase[] => [
	// Real-world social networks
	{
		name: "karate",
		getGraph: async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			return { graph: benchmark.graph, directed: benchmark.meta.directed };
		},
		seeds: ["1", "34"], // Opposite factions (node IDs are "1"-"34")
		topK: 10,
	},
	{
		name: "lesmis",
		getGraph: async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			return { graph: benchmark.graph, directed: benchmark.meta.directed };
		},
		seeds: ["Valjean", "Javert"], // Two major characters (reduced to avoid path enumeration explosion)
		topK: 10,
	},
];

/**
 * Create all expansion methods for comparison
 * @param expander
 * @param seeds
 */
const createMethods = (expander: BenchmarkGraphExpander, seeds: string[]) => [
	// Baselines
	{
		name: "Standard BFS",
		create: () => new StandardBfsExpansion(expander, seeds),
	},
	{
		name: "Degree-Prioritised",
		create: () => new DegreePrioritisedExpansion(expander, seeds),
	},
	{
		name: "Frontier-Balanced",
		create: () => new FrontierBalancedExpansion(expander, seeds),
	},
	{
		name: "Random Priority",
		create: () => new RandomPriorityExpansion(expander, seeds, 42),
	},

	// Novel algorithms
	{
		name: "Entropy-Guided (EGE)",
		create: () => new EntropyGuidedExpansion(expander, seeds),
	},
	{
		name: "Path-Preserving (PPME)",
		create: () => new PathPreservingExpansion(expander, seeds),
	},
	{
		name: "Retrospective Salience (RSGE)",
		create: () => new RetrospectiveSalienceExpansion(expander, seeds),
	},

	// Baseline variants
	{
		name: "Delayed Termination +50",
		create: () =>
			new DelayedTerminationExpansion(expander, seeds, {
				delayIterations: 50,
			}),
	},
	{
		name: "Delayed Termination +100",
		create: () =>
			new DelayedTerminationExpansion(expander, seeds, {
				delayIterations: 100,
			}),
	},
	{
		name: "Degree Surprise",
		create: () => new DegreeSurpriseExpansion(expander, seeds),
	},
	{
		name: "Ensemble (BFS∪DFS∪DP)",
		create: () => new EnsembleExpansion(expander, seeds),
	},
	{
		name: "Cross-Seed Affinity",
		create: () => new CrossSeedAffinityExpansion(expander, seeds),
	},
];

/**
 * Evaluate a single expansion method
 * @param method
 * @param testCaseName
 * @param seedCount
 * @param groundTruth
 */
const evaluateMethod = async (
	method: ReturnType<typeof createMethods>[0],
	testCaseName: string,
	seedCount: number,
	groundTruth: Set<string>,
) => {
	const algo = method.create();
	const startTime = performance.now();
	const result = await algo.run();
	const elapsedMs = performance.now() - startTime;

	const coverage = computeSalienceCoverage(result.paths, groundTruth);

	const nodesExpanded =
		"nodesExpanded" in result.stats
			? result.stats.nodesExpanded
			: result.sampledNodes.size;
	const iterations = "iterations" in result.stats ? result.stats.iterations : 0;

	metrics.record("salience-coverage-comparison", {
		dataset: testCaseName,
		method: method.name,
		n: seedCount,
		salienceCoverage: Math.round(coverage["salience-coverage"] * 1000) / 1000,
		saliencePrecision: Math.round(coverage["salience-precision"] * 1000) / 1000,
		topKFound: coverage["top-k-found"],
		topKTotal: coverage["top-k-total"],
		pathsDiscovered: result.paths.length,
		nodesExpanded,
		iterations,
		runtimeMs: Math.round(elapsedMs * 10) / 10,
	});

	console.log(
		`   ✓ ${method.name.padEnd(30)} Coverage: ${(coverage["salience-coverage"] * 100).toFixed(1)}% (${coverage["top-k-found"]}/${coverage["top-k-total"]})`,
	);
};

/**
 * Run salience coverage experiments comparing all methods
 */
export const runSalienceCoverageExperiments = async (): Promise<void> => {
	console.log("\nSalience Coverage Comparison");
	console.log("═══════════════════════════════════════════════════════════\n");

	const testCases = getTestCases();

	for (const testCase of testCases) {
		console.log(`\nTest Case: ${testCase.name}`);
		console.log(`   Seeds: ${testCase.seeds.join(", ")}`);
		console.log(`   Top-K: ${testCase.topK}\n`);

		const { graph, directed } = await testCase.getGraph();
		const expander = new BenchmarkGraphExpander(graph, directed);

		console.log("   Computing ground truth salience paths...");
		const groundTruth = computeSalienceGroundTruth(graph, testCase.seeds, {
			topK: testCase.topK,
			lambda: 0,
			traversalMode: directed ? "directed" : "undirected",
		});

		console.log(`   Ground truth: ${groundTruth.size} high-salience paths\n`);

		if (groundTruth.size === 0) {
			console.log("   WARNING: No ground truth paths found, skipping test case\n");
			continue;
		}

		const methods = createMethods(expander, testCase.seeds);

		for (const method of methods) {
			try {
				await evaluateMethod(
					method,
					testCase.name,
					testCase.seeds.length,
					groundTruth,
				);
			} catch (error) {
				console.error(`   ✗ ${method.name} failed:`, error);
			}
		}
	}

	console.log("\nSalience coverage experiments complete\n");
};

/**
 * Main entry point for running all experiments
 */
export const runAllSalienceCoverageExperiments = async (): Promise<void> => {
	await runSalienceCoverageExperiments();
};

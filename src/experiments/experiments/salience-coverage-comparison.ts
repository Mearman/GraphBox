/**
 * Salience Coverage Comparison Experiments
 *
 * Evaluates novel expansion algorithms (EGE, PPME, RSGE), baseline variants,
 * and intelligent termination strategies (IDT) on their ability to discover
 * high-salience paths.
 *
 * Ground truth: Paths ranked highly by Path Salience algorithm (MI-based ranking)
 * Metric: What percentage of top-K salient paths does each method discover?
 */

import { Graph } from "@graph/algorithms/graph/graph.js";
import { DegreePrioritisedExpansion } from "@graph/algorithms/traversal/degree-prioritised-expansion.js";
import { EntropyGuidedExpansion } from "@graph/algorithms/traversal/entropy-guided-expansion.js";
import { IntelligentDelayedTermination } from "@graph/algorithms/traversal/intelligent-delayed-termination.js";
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
import { retroactivePathEnumeration } from "@graph/experiments/baselines/retroactive-path-enum.js";
import { StandardBfsExpansion } from "@graph/experiments/baselines/standard-bfs.js";
import { metrics } from "@graph/experiments/metrics/index.js";

/**
 * Coverage efficiency metrics for comparing algorithms.
 */
interface CoverageEfficiencyMetrics {
	/** First-discovery iteration for each salient path (path signature → iteration) */
	pathDiscoveryIterations: Map<string, number>;
	/** Coverage at budget checkpoints (10%, 25%, 50%, 75%, 100%) */
	budgetCheckpoints: { budget: number; coverage: number }[];
	/** Area under the coverage-vs-iterations curve (normalised 0-1) */
	auc: number;
	/** Median first-discovery iteration across all salient paths */
	medianDiscoveryIteration: number;
}

/**
 * Compute coverage efficiency metrics using node discovery iteration data.
 *
 * @param groundTruth - Set of path signatures representing top-K salient paths
 * @param nodeDiscoveryIteration - Map of node → iteration when first discovered
 * @param totalIterations - Total iterations run by the algorithm
 * @returns Coverage efficiency metrics
 */
const computeCoverageEfficiency = (
	groundTruth: Set<string>,
	nodeDiscoveryIteration: Map<string, number>,
	totalIterations: number,
): CoverageEfficiencyMetrics => {
	// Compute first-discovery iteration for each salient path
	// A path is "discoverable" when ALL its nodes have been sampled
	const pathDiscoveryIterations = new Map<string, number>();

	for (const pathSig of groundTruth) {
		const nodes = pathSig.split("->");
		let maxIteration = 0;
		let allNodesDiscovered = true;

		for (const node of nodes) {
			const iteration = nodeDiscoveryIteration.get(node);
			if (iteration === undefined) {
				allNodesDiscovered = false;
				break;
			}
			maxIteration = Math.max(maxIteration, iteration);
		}

		if (allNodesDiscovered) {
			pathDiscoveryIterations.set(pathSig, maxIteration);
		}
	}

	// Compute coverage at budget checkpoints
	const budgetPercentages = [0.1, 0.25, 0.5, 0.75, 1];
	const budgetCheckpoints: { budget: number; coverage: number }[] = [];

	for (const pct of budgetPercentages) {
		const budgetIterations = Math.floor(totalIterations * pct);
		let pathsDiscoveredByBudget = 0;

		for (const [, iteration] of pathDiscoveryIterations) {
			if (iteration <= budgetIterations) {
				pathsDiscoveredByBudget++;
			}
		}

		budgetCheckpoints.push({
			budget: pct,
			coverage: groundTruth.size > 0 ? pathsDiscoveredByBudget / groundTruth.size : 0,
		});
	}

	// Compute AUC using trapezoidal rule
	// Higher AUC = finds salient paths earlier
	let auc = 0;
	if (totalIterations > 0 && groundTruth.size > 0) {
		// Create coverage curve at each iteration
		const discoveryIterations = [...pathDiscoveryIterations.values()].sort((a, b) => a - b);
		let pathsFound = 0;
		let previousIteration = 0;

		for (const iteration of discoveryIterations) {
			// Add area for flat region from prevIteration to iteration
			const width = (iteration - previousIteration) / totalIterations;
			const height = pathsFound / groundTruth.size;
			auc += width * height;

			pathsFound++;
			previousIteration = iteration;
		}

		// Add area from last discovery to end
		const remainingWidth = (totalIterations - previousIteration) / totalIterations;
		const finalHeight = pathsFound / groundTruth.size;
		auc += remainingWidth * finalHeight;
	}

	// Compute median first-discovery iteration
	const sortedIterations = [...pathDiscoveryIterations.values()].sort((a, b) => a - b);
	const medianDiscoveryIteration =
		sortedIterations.length > 0
			? sortedIterations[Math.floor(sortedIterations.length / 2)]
			: totalIterations; // If no paths found, use max

	return {
		pathDiscoveryIterations,
		budgetCheckpoints,
		auc,
		medianDiscoveryIteration,
	};
};

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

	// Intelligent termination strategies
	{
		name: "Intelligent Delayed +50",
		create: () =>
			new IntelligentDelayedTermination(expander, seeds, {
				delayIterations: 50,
			}),
	},
	{
		name: "Intelligent Delayed +100",
		create: () =>
			new IntelligentDelayedTermination(expander, seeds, {
				delayIterations: 100,
			}),
	},
];

/**
 * Evaluate a single expansion method
 * @param method
 * @param testCaseName
 * @param seedCount
 * @param groundTruth
 * @param expander - Graph expander for retroactive path enumeration
 * @param seeds - Seed node IDs for path enumeration
 */
const evaluateMethod = async (
	method: ReturnType<typeof createMethods>[0],
	testCaseName: string,
	seedCount: number,
	groundTruth: Set<string>,
	expander: BenchmarkGraphExpander,
	seeds: string[],
) => {
	const algo = method.create();
	const startTime = performance.now();
	const expansionResult = await algo.run();
	const elapsedMs = performance.now() - startTime;

	// POST-PROCESS: Enumerate ALL simple paths through sampled subgraph
	// This measures subgraph quality: does the sampled region contain high-salience paths?
	// We use retroactive enumeration for all methods to ensure fair comparison,
	// since different algorithms have different online path detection strategies.
	//
	// Use shorter maxLength (7) for tractability on dense graphs like Les Misérables.
	// The ground truth computation uses maxLength=10, so we may miss some longer paths.
	const enumResult = await retroactivePathEnumeration(
		expansionResult,
		expander,
		seeds,
		7, // maxLength - reduced for computational tractability
	);
	const paths = enumResult.paths;

	const coverage = computeSalienceCoverage(paths, groundTruth);

	const nodesExpanded =
		"nodesExpanded" in expansionResult.stats
			? expansionResult.stats.nodesExpanded
			: expansionResult.sampledNodes.size;
	const iterations =
		"iterations" in expansionResult.stats ? expansionResult.stats.iterations : 0;

	// Compute coverage efficiency metrics using node discovery iteration data
	const nodeDiscoveryIteration =
		"nodeDiscoveryIteration" in expansionResult
			? (expansionResult.nodeDiscoveryIteration)
			: new Map<string, number>();

	const efficiencyMetrics = computeCoverageEfficiency(groundTruth, nodeDiscoveryIteration, iterations);

	// Extract checkpoint coverages for recording
	const coverage10 = efficiencyMetrics.budgetCheckpoints.find((c) => c.budget === 0.1)?.coverage ?? 0;
	const coverage25 = efficiencyMetrics.budgetCheckpoints.find((c) => c.budget === 0.25)?.coverage ?? 0;
	const coverage50 = efficiencyMetrics.budgetCheckpoints.find((c) => c.budget === 0.5)?.coverage ?? 0;
	const coverage75 = efficiencyMetrics.budgetCheckpoints.find((c) => c.budget === 0.75)?.coverage ?? 0;

	metrics.record("salience-coverage-comparison", {
		dataset: testCaseName,
		method: method.name,
		n: seedCount,
		salienceCoverage: Math.round(coverage["salience-coverage"] * 1000) / 1000,
		saliencePrecision: Math.round(coverage["salience-precision"] * 1000) / 1000,
		topKFound: coverage["top-k-found"],
		topKTotal: coverage["top-k-total"],
		pathsDiscovered: paths.length,
		nodesExpanded,
		iterations,
		// Coverage efficiency metrics
		coverage10pct: Math.round(coverage10 * 1000) / 1000,
		coverage25pct: Math.round(coverage25 * 1000) / 1000,
		coverage50pct: Math.round(coverage50 * 1000) / 1000,
		coverage75pct: Math.round(coverage75 * 1000) / 1000,
		auc: Math.round(efficiencyMetrics.auc * 1000) / 1000,
		medianDiscoveryIteration: efficiencyMetrics.medianDiscoveryIteration,
		runtimeMs: Math.round(elapsedMs * 10) / 10,
	});

	console.log(
		`   ✓ ${method.name.padEnd(30)} Coverage: ${(coverage["salience-coverage"] * 100).toFixed(1)}% (${coverage["top-k-found"]}/${coverage["top-k-total"]}) | AUC: ${efficiencyMetrics.auc.toFixed(3)} | Median: ${efficiencyMetrics.medianDiscoveryIteration}`,
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
					expander,
					testCase.seeds,
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

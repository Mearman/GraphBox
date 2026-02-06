/**
 * Bidirectional BFS Experiments
 *
 * Evaluates Degree-Prioritised Bidirectional BFS against baseline methods.
 * Generates metrics for thesis tables on hub traversal, path diversity, and runtime.
 */

import { DegreePrioritisedExpansion } from "@graph/algorithms/traversal/degree-prioritised-expansion.js";
import { EntropyGuidedExpansion } from "@graph/algorithms/traversal/entropy-guided-expansion.js";
import { IntelligentDelayedTermination } from "@graph/algorithms/traversal/intelligent-delayed-termination.js";
import { PathPreservingExpansion } from "@graph/algorithms/traversal/path-preserving-expansion.js";
import { RetrospectiveSalienceExpansion } from "@graph/algorithms/traversal/retrospective-salience-expansion.js";
import { BenchmarkGraphExpander } from "@graph/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/index.js";
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
 * Create all expansion methods for a given expander and seeds.
 * Matches the method list from salience-coverage-comparison.ts for consistency.
 * @param expander - Graph expander providing neighbour access
 * @param seeds - Array of seed node IDs
 */
const createAllMethods = (expander: BenchmarkGraphExpander, seeds: readonly string[]) => [
	// Baselines
	{ name: "Standard BFS", create: () => new StandardBfsExpansion(expander, seeds) },
	{ name: "Degree-Prioritised", create: () => new DegreePrioritisedExpansion(expander, seeds) },
	{ name: "Frontier-Balanced", create: () => new FrontierBalancedExpansion(expander, seeds) },
	{ name: "Random Priority", create: () => new RandomPriorityExpansion(expander, seeds, 42) },
	// Novel algorithms
	{ name: "Entropy-Guided (EGE)", create: () => new EntropyGuidedExpansion(expander, seeds) },
	{ name: "Path-Preserving (PPME)", create: () => new PathPreservingExpansion(expander, seeds) },
	{ name: "Retrospective Salience (RSGE)", create: () => new RetrospectiveSalienceExpansion(expander, seeds) },
	// Baseline variants
	{ name: "Delayed Termination +50", create: () => new DelayedTerminationExpansion(expander, seeds, { delayIterations: 50 }) },
	{ name: "Delayed Termination +100", create: () => new DelayedTerminationExpansion(expander, seeds, { delayIterations: 100 }) },
	{ name: "Degree Surprise", create: () => new DegreeSurpriseExpansion(expander, seeds) },
	{ name: "Ensemble (BFS∪DFS∪DP)", create: () => new EnsembleExpansion(expander, seeds) },
	{ name: "Cross-Seed Affinity", create: () => new CrossSeedAffinityExpansion(expander, seeds) },
	// Intelligent termination strategies
	{ name: "Intelligent Delayed +50", create: () => new IntelligentDelayedTermination(expander, seeds, { delayIterations: 50 }) },
	{ name: "Intelligent Delayed +100", create: () => new IntelligentDelayedTermination(expander, seeds, { delayIterations: 100 }) },
];


const DATASET_NAMES: Record<string, string> = {
	"karate": "Karate Club",
	"lesmis": "Les Misérables",
	"cora": "Cora",
	"citeseer": "CiteSeer",
	"cit-hepth": "Cit-HepTH",
	"ca-astroph": "CA-Astroph",
	"ca-condmat": "CA-CondMat",
	"ca-hepph": "CA-HepPh",
	"facebook": "Facebook",
};

/**
 * Run hub traversal experiments on scale-free graphs.
 *
 * Hub traversal measures what percentage of high-degree nodes are visited
 * during path finding. Degree-prioritised expansion should avoid hubs.
 */
export const runHubTraversalExperiments = async (): Promise<void> => {
	const datasets = ["karate", "lesmis", "cora", "citeseer", "cit-hepth", "ca-astroph", "ca-condmat", "ca-hepph", "facebook"];

	for (const datasetId of datasets) {
		const benchmark = await loadBenchmarkByIdFromUrl(datasetId);
		const graph = benchmark.graph;
		const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
		const allNodes = expander.getAllNodeIds();

		// Use first and last nodes as seeds
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		// Run each method
		const methods = createAllMethods(expander, seeds);

		for (const method of methods) {
			const result = await method.create().run();

			// Calculate hub traversal: % of nodes with degree > threshold that were visited
			const threshold = 5;
			const highDegreeNodes = allNodes.filter((id) => expander.getDegree(id) > threshold);
			const visitedHubs = highDegreeNodes.filter((id) => result.sampledNodes.has(id));
			const hubTraversal = highDegreeNodes.length > 0
				? (visitedHubs.length / highDegreeNodes.length) * 100
				: 0;

			metrics.record("hub-traversal-comparison", {
				graph: datasetId,
				method: method.name,
				hubTraversal: Math.round(hubTraversal * 10) / 10,
			});
		}
	}
};

/**
 * Run runtime performance experiments.
 *
 * Measures execution time and throughput for each method.
 */
export const runRuntimeExperiments = async (): Promise<void> => {
	const datasets = [
		{ id: "karate", expectedNodes: 34 },
		{ id: "lesmis", expectedNodes: 77 },
		{ id: "cora", expectedNodes: 2708 },
		{ id: "citeseer", expectedNodes: 3312 },
		{ id: "cit-hepth", expectedNodes: 27_770 },
		{ id: "ca-astroph", expectedNodes: 18_772 },
		{ id: "ca-condmat", expectedNodes: 23_133 },
		{ id: "ca-hepph", expectedNodes: 12_008 },
		{ id: "facebook", expectedNodes: 4039 },
	];

	for (const { id, expectedNodes } of datasets) {
		const benchmark = await loadBenchmarkByIdFromUrl(id);
		const graph = benchmark.graph;
		const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		const allMethods = createAllMethods(expander, seeds);

		// Collect timing data for all methods
		const timings: Array<{ name: string; timeMs: number; nodesExpanded: number }> = [];

		for (const method of allMethods) {
			const start = performance.now();
			const result = await method.create().run();
			const elapsed = performance.now() - start;
			const nodesExpanded = result.sampledNodes.size;

			timings.push({ name: method.name, timeMs: elapsed, nodesExpanded });

			metrics.record("runtime-performance-all", {
				dataset: DATASET_NAMES[id] ?? id,
				nodes: expectedNodes,
				method: method.name,
				timeMs: Math.round(elapsed * 100) / 100,
				nodesPerSec: Math.round(nodesExpanded / (elapsed / 1000)),
			});
		}

		// Preserve legacy DP-vs-BFS metrics for backward compatibility
		const dpTiming = timings.find((t) => t.name === "Degree-Prioritised");
		const bfsTiming = timings.find((t) => t.name === "Standard BFS");

		if (dpTiming && bfsTiming) {
			metrics.record("runtime-performance", {
				dataset: DATASET_NAMES[id] ?? id,
				nodes: expectedNodes,
				dpTime: Math.round(dpTiming.timeMs * 100) / 100,
				bfsTime: Math.round(bfsTiming.timeMs * 100) / 100,
				dpNodesPerSec: Math.round(dpTiming.nodesExpanded / (dpTiming.timeMs / 1000)),
				bfsNodesPerSec: Math.round(bfsTiming.nodesExpanded / (bfsTiming.timeMs / 1000)),
			});

			metrics.record("scalability", {
				dataset: id,
				nodes: expectedNodes,
				dpTime: Math.round(dpTiming.timeMs * 10) / 10,
				bfsTime: Math.round(bfsTiming.timeMs * 10) / 10,
				ratio: Math.round((bfsTiming.timeMs / dpTiming.timeMs) * 100) / 100,
			});
		}
	}
};

/**
 * Run path diversity experiments.
 *
 * Measures the structural diversity of discovered paths using Jaccard dissimilarity.
 */
export const runPathDiversityExperiments = async (): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
	const graph = benchmark.graph;
	const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
	const allNodes = expander.getAllNodeIds();
	const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

	const allMethods = createAllMethods(expander, seeds);

	for (const method of allMethods) {
		const result = await method.create().run();

		// Use retroactive path enumeration for fair comparison (maxLength=5 for tractability)
		const retroPaths = await retroactivePathEnumeration(result, expander, seeds, 5);

		const pathLengths = retroPaths.paths.map((p) => p.nodes.length);
		if (pathLengths.length > 0) {
			const minLength = Math.min(...pathLengths);
			const maxLength = Math.max(...pathLengths);
			const meanLength = pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length;
			const sortedLengths = [...pathLengths].sort((a, b) => a - b);
			const medianLength = sortedLengths[Math.floor(sortedLengths.length / 2)];

			metrics.record("path-lengths", {
				dataset: "Les Misérables",
				method: method.name,
				min: minLength,
				max: maxLength,
				mean: Math.round(meanLength * 100) / 100,
				median: medianLength,
			});
		}
	}
};

/**
 * Run method ranking experiments.
 *
 * Ranks all methods by path diversity on a single dataset.
 */
export const runMethodRankingExperiments = async (): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
	const graph = benchmark.graph;
	const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
	const allNodes = expander.getAllNodeIds();
	const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

	// Simple diversity metric: ratio of unique intermediate nodes to total path nodes
	const calculateDiversity = (paths: Array<{ nodes: string[] }>): number => {
		const allNodes = new Set<string>();
		let totalNodes = 0;

		for (const path of paths) {
			// Exclude seed nodes from intermediate node calculation
			for (let index = 1; index < path.nodes.length - 1; index++) {
				allNodes.add(path.nodes[index]);
				totalNodes++;
			}
		}

		return totalNodes > 0 ? allNodes.size / totalNodes : 0;
	};

	const allMethods = createAllMethods(expander, seeds);

	const rankings: Array<{ method: string; diversity: number; paths: number; onlinePaths: number }> = [];

	for (const method of allMethods) {
		const result = await method.create().run();

		// Use retroactive path enumeration for fair comparison (maxLength=5 for tractability)
		const retroactivePaths = await retroactivePathEnumeration(result, expander, seeds, 5);
		const diversity = calculateDiversity(retroactivePaths.paths);

		rankings.push({
			method: method.name,
			diversity: Math.round(diversity * 1000) / 1000,
			paths: retroactivePaths.paths.length, // Retroactive path count
			onlinePaths: result.paths.length, // Keep online for reference
		});
	}

	// Sort by diversity descending
	rankings.sort((a, b) => b.diversity - a.diversity);

	for (const ranking of rankings) {
		metrics.record("method-ranking", ranking);
	}
};

/**
 * Run cross-dataset diversity experiments.
 *
 * Compares all 4 methods across multiple datasets, recording both online and
 * retroactive path counts. This resolves the online paths contradiction between
 * method-ranking (per-graph) and cross-dataset-generalisation (aggregated) data.
 */
export const runCrossDatasetExperiments = async (): Promise<void> => {
	const datasets = [
		{ id: "karate", name: "Karate Club", nodes: 34 },
		{ id: "lesmis", name: "Les Misérables", nodes: 77 },
		{ id: "cora", name: "Cora", nodes: 2708 },
		{ id: "citeseer", name: "CiteSeer", nodes: 3312 },
		{ id: "cit-hepth", name: "Cit-HepTH", nodes: 27_770 },
		{ id: "ca-astroph", name: "CA-Astroph", nodes: 18_772 },
		{ id: "ca-condmat", name: "CA-CondMat", nodes: 23_133 },
		{ id: "ca-hepph", name: "CA-HepPh", nodes: 12_008 },
		{ id: "facebook", name: "Facebook", nodes: 4039 },
	];

	const calculateDiversity = (paths: Array<{ nodes: string[] }>): number => {
		const allNodes = new Set<string>();
		let totalNodes = 0;

		for (const path of paths) {
			for (let index = 1; index < path.nodes.length - 1; index++) {
				allNodes.add(path.nodes[index]);
				totalNodes++;
			}
		}

		return totalNodes > 0 ? allNodes.size / totalNodes : 0;
	};

	for (const dataset of datasets) {
		const benchmark = await loadBenchmarkByIdFromUrl(dataset.id);
		const graph = benchmark.graph;
		const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		const allMethods = createAllMethods(expander, seeds);

		for (const method of allMethods) {
			const result = await method.create().run();
			const retroPaths = await retroactivePathEnumeration(result, expander, seeds, 5);
			const retroDiversity = calculateDiversity(retroPaths.paths);
			const onlineDiversity = calculateDiversity(result.paths);

			// Extract nodesExpanded from stats, handling different result types
			const nodesExpanded =
				"nodesExpanded" in result.stats
					? (result.stats as { nodesExpanded: number }).nodesExpanded
					: result.sampledNodes.size;

			metrics.record("cross-dataset", {
				dataset: dataset.name,
				nodes: dataset.nodes,
				method: method.name,
				onlinePaths: result.paths.length,
				retroactivePaths: retroPaths.paths.length,
				onlineDiversity: Math.round(onlineDiversity * 1000) / 1000,
				retroactiveDiversity: Math.round(retroDiversity * 1000) / 1000,
				nodesExpanded,
			});
		}
	}
};

/**
 * Run all bidirectional BFS experiments.
 */
export const runBidirectionalBFSExperiments = async (): Promise<void> => {
	console.log("Running Bidirectional BFS experiments...");

	await runHubTraversalExperiments();
	console.log("  ✓ Hub traversal experiments complete");

	await runRuntimeExperiments();
	console.log("  ✓ Runtime experiments complete");

	await runPathDiversityExperiments();
	console.log("  ✓ Path diversity experiments complete");

	await runMethodRankingExperiments();
	console.log("  ✓ Method ranking experiments complete");

	await runCrossDatasetExperiments();
	console.log("  ✓ Cross-dataset experiments complete");

	console.log("Bidirectional BFS experiments complete!");
};

/**
 * Bidirectional BFS Experiments
 *
 * Evaluates Degree-Prioritised Bidirectional BFS against baseline methods.
 * Generates metrics for thesis tables on hub traversal, path diversity, and runtime.
 */

import { DegreePrioritisedExpansion } from "@graph/algorithms/traversal/degree-prioritised-expansion.js";
import { BenchmarkGraphExpander } from "@graph/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/index.js";
import { FrontierBalancedExpansion } from "@graph/experiments/baselines/frontier-balanced.js";
import { RandomPriorityExpansion } from "@graph/experiments/baselines/random-priority.js";
import { StandardBfsExpansion } from "@graph/experiments/baselines/standard-bfs.js";
import { metrics } from "@graph/experiments/metrics/index.js";

/**
 * Run hub traversal experiments on scale-free graphs.
 *
 * Hub traversal measures what percentage of high-degree nodes are visited
 * during path finding. Degree-prioritised expansion should avoid hubs.
 */
export const runHubTraversalExperiments = async (): Promise<void> => {
	const datasets = ["karate", "lesmis"];

	for (const datasetId of datasets) {
		const benchmark = await loadBenchmarkByIdFromUrl(datasetId);
		const graph = benchmark.graph;
		const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
		const allNodes = expander.getAllNodeIds();

		// Use first and last nodes as seeds
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		// Run each method
		const methods = [
			{ name: "Degree-Prioritised", algo: new DegreePrioritisedExpansion(expander, seeds) },
			{ name: "Standard BFS", algo: new StandardBfsExpansion(expander, seeds) },
			{ name: "Frontier-Balanced", algo: new FrontierBalancedExpansion(expander, seeds) },
			{ name: "Random Priority", algo: new RandomPriorityExpansion(expander, seeds, 42) },
		];

		for (const method of methods) {
			const result = await method.algo.run();

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
		{ id: "facebook", expectedNodes: 4039 },
	];

	for (const { id, expectedNodes } of datasets) {
		const benchmark = await loadBenchmarkByIdFromUrl(id);
		const graph = benchmark.graph;
		const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		// Time DP
		const dpStart = performance.now();
		const dp = new DegreePrioritisedExpansion(expander, seeds);
		const dpResult = await dp.run();
		const dpTime = performance.now() - dpStart;

		// Time BFS
		const bfsStart = performance.now();
		const bfs = new StandardBfsExpansion(expander, seeds);
		const bfsResult = await bfs.run();
		const bfsTime = performance.now() - bfsStart;

		const dpNodesPerSec = Math.round(dpResult.sampledNodes.size / (dpTime / 1000));
		const bfsNodesPerSec = Math.round(bfsResult.sampledNodes.size / (bfsTime / 1000));

		metrics.record("runtime-performance", {
			dataset: id === "karate" ? "Karate Club" : (id === "lesmis" ? "Les Misérables" : "Facebook"),
			nodes: expectedNodes,
			dpTime: Math.round(dpTime * 100) / 100,
			bfsTime: Math.round(bfsTime * 100) / 100,
			dpNodesPerSec,
			bfsNodesPerSec,
		});

		metrics.record("scalability", {
			dataset: id,
			nodes: expectedNodes,
			dpTime: Math.round(dpTime * 10) / 10,
			bfsTime: Math.round(bfsTime * 10) / 10,
			ratio: Math.round((bfsTime / dpTime) * 100) / 100,
		});
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

	// Run DP
	const dp = new DegreePrioritisedExpansion(expander, seeds);
	const dpResult = await dp.run();

	// Calculate path length distribution
	const pathLengths = dpResult.paths.map((p) => p.nodes.length);
	const minLength = Math.min(...pathLengths);
	const maxLength = Math.max(...pathLengths);
	const meanLength = pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length;
	const sortedLengths = [...pathLengths].sort((a, b) => a - b);
	const medianLength = sortedLengths[Math.floor(sortedLengths.length / 2)];

	metrics.record("path-lengths", {
		dataset: "Les Misérables",
		method: "Degree-Prioritised",
		min: minLength,
		max: maxLength,
		mean: Math.round(meanLength * 100) / 100,
		median: medianLength,
	});

	// Run BFS for comparison
	const bfs = new StandardBfsExpansion(expander, seeds);
	const bfsResult = await bfs.run();

	const bfsPathLengths = bfsResult.paths.map((p) => p.nodes.length);
	const bfsMinLength = Math.min(...bfsPathLengths);
	const bsfMaxLength = Math.max(...bfsPathLengths);
	const bfsMeanLength = bfsPathLengths.reduce((a, b) => a + b, 0) / bfsPathLengths.length;
	const bfsSortedLengths = [...bfsPathLengths].sort((a, b) => a - b);
	const bfsMedianLength = bfsSortedLengths[Math.floor(bfsSortedLengths.length / 2)];

	metrics.record("path-lengths", {
		dataset: "Les Misérables",
		method: "Standard BFS",
		min: bfsMinLength,
		max: bsfMaxLength,
		mean: Math.round(bfsMeanLength * 100) / 100,
		median: bfsMedianLength,
	});
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

	const methods = [
		{ name: "Degree-Prioritised (Thesis)", algo: new DegreePrioritisedExpansion(expander, seeds) },
		{ name: "Random Priority", algo: new RandomPriorityExpansion(expander, seeds, 42) },
		{ name: "Standard BFS", algo: new StandardBfsExpansion(expander, seeds) },
		{ name: "Frontier-Balanced", algo: new FrontierBalancedExpansion(expander, seeds) },
	];

	const rankings: Array<{ method: string; diversity: number; paths: number }> = [];

	for (const method of methods) {
		const result = await method.algo.run();
		const diversity = calculateDiversity(result.paths);
		rankings.push({
			method: method.name,
			diversity: Math.round(diversity * 1000) / 1000,
			paths: result.paths.length,
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
 * Compares DP vs BFS across multiple datasets.
 */
export const runCrossDatasetExperiments = async (): Promise<void> => {
	const datasets = [
		{ id: "karate", name: "Karate Club", nodes: 34 },
		{ id: "lesmis", name: "Les Misérables", nodes: 77 },
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

		const dp = new DegreePrioritisedExpansion(expander, seeds);
		const dpResult = await dp.run();
		const dpDiversity = calculateDiversity(dpResult.paths);

		const bfs = new StandardBfsExpansion(expander, seeds);
		const bfsResult = await bfs.run();
		const bfsDiversity = calculateDiversity(bfsResult.paths);

		const improvement = bfsDiversity > 0
			? ((dpDiversity - bfsDiversity) / bfsDiversity) * 100
			: 0;

		metrics.record("cross-dataset", {
			dataset: dataset.name,
			nodes: dataset.nodes,
			dpDiversity: Math.round(dpDiversity * 1000) / 1000,
			bfsDiversity: Math.round(bfsDiversity * 1000) / 1000,
			improvement: Math.round(improvement * 10) / 10,
		});
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

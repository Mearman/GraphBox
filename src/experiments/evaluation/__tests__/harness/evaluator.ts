/**
 * Algorithm evaluator - runs all algorithms on all fixtures and records metrics.
 *
 * This is the core of the evaluation framework, inspired by the notes on
 * building better test harnesses for algorithm comparison.
 */

import { DegreePrioritisedExpansion } from "@graph/algorithms/traversal/degree-prioritised-expansion";
import { FrontierBalancedExpansion } from "@graph/experiments/baselines/frontier-balanced";
import { RandomPriorityExpansion } from "@graph/experiments/baselines/random-priority";
import { StandardBfsExpansion } from "@graph/experiments/baselines/standard-bfs";

import { fixtures } from "./fixtures";
import type { AlgorithmRunResult, ExpansionMetrics, GraphFixture,PathMetrics } from "./types";

/**
 * Algorithm configuration.
 */
interface AlgorithmConfig {
	/** Display name */
	name: string;

	/** Factory to create the algorithm */
	create: (
		expander: import("@graph/interfaces/graph-expander").GraphExpander<unknown>,
		seeds: readonly string[]
	) => {
		run: () => Promise<{
			paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;
			sampledNodes: Set<string>;
			sampledEdges: Set<string>;
			stats: {
				nodesExpanded: number;
				edgesTraversed: number;
				iterations: number;
				degreeDistribution: Map<string, number>;
			};
		}>;
	};
}

/**
 * All algorithms to evaluate.
 */
export const algorithms: AlgorithmConfig[] = [
	{
		name: "Degree-Prioritised",
		create: (expander, seeds) => new DegreePrioritisedExpansion(expander, seeds),
	},
	{
		name: "Standard BFS",
		create: (expander, seeds) => new StandardBfsExpansion(expander, seeds),
	},
	{
		name: "Frontier-Balanced",
		create: (expander, seeds) => new FrontierBalancedExpansion(expander, seeds),
	},
	{
		name: "Random Priority",
		create: (expander, seeds) => new RandomPriorityExpansion(expander, seeds, 42),
	},
];

/**
 * Calculate path diversity using Jaccard dissimilarity.
 *
 * Higher values indicate more structurally varied paths.
 * @param paths
 */
const calculatePathDiversity = (paths: Array<{ nodes: string[] }>): number => {
	if (paths.length <= 1) return 0;

	// Create sets of nodes for each path
	const pathNodeSets = paths.map((p) => new Set(p.nodes));

	// Calculate pairwise Jaccard dissimilarity
	let totalDissimilarity = 0;
	let comparisons = 0;

	for (let index = 0; index < pathNodeSets.length; index++) {
		for (let index_ = index + 1; index_ < pathNodeSets.length; index_++) {
			const setA = pathNodeSets[index];
			const setB = pathNodeSets[index_];

			// Jaccard similarity = |A ∩ B| / |A ∪ B|
			const intersection = new Set<string>();
			for (const node of setA) {
				if (setB.has(node)) {
					intersection.add(node);
				}
			}

			const union = new Set([...setA, ...setB]);
			const jaccard = union.size > 0 ? intersection.size / union.size : 0;

			// Dissimilarity = 1 - Jaccard
			totalDissimilarity += 1 - jaccard;
			comparisons++;
		}
	}

	return comparisons > 0 ? totalDissimilarity / comparisons : 0;
};

/**
 * Calculate path length statistics.
 * @param paths
 */
const calculatePathLengths = (paths: Array<{ nodes: string[] }>) => {
	const lengths = paths.map((p) => p.nodes.length);

	if (lengths.length === 0) {
		return { min: 0, max: 0, mean: 0, median: 0 };
	}

	lengths.sort((a, b) => a - b);

	const min = lengths[0];
	const max = lengths.at(-1) ?? lengths[0];
	const sum = lengths.reduce((a, b) => a + b, 0);
	const mean = sum / lengths.length;
	const median = lengths[Math.floor(lengths.length / 2)];

	return { min, max, mean, median };
};

/**
 * Identify hub nodes in a graph (top 10% by degree).
 * @param expander
 * @param expander.getDegree
 */
const identifyHubs = (expander: { getDegree: (nodeId: string) => number }): Set<string> => {
	const allDegrees = new Map<string, number>();

	// Sample degrees from the graph
	// For a real implementation, we'd iterate all nodes
	// Here we use a heuristic based on the expander
	const degrees: number[] = [];

	// Get degrees for a sample of nodes
	const sampleSize = Math.min(50, expander instanceof Object ? 100 : 50);
	for (let index = 0; index < sampleSize; index++) {
		const nodeId = `N${index}`;
		try {
			const degree = expander.getDegree(nodeId);
			degrees.push(degree);
			allDegrees.set(nodeId, degree);
		} catch {
			// Node doesn't exist
		}
	}

	// Threshold at top 10% by degree
	degrees.sort((a, b) => b - a);
	const threshold = degrees[Math.floor(degrees.length * 0.1)] || 5;

	const hubs = new Set<string>();
	for (const [node, degree] of allDegrees) {
		if (degree >= threshold) {
			hubs.add(node);
		}
	}

	return hubs;
};

/**
 * Calculate hub-specific metrics for a result.
 * @param paths
 * @param hubs
 * @param nodesExpanded
 */
const calculateHubMetrics = (paths: Array<{ nodes: string[] }>, hubs: Set<string>, nodesExpanded: number): ExpansionMetrics["hubMetrics"] => {
	if (paths.length === 0) {
		return undefined;
	}

	// Count paths that traverse hubs
	let pathsWithHubs = 0;
	for (const path of paths) {
		const hasHub = path.nodes.some((n) => hubs.has(n));
		if (hasHub) pathsWithHubs++;
	}

	// Count hubs expanded
	let hubsExpanded = 0;
	for (const path of paths) {
		for (const node of path.nodes) {
			if (hubs.has(node)) {
				hubsExpanded++;
				break; // Count each hub once per path
			}
		}
	}

	return {
		hubsExpanded,
		totalExpanded: nodesExpanded,
		hubTraversalRate: paths.length > 0 ? (pathsWithHubs / paths.length) * 100 : 0,
	};
};

/**
 * Convert degree distribution Map to Record.
 * @param map
 */
const mapToRecord = (map: Map<string, number>): Record<string, number> => {
	const result: Record<string, number> = {};
	for (const [key, value] of map) {
		result[key] = value;
	}
	return result;
};

/**
 * Run a single algorithm on a single graph with given seeds.
 * @param algorithm
 * @param fixture
 * @param seeds
 */
export const runAlgorithmOnGraph = async (algorithm: AlgorithmConfig, fixture: GraphFixture, seeds: string[]): Promise<AlgorithmRunResult> => {
	const expander = fixture.create();
	const expansion = algorithm.create(expander, seeds);
	const result = await expansion.run();

	// Calculate path metrics
	let pathMetrics: PathMetrics | undefined;
	if (result.paths.length > 0) {
		const lengths = calculatePathLengths(result.paths);
		const uniqueNodes = new Set<string>();
		for (const path of result.paths) {
			for (const node of path.nodes) {
				uniqueNodes.add(node);
			}
		}

		pathMetrics = {
			algorithm: algorithm.name,
			graph: fixture.name,
			pathCount: result.paths.length,
			minLength: lengths.min,
			maxLength: lengths.max,
			meanLength: lengths.mean,
			medianLength: lengths.median,
			diversity: calculatePathDiversity(result.paths),
			uniqueNodes: uniqueNodes.size,
			jaccardDissimilarity: calculatePathDiversity(result.paths),
		};
	}

	// Calculate hub metrics
	const hubs = identifyHubs(expander);
	const hubMetrics = calculateHubMetrics(result.paths, hubs, result.stats.nodesExpanded);

	// Build expansion metrics
	const metrics: ExpansionMetrics = {
		algorithm: algorithm.name,
		graph: fixture.name,
		numSeeds: seeds.length,
		nodesExpanded: result.stats.nodesExpanded,
		edgesTraversed: result.stats.edgesTraversed,
		iterations: result.stats.iterations,
		sampledNodes: result.sampledNodes.size,
		sampledEdges: result.sampledEdges.size,
		pathsFound: result.paths.length,
		degreeDistribution: mapToRecord(result.stats.degreeDistribution),
		hubMetrics,
	};

	return { metrics, pathMetrics, raw: result };
};

/**
 * Run full evaluation: all algorithms × all fixtures × all seed configurations.
 */
export const runFullEvaluation = async (): Promise<{
	results: AlgorithmRunResult[];
	summary: {
		totalRuns: number;
		fixtures: number;
		algorithms: number;
	};
}> => {
	const results: AlgorithmRunResult[] = [];

	for (const fixture of Object.values(fixtures)) {
		// Run with N=1 seeds
		for (const algorithm of algorithms) {
			const result = await runAlgorithmOnGraph(algorithm, fixture, fixture.seeds.n1);
			results.push(result);
		}

		// Run with N=2 seeds
		for (const algorithm of algorithms) {
			const result = await runAlgorithmOnGraph(algorithm, fixture, fixture.seeds.n2);
			results.push(result);
		}

		// Run with N=3 seeds
		for (const algorithm of algorithms) {
			const result = await runAlgorithmOnGraph(algorithm, fixture, fixture.seeds.n3);
			results.push(result);
		}
	}

	return {
		results,
		summary: {
			totalRuns: results.length,
			fixtures: Object.keys(fixtures).length,
			algorithms: algorithms.length,
		},
	};
};

/**
 * Format results for JSON output.
 * @param results
 */
export const formatResultsForJson = (results: AlgorithmRunResult[]): string => {
	const formatted = results.map((r) => ({
		algorithm: r.metrics.algorithm,
		graph: r.metrics.graph,
		numSeeds: r.metrics.numSeeds,
		nodesExpanded: r.metrics.nodesExpanded,
		edgesTraversed: r.metrics.edgesTraversed,
		iterations: r.metrics.iterations,
		sampledNodes: r.metrics.sampledNodes,
		sampledEdges: r.metrics.sampledEdges,
		pathsFound: r.metrics.pathsFound,
		degreeDistribution: r.metrics.degreeDistribution,
		hubMetrics: r.metrics.hubMetrics,
		pathMetrics: r.pathMetrics
			? {
				pathCount: r.pathMetrics.pathCount,
				minLength: r.pathMetrics.minLength,
				maxLength: r.pathMetrics.maxLength,
				meanLength: r.pathMetrics.meanLength,
				medianLength: r.pathMetrics.medianLength,
				diversity: r.pathMetrics.diversity,
				uniqueNodes: r.pathMetrics.uniqueNodes,
			}
			: undefined,
	}));

	return JSON.stringify(formatted, null, 2);
};

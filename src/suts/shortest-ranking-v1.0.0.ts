/**
 * Shortest Path Ranking SUT (Worker-Compatible)
 *
 * Baseline SUT that ranks paths by length (shortest first).
 * Standalone file for PPEF worker thread execution.
 */

import { Graph } from "../algorithms/graph/graph.js";
import { shortestPathRanking } from "../algorithms/pathfinding/shortest-path-ranking.js";
import type { Edge, Node } from "../algorithms/types/graph.js";
import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../experiments/evaluation/__tests__/validation/common/path-ranking-helpers.js";
import type { SUT } from "ppef/types/sut";
import type { SutRegistration } from "ppef/types/sut";

/**
 * Configuration for Shortest Path Ranking SUT.
 */
export interface ShortestRankingConfig {
	/** Maximum number of paths to return */
	maxPaths?: number;
}

/**
 * Ranking inputs for this SUT.
 */
export interface RankingInputs {
	/** Graph expander for path discovery */
	input: BenchmarkGraphExpander;
	/** Source node ID */
	source: string;
	/** Target node ID */
	target: string;
}

/**
 * Shortest ranking result.
 */
export interface ShortestRankingResult {
	pathsFound: number;
	meanLength: number;
	meanMI: number;
	stdMI: number;
	pathDiversity: number;
	hubAvoidance: number;
	nodeCoverage: number;
	meanScore: number;
	stdScore: number;
	paths: Array<{ id: string; nodes: string[]; length: number }>;
}

/**
 * SUT registration metadata.
 */
export const registration: SutRegistration = {
	id: "shortest-ranking-v1.0.0",
	name: "Shortest Path Ranking",
	version: "1.0.0",
	role: "baseline",
	config: {} satisfies ShortestRankingConfig,
	tags: ["ranking", "baseline", "conventional"],
	description: "Shortest-path-first ranking (conventional baseline)",
};

/**
 * Static cache for graph conversions.
 */
const GRAPH_CACHE = new Map<BenchmarkGraphExpander, Graph<Node, Edge>>();

/**
 * Create a Shortest Ranking SUT instance.
 */
export function createSut(config?: Record<string, unknown>): SUT<RankingInputs, ShortestRankingResult> {
	const sutConfig = {
		maxPaths: (config?.maxPaths as number | undefined) ?? 10,
	};

	return {
		id: registration.id,
		get config() {
			return { ...sutConfig };
		},

		async run(inputs: RankingInputs): Promise<ShortestRankingResult> {
			const { input: expander, source, target } = inputs;

			try {
				// Check cache for graph conversion
				let graph = GRAPH_CACHE.get(expander);
				if (!graph) {
					graph = await expander.toGraph();
					GRAPH_CACHE.set(expander, graph);
				}

				// Run shortest path ranking algorithm
				const result = shortestPathRanking(graph, source, target, {
					maxPaths: sutConfig.maxPaths,
				});

				if (!result.ok) {
					throw new Error(result.error.message);
				}

				const rankedPaths = result.value;

				if (!rankedPaths.some || rankedPaths.value.length === 0) {
					return createEmptyResult();
				}

				const paths = rankedPaths.value;
				const metrics = computeRankingMetrics(paths, graph);

				// Calculate mean path length
				const totalLength = paths.reduce((sum, p) => sum + p.path.nodes.length - 1, 0);
				const meanLength = totalLength / paths.length;

				return {
					pathsFound: paths.length,
					...metrics,
					meanLength,
					paths: paths.map((p, index) => ({
						id: `path-${index}`,
						nodes: p.path.nodes.map((n) => n.id),
						length: p.path.nodes.length - 1,
					})),
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Shortest ranking failed: ${message}`);
			}
		},
	};
}

/**
 * Create an empty result (no paths found).
 */
function createEmptyResult(): ShortestRankingResult {
	return {
		pathsFound: 0,
		meanLength: 0,
		meanMI: 0,
		stdMI: 0,
		pathDiversity: 0,
		hubAvoidance: 0,
		nodeCoverage: 0,
		meanScore: 0,
		stdScore: 0,
		paths: [],
	};
}

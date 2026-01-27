/**
 * Path Salience Ranking SUT (Worker-Compatible)
 *
 * Standalone SUT file for PPEF worker thread execution.
 * Exported via createSut() function for dynamic loading.
 *
 * Usage:
 *   import { createSut, registration } from "./suts/path-salience-v1.0.0.js";
 *   const sut = createSut({ maxPaths: 10 });
 *   const result = await sut.run({ input, source, target });
 */

import type { SUT , SutRegistration } from "ppef/types/sut";

import { Graph } from "../algorithms/graph/graph.js";
import { rankPaths } from "../algorithms/pathfinding/path-ranking.js";
import type { Edge, Node } from "../algorithms/types/graph.js";
import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../experiments/evaluation/__tests__/validation/common/path-ranking-helpers.js";

/**
 * Configuration for Path Salience Ranking SUT.
 */
export interface PathSalienceConfig {
	/** Maximum number of paths to return */
	maxPaths?: number;
	/** Traversal mode: 'directed' or 'undirected' */
	traversalMode?: "directed" | "undirected";
	/** Length penalty parameter λ */
	lambda?: number;
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
 * Path Salience ranking result.
 */
export interface PathSalienceResult {
	pathsFound: number;
	meanMI: number;
	stdMI: number;
	pathDiversity: number;
	hubAvoidance: number;
	nodeCoverage: number;
	meanScore: number;
	stdScore: number;
	paths: Array<{ id: string; nodes: string[]; mi: number }>;
}

/**
 * SUT registration metadata.
 */
export const registration: SutRegistration = {
	id: "path-salience-v1.0.0",
	name: "Path Salience Ranking",
	version: "1.0.0",
	role: "primary",
	config: {} satisfies PathSalienceConfig,
	tags: ["ranking", "information-theoretic", "mutual-information"],
	description: "Information-theoretic path ranking using mutual information",
};

/**
 * Static cache for graph conversions across SUT instances.
 * Shared within worker thread memory.
 */
const GRAPH_CACHE = new Map<BenchmarkGraphExpander, Graph<Node, Edge>>();

/**
 * Create a Path Salience SUT instance.
 *
 * Factory function for PPEF worker thread execution.
 * Returns a PPEF-compatible SUT object with run() method.
 *
 * @param config - Optional configuration overrides
 * @returns PPEF-compatible SUT object
 */
export const createSut = (config?: Record<string, unknown>): SUT<RankingInputs, PathSalienceResult> => {
	const sutConfig = {
		maxPaths: (config?.maxPaths as number | undefined) ?? 10,
		traversalMode: (config?.traversalMode as "directed" | "undirected" | undefined) ?? "undirected",
		lambda: (config?.lambda as number | undefined) ?? 0,
	};

	return {
		id: registration.id,
		get config() {
			return { ...sutConfig };
		},

		/**
		 * Execute path ranking between source and target nodes.
		 *
		 * @param inputs - Graph expander and node IDs
		 * @returns Path ranking result with metrics
		 */
		run: async (inputs: RankingInputs): Promise<PathSalienceResult> => {
			const { input: expander, source, target } = inputs;

			try {
				// Check cache for graph conversion
				let graph = GRAPH_CACHE.get(expander);
				if (!graph) {
					graph = await expander.toGraph();
					GRAPH_CACHE.set(expander, graph);
				}

				// Run path ranking algorithm
				const result = rankPaths(graph, source, target, {
					maxPaths: sutConfig.maxPaths,
					traversalMode: sutConfig.traversalMode,
					lambda: sutConfig.lambda,
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

				return {
					pathsFound: paths.length,
					...metrics,
					paths: paths.map((p, index) => ({
						id: `path-${index}`,
						nodes: p.path.nodes.map((n) => n.id),
						mi: p.geometricMeanMI,
					})),
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Path Salience ranking failed: ${message}`);
			}
		},
	};
};

/**
 * Create an empty result (no paths found).
 */
const createEmptyResult = (): PathSalienceResult => ({
	pathsFound: 0,
	meanMI: 0,
	stdMI: 0,
	pathDiversity: 0,
	hubAvoidance: 0,
	nodeCoverage: 0,
	meanScore: 0,
	stdScore: 0,
	paths: [],
});

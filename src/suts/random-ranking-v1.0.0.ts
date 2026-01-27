/**
 * Random Path Ranking SUT (Worker-Compatible)
 *
 * Baseline SUT that ranks paths randomly (statistical null hypothesis).
 * Standalone file for PPEF worker thread execution.
 */

import type { SUT , SutRegistration } from "ppef/types/sut";

import { Graph } from "../algorithms/graph/graph.js";
import { sampleRandomPaths } from "../algorithms/pathfinding/random-path-sampling.js";
import type { Edge, Node } from "../algorithms/types/graph.js";
import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../experiments/evaluation/__tests__/validation/common/path-ranking-helpers.js";

/**
 * Configuration for Random Ranking SUT.
 */
export interface RandomRankingConfig {
	/** Maximum number of paths to return */
	maxPaths?: number;
	/** Random seed for reproducibility */
	seed?: number;
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
 * Random ranking result.
 */
export interface RandomRankingResult {
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
	id: "random-ranking-v1.0.0",
	name: "Random Path Ranking",
	version: "1.0.0",
	role: "baseline",
	config: {} satisfies RandomRankingConfig,
	tags: ["ranking", "baseline", "null-hypothesis"],
	description: "Random path ranking (statistical null hypothesis)",
};

/**
 * Static cache for graph conversions.
 */
const GRAPH_CACHE = new Map<BenchmarkGraphExpander, Graph<Node, Edge>>();

/**
 * Create a Random Ranking SUT instance.
 * @param config
 */
export const createSut = (config?: Record<string, unknown>): SUT<RankingInputs, RandomRankingResult> => {
	const sutConfig = {
		maxPaths: (config?.maxPaths as number | undefined) ?? 10,
		seed: (config?.seed as number | undefined) ?? 42,
	};

	return {
		id: registration.id,
		get config() {
			return { ...sutConfig };
		},

		run: async (inputs: RankingInputs): Promise<RandomRankingResult> => {
			const { input: expander, source, target } = inputs;

			try {
				// Check cache for graph conversion
				let graph = GRAPH_CACHE.get(expander);
				if (!graph) {
					graph = await expander.toGraph();
					GRAPH_CACHE.set(expander, graph);
				}

				// Run random path sampling
				const result = sampleRandomPaths(graph, source, target, {
					maxPaths: sutConfig.maxPaths,
					seed: sutConfig.seed,
				});

				if (!result.ok) {
					throw new Error(result.error.message);
				}

				const sampledPaths = result.value;

				if (!sampledPaths.some || sampledPaths.value.length === 0) {
					return createEmptyResult();
				}

				const paths = sampledPaths.value;
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
				throw new Error(`Random ranking failed: ${message}`);
			}
		},
	};
};

/**
 * Create an empty result (no paths found).
 */
const createEmptyResult = (): RandomRankingResult => ({
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

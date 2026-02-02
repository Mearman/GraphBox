/**
 * MI Ranking with IDF Weighting SUT (Worker-Compatible)
 *
 * Uses inverse document frequency-style weighting to reduce MI for high-degree nodes.
 * Borrowed from information retrieval: rare terms (low-degree nodes) are more informative.
 *
 * MI_adjusted = MI_base × log(N/(deg(u)+1)) × log(N/(deg(v)+1))
 */

import type { SUT, SutRegistration } from "ppef/types/sut";

import { Graph } from "../algorithms/graph/graph.js";
import { rankPaths } from "../algorithms/pathfinding/path-ranking.js";
import type { Edge, Node } from "../algorithms/types/graph.js";
import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../experiments/evaluation/__tests__/validation/common/path-ranking-helpers.js";

/**
 * Configuration for MI IDF-Weighted Ranking SUT.
 */
export interface MIIDFWeightedConfig {
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
 * MI ranking result.
 */
export interface MIIDFWeightedResult {
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
	id: "mi-idf-weighted-v1.0.0",
	name: "MI Ranking (IDF-Weighted)",
	version: "1.0.0",
	role: "primary",
	config: {} satisfies MIIDFWeightedConfig,
	tags: ["ranking", "information-theoretic", "idf-weighted", "hub-penalized"],
	description:
		"MI-based path ranking with IDF-style weighting. Penalizes paths through high-degree nodes.",
};

/**
 * Static cache for graph conversions across SUT instances.
 */
const GRAPH_CACHE = new Map<BenchmarkGraphExpander, Graph<Node, Edge>>();

/**
 * Create an MI IDF-Weighted SUT instance.
 * @param config
 */
export const createSut = (
	config?: Record<string, unknown>,
): SUT<RankingInputs, MIIDFWeightedResult> => {
	const sutConfig = {
		maxPaths: (config?.maxPaths as number | undefined) ?? 10,
		traversalMode:
			(config?.traversalMode as "directed" | "undirected" | undefined) ??
			"undirected",
		lambda: (config?.lambda as number | undefined) ?? 0,
	};

	return {
		id: registration.id,
		get config() {
			return { ...sutConfig };
		},

		run: async (inputs: RankingInputs): Promise<MIIDFWeightedResult> => {
			const { input: expander, source, target } = inputs;

			try {
				let graph = GRAPH_CACHE.get(expander);
				if (!graph) {
					graph = await expander.toGraph();
					GRAPH_CACHE.set(expander, graph);
				}

				const result = rankPaths(graph, source, target, {
					maxPaths: sutConfig.maxPaths,
					traversalMode: sutConfig.traversalMode,
					lambda: sutConfig.lambda,
					miConfig: {
						useIDFWeighting: true,
					},
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
				throw new Error(`MI IDF-Weighted ranking failed: ${message}`);
			}
		},
	};
};

const createEmptyResult = (): MIIDFWeightedResult => ({
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

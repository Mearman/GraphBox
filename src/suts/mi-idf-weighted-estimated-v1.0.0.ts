/**
 * MI Ranking with Estimated IDF Weighting SUT (Worker-Compatible)
 *
 * Uses inverse document frequency-style weighting with an estimated total node count.
 * Enables IDF weighting in streaming/incremental contexts without full graph awareness.
 *
 * MI_adjusted = MI_base × log(N_estimated/(deg(u)+1)) × log(N_estimated/(deg(v)+1))
 *
 * Difference from exact IDF:
 * - Exact version: N = actual node count in loaded graph
 * - Estimated version: N = user-provided estimate (e.g., 250M for OpenAlex)
 *
 * This allows comparing the impact of using estimates vs exact counts.
 */

import type { SUT, SutRegistration } from "ppef/types/sut";

import { Graph } from "../algorithms/graph/graph.js";
import { rankPaths } from "../algorithms/pathfinding/path-ranking.js";
import type { Edge, Node } from "../algorithms/types/graph.js";
import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../experiments/evaluation/__tests__/validation/common/path-ranking-helpers.js";

/**
 * Configuration for MI IDF-Weighted (Estimated) Ranking SUT.
 */
export interface MIIDFWeightedEstimatedConfig {
	/** Maximum number of paths to return */
	maxPaths?: number;
	/** Traversal mode: 'directed' or 'undirected' */
	traversalMode?: "directed" | "undirected";
	/** Length penalty parameter λ */
	lambda?: number;
	/**
	 * Estimated total nodes for IDF calculation.
	 * Use this to simulate streaming contexts where true N is unknown.
	 * @default 250_000_000 (approximate OpenAlex works count)
	 */
	estimatedTotalNodes?: number;
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
export interface MIIDFWeightedEstimatedResult {
	pathsFound: number;
	meanMI: number;
	stdMI: number;
	pathDiversity: number;
	hubAvoidance: number;
	nodeCoverage: number;
	meanScore: number;
	stdScore: number;
	paths: Array<{ id: string; nodes: string[]; mi: number }>;
	/** The estimated N used for IDF calculation */
	estimatedTotalNodes: number;
}

/**
 * Default estimated total nodes (approximate OpenAlex works count).
 */
const DEFAULT_ESTIMATED_TOTAL_NODES = 250_000_000;

/**
 * SUT registration metadata.
 */
export const registration: SutRegistration = {
	id: "mi-idf-weighted-estimated-v1.0.0",
	name: "MI Ranking (IDF-Weighted, Estimated N)",
	version: "1.0.0",
	role: "primary",
	config: {
		estimatedTotalNodes: DEFAULT_ESTIMATED_TOTAL_NODES,
	} satisfies MIIDFWeightedEstimatedConfig,
	tags: [
		"ranking",
		"information-theoretic",
		"idf-weighted",
		"hub-penalized",
		"streaming",
		"estimated",
	],
	description:
		"MI-based path ranking with IDF-style weighting using estimated total nodes. For streaming contexts where true N is unknown.",
};

/**
 * Static cache for graph conversions across SUT instances.
 */
const GRAPH_CACHE = new Map<BenchmarkGraphExpander, Graph<Node, Edge>>();

/**
 * Create an MI IDF-Weighted (Estimated) SUT instance.
 * @param config
 */
export const createSut = (
	config?: Record<string, unknown>,
): SUT<RankingInputs, MIIDFWeightedEstimatedResult> => {
	const sutConfig = {
		maxPaths: (config?.maxPaths as number | undefined) ?? 10,
		traversalMode:
			(config?.traversalMode as "directed" | "undirected" | undefined) ??
			"undirected",
		lambda: (config?.lambda as number | undefined) ?? 0,
		estimatedTotalNodes:
			(config?.estimatedTotalNodes as number | undefined) ??
			DEFAULT_ESTIMATED_TOTAL_NODES,
	};

	return {
		id: registration.id,
		get config() {
			return { ...sutConfig };
		},

		run: async (
			inputs: RankingInputs,
		): Promise<MIIDFWeightedEstimatedResult> => {
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
						estimatedTotalNodes: sutConfig.estimatedTotalNodes,
					},
				});

				if (!result.ok) {
					throw new Error(result.error.message);
				}

				const rankedPaths = result.value;

				if (!rankedPaths.some || rankedPaths.value.length === 0) {
					return createEmptyResult(sutConfig.estimatedTotalNodes);
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
					estimatedTotalNodes: sutConfig.estimatedTotalNodes,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(
					`MI IDF-Weighted (Estimated) ranking failed: ${message}`,
				);
			}
		},
	};
};

const createEmptyResult = (
	estimatedTotalNodes: number,
): MIIDFWeightedEstimatedResult => ({
	pathsFound: 0,
	meanMI: 0,
	stdMI: 0,
	pathDiversity: 0,
	hubAvoidance: 0,
	nodeCoverage: 0,
	meanScore: 0,
	stdScore: 0,
	paths: [],
	estimatedTotalNodes,
});

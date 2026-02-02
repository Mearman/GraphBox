/**
 * MI Ranking with Clustering Penalty SUT (Worker-Compatible)
 *
 * Penalizes paths through highly clustered regions.
 * Favors paths through structural holes (bridges) which are often more informative.
 *
 * MI_adjusted = MI_base × (1 - max(cc(source), cc(target)))
 * where cc(v) is the local clustering coefficient of node v.
 */

import type { SUT, SutRegistration } from "ppef/types/sut";

import { Graph } from "../algorithms/graph/graph.js";
import { rankPaths } from "../algorithms/pathfinding/path-ranking.js";
import type { Edge, Node } from "../algorithms/types/graph.js";
import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../experiments/evaluation/__tests__/validation/common/path-ranking-helpers.js";

/**
 * Configuration for MI Clustering-Penalized Ranking SUT.
 */
export interface MIClusteringPenalizedConfig {
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
export interface MIClusteringPenalizedResult {
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
	id: "mi-clustering-penalized-v1.0.0",
	name: "MI Ranking (Clustering-Penalized)",
	version: "1.0.0",
	role: "primary",
	config: {} satisfies MIClusteringPenalizedConfig,
	tags: ["ranking", "information-theoretic", "clustering-penalized", "bridges"],
	description:
		"MI-based path ranking with clustering penalty. Favors paths through structural holes.",
};

/**
 * Static cache for graph conversions across SUT instances.
 */
const GRAPH_CACHE = new Map<BenchmarkGraphExpander, Graph<Node, Edge>>();

/**
 * Create an MI Clustering-Penalized SUT instance.
 * @param config
 */
export const createSut = (
	config?: Record<string, unknown>,
): SUT<RankingInputs, MIClusteringPenalizedResult> => {
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

		run: async (
			inputs: RankingInputs,
		): Promise<MIClusteringPenalizedResult> => {
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
						useClusteringPenalty: true,
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
				throw new Error(`MI Clustering-Penalized ranking failed: ${message}`);
			}
		},
	};
};

const createEmptyResult = (): MIClusteringPenalizedResult => ({
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

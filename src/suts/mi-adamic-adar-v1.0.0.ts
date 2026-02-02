/**
 * MI Ranking with Adamic-Adar SUT (Worker-Compatible)
 *
 * Uses Adamic-Adar similarity instead of Jaccard for structural MI.
 * Better for dense social networks where Jaccard is less discriminative.
 *
 * AA(u,v) = Σ_{w ∈ N(u) ∩ N(v)} 1/log(deg(w))
 */

import type { SUT, SutRegistration } from "ppef/types/sut";

import { Graph } from "../algorithms/graph/graph.js";
import { rankPaths } from "../algorithms/pathfinding/path-ranking.js";
import type { Edge, Node } from "../algorithms/types/graph.js";
import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../experiments/evaluation/__tests__/validation/common/path-ranking-helpers.js";

/**
 * Configuration for MI Adamic-Adar Ranking SUT.
 */
export interface MIAdamicAdarConfig {
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
export interface MIAdamicAdarResult {
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
	id: "mi-adamic-adar-v1.0.0",
	name: "MI Ranking (Adamic-Adar)",
	version: "1.0.0",
	role: "primary",
	config: {} satisfies MIAdamicAdarConfig,
	tags: ["ranking", "information-theoretic", "adamic-adar", "dense-graphs"],
	description:
		"MI-based path ranking using Adamic-Adar for structural similarity. Better for dense social networks.",
};

/**
 * Static cache for graph conversions across SUT instances.
 */
const GRAPH_CACHE = new Map<BenchmarkGraphExpander, Graph<Node, Edge>>();

/**
 * Create an MI Adamic-Adar SUT instance.
 * @param config
 */
export const createSut = (
	config?: Record<string, unknown>,
): SUT<RankingInputs, MIAdamicAdarResult> => {
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

		run: async (inputs: RankingInputs): Promise<MIAdamicAdarResult> => {
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
						useAdamicAdar: true,
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
				throw new Error(`MI Adamic-Adar ranking failed: ${message}`);
			}
		},
	};
};

const createEmptyResult = (): MIAdamicAdarResult => ({
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

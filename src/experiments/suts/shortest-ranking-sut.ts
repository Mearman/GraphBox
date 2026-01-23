/**
 * Shortest Path Ranking SUT (Baseline)
 *
 * Baseline SUT that ranks paths by length (shortest first).
 * Integrates shortest path ranking into PPEF framework.
 */

import { Graph } from "../../algorithms/graph/graph.js";
import type { Edge, Node } from "../../algorithms/types/graph.js";
import { Err as Error_, Ok, type Result } from "../../algorithms/types/result.js";
import { shortestPathRanking } from "../baselines/shortest-path-ranking.js";
import type { BenchmarkGraphExpander } from "../evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../evaluation/__tests__/validation/common/path-ranking-helpers.js";

/**
 * Static cache for graph conversions.
 * Shared across all SUT instances to avoid repeated toGraph() calls.
 */
const GRAPH_CACHE = new Map<BenchmarkGraphExpander, Graph<Node, Edge>>();

/**
 * Configuration for Shortest Path Ranking SUT.
 */
export interface ShortestRankingConfig {
	/** Maximum number of paths to return */
	maxPaths?: number;
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
 * Shortest Path Ranking SUT (conventional baseline).
 *
 * Ranks paths between source and target nodes by length (shortest first).
 */
export class ShortestRankingSUT {
	readonly id = "shortest-ranking-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	private readonly expander: BenchmarkGraphExpander;
	private readonly source: string;
	private readonly target: string;
	private readonly rankingConfig: Required<ShortestRankingConfig>;

	constructor(expander: BenchmarkGraphExpander, inputs: readonly string[], config: ShortestRankingConfig = {}) {
		this.expander = expander;
		this.source = inputs[0];
		this.target = inputs[1];
		this.rankingConfig = {
			maxPaths: config.maxPaths ?? 10,
		};
		this.config = { ...this.rankingConfig };
	}

	/**
	 * Execute shortest path ranking.
	 */
	async run(): Promise<Result<ShortestRankingResult, Error>> {
		try {
			// Check cache for graph conversion (avoid repeated conversions for same expander)
			let graph = GRAPH_CACHE.get(this.expander);
			if (!graph) {
				graph = await this.expander.toGraph();
				GRAPH_CACHE.set(this.expander, graph);
			}

			// Run shortest path ranking algorithm
			const result = shortestPathRanking(graph, this.source, this.target, {
				maxPaths: this.rankingConfig.maxPaths,
			});

			if (!result.ok) {
				return Error_(new Error(result.error.message));
			}

			const rankedPaths = result.value;

			if (!rankedPaths.some || rankedPaths.value.length === 0) {
				return Ok(this.createEmptyResult());
			}

			const paths = rankedPaths.value;
			const metrics = computeRankingMetrics(paths, graph);

			// Calculate mean path length
			const totalLength = paths.reduce((sum, p) => sum + p.path.nodes.length - 1, 0);
			const meanLength = totalLength / paths.length;

			return Ok({
				pathsFound: paths.length,
				...metrics,
				meanLength,
				paths: paths.map((p, index) => ({
					id: `path-${index}`,
					nodes: p.path.nodes.map((n) => n.id),
					length: p.path.nodes.length - 1,
				})),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return Error_(new Error(`Shortest ranking failed: ${message}`));
		}
	}

	/**
	 * Create an empty result (no paths found).
	 */
	private createEmptyResult(): ShortestRankingResult {
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
}

/**
 * Betweenness Centrality Ranking SUT (Baseline)
 *
 * Baseline SUT that ranks paths by sum of node betweenness centrality.
 * Integrates betweenness ranking into PPEF framework.
 */

import { Graph } from "../../algorithms/graph/graph.js";
import type { Edge, Node } from "../../algorithms/types/graph.js";
import { Err as Error_, Ok, type Result } from "../../algorithms/types/result.js";
import { betweennessRanking } from "../baselines/betweenness-ranking.js";
import type { BenchmarkGraphExpander } from "../evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../evaluation/__tests__/validation/common/path-ranking-helpers.js";

/**
 * Static cache for graph conversions.
 * Shared across all SUT instances to avoid repeated toGraph() calls.
 */
const GRAPH_CACHE = new Map<BenchmarkGraphExpander, Graph<Node, Edge>>();

/**
 * Configuration for Betweenness Ranking SUT.
 */
export interface BetweennessRankingConfig {
	/** Maximum number of paths to return */
	maxPaths?: number;
	/** Traversal mode: 'directed' or 'undirected' */
	traversalMode?: "directed" | "undirected";
}

/**
 * Betweenness ranking result.
 */
export interface BetweennessRankingResult {
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
 * Betweenness Centrality Ranking SUT (baseline).
 *
 * Ranks paths between source and target nodes by sum of betweenness centrality.
 * Uses Brandes' algorithm to compute betweenness for all nodes.
 */
export class BetweennessRankingSUT {
	readonly id = "betweenness-ranking-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	private readonly expander: BenchmarkGraphExpander;
	private readonly source: string;
	private readonly target: string;
	private readonly rankingConfig: Required<BetweennessRankingConfig>;

	constructor(expander: BenchmarkGraphExpander, inputs: readonly string[], config: BetweennessRankingConfig = {}) {
		this.expander = expander;
		this.source = inputs[0];
		this.target = inputs[1];
		this.rankingConfig = {
			maxPaths: config.maxPaths ?? 10,
			traversalMode: config.traversalMode ?? "undirected",
		};
		this.config = { ...this.rankingConfig };
	}

	/**
	 * Execute betweenness centrality path ranking.
	 */
	async run(): Promise<Result<BetweennessRankingResult, Error>> {
		try {
			// Check cache for graph conversion (avoid repeated conversions for same expander)
			let graph = GRAPH_CACHE.get(this.expander);
			if (!graph) {
				graph = await this.expander.toGraph();
				GRAPH_CACHE.set(this.expander, graph);
			}

			// Run betweenness ranking algorithm
			const result = betweennessRanking(graph, this.source, this.target, {
				maxPaths: this.rankingConfig.maxPaths,
				traversalMode: this.rankingConfig.traversalMode,
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

			return Ok({
				pathsFound: paths.length,
				...metrics,
				paths: paths.map((p, index) => ({
					id: `path-${index}`,
					nodes: p.path.nodes.map((n) => n.id),
					mi: p.geometricMeanMI,
				})),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return Error_(new Error(`Betweenness ranking failed: ${message}`));
		}
	}

	/**
	 * Create an empty result (no paths found).
	 */
	private createEmptyResult(): BetweennessRankingResult {
		return {
			pathsFound: 0,
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

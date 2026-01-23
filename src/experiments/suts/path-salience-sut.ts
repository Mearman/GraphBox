/**
 * Path Salience Ranking SUT
 *
 * System Under Test wrapper for Path Salience Ranking algorithm.
 * Integrates Mutual Information-based path ranking into PPEF framework.
 */

import { Graph } from "../../algorithms/graph/graph.js";
import { rankPaths } from "../../algorithms/pathfinding/path-ranking.js";
import type { Edge, Node } from "../../algorithms/types/graph.js";
import { Err as Error_, Ok, type Result } from "../../algorithms/types/result.js";
import type { BenchmarkGraphExpander } from "../evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../evaluation/__tests__/validation/common/path-ranking-helpers.js";

/**
 * Static cache for graph conversions.
 * Shared across all SUT instances to avoid repeated toGraph() calls.
 */
const GRAPH_CACHE = new Map<BenchmarkGraphExpander, Graph<Node, Edge>>();

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
 * Internal path ranking inputs.
 */
export interface PathRankingInputs {
	graph: BenchmarkGraphExpander;
	source: string;
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
 * Path Salience Ranking SUT implementation.
 *
 * Ranks paths between source and target nodes using mutual information.
 */
export class PathSalienceSUT {
	readonly id = "path-salience-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	private readonly expander: BenchmarkGraphExpander;
	private readonly source: string;
	private readonly target: string;
	private readonly rankingConfig: Required<PathSalienceConfig>;

	constructor(expander: BenchmarkGraphExpander, inputs: readonly string[], config: PathSalienceConfig = {}) {
		this.expander = expander;
		this.source = inputs[0];
		this.target = inputs[1];
		this.rankingConfig = {
			maxPaths: config.maxPaths ?? 10,
			traversalMode: config.traversalMode ?? "undirected",
			lambda: config.lambda ?? 0,
		};
		this.config = { ...this.rankingConfig };
	}

	/**
	 * Execute path ranking.
	 */
	async run(): Promise<Result<PathSalienceResult, Error>> {
		try {
			// Check cache for graph conversion (avoid repeated conversions for same expander)
			let graph = GRAPH_CACHE.get(this.expander);
			if (!graph) {
				graph = await this.expander.toGraph();
				GRAPH_CACHE.set(this.expander, graph);
			}

			// Run path ranking algorithm
			const result = rankPaths(graph, this.source, this.target, {
				maxPaths: this.rankingConfig.maxPaths,
				traversalMode: this.rankingConfig.traversalMode,
				lambda: this.rankingConfig.lambda,
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
			return Error_(new Error(`Path Salience ranking failed: ${message}`));
		}
	}

	/**
	 * Create an empty result (no paths found).
	 */
	private createEmptyResult(): PathSalienceResult {
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

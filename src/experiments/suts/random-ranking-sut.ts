/**
 * Random Path Ranking SUT (Baseline)
 *
 * Baseline SUT that ranks paths randomly, serving as a statistical null hypothesis.
 * Integrates random path ranking into PPEF framework.
 */

import { Err as Error_, Ok, type Result } from "../../algorithms/types/result.js";
import { randomPathRanking } from "../baselines/random-path-ranking.js";
import type { BenchmarkGraphExpander } from "../evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { computeRankingMetrics } from "../evaluation/__tests__/validation/common/path-ranking-helpers.js";

/**
 * Configuration for Random Path Ranking SUT.
 */
export interface RandomRankingConfig {
	/** Maximum number of paths to return */
	maxPaths?: number;
	/** Random seed for reproducibility */
	seed?: number;
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
 * Random Path Ranking SUT (statistical null hypothesis).
 *
 * Ranks paths between source and target nodes using random selection.
 */
export class RandomRankingSUT {
	readonly id = "random-ranking-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	private readonly expander: BenchmarkGraphExpander;
	private readonly source: string;
	private readonly target: string;
	private readonly rankingConfig: Required<RandomRankingConfig>;

	constructor(expander: BenchmarkGraphExpander, inputs: readonly string[], config: RandomRankingConfig = {}) {
		this.expander = expander;
		this.source = inputs[0];
		this.target = inputs[1];
		this.rankingConfig = {
			maxPaths: config.maxPaths ?? 10,
			seed: config.seed ?? 42,
		};
		this.config = { ...this.rankingConfig };
	}

	/**
	 * Execute random path ranking.
	 */
	async run(): Promise<Result<RandomRankingResult, Error>> {
		try {
			// Convert expander to Graph for algorithm compatibility
			const graph = await this.expander.toGraph();

			// Run random path ranking algorithm
			const result = randomPathRanking(graph, this.source, this.target, {
				maxPaths: this.rankingConfig.maxPaths,
				seed: this.rankingConfig.seed,
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
			return Error_(new Error(`Random ranking failed: ${message}`));
		}
	}

	/**
	 * Create an empty result (no paths found).
	 */
	private createEmptyResult(): RandomRankingResult {
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

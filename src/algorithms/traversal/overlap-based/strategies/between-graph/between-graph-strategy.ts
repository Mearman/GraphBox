import type { OverlapBasedExpansionResult } from "../../overlap-result.js";

/**
 * Strategy for defining the "between-graph" subgraph after termination.
 *
 * Once overlap-based termination occurs, this strategy determines what
 * constitutes the output subgraph that will be passed to Path Salience ranking.
 *
 * The goal is to produce a subgraph that:
 * - Contains paths between all seed pairs (if N ≥ 2)
 * - Preserves topological structure for accurate MI computation
 * - Maintains statistical properties needed for salient ranking
 */
export interface BetweenGraphStrategy {
	/**
	 * Strategy identifier for naming SUT variants.
	 */
	readonly id: string;

	/**
	 * Extract the between-graph subgraph from expansion results.
	 *
	 * @param expansionResult - Raw expansion output with all visited nodes/edges
	 * @param graph - Original graph (optional, for shortest paths or MI computation)
	 * @returns Refined subgraph definition with nodes, edges, and paths
	 */
	extractBetweenGraph(
		expansionResult: OverlapBasedExpansionResult,
		graph?: unknown
	): BetweenGraphOutput;
}

/**
 * Output from BetweenGraphStrategy defining the between-graph subgraph.
 */
export interface BetweenGraphOutput {
	/** Nodes included in the between-graph subgraph */
	nodes: Set<string>;

	/** Edges included in the between-graph subgraph */
	edges: Set<string>;

	/** Paths preserved in the subgraph (fromSeed → toSeed → node array) */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;
}

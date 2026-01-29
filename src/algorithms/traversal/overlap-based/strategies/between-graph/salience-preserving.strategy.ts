import type { OverlapBasedExpansionResult } from "../../overlap-result.js";
import type { BetweenGraphStrategy } from "./between-graph-strategy.js";

/**
 * Configuration for SaliencePreservingStrategy.
 */
export interface SaliencePreservingConfig {
	/**
	 * Target percentage of nodes to preserve based on salience ranking.
	 * Range: (0, 100]
	 * Default: 100 (preserve all salient nodes, equivalent to full expansion result)
	 */
	targetPreservation?: number;

	/**
	 * Minimum number of nodes to preserve regardless of salience.
	 * Default: 10 (ensures basic connectivity)
	 */
	minNodes?: number;
}

/**
 * Salience-Preserving Between-Graph Strategy
 *
 * Preserves nodes and edges based on their contribution to path salience
 * (mutual information). This strategy aims to retain high-information paths
 * while discarding low-contributing regions.
 *
 * **Algorithm**: Rank nodes by their occurrence frequency in discovered paths
 * (as a proxy for MI contribution), then preserve nodes/edges above a threshold.
 *
 * **Complexity**: O(P × L + V log V) where P = paths, L = avg length, V = nodes
 *
 * **Thesis Alignment**: This strategy implements the thesis concept of
 * salience-based subgraph extraction, preserving paths that maximize mutual
 * information for downstream ranking tasks.
 *
 * **Note**: This is a simplified implementation using path frequency as a
 * proxy for MI. A full implementation would integrate with Path Salience
 * ranking to compute actual MI scores.
 */
export class SaliencePreservingStrategy implements BetweenGraphStrategy {
	/** Strategy identifier for naming SUT variants */
	readonly id = "salience-preserving";

	/** Target percentage of nodes to preserve */
	private readonly targetPreservation: number;

	/** Minimum number of nodes to preserve */
	private readonly minNodes: number;

	/**
	 * Create a SaliencePreserving strategy.
	 *
	 * @param config - Strategy configuration
	 */
	constructor(config: SaliencePreservingConfig = {}) {
		this.targetPreservation = config.targetPreservation ?? 100;
		this.minNodes = config.minNodes ?? 10;
	}

	/**
	 * Extract the between-graph subgraph from expansion results.
	 *
	 * Preserves nodes based on path salience ranking.
	 *
	 * @param expansionResult - Raw expansion output with all visited nodes/edges
	 * @param _graph - Original graph (unused, we use path-based salience)
	 * @returns Refined subgraph definition with nodes, edges, and paths
	 */
	extractBetweenGraph(
		expansionResult: OverlapBasedExpansionResult,
		_graph?: unknown
	): {
		nodes: Set<string>;
		edges: Set<string>;
		paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;
	} {
		// If no paths discovered, return all visited nodes
		if (expansionResult.paths.length === 0) {
			return {
				nodes: expansionResult.sampledNodes,
				edges: expansionResult.sampledEdges,
				paths: [],
			};
		}

		// Calculate node salience based on path occurrence frequency
		const nodeSalience = this.calculateNodeSalience(expansionResult.paths);

		// Sort nodes by salience score
		const sortedNodes = [...nodeSalience.entries()].sort((a, b) => b[1] - a[1]);

		// Determine how many nodes to preserve
		const targetCount = Math.max(
			this.minNodes,
			Math.ceil((this.targetPreservation / 100) * sortedNodes.length)
		);

		// Select top-K salient nodes
		const preservedNodes = new Set<string>();
		for (let index = 0; index < Math.min(targetCount, sortedNodes.length); index++) {
			preservedNodes.add(sortedNodes[index][0]);
		}

		// Include seeds regardless of salience (for connectivity)
		for (const path of expansionResult.paths) {
			const seedA = path.nodes[0];
			const seedB = path.nodes.at(-1);
			preservedNodes.add(seedA);
			if (seedB !== undefined) {
				preservedNodes.add(seedB);
			}
		}

		// Filter edges to only include those between preserved nodes
		const preservedEdges = new Set<string>();
		for (const edge of expansionResult.sampledEdges) {
			const [source, target] = edge.split("->");
			if (preservedNodes.has(source) && preservedNodes.has(target)) {
				preservedEdges.add(edge);
			}
		}

		// Filter paths to only include those within preserved nodes
		const filteredPaths = expansionResult.paths.filter((path) =>
			path.nodes.every((node) => preservedNodes.has(node))
		);

		return {
			nodes: preservedNodes,
			edges: preservedEdges,
			paths: filteredPaths,
		};
	}

	/**
	 * Calculate node salience based on path occurrence frequency.
	 *
	 * Nodes that appear in more paths have higher salience scores.
	 * This is a simplified proxy for mutual information contribution.
	 *
	 * @param paths - Discovered paths from expansion
	 * @returns Map of node ID to salience score
	 * @private
	 */
	private calculateNodeSalience(
		paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>
	): Map<string, number> {
		const salience = new Map<string, number>();

		for (const path of paths) {
			for (const node of path.nodes) {
				const current = salience.get(node) ?? 0;
				salience.set(node, current + 1);
			}
		}

		return salience;
	}
}

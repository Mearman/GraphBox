import type { OverlapBasedExpansionResult } from "../../overlap-result.js";
import type { BetweenGraphStrategy } from "./between-graph-strategy.js";

/**
 * Minimal Paths Between-Graph Strategy
 *
 * Returns the minimal subgraph containing only the nodes and edges that appear
 * in the discovered paths. This produces the most compact between-graph representation.
 *
 * **Algorithm**: Extract all nodes and edges that appear in any discovered path,
 * excluding nodes visited but not part of path connections.
 *
 * **Complexity**: O(P × L) where P = number of paths, L = average path length
 *
 * **Thesis Alignment**: This strategy provides the most compact representation
 * of the between-graph, useful for memory-constrained scenarios and as a baseline
 * for comparison with more comprehensive strategies.
 */
export class MinimalPathsStrategy implements BetweenGraphStrategy {
	/** Strategy identifier for naming SUT variants */
	readonly id = "minimal-paths";

	/**
	 * Extract the between-graph subgraph from expansion results.
	 *
	 * Returns only nodes and edges that appear in discovered paths.
	 * For N=1 (no paths), returns all visited nodes as fallback.
	 *
	 * @param expansionResult - Raw expansion output with all visited nodes/edges
	 * @param _graph - Original graph (unused for minimal paths)
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
		// For N=1 (no paths), return all visited nodes as fallback
		if (expansionResult.paths.length === 0) {
			return {
				nodes: expansionResult.sampledNodes,
				edges: expansionResult.sampledEdges,
				paths: expansionResult.paths,
			};
		}

		// Collect all nodes and edges from paths
		const nodes = new Set<string>();
		const edges = new Set<string>();

		for (const path of expansionResult.paths) {
			// Add all nodes in the path
			for (const node of path.nodes) {
				nodes.add(node);
			}

			// Add all edges in the path
			for (let index = 0; index < path.nodes.length - 1; index++) {
				const edgeKey = `${path.nodes[index]}->${path.nodes[index + 1]}`;
				edges.add(edgeKey);
			}
		}

		return {
			nodes,
			edges,
			paths: expansionResult.paths,
		};
	}
}

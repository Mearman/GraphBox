import type { OverlapBasedExpansionResult } from "../../overlap-result.js";
import type { BetweenGraphStrategy } from "./between-graph-strategy.js";

/**
 * Truncated Component Between-Graph Strategy
 *
 * Returns the connected component(s) containing the overlap nodes where
 * frontiers met. This preserves more context than MinimalPaths while
 * avoiding fringe regions that don't contribute to seed connectivity.
 *
 * **Algorithm**: Identify all overlap meeting nodes, then extract the
 * connected component(s) containing these nodes using BFS/DFS traversal.
 *
 * **Complexity**: O(V + E) where V = visited nodes, E = visited edges
 *
 * **Thesis Alignment**: This strategy provides a balanced approach that
 * preserves the neighborhood structure around overlap regions while excluding
 * peripheral exploration that doesn't contribute to seed connectivity.
 */
export class TruncatedComponentStrategy implements BetweenGraphStrategy {
	/** Strategy identifier for naming SUT variants */
	readonly id = "truncated-component";

	/**
	 * Extract the between-graph subgraph from expansion results.
	 *
	 * Returns the connected component containing overlap meeting nodes.
	 *
	 * @param expansionResult - Raw expansion output with all visited nodes/edges
	 * @param _graph - Original graph (unused, we use sampled data)
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
		// Extract all overlap meeting nodes
		const overlapNodes = new Set<string>();
		for (const event of expansionResult.overlapMetadata.overlapEvents) {
			overlapNodes.add(event.meetingNode);
		}

		// If no overlap nodes, fall back to all visited nodes
		if (overlapNodes.size === 0) {
			return {
				nodes: expansionResult.sampledNodes,
				edges: expansionResult.sampledEdges,
				paths: expansionResult.paths,
			};
		}

		// Build adjacency list from sampled edges
		const adj = this.buildAdjacencyList(expansionResult);

		// Find connected component(s) containing overlap nodes
		const componentNodes = new Set<string>();
		const componentEdges = new Set<string>();

		// BFS from each overlap node to find connected component
		for (const startNode of overlapNodes) {
			this.bfsComponent(startNode, adj, componentNodes, componentEdges);
		}

		// Filter paths to only include those within the component
		const filteredPaths = expansionResult.paths.filter((path) =>
			path.nodes.every((node) => componentNodes.has(node))
		);

		return {
			nodes: componentNodes,
			edges: componentEdges,
			paths: filteredPaths,
		};
	}

	/**
	 * Build an adjacency list from sampled edges.
	 *
	 * @param expansionResult - Expansion result with sampled edges
	 * @returns Adjacency list (node -> set of neighbors)
	 * @private
	 */
	private buildAdjacencyList(
		expansionResult: OverlapBasedExpansionResult
	): Map<string, Set<string>> {
		const adj = new Map<string, Set<string>>();

		for (const edge of expansionResult.sampledEdges) {
			const [source, target] = edge.split("->");

			if (!adj.has(source)) {
				adj.set(source, new Set());
			}
			if (!adj.has(target)) {
				adj.set(target, new Set());
			}

			const sourceSet = adj.get(source);
			const targetSet = adj.get(target);
			if (sourceSet !== undefined) {
				sourceSet.add(target);
			}
			if (targetSet !== undefined) {
				targetSet.add(source); // Undirected for connectivity
			}
		}

		return adj;
	}

	/**
	 * Perform BFS to find the connected component containing a start node.
	 *
	 * @param startNode - Node to start BFS from
	 * @param adj - Adjacency list
	 * @param componentNodes - Set to accumulate component nodes
	 * @param componentEdges - Set to accumulate component edges
	 * @private
	 */
	private bfsComponent(
		startNode: string,
		adj: Map<string, Set<string>>,
		componentNodes: Set<string>,
		componentEdges: Set<string>
	): void {
		const visited = new Set<string>();
		const queue: string[] = [startNode];
		visited.add(startNode);

		while (queue.length > 0) {
			const current = queue.shift();
			if (current === undefined) continue;

			// Add this node to component
			componentNodes.add(current);

			// Add edges to neighbors
			const neighbors = adj.get(current) || new Set();
			for (const neighbor of neighbors) {
				const edgeKey1 = `${current}->${neighbor}`;
				const edgeKey2 = `${neighbor}->${current}`;

				// Add edge (try both directions to match sampled edge format)
				if (componentEdges.has(edgeKey1)) {
					componentEdges.add(edgeKey1);
				} else {
					componentEdges.add(edgeKey2);
				}

				// Continue BFS
				if (!visited.has(neighbor)) {
					visited.add(neighbor);
					queue.push(neighbor);
				}
			}
		}
	}
}

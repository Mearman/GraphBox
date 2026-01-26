import type { TerminationStrategy } from "./termination-strategy.js";
import type { FrontierState } from "../../frontier-state.js";

/**
 * Transitive Connectivity Termination Strategy
 *
 * Terminates expansion when the overlap graph is connected, meaning all seeds
 * are transitively connected via overlap events. This is less strict than
 * FullPairwise, allowing termination before all C(N,2) pairs directly overlap.
 *
 * **Algorithm**: Build an overlap graph where nodes = frontiers and edges = overlaps.
 * Terminate when the graph is connected (all nodes reachable from any starting node).
 *
 * **Complexity**: O(N + E) where N = number of seeds, E = overlap events
 *
 * **Thesis Alignment**: This strategy provides a balanced approach, ensuring
 * connectivity between all seed regions while potentially terminating earlier
 * than FullPairwise. This is useful for large N where full pairwise overlap
 * may be excessive.
 */
export class TransitiveConnectivityStrategy implements TerminationStrategy {
	/** Strategy identifier for naming SUT variants */
	readonly id = "transitive-connectivity";

	/**
	 * Check if expansion should terminate based on current state.
	 *
	 * @param allFrontiers - All frontiers in the expansion
	 * @param overlapEvents - All recorded overlap events so far
	 * @param _iteration - Current iteration count (unused)
	 * @returns true if expansion should terminate
	 */
	shouldTerminate(
		allFrontiers: FrontierState[],
		overlapEvents: readonly { frontierA: number; frontierB: number }[],
		_iteration: number
	): boolean {
		const n = allFrontiers.length;

		// N=1 is a special case - no overlap possible
		if (n <= 1) {
			return true;
		}

		// Build adjacency list for overlap graph
		const adj = new Map<number, Set<number>>();
		for (let i = 0; i < n; i++) {
			adj.set(i, new Set());
		}

		for (const event of overlapEvents) {
			adj.get(event.frontierA)!.add(event.frontierB);
			adj.get(event.frontierB)!.add(event.frontierA);
		}

		// Check if graph is connected using BFS from node 0
		return this.isConnected(adj, n);
	}

	/**
	 * Check if an undirected graph is connected using BFS.
	 *
	 * @param adj - Adjacency list representation of graph
	 * @param n - Number of nodes
	 * @returns true if graph is connected
	 * @private
	 */
	private isConnected(adj: Map<number, Set<number>>, n: number): boolean {
		if (n === 0) return true;

		const visited = new Set<number>();
		const queue: number[] = [0];
		visited.add(0);

		while (queue.length > 0) {
			const current = queue.shift()!;

			for (const neighbor of adj.get(current) || []) {
				if (!visited.has(neighbor)) {
					visited.add(neighbor);
					queue.push(neighbor);
				}
			}
		}

		// Graph is connected if all nodes were visited
		return visited.size === n;
	}
}

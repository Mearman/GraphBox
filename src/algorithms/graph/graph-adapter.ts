/**
 * Adapter to make the algorithms Graph class compatible with ReadableGraph interface.
 *
 * This adapter bridges the gap between the algorithms Graph class and the
 * ReadableGraph interface used by traversal algorithms (BFS, DFS, etc.).
 */

import type { ReadableGraph } from "../../interfaces/readable-graph";
import type { Edge,Node } from "../types/graph";
import type { Graph } from "./graph";

/**
 * Adapts the algorithms Graph class to the ReadableGraph interface.
 *
 * @template N - Node type extending Node
 * @template E - Edge type extending Edge
 * @example
 * ```typescript
 * const graph = new Graph<MyNode, MyEdge>(true);
 * graph.addNode({ id: 'A', type: 'test' });
 * graph.addNode({ id: 'B', type: 'test' });
 * graph.addEdge({ id: 'E1', source: 'A', target: 'B', type: 'edge' });
 *
 * const adapter = new GraphAdapter(graph);
 * const result = bfs(adapter, 'A');
 * ```
 */
export class GraphAdapter<N extends Node, E extends Edge> implements ReadableGraph<N, E> {
	constructor(private readonly graph: Graph<N, E>) {}

	hasNode(id: string): boolean {
		return this.graph.getNode(id).some;
	}

	getNode(id: string): N | null {
		const result = this.graph.getNode(id);
		return result.some ? result.value : null;
	}

	getNeighbors(id: string): string[] {
		const result = this.graph.getOutgoingEdges(id);
		if (!result.ok) {
			return [];
		}
		return result.value.map(edge => edge.target);
	}

	getAllNodes(): N[] {
		return this.graph.getAllNodes();
	}

	isDirected(): boolean {
		return this.graph.isDirected();
	}

	getOutgoingEdges(id: string): E[] {
		const result = this.graph.getOutgoingEdges(id);
		if (!result.ok) {
			return [];
		}
		return result.value;
	}
}

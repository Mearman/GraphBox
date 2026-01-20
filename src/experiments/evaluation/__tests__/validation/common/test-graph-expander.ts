/**
 * Test Graph Builder
 *
 * Creates a test graph expander from an edge list.
 * Supports both directed and undirected graphs.
 */

import type { GraphExpander, Neighbor } from "../../../../../interfaces/graph-expander";

export interface TestNode {
	id: string;
	degree?: number;
}

/**
 * Creates a test graph expander from an edge list.
 * Supports both directed and undirected graphs.
 */
export class TestGraphExpander implements GraphExpander<TestNode> {
	private adjacency = new Map<string, Neighbor[]>();
	private degrees = new Map<string, number>();
	private nodes = new Map<string, TestNode>();

	constructor(edges: Array<[string, string]>, directed = false) {
		// Collect all nodes
		const nodeIds = new Set<string>();
		for (const [source, target] of edges) {
			nodeIds.add(source);
			nodeIds.add(target);
		}

		// Initialize adjacency lists
		for (const id of nodeIds) {
			this.adjacency.set(id, []);
			this.nodes.set(id, { id });
		}

		// Build adjacency
		for (const [source, target] of edges) {
			this.adjacency.get(source)!.push({ targetId: target, relationshipType: "edge" });
			if (!directed) {
				this.adjacency.get(target)!.push({ targetId: source, relationshipType: "edge" });
			}
		}

		// Compute degrees
		for (const [nodeId, neighbors] of this.adjacency) {
			this.degrees.set(nodeId, neighbors.length);
			this.nodes.get(nodeId)!.degree = neighbors.length;
		}
	}

	async getNeighbors(nodeId: string): Promise<Neighbor[]> {
		return this.adjacency.get(nodeId) ?? [];
	}

	getDegree(nodeId: string): number {
		return this.degrees.get(nodeId) ?? 0;
	}

	async getNode(nodeId: string): Promise<TestNode | null> {
		return this.nodes.get(nodeId) ?? null;
	}

	addEdge(): void {
		// No-op for tests
	}

	calculatePriority(nodeId: string, options: { nodeWeight?: number; epsilon?: number } = {}): number {
		const { nodeWeight = 1, epsilon = 1e-10 } = options;
		const degree = this.getDegree(nodeId);
		return degree / (nodeWeight + epsilon);
	}

	getNodeCount(): number {
		return this.nodes.size;
	}

	getAllNodeIds(): string[] {
		return [...this.nodes.keys()];
	}

	getAllDegrees(): Map<string, number> {
		return this.degrees;
	}
}

/**
 * Create a test graph from edge list
 * @param edges
 */
export const createGraphFromEdges = (edges: Array<[string, string]>): TestGraphExpander => new TestGraphExpander(edges, false);

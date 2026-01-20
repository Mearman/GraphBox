/**
 * Benchmark Graph Adapter
 *
 * Adapts a loaded benchmark graph to the GraphExpander interface.
 * The benchmark graphs use the core Graph class with LoadedNode/LoadedEdge types.
 */

import type { GraphExpander, Neighbor } from "../../../../../interfaces/graph-expander";

export class BenchmarkGraphExpander implements GraphExpander<{ id: string }> {
	private adjacency: Map<string, string[]>;
	private degrees: Map<string, number>;
	private nodeIds: string[];

	constructor(
		private graph: {
			getAllNodes: () => Array<{ id: string }>;
			getAllEdges: () => Array<{ source: string; target: string }>;
		},
		directed: boolean
	) {
		this.adjacency = new Map();
		this.degrees = new Map();
		this.nodeIds = graph.getAllNodes().map((n) => n.id);

		// Build adjacency list and compute degrees
		for (const nodeId of this.nodeIds) {
			this.adjacency.set(nodeId, []);
			this.degrees.set(nodeId, 0);
		}

		for (const edge of graph.getAllEdges()) {
			this.adjacency.get(edge.source)!.push(edge.target);
			this.degrees.set(edge.source, (this.degrees.get(edge.source) ?? 0) + 1);

			if (!directed) {
				this.adjacency.get(edge.target)!.push(edge.source);
				this.degrees.set(edge.target, (this.degrees.get(edge.target) ?? 0) + 1);
			}
		}
	}

	async getNeighbors(nodeId: string): Promise<Neighbor[]> {
		const neighbors = this.adjacency.get(nodeId) ?? [];
		return neighbors.map((targetId) => ({ targetId, relationshipType: "edge" }));
	}

	getDegree(nodeId: string): number {
		return this.degrees.get(nodeId) ?? 0;
	}

	async getNode(nodeId: string): Promise<{ id: string } | null> {
		return this.nodeIds.includes(nodeId) ? { id: nodeId } : null;
	}

	addEdge(): void {
		// No-op for benchmark tests
	}

	calculatePriority(nodeId: string, options: { nodeWeight?: number; epsilon?: number } = {}): number {
		const { nodeWeight = 1, epsilon = 1e-10 } = options;
		const degree = this.getDegree(nodeId);
		return degree / (nodeWeight + epsilon);
	}

	getNodeCount(): number {
		return this.nodeIds.length;
	}

	getAllNodeIds(): string[] {
		return [...this.nodeIds];
	}

	/**
	 * Get the degree distribution for statistical analysis.
	 */
	getDegreeDistribution(): Map<number, number> {
		const distribution = new Map<number, number>();
		for (const degree of this.degrees.values()) {
			distribution.set(degree, (distribution.get(degree) ?? 0) + 1);
		}
		return distribution;
	}

	getAllDegrees(): Map<string, number> {
		return this.degrees;
	}
}

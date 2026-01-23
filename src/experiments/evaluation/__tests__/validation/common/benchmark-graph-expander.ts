/**
 * Benchmark Graph Adapter
 *
 * Adapts a loaded benchmark graph to the GraphExpander interface.
 * The benchmark graphs use the core Graph class with LoadedNode/LoadedEdge types.
 */

import { Graph } from "../../../../../algorithms/graph/graph.js";
import type { Edge,Node } from "../../../../../algorithms/types/graph.js";
import type { GraphExpander, Neighbor } from "../../../../../interfaces/graph-expander";

export class BenchmarkGraphExpander implements GraphExpander<{ id: string }> {
	private adjacency: Map<string, string[]>;
	private degrees: Map<string, number>;
	private nodeIds: string[];
	private nodeIndex: Map<string, number>; // nodeId -> position index
	private edgesBySource: Array<{source: string; target: string}>; // Flat edge array
	private edgesByTarget?: Array<{source: string; target: string}>; // For undirected reverse lookups
	private adjacencyBuilt: Set<string>;
	private directed: boolean;

	constructor(
		private graph: {
			getAllNodes: () => Array<{ id: string }>;
			getAllEdges: () => Array<{ source: string; target: string }>;
		},
		directed: boolean
	) {
		this.adjacency = new Map();
		this.degrees = new Map();
		this.adjacencyBuilt = new Set();
		this.directed = directed;
		this.nodeIds = graph.getAllNodes().map((n) => n.id);

		// Build node index for O(1) existence checks
		this.nodeIndex = new Map();
		for (const [index, id] of this.nodeIds.entries()) {
			this.nodeIndex.set(id, index);
		}

		// Store edges as sorted flat arrays for binary search
		// This is O(E log E) for sorting, done once in constructor
		const allEdges = graph.getAllEdges();
		this.edgesBySource = [...allEdges].sort((a, b) => a.source.localeCompare(b.source));
		if (!directed) {
			this.edgesByTarget = [...allEdges].sort((a, b) => a.target.localeCompare(b.target));
		}

		// Compute degrees in O(E) by counting edges
		// This is much faster than building full adjacency
		for (const edge of allEdges) {
			this.degrees.set(edge.source, (this.degrees.get(edge.source) ?? 0) + 1);
			if (!directed) {
				this.degrees.set(edge.target, (this.degrees.get(edge.target) ?? 0) + 1);
			}
		}
	}

	async getNeighbors(nodeId: string): Promise<Neighbor[]> {
		// Build adjacency incrementally on first access
		if (!this.adjacencyBuilt.has(nodeId)) {
			this.buildAdjacencyForNode(nodeId);
		}

		const neighbors = this.adjacency.get(nodeId) ?? [];
		return neighbors.map((targetId) => ({ targetId, relationshipType: "edge" }));
	}

	getDegree(nodeId: string): number {
		// Degree is pre-computed in constructor O(E)
		return this.degrees.get(nodeId) ?? 0;
	}

	/**
	 * Build adjacency for a specific node on-demand using binary search.
	 * Only processes the subset of edges relevant to this node.
	 * @param nodeId
	 */
	private buildAdjacencyForNode(nodeId: string): void {
		if (this.adjacency.has(nodeId)) {
			return; // Already built
		}

		const neighbors: string[] = [];

		// Binary search to find range of edges where source === nodeId
		// This is O(log E) instead of O(E)
		let start = 0;
		let end = this.edgesBySource.length;
		while (start < end) {
			const mid = Math.floor((start + end) / 2);
			const edge = this.edgesBySource[mid];
			if (edge.source === nodeId) {
				// Found the range - expand to find all matching edges
				neighbors.push(edge.target);

				// Search forward
				let index = mid + 1;
				while (index < end && this.edgesBySource[index].source === nodeId) {
					neighbors.push(this.edgesBySource[index].target);
					index++;
				}

				// Search backward
				let index_ = mid - 1;
				while (index_ >= 0 && this.edgesBySource[index_].source === nodeId) {
					neighbors.push(this.edgesBySource[index_].target);
					index_--;
				}

				break;
			} else if (edge.source < nodeId) {
				start = mid + 1;
			} else {
				end = mid;
			}
		}

		this.adjacency.set(nodeId, neighbors);
		this.adjacencyBuilt.add(nodeId);
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

	/**
	 * Convert this expander to a Graph instance for use with algorithms.
	 *
	 * Creates a new Graph populated with nodes and edges from this expander.
	 * This allows using the expander with algorithms that expect Graph interface.
	 *
	 * @returns A Graph instance compatible with path ranking algorithms
	 */
	async toGraph(): Promise<Graph<Node, Edge>> {
		// Create a new undirected graph with explicit type parameters
		const graph = new Graph<Node, Edge>(false);

		// Add all nodes with required Node type
		for (const id of this.nodeIds) {
			const result = graph.addNode({ id, type: "node" });
			if (!result.ok) {
				// Node already exists, skip
			}
		}

		// Add all edges with required Edge type
		// Generate edge IDs from source-target pairs
		const edgesAdded = new Set<string>();
		for (const edge of this.edgesBySource) {
			const edgeId = `${edge.source}-${edge.target}`;
			const reverseEdgeId = `${edge.target}-${edge.source}`;

			// For undirected graphs, avoid adding duplicate edges
			if (edgesAdded.has(edgeId) || edgesAdded.has(reverseEdgeId)) {
				continue;
			}

			edgesAdded.add(edgeId);
			const result = graph.addEdge({
				id: edgeId,
				source: edge.source,
				target: edge.target,
				type: "edge",
			});
			if (!result.ok) {
				// Edge already exists, skip
			}
		}

		return graph;
	}
}

/**
 * Shared test infrastructure for representativeness tests
 */

import { Graph } from "../../../../../../../../../algorithms/graph/graph";
import type { Neighbor } from "../../../../../../../../../interfaces/graph-expander";

export interface TestNode {
	id: string;
	type: string;
	[key: string]: unknown;
}

export interface TestEdge {
	id: string;
	source: string;
	target: string;
	type: string;
	[key: string]: unknown;
}

/**
 * Adapter to use Graph class with expansion algorithms
 */
export class GraphExpanderAdapter {
	private adjacency = new Map<string, Neighbor[]>();
	private degrees = new Map<string, number>();
	private nodes = new Map<string, TestNode>();

	constructor(
		private readonly graph: Graph<TestNode, TestEdge>,
		directed = false
	) {
		for (const node of graph.getAllNodes()) {
			this.nodes.set(node.id, node);
			this.adjacency.set(node.id, []);
		}

		for (const edge of graph.getAllEdges()) {
			const neighbors = this.adjacency.get(edge.source) ?? [];
			neighbors.push({ targetId: edge.target, relationshipType: edge.type ?? "edge" });
			this.adjacency.set(edge.source, neighbors);

			if (!directed) {
				const reverseNeighbors = this.adjacency.get(edge.target) ?? [];
				reverseNeighbors.push({ targetId: edge.source, relationshipType: edge.type ?? "edge" });
				this.adjacency.set(edge.target, reverseNeighbors);
			}
		}

		for (const [nodeId, neighbors] of this.adjacency) {
			this.degrees.set(nodeId, neighbors.length);
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
		// No-op
	}

	calculatePriority(nodeId: string, options: { nodeWeight?: number; epsilon?: number } = {}): number {
		const { nodeWeight = 1, epsilon = 1e-10 } = options;
		const degree = this.getDegree(nodeId);
		return degree / (nodeWeight + epsilon);
	}

	getAllDegrees(): Map<string, number> {
		return this.degrees;
	}
}

/**
 * Create a test graph from edge list
 * @param edges
 */
export const createGraph = (edges: Array<[string, string]>): Graph<TestNode, TestEdge> => {
	const graph = new Graph<TestNode, TestEdge>(false);

	const nodeIds = new Set<string>();
	for (const [source, target] of edges) {
		nodeIds.add(source);
		nodeIds.add(target);
	}

	for (const id of nodeIds) {
		graph.addNode({ id, type: "test" });
	}

	let edgeCounter = 0;
	for (const [source, target] of edges) {
		graph.addEdge({ id: `e${edgeCounter++}`, source, target, type: "edge" });
		graph.addEdge({ id: `e${edgeCounter++}`, source: target, target: source, type: "edge" });
	}

	return graph;
};

/**
 * Create a chain graph (linear path)
 * @param length
 */
export const createChainGraph = (length: number): Graph<TestNode, TestEdge> => {
	const edges: Array<[string, string]> = [];
	for (let index = 0; index < length - 1; index++) {
		edges.push([`N${index}`, `N${index + 1}`]);
	}
	return createGraph(edges);
};

/**
 * Create a grid graph (rows x cols)
 * @param rows
 * @param cols
 */
export const createGridGraph = (rows: number, cols: number): Graph<TestNode, TestEdge> => {
	const edges: Array<[string, string]> = [];

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const node = `${r}_${c}`;
			if (c < cols - 1) {
				edges.push([node, `${r}_${c + 1}`]);
			}
			if (r < rows - 1) {
				edges.push([node, `${r + 1}_${c}`]);
			}
		}
	}

	return createGraph(edges);
};

/**
 * Create a hub graph with central hub nodes and leaf nodes
 * @param numberHubs
 * @param leavesPerHub
 */
export const createHubGraph = (numberHubs: number, leavesPerHub: number): Graph<TestNode, TestEdge> => {
	const edges: Array<[string, string]> = [];

	// Connect hubs
	for (let index = 0; index < numberHubs; index++) {
		for (let index_ = index + 1; index_ < numberHubs; index_++) {
			edges.push([`H${index}`, `H${index_}`]);
		}
	}

	// Connect leaves
	for (let h = 0; h < numberHubs; h++) {
		for (let l = 0; l < leavesPerHub; l++) {
			edges.push([`H${h}`, `L${h}_${l}`]);
		}
	}

	return createGraph(edges);
};

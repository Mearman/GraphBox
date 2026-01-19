/**
 * Test utilities for validating formal mathematical properties of graph algorithms.
 *
 * Provides graph generators and helper functions for proof tests.
 */

import { Graph } from "../../algorithms/graph/graph";
import type { Edge, Node } from "../../algorithms/types/graph";
import type { GraphExpander, Neighbor } from "../../interfaces/graph-expander";

// ============================================================================
// Test Node and Edge Types
// ============================================================================

/**
 * Test node with optional attributes for MI computation.
 */
export interface ProofTestNode extends Node {
	id: string;
	type: string;
	degree?: number;
	attributes?: number[];
}

/**
 * Test edge with optional weight and MI override.
 */
export interface ProofTestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: string;
	weight?: number;
	/** Override MI value for testing specific scenarios */
	miOverride?: number;
}

// ============================================================================
// Graph Expander for Testing
// ============================================================================

/**
 * Test implementation of GraphExpander for proof tests.
 * Wraps a Graph instance to provide the expansion interface.
 */
export class ProofTestExpander implements GraphExpander<ProofTestNode> {
	private adjacency = new Map<string, Neighbor[]>();
	private degrees = new Map<string, number>();
	private nodes = new Map<string, ProofTestNode>();
	private discoveredEdges: Array<{ source: string; target: string; relationshipType: string }> = [];

	constructor(
		edges: Array<[string, string]>,
		private readonly directed = false,
	) {
		// Collect all nodes
		const nodeIds = new Set<string>();
		for (const [source, target] of edges) {
			nodeIds.add(source);
			nodeIds.add(target);
		}

		// Initialize adjacency lists
		for (const id of nodeIds) {
			this.adjacency.set(id, []);
			this.nodes.set(id, { id, type: "test" });
		}

		// Build adjacency
		for (const [source, target] of edges) {
			const sourceAdj = this.adjacency.get(source);
			if (sourceAdj) {
				sourceAdj.push({ targetId: target, relationshipType: "edge" });
			}
			if (!directed) {
				const targetAdj = this.adjacency.get(target);
				if (targetAdj) {
					targetAdj.push({ targetId: source, relationshipType: "edge" });
				}
			}
		}

		// Compute degrees
		for (const [nodeId, neighbors] of this.adjacency) {
			this.degrees.set(nodeId, neighbors.length);
			const node = this.nodes.get(nodeId);
			if (node) {
				node.degree = neighbors.length;
			}
		}
	}

	async getNeighbors(nodeId: string): Promise<Neighbor[]> {
		return this.adjacency.get(nodeId) ?? [];
	}

	getDegree(nodeId: string): number {
		return this.degrees.get(nodeId) ?? 0;
	}

	async getNode(nodeId: string): Promise<ProofTestNode | null> {
		return this.nodes.get(nodeId) ?? null;
	}

	addEdge(source: string, target: string, relationshipType: string): void {
		this.discoveredEdges.push({ source, target, relationshipType });
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

	getDiscoveredEdges(): Array<{ source: string; target: string; relationshipType: string }> {
		return this.discoveredEdges;
	}

	clearDiscoveredEdges(): void {
		this.discoveredEdges = [];
	}
}

// ============================================================================
// Graph Generators
// ============================================================================

/**
 * Creates a linear chain graph: N0 -- N1 -- N2 -- ... -- N(n-1)
 * @param length
 */
export const createChainGraph = (length: number): ProofTestExpander => {
	const edges: Array<[string, string]> = [];
	for (let index = 0; index < length - 1; index++) {
		edges.push([`N${index}`, `N${index + 1}`]);
	}
	return new ProofTestExpander(edges);
};

/**
 * Creates a star graph with a central hub connected to all spokes.
 * @param numSpokes
 * @param numberSpokes
 */
export const createStarGraph = (numberSpokes: number): ProofTestExpander => {
	const edges: Array<[string, string]> = [];
	for (let index = 0; index < numberSpokes; index++) {
		edges.push(["HUB", `S${index}`]);
	}
	return new ProofTestExpander(edges);
};

/**
 * Creates a grid (lattice) graph of rows × cols.
 * @param rows
 * @param cols
 */
export const createGridGraph = (rows: number, cols: number): ProofTestExpander => {
	const edges: Array<[string, string]> = [];

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const node = `${r}_${c}`;
			// Right neighbor
			if (c < cols - 1) {
				edges.push([node, `${r}_${c + 1}`]);
			}
			// Down neighbor
			if (r < rows - 1) {
				edges.push([node, `${r + 1}_${c}`]);
			}
		}
	}

	return new ProofTestExpander(edges);
};

/**
 * Creates a complete graph K_n where every node connects to every other node.
 * @param n
 */
export const createCompleteGraph = (n: number): ProofTestExpander => {
	const edges: Array<[string, string]> = [];
	for (let index = 0; index < n; index++) {
		for (let index_ = index + 1; index_ < n; index_++) {
			edges.push([`N${index}`, `N${index_}`]);
		}
	}
	return new ProofTestExpander(edges);
};

/**
 * Creates a tree graph with specified branching factor and depth.
 * @param branchingFactor
 * @param depth
 */
export const createTreeGraph = (branchingFactor: number, depth: number): ProofTestExpander => {
	const edges: Array<[string, string]> = [];
	let nodeId = 0;
	const queue: Array<{ id: number; level: number }> = [{ id: nodeId++, level: 0 }];

	while (queue.length > 0) {
		const current = queue.shift();
		if (current && current.level < depth) {
			for (let index = 0; index < branchingFactor; index++) {
				const childId = nodeId++;
				edges.push([`N${current.id}`, `N${childId}`]);
				queue.push({ id: childId, level: current.level + 1 });
			}
		}
	}

	return new ProofTestExpander(edges);
};

/**
 * Creates a graph with multiple disconnected components.
 * @param numComponents
 * @param numberComponents
 * @param nodesPerComponent
 */
export const createDisconnectedGraph = (
	numberComponents: number,
	nodesPerComponent: number,
): ProofTestExpander => {
	const edges: Array<[string, string]> = [];

	for (let c = 0; c < numberComponents; c++) {
		// Create a chain within each component
		for (let index = 0; index < nodesPerComponent - 1; index++) {
			edges.push([`C${c}_N${index}`, `C${c}_N${index + 1}`]);
		}
	}

	return new ProofTestExpander(edges);
};

/**
 * Creates a cycle graph: N0 -- N1 -- N2 -- ... -- N(n-1) -- N0
 * @param n
 */
export const createCycleGraph = (n: number): ProofTestExpander => {
	const edges: Array<[string, string]> = [];
	for (let index = 0; index < n; index++) {
		edges.push([`N${index}`, `N${(index + 1) % n}`]);
	}
	return new ProofTestExpander(edges);
};

/**
 * Creates an Erdős-Rényi random graph G(n, p).
 * Each edge exists independently with probability p.
 * @param n
 * @param p
 * @param seed
 */
export const createErdosRenyiGraph = (
	n: number,
	p: number,
	seed?: number,
): ProofTestExpander => {
	const edges: Array<[string, string]> = [];
	const rng = createSeededRng(seed ?? Date.now());

	for (let index = 0; index < n; index++) {
		for (let index_ = index + 1; index_ < n; index_++) {
			if (rng() < p) {
				edges.push([`N${index}`, `N${index_}`]);
			}
		}
	}

	// Ensure graph is connected by adding edges if needed
	const connected = ensureConnected(edges, n);
	return new ProofTestExpander(connected);
};

/**
 * Creates a Barabási-Albert preferential attachment graph.
 * @param n
 * @param m
 * @param seed
 */
export const createBarabasiAlbertGraph = (
	n: number,
	m: number,
	seed?: number,
): ProofTestExpander => {
	if (m < 1 || m >= n) {
		throw new Error("m must be >= 1 and < n");
	}

	const edges: Array<[string, string]> = [];
	const degrees = new Map<string, number>();
	const rng = createSeededRng(seed ?? Date.now());

	// Start with a complete graph of m+1 nodes
	for (let index = 0; index <= m; index++) {
		for (let index_ = index + 1; index_ <= m; index_++) {
			edges.push([`N${index}`, `N${index_}`]);
			degrees.set(`N${index}`, (degrees.get(`N${index}`) ?? 0) + 1);
			degrees.set(`N${index_}`, (degrees.get(`N${index_}`) ?? 0) + 1);
		}
	}

	// Add remaining nodes with preferential attachment
	for (let index = m + 1; index < n; index++) {
		const newNode = `N${index}`;
		const totalDegree = [...degrees.values()].reduce((a, b) => a + b, 0);
		const targets = new Set<string>();

		while (targets.size < m) {
			// Select target with probability proportional to degree
			let rand = rng() * totalDegree;
			for (const [nodeId, deg] of degrees) {
				rand -= deg;
				if (rand <= 0 && !targets.has(nodeId)) {
					targets.add(nodeId);
					break;
				}
			}
		}

		for (const target of targets) {
			edges.push([newNode, target]);
			degrees.set(newNode, (degrees.get(newNode) ?? 0) + 1);
			degrees.set(target, (degrees.get(target) ?? 0) + 1);
		}
	}

	return new ProofTestExpander(edges);
};

// ============================================================================
// Graph Type for Path Ranking Tests
// ============================================================================

/**
 * Creates a Graph instance for path ranking tests.
 * @param edges
 * @param directed
 */
export const createTestGraph = (
	edges: Array<{ source: string; target: string; weight?: number; type?: string }>,
	directed = false,
): Graph<ProofTestNode, ProofTestEdge> => {
	const graph = new Graph<ProofTestNode, ProofTestEdge>(directed);
	const nodeIds = new Set<string>();

	// Collect node IDs
	for (const edge of edges) {
		nodeIds.add(edge.source);
		nodeIds.add(edge.target);
	}

	// Add nodes
	for (const id of nodeIds) {
		graph.addNode({ id, type: "test" });
	}

	// Add edges
	let edgeId = 0;
	for (const edge of edges) {
		graph.addEdge({
			id: `E${edgeId++}`,
			source: edge.source,
			target: edge.target,
			type: edge.type ?? "edge",
			weight: edge.weight ?? 1,
		});
	}

	return graph;
};

/**
 * Creates a Graph with explicit MI values for edges.
 * Used for testing path ranking properties.
 * @param edges
 * @param directed
 */
export const createTestGraphWithMI = (
	edges: Array<{ source: string; target: string; miOverride: number }>,
	directed = false,
): Graph<ProofTestNode, ProofTestEdge> => {
	const graph = new Graph<ProofTestNode, ProofTestEdge>(directed);
	const nodeIds = new Set<string>();

	// Collect node IDs
	for (const edge of edges) {
		nodeIds.add(edge.source);
		nodeIds.add(edge.target);
	}

	// Add nodes with unique types to control MI computation
	let nodeIndex = 0;
	for (const id of nodeIds) {
		graph.addNode({ id, type: `type_${nodeIndex++}` });
	}

	// Add edges with miOverride stored in edge data
	let edgeId = 0;
	for (const edge of edges) {
		graph.addEdge({
			id: `E${edgeId++}`,
			source: edge.source,
			target: edge.target,
			type: "edge",
			weight: 1,
			miOverride: edge.miOverride,
		});
	}

	return graph;
};

// ============================================================================
// MI Cache Helpers
// ============================================================================

/**
 * Creates a mock MI cache with specified values.
 * @param miValues
 */
export const createMockMICache = (
	miValues: Map<string, number>,
): { get: (id: string) => number | undefined; keys: () => IterableIterator<string>; size: number } => {
	return {
		get: (id: string) => miValues.get(id),
		keys: () => miValues.keys(),
		size: miValues.size,
	};
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a seeded pseudo-random number generator.
 * Uses mulberry32 algorithm for deterministic results.
 * @param seed
 */
export const createSeededRng = (seed: number): (() => number) => {
	let t = seed;
	return () => {
		t = Math.trunc(t + 0x6D_2B_79_F5);
		let result = Math.imul(t ^ (t >>> 15), 1 | t);
		result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
		return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
	};
};

/**
 * Ensures a graph is connected by adding minimum edges.
 * @param edges
 * @param n
 */
const ensureConnected = (
	edges: Array<[string, string]>,
	n: number,
): Array<[string, string]> => {
	// Build adjacency for connectivity check
	const adj = new Map<string, Set<string>>();
	for (let index = 0; index < n; index++) {
		adj.set(`N${index}`, new Set());
	}

	for (const [u, v] of edges) {
		adj.get(u)?.add(v);
		adj.get(v)?.add(u);
	}

	// Find connected components using BFS
	const visited = new Set<string>();
	const components: string[][] = [];

	for (let index = 0; index < n; index++) {
		const nodeId = `N${index}`;
		if (visited.has(nodeId)) continue;

		const component: string[] = [];
		const queue = [nodeId];
		visited.add(nodeId);

		while (queue.length > 0) {
			const current = queue.shift();
			if (current) {
				component.push(current);
				for (const neighbor of adj.get(current) ?? []) {
					if (!visited.has(neighbor)) {
						visited.add(neighbor);
						queue.push(neighbor);
					}
				}
			}
		}

		components.push(component);
	}

	// Connect components
	const result = [...edges];
	for (let index = 1; index < components.length; index++) {
		result.push([components[index - 1][0], components[index][0]]);
	}

	return result;
};

/**
 * Computes the geometric mean of an array of positive numbers.
 * @param values
 */
export const geometricMean = (values: number[]): number => {
	if (values.length === 0) return 0;
	if (values.some((v) => v <= 0)) return 0;

	const logSum = values.reduce((sum, v) => sum + Math.log(v), 0);
	return Math.exp(logSum / values.length);
};

/**
 * Checks if two sets contain the same elements.
 * @param a
 * @param b
 */
export const setsEqual = <T>(a: Set<T>, b: Set<T>): boolean => {
	if (a.size !== b.size) return false;
	for (const item of a) {
		if (!b.has(item)) return false;
	}
	return true;
};

/**
 * Computes union of multiple sets.
 * @param sets
 */
export const setUnion = <T>(...sets: Set<T>[]): Set<T> => {
	const result = new Set<T>();
	for (const set of sets) {
		for (const item of set) {
			result.add(item);
		}
	}
	return result;
};

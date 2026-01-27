/**
 * Contract Tests for BenchmarkGraphExpander
 *
 * These tests verify that BenchmarkGraphExpander correctly implements
 * the GraphExpander interface contract, with particular focus on:
 * - Undirected graph edge handling (forward + reverse edges)
 * - Binary search correctness for edge lookup
 * - Lazy adjacency building
 * - Degree calculation consistency
 *
 * Context: The BenchmarkGraphExpander bug (missing reverse edge lookup)
 * caused universal false negatives in coverage metrics. These tests
 * prevent similar bugs by validating adapter implementation correctness.
 */

import { describe, expect, it } from "vitest";

import { BenchmarkGraphExpander } from "./benchmark-graph-expander.js";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a simple triangle graph for testing
 * Edges: (1,2), (2,3), (3,1)
 */
const createTriangleGraph = (): {
	getAllNodes: () => Array<{ id: string }>;
	getAllEdges: () => Array<{ source: string; target: string }>;
} => {
	const nodes = [{ id: "1" }, { id: "2" }, { id: "3" }];
	const edges = [
		{ source: "1", target: "2" },
		{ source: "2", target: "3" },
		{ source: "3", target: "1" },
	];

	return {
		getAllNodes: () => nodes,
		getAllEdges: () => edges,
	};
};

/**
 * Create a graph where some nodes only appear as targets
 * Edge: 2 → 1 (node 1 has no outgoing edges in edgesBySource)
 */
const createTargetOnlyGraph = (): {
	getAllNodes: () => Array<{ id: string }>;
	getAllEdges: () => Array<{ source: string; target: string }>;
} => {
	const nodes = [{ id: "1" }, { id: "2" }];
	const edges = [{ source: "2", target: "1" }];

	return {
		getAllNodes: () => nodes,
		getAllEdges: () => edges,
	};
};

/**
 * Create a star graph: center node connected to N leaves
 * Center: "0", Leaves: "1", "2", ..., "N-1"
 * @param N
 */
const createStarGraph = (N: number): {
	getAllNodes: () => Array<{ id: string }>;
	getAllEdges: () => Array<{ source: string; target: string }>;
} => {
	const nodes: Array<{ id: string }> = [{ id: "0" }];
	const edges: Array<{ source: string; target: string }> = [];

	for (let index = 1; index < N; index++) {
		nodes.push({ id: `${index}` });
		edges.push({ source: "0", target: `${index}` });
	}

	return {
		getAllNodes: () => nodes,
		getAllEdges: () => edges,
	};
};

/**
 * Create a chain graph: 1 → 2 → 3 → ... → N
 * @param N
 */
const createChainGraph = (N: number): {
	getAllNodes: () => Array<{ id: string }>;
	getAllEdges: () => Array<{ source: string; target: string }>;
} => {
	const nodes: Array<{ id: string }> = [];
	const edges: Array<{ source: string; target: string }> = [];

	for (let index = 1; index <= N; index++) {
		nodes.push({ id: `${index}` });
		if (index > 1) {
			edges.push({ source: `${index - 1}`, target: `${index}` });
		}
	}

	return {
		getAllNodes: () => nodes,
		getAllEdges: () => edges,
	};
};

// ============================================================================
// Contract Tests: Undirected Graphs
// ============================================================================

describe("BenchmarkGraphExpander Contract Tests", () => {
	describe("Undirected Graphs: Forward + Reverse Edges", () => {
		it("getNeighbors returns all neighbors including reverse edges", async () => {
			const graph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(graph, false);

			// Node 1: should have neighbors [2, 3]
			// - Forward edge: 1 → 2
			// - Reverse edge: 3 → 1 (becomes 1 ← 3)
			const neighbors1 = await expander.getNeighbors("1");
			const neighborIds1 = neighbors1.map((n) => n.targetId).sort((a, b) => a.localeCompare(b));
			expect(neighborIds1).toEqual(["2", "3"]);

			// Node 2: should have neighbors [1, 3]
			// - Reverse edge: 1 → 2 (becomes 2 ← 1)
			// - Forward edge: 2 → 3
			const neighbors2 = await expander.getNeighbors("2");
			const neighborIds2 = neighbors2.map((n) => n.targetId).sort((a, b) => a.localeCompare(b));
			expect(neighborIds2).toEqual(["1", "3"]);

			// Node 3: should have neighbors [1, 2]
			// - Reverse edge: 2 → 3 (becomes 3 ← 2)
			// - Forward edge: 3 → 1
			const neighbors3 = await expander.getNeighbors("3");
			const neighborIds3 = neighbors3.map((n) => n.targetId).sort((a, b) => a.localeCompare(b));
			expect(neighborIds3).toEqual(["1", "2"]);
		});

		it("handles nodes appearing only as targets (no outgoing edges)", async () => {
			const graph = createTargetOnlyGraph();
			const expander = new BenchmarkGraphExpander(graph, false);

			// Node 1 has no edges in edgesBySource (only appears as target)
			// But for undirected graphs, edge 2 → 1 means 1 ← 2, so 1 should have neighbor 2
			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.length).toBeGreaterThan(0);
			expect(neighbors1.map((n) => n.targetId)).toContain("2");

			// Node 2 has edge 2 → 1, so should have neighbor 1
			const neighbors2 = await expander.getNeighbors("2");
			expect(neighbors2.length).toBeGreaterThan(0);
			expect(neighbors2.map((n) => n.targetId)).toContain("1");
		});

		it("getDegree matches neighbor count for undirected graphs", async () => {
			const graph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(graph, false);

			for (const node of graph.getAllNodes()) {
				const neighbors = await expander.getNeighbors(node.id);
				const degree = expander.getDegree(node.id);
				expect(degree).toBe(neighbors.length);
			}
		});

		it("star graph: center has degree N-1, leaves have degree 1", async () => {
			const N = 10;
			const graph = createStarGraph(N);
			const expander = new BenchmarkGraphExpander(graph, false);

			// Center node "0" should have degree N-1
			const centerDegree = expander.getDegree("0");
			expect(centerDegree).toBe(N - 1);

			const centerNeighbors = await expander.getNeighbors("0");
			expect(centerNeighbors.length).toBe(N - 1);

			// Leaf nodes "1" through "N-1" should have degree 1
			for (let index = 1; index < N; index++) {
				const leafDegree = expander.getDegree(`${index}`);
				expect(leafDegree).toBe(1);

				const leafNeighbors = await expander.getNeighbors(`${index}`);
				expect(leafNeighbors.length).toBe(1);
				expect(leafNeighbors[0].targetId).toBe("0");
			}
		});
	});

	// ========================================================================
	// Contract Tests: Directed Graphs
	// ========================================================================

	describe("Directed Graphs: Forward Edges Only", () => {
		it("getNeighbors returns only outgoing edges for directed graphs", async () => {
			const graph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(graph, true);

			// Node 1: only forward edge 1 → 2
			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.map((n) => n.targetId)).toEqual(["2"]);

			// Node 2: only forward edge 2 → 3
			const neighbors2 = await expander.getNeighbors("2");
			expect(neighbors2.map((n) => n.targetId)).toEqual(["3"]);

			// Node 3: only forward edge 3 → 1
			const neighbors3 = await expander.getNeighbors("3");
			expect(neighbors3.map((n) => n.targetId)).toEqual(["1"]);
		});

		it("getDegree counts only outgoing edges for directed graphs", () => {
			const graph = createTargetOnlyGraph();
			const expander = new BenchmarkGraphExpander(graph, true);

			// Node 1: no outgoing edges, degree = 0
			const degree1 = expander.getDegree("1");
			expect(degree1).toBe(0);

			// Node 2: one outgoing edge 2 → 1, degree = 1
			const degree2 = expander.getDegree("2");
			expect(degree2).toBe(1);
		});

		it("getDegree matches neighbor count for directed graphs", async () => {
			const graph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(graph, true);

			for (const node of graph.getAllNodes()) {
				const neighbors = await expander.getNeighbors(node.id);
				const degree = expander.getDegree(node.id);
				expect(degree).toBe(neighbors.length);
			}
		});
	});

	// ========================================================================
	// Contract Tests: Binary Search Edge Cases
	// ========================================================================

	describe("Binary Search Edge Cases", () => {
		it("finds edge at start of sorted array", async () => {
			// Edge with source "1" will be first alphabetically
			const nodes = [{ id: "1" }, { id: "2" }, { id: "9" }];
			const edges = [
				{ source: "1", target: "2" },
				{ source: "9", target: "2" },
			];
			const expander = new BenchmarkGraphExpander(
				{
					getAllNodes: () => nodes,
					getAllEdges: () => edges,
				},
				true
			);

			const neighbors = await expander.getNeighbors("1");
			expect(neighbors.map((n) => n.targetId)).toEqual(["2"]);
		});

		it("finds edge at end of sorted array", async () => {
			// Edge with source "9" will be last alphabetically
			const nodes = [{ id: "1" }, { id: "2" }, { id: "9" }];
			const edges = [
				{ source: "1", target: "2" },
				{ source: "9", target: "2" },
			];
			const expander = new BenchmarkGraphExpander(
				{
					getAllNodes: () => nodes,
					getAllEdges: () => edges,
				},
				true
			);

			const neighbors = await expander.getNeighbors("9");
			expect(neighbors.map((n) => n.targetId)).toEqual(["2"]);
		});

		it("handles node with no edges gracefully", async () => {
			const nodes = [{ id: "1" }, { id: "2" }, { id: "isolated" }];
			const edges = [{ source: "1", target: "2" }];
			const expander = new BenchmarkGraphExpander(
				{
					getAllNodes: () => nodes,
					getAllEdges: () => edges,
				},
				false
			);

			const neighbors = await expander.getNeighbors("isolated");
			expect(neighbors).toEqual([]);
			expect(expander.getDegree("isolated")).toBe(0);
		});

		it("handles multiple edges from same source", async () => {
			const nodes = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
			const edges = [
				{ source: "1", target: "2" },
				{ source: "1", target: "3" },
				{ source: "1", target: "4" },
			];
			const expander = new BenchmarkGraphExpander(
				{
					getAllNodes: () => nodes,
					getAllEdges: () => edges,
				},
				true
			);

			const neighbors = await expander.getNeighbors("1");
			const neighborIds = neighbors.map((n) => n.targetId).sort((a, b) => a.localeCompare(b));
			expect(neighborIds).toEqual(["2", "3", "4"]);
			expect(expander.getDegree("1")).toBe(3);
		});
	});

	// ========================================================================
	// Contract Tests: Lazy Adjacency Building
	// ========================================================================

	describe("Lazy Adjacency Building", () => {
		it("builds adjacency on first access to node", async () => {
			const graph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(graph, false);

			// First access to node "1" should trigger adjacency build
			const neighbors1a = await expander.getNeighbors("1");
			const neighborIds1a = neighbors1a.map((n) => n.targetId).sort((a, b) => a.localeCompare(b));

			// Second access should return cached result (same data)
			const neighbors1b = await expander.getNeighbors("1");
			const neighborIds1b = neighbors1b.map((n) => n.targetId).sort((a, b) => a.localeCompare(b));

			expect(neighborIds1a).toEqual(neighborIds1b);
		});

		it("does not build adjacency for unaccessed nodes", async () => {
			const graph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(graph, false);

			// Access only node "1"
			await expander.getNeighbors("1");

			// Degree should still work for unaccessed nodes (pre-computed)
			expect(expander.getDegree("2")).toBe(2);
			expect(expander.getDegree("3")).toBe(2);
		});
	});

	// ========================================================================
	// Contract Tests: Graph Conversion (toGraph)
	// ========================================================================

	describe("Graph Conversion: toGraph()", () => {
		it("preserves node count", async () => {
			const originalGraph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(originalGraph, false);

			const convertedGraph = await expander.toGraph();
			expect(convertedGraph.getAllNodes().length).toBe(
				originalGraph.getAllNodes().length
			);
		});

		it("preserves edge connectivity (undirected)", async () => {
			const originalGraph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(originalGraph, false);

			await expander.toGraph();

			// Verify all original edges are present
			for (const originalEdge of originalGraph.getAllEdges()) {
				const neighbors = await expander.getNeighbors(originalEdge.source);
				expect(
					neighbors.some((n) => n.targetId === originalEdge.target)
				).toBe(true);
			}
		});

		it("does not create duplicate edges for undirected graphs", async () => {
			const originalGraph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(originalGraph, false);

			const convertedGraph = await expander.toGraph();

			// For undirected graph with 3 nodes and 3 edges, should have exactly 3 edges
			expect(convertedGraph.getAllEdges().length).toBe(3);
		});

		it("converted graph matches original neighbor sets", async () => {
			const originalGraph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(originalGraph, false);

			const convertedGraph = await expander.toGraph();

			// Verify neighbor sets match for all nodes
			for (const node of originalGraph.getAllNodes()) {
				const expanderNeighbors = await expander.getNeighbors(node.id);
				const expanderNeighborIds = new Set(
					expanderNeighbors.map((n) => n.targetId)
				);

				// Get neighbors from converted graph
				const graphNode = convertedGraph.getNode(node.id);
				expect(graphNode.some).toBe(true);

				const graphNeighborsResult = convertedGraph.getNeighbors(node.id);
				expect(graphNeighborsResult.ok).toBe(true);

				if (!graphNeighborsResult.ok) continue;

				// getNeighbors returns neighbor node IDs
				const graphNeighborIds = new Set(graphNeighborsResult.value);

				// Both should have the same neighbor sets
				expect(graphNeighborIds.size).toBe(expanderNeighborIds.size);
				for (const neighborId of expanderNeighborIds) {
					expect(graphNeighborIds.has(neighborId)).toBe(true);
				}
			}
		});
	});

	// ========================================================================
	// Contract Tests: Degree Distribution
	// ========================================================================

	describe("Degree Distribution", () => {
		it("degree distribution sum equals node count", () => {
			const graph = createStarGraph(10);
			const expander = new BenchmarkGraphExpander(graph, false);

			const distribution = expander.getDegreeDistribution();
			let totalNodes = 0;
			for (const count of distribution.values()) {
				totalNodes += count;
			}

			expect(totalNodes).toBe(graph.getAllNodes().length);
		});

		it("star graph has correct degree distribution", () => {
			const N = 10;
			const graph = createStarGraph(N);
			const expander = new BenchmarkGraphExpander(graph, false);

			const distribution = expander.getDegreeDistribution();

			// Should have:
			// - 1 node with degree N-1 (center)
			// - N-1 nodes with degree 1 (leaves)
			expect(distribution.get(N - 1)).toBe(1);
			expect(distribution.get(1)).toBe(N - 1);
			expect(distribution.size).toBe(2); // Only two distinct degrees
		});

		it("chain graph has correct degree distribution", () => {
			const N = 5;
			const graph = createChainGraph(N);
			const expander = new BenchmarkGraphExpander(graph, false);

			const distribution = expander.getDegreeDistribution();

			// For undirected chain: 1 -- 2 -- 3 -- 4 -- 5
			// - 2 nodes with degree 1 (endpoints: 1, 5)
			// - 3 nodes with degree 2 (middle: 2, 3, 4)
			expect(distribution.get(1)).toBe(2);
			expect(distribution.get(2)).toBe(3);
		});
	});

	// ========================================================================
	// Contract Tests: Node Queries
	// ========================================================================

	describe("Node Queries", () => {
		it("getNode returns node for valid ID", async () => {
			const graph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(graph, false);

			const node1 = await expander.getNode("1");
			expect(node1).not.toBeNull();
			expect(node1?.id).toBe("1");
		});

		it("getNode returns null for invalid ID", async () => {
			const graph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(graph, false);

			const node = await expander.getNode("nonexistent");
			expect(node).toBeNull();
		});

		it("getNodeCount returns correct count", () => {
			const graph = createStarGraph(10);
			const expander = new BenchmarkGraphExpander(graph, false);

			expect(expander.getNodeCount()).toBe(10);
		});

		it("getAllNodeIds returns all node IDs", () => {
			const graph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(graph, false);

			const nodeIds = expander.getAllNodeIds().sort((a, b) => a.localeCompare(b));
			expect(nodeIds).toEqual(["1", "2", "3"]);
		});

		it("getAllDegrees returns all node degrees", () => {
			const graph = createTriangleGraph();
			const expander = new BenchmarkGraphExpander(graph, false);

			const degrees = expander.getAllDegrees();
			expect(degrees.size).toBe(3);
			expect(degrees.get("1")).toBe(2);
			expect(degrees.get("2")).toBe(2);
			expect(degrees.get("3")).toBe(2);
		});
	});

	// ========================================================================
	// Contract Tests: Priority Calculation
	// ========================================================================

	describe("Priority Calculation", () => {
		it("calculatePriority returns degree-based priority", () => {
			const graph = createStarGraph(10);
			const expander = new BenchmarkGraphExpander(graph, false);

			// Center node has degree 9, so priority = 9 / (1 + epsilon)
			const centerPriority = expander.calculatePriority("0");
			expect(centerPriority).toBeCloseTo(9, 5);

			// Leaf node has degree 1, so priority = 1 / (1 + epsilon)
			const leafPriority = expander.calculatePriority("1");
			expect(leafPriority).toBeCloseTo(1, 5);
		});

		it("calculatePriority respects custom nodeWeight", () => {
			const graph = createStarGraph(10);
			const expander = new BenchmarkGraphExpander(graph, false);

			// With nodeWeight = 2: priority = degree / (2 + epsilon)
			const priority = expander.calculatePriority("0", { nodeWeight: 2 });
			expect(priority).toBeCloseTo(9 / 2, 5);
		});

		it("calculatePriority handles zero degree nodes", () => {
			const nodes = [{ id: "isolated" }];
			const edges: Array<{ source: string; target: string }> = [];
			const expander = new BenchmarkGraphExpander(
				{
					getAllNodes: () => nodes,
					getAllEdges: () => edges,
				},
				false
			);

			const priority = expander.calculatePriority("isolated");
			expect(priority).toBeCloseTo(0, 10);
		});
	});
});

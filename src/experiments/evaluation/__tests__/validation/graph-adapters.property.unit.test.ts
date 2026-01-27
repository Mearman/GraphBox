/**
 * Property-Based Tests for Graph Adapters
 *
 * Uses fast-check to verify graph adapter invariants hold across
 * randomized graph structures. Tests fundamental graph properties
 * that must hold regardless of implementation:
 *
 * - Degree consistency: getDegree() matches neighbor count
 * - Undirected symmetry: if A → B then B → A
 * - Directed asymmetry: A → B doesn't imply B → A
 * - Degree sum: sum of degrees = 2 * edges (undirected) or edges (directed)
 * - Node preservation: all nodes in edges appear in node list
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Graph } from "../../../../algorithms/graph/graph.js";
import type { Edge, Node } from "../../../../algorithms/types/graph.js";
import { BenchmarkGraphExpander } from "./common/benchmark-graph-expander.js";
import { TestGraphExpander } from "./common/test-graph-expander.js";

// ============================================================================
// Arbitraries (Generators for test data)
// ============================================================================

/**
 * Generate a random edge list for undirected graphs.
 * Returns array of [source, target] tuples with node IDs as strings.
 */
const arbUndirectedEdges = fc
	.array(
		fc.tuple(
			fc.integer({ min: 1, max: 20 }),
			fc.integer({ min: 1, max: 20 })
		),
		{ minLength: 1, maxLength: 30 }
	)
	.map((edges) =>
		edges.map(([source, target]): [string, string] => [`${source}`, `${target}`])
	);

/**
 * Generate a random edge list for directed graphs.
 */
const arbDirectedEdges = arbUndirectedEdges;

/**
 * Generate a random Graph instance (undirected).
 */
const arbUndirectedGraph = arbUndirectedEdges.map((edges) => {
	const graph = new Graph<Node, Edge>(false);

	// Collect unique node IDs
	const nodeIds = new Set<string>();
	for (const [source, target] of edges) {
		nodeIds.add(source);
		nodeIds.add(target);
	}

	// Add nodes
	for (const id of nodeIds) {
		graph.addNode({ id, type: "node" });
	}

	// Add edges
	for (const [index, [source, target]] of edges.entries()) {
		graph.addEdge({
			id: `e${index}`,
			source,
			target,
			type: "edge",
		});
	}

	return graph;
});

// ============================================================================
// Property Tests: Degree Consistency (BenchmarkGraphExpander)
// ============================================================================

describe("BenchmarkGraphExpander Degree Consistency", () => {
	it("getDegree matches neighbor count for all nodes", async () => {
		await fc.assert(
			fc.asyncProperty(arbUndirectedGraph, async (graph) => {
				const expander = new BenchmarkGraphExpander(graph, false);

				for (const node of graph.getAllNodes()) {
					const neighbors = await expander.getNeighbors(node.id);
					const degree = expander.getDegree(node.id);
					expect(degree).toBe(neighbors.length);
				}
			}),
			{ numRuns: 50 }
		);
	});

	it("sum of degrees equals 2 * edge count (undirected)", () => {
		fc.assert(
			fc.property(arbUndirectedGraph, (graph) => {
				const expander = new BenchmarkGraphExpander(graph, false);
				const degrees = expander.getAllDegrees();

				let sumDegrees = 0;
				for (const degree of degrees.values()) {
					sumDegrees += degree;
				}

				const edgeCount = graph.getAllEdges().length;
				expect(sumDegrees).toBe(2 * edgeCount);
			}),
			{ numRuns: 50 }
		);
	});

	it("all nodes have non-negative degrees", () => {
		fc.assert(
			fc.property(arbUndirectedGraph, (graph) => {
				const expander = new BenchmarkGraphExpander(graph, false);
				const degrees = expander.getAllDegrees();

				for (const degree of degrees.values()) {
					expect(degree).toBeGreaterThanOrEqual(0);
				}
			}),
			{ numRuns: 50 }
		);
	});
});

// ============================================================================
// Property Tests: Undirected Symmetry (BenchmarkGraphExpander)
// ============================================================================

describe("BenchmarkGraphExpander Undirected Symmetry", () => {
	it("if A → B, then B → A (undirected graphs)", async () => {
		await fc.assert(
			fc.asyncProperty(arbUndirectedGraph, async (graph) => {
				const expander = new BenchmarkGraphExpander(graph, false);

				// For every edge, verify symmetric neighbors
				for (const edge of graph.getAllEdges()) {
					const { source, target } = edge;

					const sourceNeighbors = await expander.getNeighbors(source);
					const targetNeighbors = await expander.getNeighbors(target);

					const sourceHasTarget = sourceNeighbors.some((n) => n.targetId === target);
					const targetHasSource = targetNeighbors.some((n) => n.targetId === source);

					expect(sourceHasTarget).toBe(true);
					expect(targetHasSource).toBe(true);
				}
			}),
			{ numRuns: 30 }
		);
	});
});

// ============================================================================
// Property Tests: Degree Consistency (TestGraphExpander)
// ============================================================================

describe("TestGraphExpander Degree Consistency", () => {
	it("getDegree matches neighbor count for all nodes", async () => {
		await fc.assert(
			fc.asyncProperty(arbUndirectedEdges, async (edges) => {
				const expander = new TestGraphExpander(edges, false);

				for (const nodeId of expander.getAllNodeIds()) {
					const neighbors = await expander.getNeighbors(nodeId);
					const degree = expander.getDegree(nodeId);
					expect(degree).toBe(neighbors.length);
				}
			}),
			{ numRuns: 50 }
		);
	});

	it("sum of degrees equals 2 * edge count (undirected)", () => {
		fc.assert(
			fc.property(arbUndirectedEdges, (edges) => {
				const expander = new TestGraphExpander(edges, false);
				const degrees = expander.getAllDegrees();

				let sumDegrees = 0;
				for (const degree of degrees.values()) {
					sumDegrees += degree;
				}

				expect(sumDegrees).toBe(2 * edges.length);
			}),
			{ numRuns: 50 }
		);
	});

	it("sum of degrees equals edge count (directed)", () => {
		fc.assert(
			fc.property(arbDirectedEdges, (edges) => {
				const expander = new TestGraphExpander(edges, true);
				const degrees = expander.getAllDegrees();

				let sumDegrees = 0;
				for (const degree of degrees.values()) {
					sumDegrees += degree;
				}

				expect(sumDegrees).toBe(edges.length);
			}),
			{ numRuns: 50 }
		);
	});
});

// ============================================================================
// Property Tests: Undirected Symmetry (TestGraphExpander)
// ============================================================================

describe("TestGraphExpander Undirected Symmetry", () => {
	it("if A → B, then B → A (undirected graphs)", async () => {
		await fc.assert(
			fc.asyncProperty(arbUndirectedEdges, async (edges) => {
				const expander = new TestGraphExpander(edges, false);

				// For every edge, verify symmetric neighbors
				for (const [source, target] of edges) {
					const sourceNeighbors = await expander.getNeighbors(source);
					const targetNeighbors = await expander.getNeighbors(target);

					const sourceHasTarget = sourceNeighbors.some((n) => n.targetId === target);
					const targetHasSource = targetNeighbors.some((n) => n.targetId === source);

					expect(sourceHasTarget).toBe(true);
					expect(targetHasSource).toBe(true);
				}
			}),
			{ numRuns: 30 }
		);
	});
});

// ============================================================================
// Property Tests: Directed Asymmetry (TestGraphExpander)
// ============================================================================

describe("TestGraphExpander Directed Asymmetry", () => {
	it("A → B doesn't imply B → A (directed graphs)", async () => {
		// Create a specific directed edge that shouldn't be symmetric
		const edges: Array<[string, string]> = [["1", "2"]];
		const expander = new TestGraphExpander(edges, true);

		const neighbors1 = await expander.getNeighbors("1");
		const neighbors2 = await expander.getNeighbors("2");

		// Node 1 should have neighbor 2
		expect(neighbors1.some((n) => n.targetId === "2")).toBe(true);

		// Node 2 should NOT have neighbor 1 (directed)
		expect(neighbors2.some((n) => n.targetId === "1")).toBe(false);
	});
});

// ============================================================================
// Property Tests: Node Preservation
// ============================================================================

describe("Node Preservation", () => {
	it("all nodes in edges appear in node list (BenchmarkGraphExpander)", () => {
		fc.assert(
			fc.property(arbUndirectedGraph, (graph) => {
				const expander = new BenchmarkGraphExpander(graph, false);
				const nodeIds = new Set(graph.getAllNodes().map((n) => n.id));

				// All edges reference existing nodes
				for (const edge of graph.getAllEdges()) {
					expect(nodeIds.has(edge.source)).toBe(true);
					expect(nodeIds.has(edge.target)).toBe(true);
				}

				// All nodes have a degree entry
				const degrees = expander.getAllDegrees();
				for (const nodeId of nodeIds) {
					expect(degrees.has(nodeId)).toBe(true);
				}
			}),
			{ numRuns: 50 }
		);
	});

	it("all nodes in edges appear in node list (TestGraphExpander)", () => {
		fc.assert(
			fc.property(arbUndirectedEdges, (edges) => {
				const expander = new TestGraphExpander(edges, false);
				const nodeIds = new Set(expander.getAllNodeIds());

				// All edges reference existing nodes
				for (const [source, target] of edges) {
					expect(nodeIds.has(source)).toBe(true);
					expect(nodeIds.has(target)).toBe(true);
				}
			}),
			{ numRuns: 50 }
		);
	});
});

// ============================================================================
// Property Tests: Degree Distribution Properties
// ============================================================================

describe("Degree Distribution Properties", () => {
	it("degree distribution has correct node count (BenchmarkGraphExpander)", () => {
		fc.assert(
			fc.property(arbUndirectedGraph, (graph) => {
				const expander = new BenchmarkGraphExpander(graph, false);
				const distribution = expander.getDegreeDistribution();

				// Sum of counts in distribution = total nodes
				let totalNodes = 0;
				for (const count of distribution.values()) {
					totalNodes += count;
				}

				expect(totalNodes).toBe(graph.getAllNodes().length);
			}),
			{ numRuns: 50 }
		);
	});

	it("degree distribution has correct node count (TestGraphExpander)", () => {
		fc.assert(
			fc.property(arbUndirectedEdges, (edges) => {
				const expander = new TestGraphExpander(edges, false);
				const degrees = expander.getAllDegrees();

				// All nodes should have a degree entry
				expect(degrees.size).toBe(expander.getNodeCount());

				// Verify each node has a non-negative degree
				for (const degree of degrees.values()) {
					expect(degree).toBeGreaterThanOrEqual(0);
				}
			}),
			{ numRuns: 50 }
		);
	});
});

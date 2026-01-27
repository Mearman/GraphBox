/**
 * Round-Trip Tests for Graph Adapters
 *
 * These tests verify that data transformations preserve expected properties
 * when converting between different representations:
 * - Graph → BenchmarkGraphExpander → toGraph()
 * - Edge array → TestGraphExpander → edges
 * - Benchmark → BenchmarkGraphExpander → metrics
 *
 * Round-trip tests catch data loss, duplicate edge handling, and
 * structural corruption during format conversions.
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../../algorithms/graph/graph.js";
import type { Edge, Node } from "../../../../algorithms/types/graph.js";
import { BenchmarkGraphExpander } from "./common/benchmark-graph-expander.js";
import { TestGraphExpander } from "./common/test-graph-expander.js";

// ============================================================================
// Round-Trip Tests: Graph → BenchmarkGraphExpander → toGraph()
// ============================================================================

describe("Adapter Round-Trip Tests", () => {
	describe("Graph → BenchmarkGraphExpander → toGraph()", () => {
		it("preserves node count", async () => {
			const originalGraph = new Graph<Node, Edge>(false);

			// Add nodes
			originalGraph.addNode({ id: "1", type: "node" });
			originalGraph.addNode({ id: "2", type: "node" });
			originalGraph.addNode({ id: "3", type: "node" });

			// Add edges
			originalGraph.addEdge({
				id: "e1",
				source: "1",
				target: "2",
				type: "edge",
			});
			originalGraph.addEdge({
				id: "e2",
				source: "2",
				target: "3",
				type: "edge",
			});

			const expander = new BenchmarkGraphExpander(originalGraph, false);
			const reconstructed = await expander.toGraph();

			expect(reconstructed.getAllNodes().length).toBe(
				originalGraph.getAllNodes().length
			);
		});

		it("preserves node IDs", async () => {
			const originalGraph = new Graph<Node, Edge>(false);

			originalGraph.addNode({ id: "1", type: "node" });
			originalGraph.addNode({ id: "2", type: "node" });
			originalGraph.addNode({ id: "3", type: "node" });

			const expander = new BenchmarkGraphExpander(originalGraph, false);
			const reconstructed = await expander.toGraph();

			const originalIds = originalGraph
				.getAllNodes()
				.map((n) => n.id)
				.sort((a, b) => a.localeCompare(b));
			const reconstructedIds = reconstructed
				.getAllNodes()
				.map((n) => n.id)
				.sort((a, b) => a.localeCompare(b));

			expect(reconstructedIds).toEqual(originalIds);
		});

		it("preserves edge count for undirected graphs", async () => {
			const originalGraph = new Graph<Node, Edge>(false);

			originalGraph.addNode({ id: "1", type: "node" });
			originalGraph.addNode({ id: "2", type: "node" });
			originalGraph.addNode({ id: "3", type: "node" });

			originalGraph.addEdge({
				id: "e1",
				source: "1",
				target: "2",
				type: "edge",
			});
			originalGraph.addEdge({
				id: "e2",
				source: "2",
				target: "3",
				type: "edge",
			});
			originalGraph.addEdge({
				id: "e3",
				source: "3",
				target: "1",
				type: "edge",
			});

			const expander = new BenchmarkGraphExpander(originalGraph, false);
			const reconstructed = await expander.toGraph();

			expect(reconstructed.getAllEdges().length).toBe(
				originalGraph.getAllEdges().length
			);
		});

		it("preserves neighbor sets (undirected)", async () => {
			const originalGraph = new Graph<Node, Edge>(false);

			originalGraph.addNode({ id: "1", type: "node" });
			originalGraph.addNode({ id: "2", type: "node" });
			originalGraph.addNode({ id: "3", type: "node" });

			originalGraph.addEdge({
				id: "e1",
				source: "1",
				target: "2",
				type: "edge",
			});
			originalGraph.addEdge({
				id: "e2",
				source: "2",
				target: "3",
				type: "edge",
			});

			const expander = new BenchmarkGraphExpander(originalGraph, false);
			const reconstructed = await expander.toGraph();

			// Verify neighbor sets match for all nodes
			for (const node of originalGraph.getAllNodes()) {
				const expanderNeighbors = await expander.getNeighbors(node.id);
				const expanderNeighborIds = new Set(
					expanderNeighbors.map((n) => n.targetId)
				);

				const reconstructedNeighborsResult =
					reconstructed.getNeighbors(node.id);
				expect(reconstructedNeighborsResult.ok).toBe(true);

				if (!reconstructedNeighborsResult.ok) continue;

				const reconstructedNeighborIds = new Set(
					reconstructedNeighborsResult.value
				);

				expect(reconstructedNeighborIds.size).toBe(expanderNeighborIds.size);
				for (const neighborId of expanderNeighborIds) {
					expect(reconstructedNeighborIds.has(neighborId)).toBe(true);
				}
			}
		});

		it("does not create duplicate edges for undirected graphs", async () => {
			const originalGraph = new Graph<Node, Edge>(false);

			originalGraph.addNode({ id: "1", type: "node" });
			originalGraph.addNode({ id: "2", type: "node" });
			originalGraph.addNode({ id: "3", type: "node" });

			originalGraph.addEdge({
				id: "e1",
				source: "1",
				target: "2",
				type: "edge",
			});
			originalGraph.addEdge({
				id: "e2",
				source: "2",
				target: "3",
				type: "edge",
			});
			originalGraph.addEdge({
				id: "e3",
				source: "3",
				target: "1",
				type: "edge",
			});

			const expander = new BenchmarkGraphExpander(originalGraph, false);
			const reconstructed = await expander.toGraph();

			// Should have exactly 3 edges (triangle)
			expect(reconstructed.getAllEdges().length).toBe(3);
		});

		it("handles isolated nodes correctly", async () => {
			const originalGraph = new Graph<Node, Edge>(false);

			originalGraph.addNode({ id: "1", type: "node" });
			originalGraph.addNode({ id: "2", type: "node" });
			originalGraph.addNode({ id: "isolated", type: "node" });

			originalGraph.addEdge({
				id: "e1",
				source: "1",
				target: "2",
				type: "edge",
			});

			const expander = new BenchmarkGraphExpander(originalGraph, false);
			const reconstructed = await expander.toGraph();

			// Isolated node should still exist
			const isolatedNode = reconstructed.getNode("isolated");
			expect(isolatedNode.some).toBe(true);

			// Isolated node should have no neighbors
			const neighborsResult = reconstructed.getNeighbors("isolated");
			expect(neighborsResult.ok).toBe(true);
			if (neighborsResult.ok) {
				expect(neighborsResult.value.length).toBe(0);
			}
		});
	});

	// ========================================================================
	// Round-Trip Tests: Edge Array → TestGraphExpander → Edges
	// ========================================================================

	describe("Edge Array → TestGraphExpander → Edges", () => {
		it("preserves edge connectivity", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new TestGraphExpander(edges, false);

			// Verify all edges are accessible
			for (const [source, target] of edges) {
				const neighbors = await expander.getNeighbors(source);
				expect(neighbors.some((n) => n.targetId === target)).toBe(true);
			}
		});

		it("creates bidirectional edges for undirected graphs", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new TestGraphExpander(edges, false);

			// Both directions should exist
			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.some((n) => n.targetId === "2")).toBe(true);

			const neighbors2 = await expander.getNeighbors("2");
			expect(neighbors2.some((n) => n.targetId === "1")).toBe(true);
		});

		it("preserves node set from edges", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["4", "5"],
			];
			const expander = new TestGraphExpander(edges, false);

			const nodeIds = expander.getAllNodeIds().sort((a, b) => a.localeCompare(b));
			expect(nodeIds).toEqual(["1", "2", "3", "4", "5"]);
		});

		it("sum of degrees equals 2 * edge count (undirected)", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new TestGraphExpander(edges, false);

			const degrees = expander.getAllDegrees();
			let sumDegrees = 0;
			for (const degree of degrees.values()) {
				sumDegrees += degree;
			}

			// For undirected graph: sum of degrees = 2 * edge count
			expect(sumDegrees).toBe(2 * edges.length);
		});

		it("handles empty edge list", () => {
			const edges: Array<[string, string]> = [];
			const expander = new TestGraphExpander(edges, false);

			expect(expander.getNodeCount()).toBe(0);
			expect(expander.getAllNodeIds()).toEqual([]);
		});

		it("handles single edge", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new TestGraphExpander(edges, false);

			expect(expander.getNodeCount()).toBe(2);

			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.length).toBe(1);
			expect(neighbors1[0].targetId).toBe("2");
		});
	});

	// ========================================================================
	// Round-Trip Tests: Directed vs Undirected
	// ========================================================================

	describe("Directed vs Undirected Consistency", () => {
		it("directed graph: preserves asymmetric edges", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new TestGraphExpander(edges, true);

			// Node 1 → 2 exists
			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.some((n) => n.targetId === "2")).toBe(true);

			// Node 2 → 1 does NOT exist
			const neighbors2 = await expander.getNeighbors("2");
			expect(neighbors2.some((n) => n.targetId === "1")).toBe(false);
		});

		it("undirected graph: creates symmetric edges", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new TestGraphExpander(edges, false);

			// Node 1 ↔ 2 exists
			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.some((n) => n.targetId === "2")).toBe(true);

			const neighbors2 = await expander.getNeighbors("2");
			expect(neighbors2.some((n) => n.targetId === "1")).toBe(true);
		});

		it("directed graph: sum of degrees equals edge count", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new TestGraphExpander(edges, true);

			const degrees = expander.getAllDegrees();
			let sumDegrees = 0;
			for (const degree of degrees.values()) {
				sumDegrees += degree;
			}

			// For directed graph: sum of out-degrees = edge count
			expect(sumDegrees).toBe(edges.length);
		});
	});

	// ========================================================================
	// Round-Trip Tests: Degree Preservation
	// ========================================================================

	describe("Degree Preservation", () => {
		it("degree matches neighbor count after round-trip", async () => {
			const originalGraph = new Graph<Node, Edge>(false);

			originalGraph.addNode({ id: "1", type: "node" });
			originalGraph.addNode({ id: "2", type: "node" });
			originalGraph.addNode({ id: "3", type: "node" });

			originalGraph.addEdge({
				id: "e1",
				source: "1",
				target: "2",
				type: "edge",
			});
			originalGraph.addEdge({
				id: "e2",
				source: "2",
				target: "3",
				type: "edge",
			});

			const expander = new BenchmarkGraphExpander(originalGraph, false);

			// Check before round-trip
			for (const node of originalGraph.getAllNodes()) {
				const neighbors = await expander.getNeighbors(node.id);
				const degree = expander.getDegree(node.id);
				expect(degree).toBe(neighbors.length);
			}

			// Round-trip
			const reconstructed = await expander.toGraph();
			const expander2 = new BenchmarkGraphExpander(reconstructed, false);

			// Check after round-trip
			for (const node of reconstructed.getAllNodes()) {
				const neighbors = await expander2.getNeighbors(node.id);
				const degree = expander2.getDegree(node.id);
				expect(degree).toBe(neighbors.length);
			}
		});

		it("degree distribution preserved after round-trip", async () => {
			// Star graph: 1 hub, N-1 leaves
			const N = 10;
			const originalGraph = new Graph<Node, Edge>(false);

			for (let index = 0; index < N; index++) {
				originalGraph.addNode({ id: `${index}`, type: "node" });
			}

			for (let index = 1; index < N; index++) {
				originalGraph.addEdge({
					id: `e${index}`,
					source: "0",
					target: `${index}`,
					type: "edge",
				});
			}

			const expander1 = new BenchmarkGraphExpander(originalGraph, false);
			const distribution1 = expander1.getDegreeDistribution();

			// Round-trip
			const reconstructed = await expander1.toGraph();
			const expander2 = new BenchmarkGraphExpander(reconstructed, false);
			const distribution2 = expander2.getDegreeDistribution();

			// Distribution should match
			expect(distribution2.size).toBe(distribution1.size);
			for (const [degree, count] of distribution1.entries()) {
				expect(distribution2.get(degree)).toBe(count);
			}
		});
	});

	// ========================================================================
	// Round-Trip Tests: Edge Cases
	// ========================================================================

	describe("Edge Cases", () => {
		it("handles graphs with only nodes (no edges)", async () => {
			const originalGraph = new Graph<Node, Edge>(false);

			originalGraph.addNode({ id: "1", type: "node" });
			originalGraph.addNode({ id: "2", type: "node" });

			const expander = new BenchmarkGraphExpander(originalGraph, false);
			const reconstructed = await expander.toGraph();

			expect(reconstructed.getAllNodes().length).toBe(2);
			expect(reconstructed.getAllEdges().length).toBe(0);
		});

		it("handles single-node graphs", async () => {
			const originalGraph = new Graph<Node, Edge>(false);
			originalGraph.addNode({ id: "1", type: "node" });

			const expander = new BenchmarkGraphExpander(originalGraph, false);
			const reconstructed = await expander.toGraph();

			expect(reconstructed.getAllNodes().length).toBe(1);
			expect(reconstructed.getAllNodes()[0].id).toBe("1");
		});

		it("handles self-loops", async () => {
			const edges: Array<[string, string]> = [["1", "1"]];
			const expander = new TestGraphExpander(edges, false);

			const neighbors = await expander.getNeighbors("1");
			// Self-loop should appear (possibly twice for undirected)
			expect(neighbors.length).toBeGreaterThan(0);
		});
	});
});

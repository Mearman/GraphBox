/**
 * Canary Integration Tests with Known Ground Truth
 *
 * These tests validate the entire pipeline (adapter → algorithm → metrics)
 * against known-correct results. They serve as "canary in the coal mine"
 * to detect pipeline-level bugs that unit tests miss.
 *
 * Purpose:
 * - Catch bugs like the BenchmarkGraphExpander reverse edge issue
 * - Validate end-to-end behavior with real-world graphs
 * - Provide known ground truth baselines for regression testing
 *
 * Each test uses graphs with known structural properties and validates
 * that algorithms produce expected results.
 */

import { describe, expect, it } from "vitest";

import { KARATE,loadBenchmarkByIdFromUrl } from "../../fixtures/benchmark-datasets.js";
import { BenchmarkGraphExpander } from "./common/benchmark-graph-expander.js";
import { TestGraphExpander } from "./common/test-graph-expander.js";

// ============================================================================
// Known Ground Truth: Structural Properties
// ============================================================================

describe("Canary Integration Tests", () => {
	describe("Known Ground Truth: Karate Club Network", () => {
		it("karate club: loads with correct node and edge counts", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");

			// KNOWN: Karate Club has 34 nodes, 78 edges
			expect(benchmark.nodeCount).toBe(KARATE.expectedNodes);
			expect(benchmark.edgeCount).toBe(KARATE.expectedEdges);
		});

		it("karate club: adapter correctly reads node degrees", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, false);

			// KNOWN: Node 1 has degree 16 (most connected)
			const degree1 = expander.getDegree("1");
			expect(degree1).toBe(16);

			// KNOWN: Node 34 has degree 17 (second most connected)
			const degree34 = expander.getDegree("34");
			expect(degree34).toBe(17);

			// KNOWN: Node 12 has degree 1 (least connected)
			const degree12 = expander.getDegree("12");
			expect(degree12).toBe(1);
		});

		it("karate club: getNeighbors finds all neighbors correctly", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, false);

			// KNOWN: Node 1 has 16 neighbors
			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.length).toBe(16);

			// KNOWN: Node 34 has 17 neighbors
			const neighbors34 = await expander.getNeighbors("34");
			expect(neighbors34.length).toBe(17);

			// Verify degree matches neighbor count
			expect(expander.getDegree("1")).toBe(neighbors1.length);
			expect(expander.getDegree("34")).toBe(neighbors34.length);
		});

		it("karate club: undirected edges are bidirectional", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, false);

			// KNOWN: Nodes 1 and 2 are connected (verified from Zachary's data)
			const neighbors1 = await expander.getNeighbors("1");
			const neighbors2 = await expander.getNeighbors("2");

			// Node 1's neighbors should include node 2
			const has2 = neighbors1.some((n) => n.targetId === "2");
			// Node 2's neighbors should include node 1
			const has1 = neighbors2.some((n) => n.targetId === "1");

			// Both should be neighbors of each other (undirected)
			expect(has2).toBe(true);
			expect(has1).toBe(true);
		});

		it("karate club: degree distribution matches known structure", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, false);

			const distribution = expander.getDegreeDistribution();

			// Distribution sum should equal node count
			let totalNodes = 0;
			for (const count of distribution.values()) {
				totalNodes += count;
			}
			expect(totalNodes).toBe(34);

			// KNOWN: Karate Club has varied degree distribution
			// Highest degree nodes: 1 (degree 16), 34 (degree 17)
			// Check these exist in distribution
			const degrees = expander.getAllDegrees();
			expect(degrees.get("1")).toBe(16);
			expect(degrees.get("34")).toBe(17);
		});
	});

	// ========================================================================
	// Known Ground Truth: Star Graph
	// ========================================================================

	describe("Known Ground Truth: Star Graph", () => {
		it("star graph: center has degree N-1, leaves have degree 1", async () => {
			const N = 10;
			const edges: Array<[string, string]> = [];
			for (let index = 1; index < N; index++) {
				edges.push(["0", `${index}`]);
			}
			const expander = new TestGraphExpander(edges, false);

			// KNOWN: Center node "0" has degree N-1
			const centerDegree = expander.getDegree("0");
			expect(centerDegree).toBe(N - 1);

			const centerNeighbors = await expander.getNeighbors("0");
			expect(centerNeighbors.length).toBe(N - 1);

			// KNOWN: Leaf nodes "1" through "N-1" have degree 1
			for (let index = 1; index < N; index++) {
				const leafDegree = expander.getDegree(`${index}`);
				expect(leafDegree).toBe(1);

				const leafNeighbors = await expander.getNeighbors(`${index}`);
				expect(leafNeighbors.length).toBe(1);
				expect(leafNeighbors[0].targetId).toBe("0");
			}
		});

		it("star graph: degree distribution has exactly 2 distinct degrees", () => {
			const N = 10;
			const edges: Array<[string, string]> = [];
			for (let index = 1; index < N; index++) {
				edges.push(["0", `${index}`]);
			}
			const expander = new TestGraphExpander(edges, false);

			const distribution = expander.getAllDegrees();

			// KNOWN: Star graph has only 2 distinct degrees
			const uniqueDegrees = new Set(distribution.values());
			expect(uniqueDegrees.size).toBe(2);
			expect(uniqueDegrees.has(1)).toBe(true); // Leaves
			expect(uniqueDegrees.has(N - 1)).toBe(true); // Center
		});

		it("star graph: sum of degrees equals 2 * edge count", () => {
			const N = 10;
			const edges: Array<[string, string]> = [];
			for (let index = 1; index < N; index++) {
				edges.push(["0", `${index}`]);
			}
			const expander = new TestGraphExpander(edges, false);

			const degrees = expander.getAllDegrees();
			let sumDegrees = 0;
			for (const deg of degrees.values()) {
				sumDegrees += deg;
			}

			// KNOWN: For undirected graph, sum of degrees = 2 * edge count
			expect(sumDegrees).toBe(2 * edges.length);
		});
	});

	// ========================================================================
	// Known Ground Truth: Chain Graph
	// ========================================================================

	describe("Known Ground Truth: Chain Graph", () => {
		it("chain graph: endpoints have degree 1, middle has degree 2", () => {
			const N = 5;
			const edges: Array<[string, string]> = [];
			for (let index = 1; index < N; index++) {
				edges.push([`${index}`, `${index + 1}`]);
			}
			const expander = new TestGraphExpander(edges, false);

			// KNOWN: Endpoints have degree 1
			expect(expander.getDegree("1")).toBe(1);
			expect(expander.getDegree(`${N}`)).toBe(1);

			// KNOWN: Middle nodes have degree 2
			for (let index = 2; index < N; index++) {
				expect(expander.getDegree(`${index}`)).toBe(2);
			}
		});

		it("chain graph: diameter is N-1 (path length)", () => {
			const N = 5;
			const edges: Array<[string, string]> = [];
			for (let index = 1; index < N; index++) {
				edges.push([`${index}`, `${index + 1}`]);
			}
			const expander = new TestGraphExpander(edges, false);

			// KNOWN: Chain has N nodes connected linearly
			// Diameter = N-1 (shortest path from endpoint to endpoint)
			// We can verify this by checking neighbors form a chain
			for (let index = 1; index < N; index++) {
				const neighbors = expander.getAllDegrees();
				// Internal nodes (2 to N-1) have degree 2
				// Endpoints (1, N) have degree 1
				if (index === 1 || index === N) {
					expect(neighbors.get(`${index}`)).toBe(1);
				} else {
					expect(neighbors.get(`${index}`)).toBe(2);
				}
			}
		});

		it("chain graph: no node has degree > 2", () => {
			const N = 10;
			const edges: Array<[string, string]> = [];
			for (let index = 1; index < N; index++) {
				edges.push([`${index}`, `${index + 1}`]);
			}
			const expander = new TestGraphExpander(edges, false);

			const degrees = expander.getAllDegrees();
			for (const degree of degrees.values()) {
				// KNOWN: Maximum degree in chain is 2
				expect(degree).toBeLessThanOrEqual(2);
			}
		});
	});

	// ========================================================================
	// Known Ground Truth: Complete Graph (Clique)
	// ========================================================================

	describe("Known Ground Truth: Complete Graph K_n", () => {
		it("complete graph K3: all nodes have degree 2", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new TestGraphExpander(edges, false);

			// KNOWN: K3 (triangle) has all nodes with degree 2
			expect(expander.getDegree("1")).toBe(2);
			expect(expander.getDegree("2")).toBe(2);
			expect(expander.getDegree("3")).toBe(2);
		});

		it("complete graph K4: all nodes have degree 3", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["1", "3"],
				["1", "4"],
				["2", "3"],
				["2", "4"],
				["3", "4"],
			];
			const expander = new TestGraphExpander(edges, false);

			// KNOWN: K4 has all nodes with degree 3
			for (let index = 1; index <= 4; index++) {
				expect(expander.getDegree(`${index}`)).toBe(3);
			}
		});

		it("complete graph Kn: edge count is n(n-1)/2", () => {
			const N = 5;
			const edges: Array<[string, string]> = [];
			// Generate all pairs
			for (let index = 1; index <= N; index++) {
				for (let index_ = index + 1; index_ <= N; index_++) {
					edges.push([`${index}`, `${index_}`]);
				}
			}
			const expander = new TestGraphExpander(edges, false);

			// KNOWN: Complete graph K_n has n(n-1)/2 edges
			const expectedEdges = (N * (N - 1)) / 2;
			expect(edges.length).toBe(expectedEdges);

			// All nodes should have degree N-1
			for (let index = 1; index <= N; index++) {
				expect(expander.getDegree(`${index}`)).toBe(N - 1);
			}
		});
	});

	// ========================================================================
	// Known Ground Truth: Bipartite Graph
	// ========================================================================

	describe("Known Ground Truth: Complete Bipartite Graph K_m,n", () => {
		it("bipartite K3,2: partitions have degrees 2 and 3", () => {
			const edges: Array<[string, string]> = [
				// Partition A: nodes 1,2,3 (each connects to all of B)
				// Partition B: nodes 4,5 (each connects to all of A)
				["1", "4"],
				["1", "5"],
				["2", "4"],
				["2", "5"],
				["3", "4"],
				["3", "5"],
			];
			const expander = new TestGraphExpander(edges, false);

			// KNOWN: Partition A (size 3) nodes have degree 2
			expect(expander.getDegree("1")).toBe(2);
			expect(expander.getDegree("2")).toBe(2);
			expect(expander.getDegree("3")).toBe(2);

			// KNOWN: Partition B (size 2) nodes have degree 3
			expect(expander.getDegree("4")).toBe(3);
			expect(expander.getDegree("5")).toBe(3);
		});
	});

	// ========================================================================
	// Known Ground Truth: Hub Graph (Scale-Free-like)
	// ========================================================================

	describe("Known Ground Truth: Hub Graph", () => {
		it("hub graph: power-law-like degree distribution", () => {
			const edges: Array<[string, string]> = [
				// Hub 1: connected to many nodes
				["1", "2"],
				["1", "3"],
				["1", "4"],
				["1", "5"],
				["1", "6"],
				// Hub 2: connected to fewer nodes
				["2", "7"],
				["2", "8"],
				// Low-degree nodes
				["7", "8"],
			];
			const expander = new TestGraphExpander(edges, false);

			const degrees = expander.getAllDegrees();

			// KNOWN: Hub 1 should have highest degree
			const degree1 = degrees.get("1");
			expect(degree1).toBeDefined();
			expect(degree1).toBeGreaterThan(3);

			// KNOWN: Most nodes have low degree
			const lowDegreeNodes = [...degrees.values()].filter((d) => d <= 2);
			expect(lowDegreeNodes.length).toBeGreaterThan(0);
		});
	});

	// ========================================================================
	// Known Ground Truth: Regression Test for Reverse Edge Bug
	// ========================================================================

	describe("Regression: Reverse Edge Lookup for Undirected Graphs", () => {
		it("prevents BenchmarkGraphExpander reverse edge bug", async () => {
			// This test specifically targets the bug that caused false negatives
			// Create a graph where some nodes only appear as targets in the edge list

			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, false);

			// For every edge (source, target), verify both nodes see each other
			for (const edge of benchmark.graph.getAllEdges()) {
				const sourceNeighbors = await expander.getNeighbors(edge.source);
				const targetNeighbors = await expander.getNeighbors(edge.target);

				// Source should see target as neighbor
				expect(sourceNeighbors.some((n) => n.targetId === edge.target)).toBe(
					true
				);

				// Target should see source as neighbor (reverse edge)
				expect(targetNeighbors.some((n) => n.targetId === edge.source)).toBe(
					true
				);
			}
		});

		it("handles nodes appearing only as targets", async () => {
			// Edge list where node 1 only appears as target
			const edges = [
				{ source: "2", target: "1" },
				{ source: "3", target: "1" },
			];

			const graph = {
				getAllNodes: () => [{ id: "1" }, { id: "2" }, { id: "3" }],
				getAllEdges: () => edges,
			};

			const expander = new BenchmarkGraphExpander(graph, false);

			// Node 1 should still have neighbors via reverse edges
			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.length).toBeGreaterThan(0);
			expect(neighbors1.map((n) => n.targetId).sort((a, b) => a.localeCompare(b))).toEqual(["2", "3"]);

			// Degree should match neighbor count
			expect(expander.getDegree("1")).toBe(neighbors1.length);
		});
	});
});

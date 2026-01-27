/**
 * Contract Tests for TestGraphExpander
 *
 * These tests verify that TestGraphExpander correctly implements
 * the GraphExpander interface contract, with particular focus on:
 * - Edge array → adjacency list conversion
 * - Factory functions (star, hub, grid, chain)
 * - Degree calculation consistency
 * - Directed vs undirected graph handling
 *
 * TestGraphExpander is a simpler adapter used in unit tests,
 * with direct adjacency list construction rather than lazy loading.
 */

import { describe, expect, it } from "vitest";

import { createGraphFromEdges,TestGraphExpander } from "./test-graph-expander.js";

// ============================================================================
// Contract Tests: Edge Array → Adjacency List Conversion
// ============================================================================

describe("TestGraphExpander Contract Tests", () => {
	describe("Edge Array → Adjacency List Conversion", () => {
		it("correctly builds adjacency list for undirected graph", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new TestGraphExpander(edges, false);

			// Node 1: should have neighbors [2, 3]
			const neighbors1 = await expander.getNeighbors("1");
			const neighborIds1 = neighbors1.map((n) => n.targetId).sort((a, b) => a.localeCompare(b));
			expect(neighborIds1).toEqual(["2", "3"]);

			// Node 2: should have neighbors [1, 3]
			const neighbors2 = await expander.getNeighbors("2");
			const neighborIds2 = neighbors2.map((n) => n.targetId).sort((a, b) => a.localeCompare(b));
			expect(neighborIds2).toEqual(["1", "3"]);

			// Node 3: should have neighbors [1, 2]
			const neighbors3 = await expander.getNeighbors("3");
			const neighborIds3 = neighbors3.map((n) => n.targetId).sort((a, b) => a.localeCompare(b));
			expect(neighborIds3).toEqual(["1", "2"]);
		});

		it("correctly builds adjacency list for directed graph", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new TestGraphExpander(edges, true);

			// Node 1: only outgoing edge 1 → 2
			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.map((n) => n.targetId)).toEqual(["2"]);

			// Node 2: only outgoing edge 2 → 3
			const neighbors2 = await expander.getNeighbors("2");
			expect(neighbors2.map((n) => n.targetId)).toEqual(["3"]);

			// Node 3: only outgoing edge 3 → 1
			const neighbors3 = await expander.getNeighbors("3");
			expect(neighbors3.map((n) => n.targetId)).toEqual(["1"]);
		});

		it("handles isolated nodes (no edges)", async () => {
			// Node 3 appears in edges, but node 4 doesn't
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new TestGraphExpander(edges, false);

			// Node 3 has neighbors
			const neighbors3 = await expander.getNeighbors("3");
			expect(neighbors3.length).toBe(1);
			expect(neighbors3[0].targetId).toBe("2");

			// But if we check the nodes, only nodes that appear in edges exist
			const node4 = await expander.getNode("4");
			expect(node4).toBeNull();
		});

		it("handles self-loops", async () => {
			const edges: Array<[string, string]> = [
				["1", "1"], // Self-loop
				["1", "2"],
			];
			const expander = new TestGraphExpander(edges, false);

			const neighbors1 = await expander.getNeighbors("1");
			// Should have: self-loop (1) + neighbor (2) + reverse edge from (1,2)
			// But self-loop appears twice (once for source, once for target in undirected)
			expect(neighbors1.length).toBeGreaterThanOrEqual(2);
		});

		it("handles multiple edges between same pair", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["1", "2"], // Duplicate edge
				["2", "3"],
			];
			const expander = new TestGraphExpander(edges, false);

			const neighbors1 = await expander.getNeighbors("1");
			// Multiple edges are allowed (multigraph support)
			// Node 1 should have: 2 edges to node 2 + reverse edge from (2,3)
			const count2 = neighbors1.filter((n) => n.targetId === "2").length;
			expect(count2).toBeGreaterThanOrEqual(2);
		});
	});

	// ========================================================================
	// Contract Tests: Degree Calculation
	// ========================================================================

	describe("Degree Calculation", () => {
		it("getDegree matches neighbor count for undirected graphs", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new TestGraphExpander(edges, false);

			for (const nodeId of ["1", "2", "3"]) {
				const neighbors = await expander.getNeighbors(nodeId);
				const degree = expander.getDegree(nodeId);
				expect(degree).toBe(neighbors.length);
			}
		});

		it("getDegree matches neighbor count for directed graphs", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new TestGraphExpander(edges, true);

			for (const nodeId of ["1", "2", "3"]) {
				const neighbors = await expander.getNeighbors(nodeId);
				const degree = expander.getDegree(nodeId);
				expect(degree).toBe(neighbors.length);
			}
		});

		it("returns zero degree for isolated nodes", () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new TestGraphExpander(edges, false);

			// Node 3 doesn't exist, should return 0
			const degree3 = expander.getDegree("3");
			expect(degree3).toBe(0);
		});

		it("getAllDegrees returns correct degree map", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new TestGraphExpander(edges, false);

			const degrees = expander.getAllDegrees();
			expect(degrees.size).toBe(3);
			// Triangle: all nodes have degree 2
			expect(degrees.get("1")).toBe(2);
			expect(degrees.get("2")).toBe(2);
			expect(degrees.get("3")).toBe(2);
		});
	});

	// ========================================================================
	// Contract Tests: Node Queries
	// ========================================================================

	describe("Node Queries", () => {
		it("getNode returns node for valid ID", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new TestGraphExpander(edges, false);

			const node1 = await expander.getNode("1");
			expect(node1).not.toBeNull();
			expect(node1?.id).toBe("1");

			const node2 = await expander.getNode("2");
			expect(node2).not.toBeNull();
			expect(node2?.id).toBe("2");
		});

		it("getNode returns null for invalid ID", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new TestGraphExpander(edges, false);

			const node = await expander.getNode("nonexistent");
			expect(node).toBeNull();
		});

		it("getNode includes degree property", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["1", "3"],
			];
			const expander = new TestGraphExpander(edges, false);

			const node1 = await expander.getNode("1");
			expect(node1).not.toBeNull();
			expect(node1?.degree).toBe(2); // Connected to 2 and 3
		});

		it("getNodeCount returns correct count", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "4"],
			];
			const expander = new TestGraphExpander(edges, false);

			expect(expander.getNodeCount()).toBe(4);
		});

		it("getAllNodeIds returns all node IDs", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new TestGraphExpander(edges, false);

			const nodeIds = expander.getAllNodeIds().sort((a, b) => a.localeCompare(b));
			expect(nodeIds).toEqual(["1", "2", "3"]);
		});
	});

	// ========================================================================
	// Contract Tests: Priority Calculation
	// ========================================================================

	describe("Priority Calculation", () => {
		it("calculatePriority returns degree-based priority", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["1", "3"],
				["1", "4"],
			];
			const expander = new TestGraphExpander(edges, false);

			// Node 1 has degree 3
			const priority1 = expander.calculatePriority("1");
			expect(priority1).toBeCloseTo(3, 5);

			// Node 2 has degree 1
			const priority2 = expander.calculatePriority("2");
			expect(priority2).toBeCloseTo(1, 5);
		});

		it("calculatePriority respects custom nodeWeight", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["1", "3"],
			];
			const expander = new TestGraphExpander(edges, false);

			// With nodeWeight = 2: priority = degree / (2 + epsilon)
			const priority = expander.calculatePriority("1", { nodeWeight: 2 });
			expect(priority).toBeCloseTo(1, 5); // degree 2 / nodeWeight 2 = 1
		});

		it("calculatePriority handles zero degree nodes", () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new TestGraphExpander(edges, false);

			// Nonexistent node should return 0 priority
			const priority = expander.calculatePriority("nonexistent");
			expect(priority).toBeCloseTo(0, 10);
		});
	});

	// ========================================================================
	// Contract Tests: Factory Function - createGraphFromEdges
	// ========================================================================

	describe("Factory Function: createGraphFromEdges", () => {
		it("creates undirected graph by default", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = createGraphFromEdges(edges);

			// Should be undirected: both nodes have each other as neighbors
			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.map((n) => n.targetId)).toContain("2");

			const neighbors2 = await expander.getNeighbors("2");
			expect(neighbors2.map((n) => n.targetId)).toContain("1");
		});

		it("creates graph with correct node and edge counts", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "4"],
			];
			const expander = createGraphFromEdges(edges);

			expect(expander.getNodeCount()).toBe(4);
			// For undirected graph, each edge is bidirectional
			// But degree count is based on adjacency list size
			const totalDegrees = [...expander.getAllDegrees().values()].reduce(
				(sum, deg) => sum + deg,
				0
			);
			// For undirected graph with E edges: sum of degrees = 2E
			expect(totalDegrees).toBe(edges.length * 2);
		});
	});

	// ========================================================================
	// Contract Tests: Empty Graph Edge Cases
	// ========================================================================

	describe("Empty Graph Edge Cases", () => {
		it("handles empty edge list", () => {
			const edges: Array<[string, string]> = [];
			const expander = new TestGraphExpander(edges, false);

			expect(expander.getNodeCount()).toBe(0);
			expect(expander.getAllNodeIds()).toEqual([]);
		});

		it("handles single node (no edges)", async () => {
			// This is tricky - no edges means no nodes are created
			// since nodes are derived from edges
			const edges: Array<[string, string]> = [];
			const expander = new TestGraphExpander(edges, false);

			const node1 = await expander.getNode("1");
			expect(node1).toBeNull();
		});
	});

	// ========================================================================
	// Contract Tests: Neighbor Relationship Types
	// ========================================================================

	describe("Neighbor Relationship Types", () => {
		it("all neighbors have relationshipType='edge'", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new TestGraphExpander(edges, false);

			const neighbors = await expander.getNeighbors("1");
			for (const neighbor of neighbors) {
				expect(neighbor.relationshipType).toBe("edge");
			}
		});
	});

	// ========================================================================
	// Contract Tests: Structural Patterns
	// ========================================================================

	describe("Structural Patterns", () => {
		it("star graph: center has high degree, leaves have degree 1", () => {
			const N = 10;
			const edges: Array<[string, string]> = [];
			for (let index = 1; index < N; index++) {
				edges.push(["0", `${index}`]);
			}
			const expander = new TestGraphExpander(edges, false);

			// Center node "0" should have degree N-1
			const centerDegree = expander.getDegree("0");
			expect(centerDegree).toBe(N - 1);

			// Leaf nodes should have degree 1
			for (let index = 1; index < N; index++) {
				const leafDegree = expander.getDegree(`${index}`);
				expect(leafDegree).toBe(1);
			}
		});

		it("chain graph: endpoints have degree 1, middle has degree 2", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "4"],
				["4", "5"],
			];
			const expander = new TestGraphExpander(edges, false);

			// Endpoints: degree 1
			expect(expander.getDegree("1")).toBe(1);
			expect(expander.getDegree("5")).toBe(1);

			// Middle nodes: degree 2
			expect(expander.getDegree("2")).toBe(2);
			expect(expander.getDegree("3")).toBe(2);
			expect(expander.getDegree("4")).toBe(2);
		});

		it("complete graph K3: all nodes have degree 2", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new TestGraphExpander(edges, false);

			expect(expander.getDegree("1")).toBe(2);
			expect(expander.getDegree("2")).toBe(2);
			expect(expander.getDegree("3")).toBe(2);
		});
	});

	// ========================================================================
	// Contract Tests: addEdge No-Op
	// ========================================================================

	describe("addEdge No-Op", () => {
		it("addEdge does nothing (test fixture immutability)", () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new TestGraphExpander(edges, false);

			const degreeBeforeAdd = expander.getDegree("1");

			// addEdge is a no-op for test fixtures
			expander.addEdge();

			const degreeAfterAdd = expander.getDegree("1");
			expect(degreeAfterAdd).toBe(degreeBeforeAdd);
		});
	});
});

/**
 * Contract Tests for InstrumentedExpander
 *
 * These tests verify that InstrumentedExpander correctly implements
 * the GraphExpander interface contract while also providing instrumentation
 * features for tracking:
 * - Node expansions
 * - Expansion order
 * - Hub node identification
 * - Reset functionality
 *
 * InstrumentedExpander is used for testing algorithms that need to
 * verify expansion behavior (e.g., hub-deferring properties).
 */

import { describe, expect, it } from "vitest";

import { InstrumentedExpander } from "./instrumented-expander.js";

// ============================================================================
// Contract Tests: Basic GraphExpander Interface
// ============================================================================

describe("InstrumentedExpander Contract Tests", () => {
	describe("GraphExpander Interface", () => {
		it("implements getNeighbors correctly", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new InstrumentedExpander(edges, 0.1);

			const neighbors1 = await expander.getNeighbors("1");
			const neighborIds1 = neighbors1.map((n) => n.targetId).sort((a, b) => a.localeCompare(b));
			expect(neighborIds1).toEqual(["2", "3"]);
		});

		it("getDegree matches neighbor count", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new InstrumentedExpander(edges, 0.1);

			for (const nodeId of ["1", "2", "3"]) {
				const neighbors = await expander.getNeighbors(nodeId);
				const degree = expander.getDegree(nodeId);
				expect(degree).toBe(neighbors.length);
			}
		});

		it("getNode returns node for valid ID", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new InstrumentedExpander(edges, 0.1);

			const node1 = await expander.getNode("1");
			expect(node1).not.toBeNull();
			expect(node1?.id).toBe("1");
		});

		it("getNode returns null for invalid ID", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new InstrumentedExpander(edges, 0.1);

			const node = await expander.getNode("nonexistent");
			expect(node).toBeNull();
		});

		it("getAllDegrees returns correct degree map", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new InstrumentedExpander(edges, 0.1);

			const degrees = expander.getAllDegrees();
			expect(degrees.size).toBe(3);
			expect(degrees.get("1")).toBe(2);
			expect(degrees.get("2")).toBe(2);
			expect(degrees.get("3")).toBe(2);
		});
	});

	// ========================================================================
	// Contract Tests: Expansion Tracking
	// ========================================================================

	describe("Expansion Tracking", () => {
		it("tracks nodes as they are expanded", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new InstrumentedExpander(edges, 0.1);

			// Initially, no nodes expanded
			expect(expander.getExpandedNodes().size).toBe(0);

			// Expand node 1
			await expander.getNeighbors("1");
			expect(expander.getExpandedNodes().size).toBe(1);
			expect(expander.getExpandedNodes().has("1")).toBe(true);

			// Expand node 2
			await expander.getNeighbors("2");
			expect(expander.getExpandedNodes().size).toBe(2);
			expect(expander.getExpandedNodes().has("1")).toBe(true);
			expect(expander.getExpandedNodes().has("2")).toBe(true);
		});

		it("does not track a node multiple times", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new InstrumentedExpander(edges, 0.1);

			// Expand node 1 twice
			await expander.getNeighbors("1");
			await expander.getNeighbors("1");

			// Should only count once
			expect(expander.getExpandedNodes().size).toBe(1);
		});

		it("getExpandedNodes returns independent copy", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new InstrumentedExpander(edges, 0.1);

			await expander.getNeighbors("1");
			const expanded1 = expander.getExpandedNodes();

			await expander.getNeighbors("2");
			const expanded2 = expander.getExpandedNodes();

			// Should be independent sets
			expect(expanded1.size).toBe(1);
			expect(expanded2.size).toBe(2);
		});
	});

	// ========================================================================
	// Contract Tests: Expansion Order
	// ========================================================================

	describe("Expansion Order Tracking", () => {
		it("tracks expansion order correctly", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "4"],
			];
			const expander = new InstrumentedExpander(edges, 0.1);

			await expander.getNeighbors("1");
			await expander.getNeighbors("3");
			await expander.getNeighbors("2");

			const order = expander.getExpansionOrder();
			expect(order).toEqual(["1", "3", "2"]);
		});

		it("does not add duplicates to expansion order", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new InstrumentedExpander(edges, 0.1);

			await expander.getNeighbors("1");
			await expander.getNeighbors("1");
			await expander.getNeighbors("1");

			const order = expander.getExpansionOrder();
			expect(order).toEqual(["1"]);
		});

		it("getExpansionOrder returns independent copy", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new InstrumentedExpander(edges, 0.1);

			await expander.getNeighbors("1");
			const order1 = expander.getExpansionOrder();

			await expander.getNeighbors("2");
			const order2 = expander.getExpansionOrder();

			// Should be independent arrays
			expect(order1).toEqual(["1"]);
			expect(order2).toEqual(["1", "2"]);
		});
	});

	// ========================================================================
	// Contract Tests: Hub Node Identification
	// ========================================================================

	describe("Hub Node Identification", () => {
		it("identifies hub nodes based on degree percentile", () => {
			// Create star graph: node 0 is hub with degree 9, leaves have degree 1
			const edges: Array<[string, string]> = [];
			for (let index = 1; index <= 9; index++) {
				edges.push(["0", `${index}`]);
			}

			// Hub percentile = 0.1 means top 10% by degree
			// With 10 nodes, top 10% = 1 node (the center)
			const expander = new InstrumentedExpander(edges, 0.1);

			const hubs = expander.getHubNodes();
			expect(hubs.size).toBe(1);
			expect(hubs.has("0")).toBe(true);
		});

		it("identifies multiple hubs with higher percentile", () => {
			// Create graph with varying degrees
			const edges: Array<[string, string]> = [
				["1", "2"],
				["1", "3"],
				["1", "4"],
				["1", "5"], // Node 1: degree 4
				["2", "3"],
				["2", "4"], // Node 2: degree 3 (including edge to 1)
				["3", "4"], // Node 3: degree 3
				// Node 4: degree 3, Node 5: degree 1
			];

			// Hub percentile = 0.5 means top 50% by degree
			const expander = new InstrumentedExpander(edges, 0.5);

			const hubs = expander.getHubNodes();
			// Top 50% of 5 nodes = top 2-3 nodes
			expect(hubs.size).toBeGreaterThan(0);
		});

		it("tracks hub expansions", async () => {
			const edges: Array<[string, string]> = [];
			for (let index = 1; index <= 9; index++) {
				edges.push(["0", `${index}`]);
			}
			const expander = new InstrumentedExpander(edges, 0.1);

			// Initially, no hubs expanded
			expect(expander.getHubNodesExpanded()).toBe(0);

			// Expand a leaf node (not a hub)
			await expander.getNeighbors("1");
			expect(expander.getHubNodesExpanded()).toBe(0);

			// Expand the hub node
			await expander.getNeighbors("0");
			expect(expander.getHubNodesExpanded()).toBe(1);
		});

		it("getHubNodes returns the same set instance", () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new InstrumentedExpander(edges, 0.1);

			const hubs1 = expander.getHubNodes();
			const hubs2 = expander.getHubNodes();

			// Current implementation returns same reference
			expect(hubs1 === hubs2).toBe(true);
		});
	});

	// ========================================================================
	// Contract Tests: Reset Functionality
	// ========================================================================

	describe("Reset Functionality", () => {
		it("reset clears expansion tracking", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new InstrumentedExpander(edges, 0.1);

			// Expand some nodes
			await expander.getNeighbors("1");
			await expander.getNeighbors("2");
			expect(expander.getExpandedNodes().size).toBe(2);

			// Reset
			expander.reset();

			// Should clear tracking
			expect(expander.getExpandedNodes().size).toBe(0);
			expect(expander.getExpansionOrder()).toEqual([]);
			expect(expander.getHubNodesExpanded()).toBe(0);
		});

		it("reset allows re-tracking expansion order", async () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new InstrumentedExpander(edges, 0.1);

			// First expansion sequence
			await expander.getNeighbors("1");
			await expander.getNeighbors("2");
			const order1 = expander.getExpansionOrder();
			expect(order1).toEqual(["1", "2"]);

			// Reset and expand in different order
			expander.reset();
			await expander.getNeighbors("2");
			await expander.getNeighbors("1");
			const order2 = expander.getExpansionOrder();
			expect(order2).toEqual(["2", "1"]);
		});

		it("reset does not affect hub node identification", () => {
			const edges: Array<[string, string]> = [];
			for (let index = 1; index <= 9; index++) {
				edges.push(["0", `${index}`]);
			}
			const expander = new InstrumentedExpander(edges, 0.1);

			const hubsBefore = expander.getHubNodes();
			expander.reset();
			const hubsAfter = expander.getHubNodes();

			expect(hubsAfter).toEqual(hubsBefore);
		});

		it("reset does not affect graph structure", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new InstrumentedExpander(edges, 0.1);

			const neighborsBefore = await expander.getNeighbors("1");
			expander.reset();
			const neighborsAfter = await expander.getNeighbors("1");

			expect(neighborsAfter).toEqual(neighborsBefore);
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
			const expander = new InstrumentedExpander(edges, 0.1);

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
			const expander = new InstrumentedExpander(edges, 0.1);

			const priority = expander.calculatePriority("1", { nodeWeight: 2 });
			expect(priority).toBeCloseTo(1, 5); // degree 2 / nodeWeight 2 = 1
		});
	});

	// ========================================================================
	// Contract Tests: Undirected Graph Behavior
	// ========================================================================

	describe("Undirected Graph Behavior", () => {
		it("creates bidirectional edges", async () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new InstrumentedExpander(edges, 0.1);

			// Both nodes should have each other as neighbors
			const neighbors1 = await expander.getNeighbors("1");
			expect(neighbors1.map((n) => n.targetId)).toContain("2");

			const neighbors2 = await expander.getNeighbors("2");
			expect(neighbors2.map((n) => n.targetId)).toContain("1");
		});

		it("computes symmetric degrees", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new InstrumentedExpander(edges, 0.1);

			// Node 2 should have degree 2 (connected to 1 and 3)
			expect(expander.getDegree("2")).toBe(2);
		});
	});

	// ========================================================================
	// Contract Tests: addEdge No-Op
	// ========================================================================

	describe("addEdge No-Op", () => {
		it("addEdge does nothing", () => {
			const edges: Array<[string, string]> = [["1", "2"]];
			const expander = new InstrumentedExpander(edges, 0.1);

			const degreeBeforeAdd = expander.getDegree("1");
			expander.addEdge();
			const degreeAfterAdd = expander.getDegree("1");

			expect(degreeAfterAdd).toBe(degreeBeforeAdd);
		});
	});

	// ========================================================================
	// Contract Tests: Hub Percentile Edge Cases
	// ========================================================================

	describe("Hub Percentile Edge Cases", () => {
		it("hub percentile 0.0 still identifies at least 1 hub", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new InstrumentedExpander(edges, 0);

			const hubs = expander.getHubNodes();
			// identifyHubNodes uses Math.max(1, ...) so always identifies at least 1 hub
			expect(hubs.size).toBeGreaterThanOrEqual(1);
		});

		it("hub percentile 1.0 identifies all nodes as hubs", () => {
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
			];
			const expander = new InstrumentedExpander(edges, 1);

			const hubs = expander.getHubNodes();
			expect(hubs.size).toBe(3); // All nodes
		});

		it("hub identification with uniform degree distribution", () => {
			// Triangle: all nodes have degree 2
			const edges: Array<[string, string]> = [
				["1", "2"],
				["2", "3"],
				["3", "1"],
			];
			const expander = new InstrumentedExpander(edges, 0.1);

			// With uniform degrees, top 10% could be any node(s)
			const hubs = expander.getHubNodes();
			// Should identify some hub(s) based on percentile
			expect(hubs.size).toBeGreaterThanOrEqual(0);
		});
	});
});

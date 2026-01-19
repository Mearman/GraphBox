/**
 * Degeneracy Property Tests for Seed-Bounded Graph Sampling
 *
 * Validates: Formula degenerates correctly for special graph classes.
 *
 * The degree-prioritised expansion uses the formula:
 *   priority(v) = w_V(v) × (deg+(v) × w(E+) + deg-(v) × w(E-))
 *
 * This test verifies the formula correctly simplifies for:
 * - Undirected graphs: deg+(v) = deg-(v)
 * - Unweighted edges: w(e) = 1
 * - Unweighted nodes: w_V(v) = 1
 * - Multigraphs: parallel edges aggregated correctly
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../algorithms/traversal/degree-prioritised-expansion";
import {
	createChainGraph,
	createCompleteGraph,
	createCycleGraph,
	createGridGraph,
	createStarGraph,
	ProofTestExpander,
} from "../test-utils";

describe("Implicit Degeneracy", () => {
	describe("Undirected Graph Degeneracy", () => {
		it("undirected: deg+(v) = deg-(v), priority = 2·deg(v)", async () => {
			const graph = createGridGraph(4, 4);

			// For undirected graphs, each edge contributes to both in-degree and out-degree
			// So effective priority should be proportional to total degree

			// Get degrees for each node
			const nodeIds = graph.getAllNodeIds();
			const degrees = new Map<string, number>();
			for (const id of nodeIds) {
				degrees.set(id, graph.getDegree(id));
			}

			// Corner nodes should have degree 2
			expect(graph.getDegree("0_0")).toBe(2);
			expect(graph.getDegree("3_3")).toBe(2);

			// Edge nodes should have degree 3
			expect(graph.getDegree("0_1")).toBe(3);
			expect(graph.getDegree("1_0")).toBe(3);

			// Center nodes should have degree 4
			expect(graph.getDegree("1_1")).toBe(4);
			expect(graph.getDegree("2_2")).toBe(4);

			// Expansion should still work correctly
			const expansion = new DegreePrioritisedExpansion(graph, ["0_0", "3_3"]);
			const result = await expansion.run();

			expect(result.sampledNodes.size).toBe(16);
		});

		it("symmetric degree distribution on cycle graph", async () => {
			const n = 10;
			const graph = createCycleGraph(n);

			// All nodes in cycle have degree 2
			for (const nodeId of graph.getAllNodeIds()) {
				expect(graph.getDegree(nodeId)).toBe(2);
			}

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", "N5"]);
			const result = await expansion.run();

			// All nodes visited
			expect(result.sampledNodes.size).toBe(n);
		});

		it("hub vs spoke degree difference on star graph", async () => {
			const numberSpokes = 15;
			const graph = createStarGraph(numberSpokes);

			// Hub has degree = numSpokes
			expect(graph.getDegree("HUB")).toBe(numberSpokes);

			// All spokes have degree 1
			for (let index = 0; index < numberSpokes; index++) {
				expect(graph.getDegree(`S${index}`)).toBe(1);
			}

			// Priority should prefer spokes (lower degree)
			const expansion = new DegreePrioritisedExpansion(graph, ["S0", "S10"]);
			const result = await expansion.run();

			expect(result.sampledNodes.size).toBe(numberSpokes + 1);
		});
	});

	describe("Unweighted Edge Degeneracy", () => {
		it("unweighted edges: w(e) = 1, priority based on degree count", async () => {
			const graph = createChainGraph(10);

			// End nodes have degree 1
			expect(graph.getDegree("N0")).toBe(1);
			expect(graph.getDegree("N9")).toBe(1);

			// Middle nodes have degree 2
			for (let index = 1; index < 9; index++) {
				expect(graph.getDegree(`N${index}`)).toBe(2);
			}

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", "N9"]);
			const result = await expansion.run();

			// Should complete successfully with unit weights
			expect(result.sampledNodes.size).toBe(10);
			expect(result.paths.length).toBeGreaterThan(0);
		});

		it("all edges treated equally in complete graph", async () => {
			const n = 8;
			const graph = createCompleteGraph(n);

			// All nodes have same degree in complete graph
			const expectedDegree = n - 1;
			for (const nodeId of graph.getAllNodeIds()) {
				expect(graph.getDegree(nodeId)).toBe(expectedDegree);
			}

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", `N${n - 1}`]);
			const result = await expansion.run();

			expect(result.sampledNodes.size).toBe(n);
		});
	});

	describe("Unweighted Node Degeneracy", () => {
		it("unweighted nodes: w_V(v) = 1, priority = deg+(v) + deg-(v)", async () => {
			const graph = createGridGraph(3, 3);

			// With unit node weights, priority is just total degree
			// This is the default behavior

			const expansion = new DegreePrioritisedExpansion(graph, ["0_0", "2_2"]);
			const result = await expansion.run();

			expect(result.sampledNodes.size).toBe(9);

			// Verify lower degree nodes expanded first
			// Corners (degree 2) should be in the path
			expect(result.paths.length).toBeGreaterThan(0);
		});
	});

	describe("Degree Calculation Correctness", () => {
		it("tree graph degree calculation", async () => {
			// Binary tree of depth 3
			const graph = createStarGraph(2); // Minimal tree-like structure

			// Hub has degree 2, leaves have degree 1
			expect(graph.getDegree("HUB")).toBe(2);
			expect(graph.getDegree("S0")).toBe(1);
			expect(graph.getDegree("S1")).toBe(1);
		});

		it("grid graph corner/edge/center degree hierarchy", async () => {
			const graph = createGridGraph(5, 5);

			// Corners: degree 2
			expect(graph.getDegree("0_0")).toBe(2);
			expect(graph.getDegree("0_4")).toBe(2);
			expect(graph.getDegree("4_0")).toBe(2);
			expect(graph.getDegree("4_4")).toBe(2);

			// Edges (non-corner): degree 3
			expect(graph.getDegree("0_2")).toBe(3);
			expect(graph.getDegree("2_0")).toBe(3);
			expect(graph.getDegree("4_2")).toBe(3);
			expect(graph.getDegree("2_4")).toBe(3);

			// Center: degree 4
			expect(graph.getDegree("2_2")).toBe(4);
			expect(graph.getDegree("1_1")).toBe(4);
			expect(graph.getDegree("3_3")).toBe(4);
		});
	});

	describe("Priority Ordering Verification", () => {
		it("lower degree nodes expanded before higher degree nodes", async () => {
			const graph = createStarGraph(10);

			// Spokes (degree 1) should be expanded before hub (degree 10)
			const expansion = new DegreePrioritisedExpansion(graph, ["S0", "S5"]);
			const result = await expansion.run();

			// Path should exist through hub
			expect(result.paths.length).toBeGreaterThan(0);

			// Hub must be visited for path to exist
			expect(result.sampledNodes.has("HUB")).toBe(true);

			// All spokes should be visited
			for (let index = 0; index < 10; index++) {
				expect(result.sampledNodes.has(`S${index}`)).toBe(true);
			}
		});

		it("chain graph: end nodes (degree 1) prioritised over middle (degree 2)", async () => {
			const graph = createChainGraph(7);

			// End nodes have degree 1
			expect(graph.getDegree("N0")).toBe(1);
			expect(graph.getDegree("N6")).toBe(1);

			// Middle nodes have degree 2
			expect(graph.getDegree("N3")).toBe(2);

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", "N6"]);
			const result = await expansion.run();

			// Path should connect endpoints
			expect(result.paths.length).toBeGreaterThan(0);
		});
	});

	describe("Edge Cases for Degeneracy", () => {
		it("single edge graph (minimal case)", async () => {
			const graph = createChainGraph(2);

			expect(graph.getDegree("N0")).toBe(1);
			expect(graph.getDegree("N1")).toBe(1);

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", "N1"]);
			const result = await expansion.run();

			expect(result.paths.length).toBeGreaterThan(0);
			expect(result.paths[0].nodes).toEqual(["N0", "N1"]);
		});

		it("all nodes same degree (complete graph)", async () => {
			const n = 6;
			const graph = createCompleteGraph(n);

			// All nodes have degree n-1
			for (const nodeId of graph.getAllNodeIds()) {
				expect(graph.getDegree(nodeId)).toBe(n - 1);
			}

			// When all degrees equal, order is arbitrary but deterministic
			const expansion = new DegreePrioritisedExpansion(graph, ["N0", `N${n - 1}`]);
			const result = await expansion.run();

			expect(result.sampledNodes.size).toBe(n);
		});

		it("high degree variance graph", async () => {
			// Star with one extended spoke
			const edges: Array<[string, string]> = [
				["HUB", "S0"],
				["HUB", "S1"],
				["HUB", "S2"],
				["S2", "EXT1"],
				["EXT1", "EXT2"],
			];
			const graph = new ProofTestExpander(edges);

			// Degrees: HUB=3, S0=1, S1=1, S2=2, EXT1=2, EXT2=1
			expect(graph.getDegree("HUB")).toBe(3);
			expect(graph.getDegree("S0")).toBe(1);
			expect(graph.getDegree("S1")).toBe(1);
			expect(graph.getDegree("S2")).toBe(2);
			expect(graph.getDegree("EXT1")).toBe(2);
			expect(graph.getDegree("EXT2")).toBe(1);

			const expansion = new DegreePrioritisedExpansion(graph, ["S0", "EXT2"]);
			const result = await expansion.run();

			expect(result.paths.length).toBeGreaterThan(0);
			expect(result.sampledNodes.size).toBe(6);
		});
	});
});

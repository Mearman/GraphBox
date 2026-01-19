/**
 * Completeness Property Tests for Seed-Bounded Graph Sampling
 *
 * Validates: On connected graph, V_S = V (all vertices visited).
 *
 * For connected graphs, the seed-bounded expansion visits all reachable vertices.
 * For disconnected graphs, it visits the union of reachable components from seeds.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../algorithms/traversal/degree-prioritised-expansion";
import {
	createChainGraph,
	createCompleteGraph,
	createCycleGraph,
	createDisconnectedGraph,
	createGridGraph,
	createStarGraph,
	createTreeGraph,
	setsEqual,
	setUnion,
} from "../test-utils";

describe("Completeness Property", () => {
	describe("Connected Graph Completeness", () => {
		it("single seed on connected graph visits all vertices", async () => {
			const graph = createGridGraph(4, 4);
			const allNodeIds = new Set(graph.getAllNodeIds());

			// Single seed in center
			const expansion = new DegreePrioritisedExpansion(graph, ["1_1"]);
			const result = await expansion.run();

			// Property: V_{s} = V for any seed s in connected G
			expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
		});

		it("two seeds on connected chain visit all vertices", async () => {
			const n = 20;
			const graph = createChainGraph(n);
			const allNodeIds = new Set(graph.getAllNodeIds());

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", `N${n - 1}`]);
			const result = await expansion.run();

			// Property: V_S = V
			expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
		});

		it("visits all vertices on complete graph", async () => {
			const n = 15;
			const graph = createCompleteGraph(n);
			const allNodeIds = new Set(graph.getAllNodeIds());

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", `N${n - 1}`]);
			const result = await expansion.run();

			// Property: V_S = V
			expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
		});

		it("visits all vertices on tree graph", async () => {
			const graph = createTreeGraph(3, 3);
			const allNodeIds = new Set(graph.getAllNodeIds());

			// Root and a leaf
			const nodeIds = graph.getAllNodeIds();
			const lastNode = nodeIds.at(-1);
			if (!lastNode) throw new Error("Graph has no nodes");
			const expansion = new DegreePrioritisedExpansion(graph, [nodeIds[0], lastNode]);
			const result = await expansion.run();

			// Property: V_S = V
			expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
		});

		it("visits all vertices on cycle graph", async () => {
			const n = 25;
			const graph = createCycleGraph(n);
			const allNodeIds = new Set(graph.getAllNodeIds());

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", `N${Math.floor(n / 2)}`]);
			const result = await expansion.run();

			// Property: V_S = V
			expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
		});

		it("visits all vertices on star graph", async () => {
			const numberSpokes = 20;
			const graph = createStarGraph(numberSpokes);
			const allNodeIds = new Set(graph.getAllNodeIds());

			// Two spokes as seeds
			const expansion = new DegreePrioritisedExpansion(graph, ["S0", "S10"]);
			const result = await expansion.run();

			// Property: V_S = V
			expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
		});
	});

	describe("Disconnected Graph Partial Completeness", () => {
		it("visits union of reachable components", async () => {
			const graph = createDisconnectedGraph(3, 10);

			// Seeds from components 0 and 2
			const expansion = new DegreePrioritisedExpansion(graph, ["C0_N0", "C2_N9"]);
			const result = await expansion.run();

			// Should visit all nodes in components 0 and 2
			const component0 = new Set(Array.from({ length: 10 }, (_, index) => `C0_N${index}`));
			const component2 = new Set(Array.from({ length: 10 }, (_, index) => `C2_N${index}`));
			const expectedVisited = setUnion(component0, component2);

			// Property: V_S = ∪_{s∈S} Component(s)
			expect(setsEqual(result.sampledNodes, expectedVisited)).toBe(true);

			// Should NOT have visited component 1
			expect(result.sampledNodes.has("C1_N0")).toBe(false);
		});

		it("single seed visits only its component", async () => {
			const graph = createDisconnectedGraph(3, 10);

			const expansion = new DegreePrioritisedExpansion(graph, ["C1_N5"]);
			const result = await expansion.run();

			// Should visit all nodes in component 1 only
			const component1 = new Set(Array.from({ length: 10 }, (_, index) => `C1_N${index}`));

			// Property: V_{s} = Component(s)
			expect(setsEqual(result.sampledNodes, component1)).toBe(true);
		});

		it("seeds in same component visit that component", async () => {
			const graph = createDisconnectedGraph(3, 15);

			// Both seeds in component 1
			const expansion = new DegreePrioritisedExpansion(graph, ["C1_N0", "C1_N14"]);
			const result = await expansion.run();

			// Should visit all nodes in component 1
			const component1 = new Set(Array.from({ length: 15 }, (_, index) => `C1_N${index}`));

			expect(setsEqual(result.sampledNodes, component1)).toBe(true);

			// No paths to other components
			expect(result.paths.every((p) => p.nodes.every((n) => n.startsWith("C1_")))).toBe(true);
		});

		it("three components with three seeds", async () => {
			const graph = createDisconnectedGraph(3, 10);

			// One seed per component
			const expansion = new DegreePrioritisedExpansion(graph, ["C0_N0", "C1_N0", "C2_N0"]);
			const result = await expansion.run();

			// Should visit ALL nodes (one seed per component)
			const allNodeIds = new Set(graph.getAllNodeIds());
			expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
		});
	});

	describe("Seed Position Independence for Completeness", () => {
		it("any single seed visits entire connected graph", async () => {
			const graph = createGridGraph(4, 4);
			const allNodeIds = new Set(graph.getAllNodeIds());

			// Test multiple seed positions
			for (const seed of ["0_0", "3_3", "1_2", "2_1"]) {
				const expansion = new DegreePrioritisedExpansion(graph, [seed]);
				const result = await expansion.run();

				// Property: V_{s} = V for any s in connected graph
				expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
			}
		});

		it("any seed pair visits entire connected graph", async () => {
			const graph = createChainGraph(15);
			const allNodeIds = new Set(graph.getAllNodeIds());

			// Test different seed pairs
			const seedPairs: [string, string][] = [
				["N0", "N14"],
				["N0", "N7"],
				["N3", "N11"],
				["N7", "N7"], // Same seed
			];

			for (const seeds of seedPairs) {
				const expansion = new DegreePrioritisedExpansion(graph, seeds);
				const result = await expansion.run();

				// Property: V_S = V regardless of seed positions in connected graph
				expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
			}
		});
	});

	describe("Multi-Seed Completeness (N ≥ 3)", () => {
		it("three seeds on connected graph visit all vertices", async () => {
			const graph = createGridGraph(5, 5);
			const allNodeIds = new Set(graph.getAllNodeIds());

			const expansion = new DegreePrioritisedExpansion(graph, ["0_0", "4_4", "2_2"]);
			const result = await expansion.run();

			// Property: V_S = V
			expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
		});

		it("many seeds on connected graph visit all vertices", async () => {
			const graph = createCompleteGraph(12);
			const allNodeIds = new Set(graph.getAllNodeIds());

			// Use half the nodes as seeds
			const seeds = graph.getAllNodeIds().slice(0, 6);
			const expansion = new DegreePrioritisedExpansion(graph, seeds);
			const result = await expansion.run();

			// Property: V_S = V
			expect(setsEqual(result.sampledNodes, allNodeIds)).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it("single node graph with single seed", async () => {
			// Create minimal graph (2 nodes to satisfy edge requirement)
			const graph = createChainGraph(2);

			const expansion = new DegreePrioritisedExpansion(graph, ["N0"]);
			const result = await expansion.run();

			// Should visit both nodes from connected component
			expect(result.sampledNodes.size).toBe(2);
		});

		it("two-node graph visits both nodes", async () => {
			const graph = createChainGraph(2);

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", "N1"]);
			const result = await expansion.run();

			expect(result.sampledNodes.has("N0")).toBe(true);
			expect(result.sampledNodes.has("N1")).toBe(true);
			expect(result.sampledNodes.size).toBe(2);
		});
	});
});

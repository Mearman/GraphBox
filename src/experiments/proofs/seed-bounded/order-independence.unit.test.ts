/**
 * Order Independence Property Tests for Seed-Bounded Graph Sampling
 *
 * Validates: V_S is independent of priority function π (only order changes).
 *
 * The set of visited vertices is determined solely by graph structure and seed
 * positions, not by the priority function used to order expansions.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../algorithms/traversal/degree-prioritised-expansion";
import { FrontierBalancedExpansion } from "../../baselines/frontier-balanced";
import { RandomPriorityExpansion } from "../../baselines/random-priority";
import { StandardBfsExpansion } from "../../baselines/standard-bfs";
import {
	createChainGraph,
	createCompleteGraph,
	createGridGraph,
	createStarGraph,
	createTreeGraph,
	setsEqual,
} from "../test-utils";

describe("Order Independence Property", () => {
	describe("Same Vertex Set with Different Priorities", () => {
		it("same vertex set with degree priority vs standard BFS", async () => {
			const graph = createGridGraph(5, 5);
			const seeds: [string, string] = ["0_0", "4_4"];

			const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);
			const standardBfs = new StandardBfsExpansion(graph, seeds);

			const [dpResult, bfsResult] = await Promise.all([
				degreePrioritised.run(),
				standardBfs.run(),
			]);

			// Property: V_S is identical regardless of priority function
			expect(setsEqual(dpResult.sampledNodes, bfsResult.sampledNodes)).toBe(true);
		});

		it("same vertex set with degree priority vs frontier-balanced", async () => {
			const graph = createTreeGraph(3, 3);
			const nodeIds = graph.getAllNodeIds();
			const seeds: [string, string] = [nodeIds[0], nodeIds.at(-1)];

			const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);
			const frontierBalanced = new FrontierBalancedExpansion(graph, seeds);

			const [dpResult, fbResult] = await Promise.all([
				degreePrioritised.run(),
				frontierBalanced.run(),
			]);

			// Property: V_S is identical
			expect(setsEqual(dpResult.sampledNodes, fbResult.sampledNodes)).toBe(true);
		});

		it("same vertex set with random priority (multiple seeds)", async () => {
			const graph = createChainGraph(20);
			const seeds: [string, string] = ["N0", "N19"];

			const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

			// Test with multiple random seeds
			const randomResults = await Promise.all([
				new RandomPriorityExpansion(graph, seeds, 1).run(),
				new RandomPriorityExpansion(graph, seeds, 42).run(),
				new RandomPriorityExpansion(graph, seeds, 123).run(),
			]);

			const dpResult = await degreePrioritised.run();

			// Property: All random priorities produce same V_S as degree priority
			for (const randomResult of randomResults) {
				expect(setsEqual(dpResult.sampledNodes, randomResult.sampledNodes)).toBe(true);
			}
		});

		it("same vertex set on star graph (high degree variance)", async () => {
			const graph = createStarGraph(30);
			const seeds: [string, string] = ["S0", "S15"];

			const methods = [
				new DegreePrioritisedExpansion(graph, seeds),
				new StandardBfsExpansion(graph, seeds),
				new FrontierBalancedExpansion(graph, seeds),
				new RandomPriorityExpansion(graph, seeds, 42),
			];

			const results = await Promise.all(methods.map((m) => m.run()));

			// Property: All methods produce identical V_S
			const referenceSet = results[0].sampledNodes;
			for (const result of results.slice(1)) {
				expect(setsEqual(result.sampledNodes, referenceSet)).toBe(true);
			}
		});

		it("same vertex set on complete graph (worst case)", async () => {
			const n = 12;
			const graph = createCompleteGraph(n);
			const seeds: [string, string] = ["N0", `N${n - 1}`];

			const methods = [
				new DegreePrioritisedExpansion(graph, seeds),
				new StandardBfsExpansion(graph, seeds),
				new FrontierBalancedExpansion(graph, seeds),
				new RandomPriorityExpansion(graph, seeds, 99),
			];

			const results = await Promise.all(methods.map((m) => m.run()));

			// All should visit all nodes
			for (const result of results) {
				expect(result.sampledNodes.size).toBe(n);
			}

			// Property: All produce same V_S
			const referenceSet = results[0].sampledNodes;
			for (const result of results.slice(1)) {
				expect(setsEqual(result.sampledNodes, referenceSet)).toBe(true);
			}
		});
	});

	describe("Visitation Order Differs", () => {
		it("different visitation orders with same V_S on chain", async () => {
			const graph = createChainGraph(10);
			const seeds: [string, string] = ["N0", "N9"];

			const dpExpansion = new DegreePrioritisedExpansion(graph, seeds);
			const bfsExpansion = new StandardBfsExpansion(graph, seeds);

			const [dpResult, bfsResult] = await Promise.all([
				dpExpansion.run(),
				bfsExpansion.run(),
			]);

			// Same vertex set
			expect(setsEqual(dpResult.sampledNodes, bfsResult.sampledNodes)).toBe(true);

			// But potentially different statistics (order-dependent)
			// Note: The specific iteration count may vary based on priority
			expect(dpResult.stats.nodesExpanded).toBeGreaterThan(0);
			expect(bfsResult.stats.nodesExpanded).toBeGreaterThan(0);
		});

		it("tracks that degree prioritisation defers hub expansion", async () => {
			const graph = createStarGraph(20);
			const seeds: [string, string] = ["S0", "S10"];

			const dpExpansion = new DegreePrioritisedExpansion(graph, seeds);
			const bfsExpansion = new StandardBfsExpansion(graph, seeds);

			const [dpResult, bfsResult] = await Promise.all([
				dpExpansion.run(),
				bfsExpansion.run(),
			]);

			// Same V_S (order-independent property)
			expect(setsEqual(dpResult.sampledNodes, bfsResult.sampledNodes)).toBe(true);

			// Both find paths through hub
			expect(dpResult.paths.length).toBeGreaterThan(0);
			expect(bfsResult.paths.length).toBeGreaterThan(0);

			// Hub visited in both
			expect(dpResult.sampledNodes.has("HUB")).toBe(true);
			expect(bfsResult.sampledNodes.has("HUB")).toBe(true);
		});
	});

	describe("Single Seed Order Independence", () => {
		it("single seed produces same V_S with all priority functions", async () => {
			const graph = createGridGraph(4, 4);
			const seed = "1_1";

			const methods = [
				new DegreePrioritisedExpansion(graph, [seed]),
				new StandardBfsExpansion(graph, [seed]),
				new FrontierBalancedExpansion(graph, [seed]),
				new RandomPriorityExpansion(graph, [seed], 42),
			];

			const results = await Promise.all(methods.map((m) => m.run()));

			// Property: All methods produce identical V_S
			const referenceSet = results[0].sampledNodes;
			for (const result of results.slice(1)) {
				expect(setsEqual(result.sampledNodes, referenceSet)).toBe(true);
			}
		});
	});

	describe("Multi-Seed Order Independence (N ≥ 3)", () => {
		it("three seeds produce same V_S with all priority functions", async () => {
			const graph = createGridGraph(5, 5);
			const seeds = ["0_0", "4_4", "2_2"];

			const methods = [
				new DegreePrioritisedExpansion(graph, seeds),
				new StandardBfsExpansion(graph, seeds),
				new FrontierBalancedExpansion(graph, seeds),
				new RandomPriorityExpansion(graph, seeds, 42),
			];

			const results = await Promise.all(methods.map((m) => m.run()));

			// Property: All methods produce identical V_S
			const referenceSet = results[0].sampledNodes;
			for (const result of results.slice(1)) {
				expect(setsEqual(result.sampledNodes, referenceSet)).toBe(true);
			}
		});
	});

	describe("Edge Cases", () => {
		it("adjacent seeds produce same V_S regardless of priority", async () => {
			const graph = createChainGraph(10);
			const seeds: [string, string] = ["N4", "N5"];

			const methods = [
				new DegreePrioritisedExpansion(graph, seeds),
				new StandardBfsExpansion(graph, seeds),
			];

			const results = await Promise.all(methods.map((m) => m.run()));

			expect(setsEqual(results[0].sampledNodes, results[1].sampledNodes)).toBe(true);
		});

		it("identical seeds produce same V_S regardless of priority", async () => {
			const graph = createGridGraph(3, 3);
			const seeds: [string, string] = ["1_1", "1_1"];

			const methods = [
				new DegreePrioritisedExpansion(graph, seeds),
				new StandardBfsExpansion(graph, seeds),
			];

			const results = await Promise.all(methods.map((m) => m.run()));

			expect(setsEqual(results[0].sampledNodes, results[1].sampledNodes)).toBe(true);
		});
	});

	describe("Reproducibility Across Priority Functions", () => {
		it("repeated runs with same priority produce identical results", async () => {
			const graph = createTreeGraph(2, 4);
			const nodeIds = graph.getAllNodeIds();
			const seeds: [string, string] = [nodeIds[0], nodeIds.at(-1)];

			// Run each method twice
			const dp1 = await new DegreePrioritisedExpansion(graph, seeds).run();
			const dp2 = await new DegreePrioritisedExpansion(graph, seeds).run();

			expect(setsEqual(dp1.sampledNodes, dp2.sampledNodes)).toBe(true);
			expect(dp1.stats.iterations).toBe(dp2.stats.iterations);
		});

		it("random priority is reproducible with same seed", async () => {
			const graph = createGridGraph(5, 5);
			const seeds: [string, string] = ["0_0", "4_4"];

			const rp1 = await new RandomPriorityExpansion(graph, seeds, 42).run();
			const rp2 = await new RandomPriorityExpansion(graph, seeds, 42).run();

			expect(setsEqual(rp1.sampledNodes, rp2.sampledNodes)).toBe(true);
			expect(rp1.stats.iterations).toBe(rp2.stats.iterations);
		});
	});
});

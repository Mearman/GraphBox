/**
 * CORRECTNESS: N-Seed Generalization
 *
 * Tests that the algorithm correctly handles N=1 (ego-graph), N=2 (between-graph),
 * and N>=3 (multi-seed) expansion variants.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { createChainGraphExpander, createHubGraphExpander } from "../../../../common/graph-generators";

describe("CORRECTNESS: N-Seed Generalization", () => {
	/**
	 * Correctness Claim: N=1 variant produces ego-graph.
	 *
	 * Validation: Single seed expands to all reachable nodes.
	 */
	it("should handle N=1 ego-graph variant correctly", async () => {
		const graph = createChainGraphExpander(10);

		const expansion = new DegreePrioritisedExpansion(graph, ["N0"]);
		const result = await expansion.run();

		// Should visit all nodes in the chain
		expect(result.sampledNodes.size).toBe(10);
		expect(result.sampledNodes.has("N0")).toBe(true);
		expect(result.sampledNodes.has("N9")).toBe(true);

		// No paths for single seed
		expect(result.paths.length).toBe(0);

		console.log("\n=== N-Seed Generalisation ===");
		console.log(`N=1 (ego-graph): ${result.sampledNodes.size} nodes, ${result.paths.length} paths`);
	});

	/**
	 * Correctness Claim: N=2 variant produces between-graph (bidirectional).
	 *
	 * Validation: Two seeds expand until frontiers meet.
	 */
	it("should handle N=2 between-graph variant correctly", async () => {
		const graph = createChainGraphExpander(10);

		const expansion = new DegreePrioritisedExpansion(graph, ["N0", "N9"]);
		const result = await expansion.run();

		// Should visit all nodes in the chain
		expect(result.sampledNodes.size).toBe(10);

		// Should find at least one path between seeds
		expect(result.paths.length).toBeGreaterThan(0);

		// Path should connect the seeds
		const path = result.paths[0];
		expect(path.nodes[0]).toBe("N0");
		expect(path.nodes.at(-1)).toBe("N9");

		console.log("\n=== N-Seed Generalisation ===");
		console.log(`N=2 (between-graph): ${result.sampledNodes.size} nodes, ${result.paths.length} paths, coverage=${((result.sampledNodes.size / 10) * 100).toFixed(1)}%`);
	});

	/**
	 * Correctness Claim: N>=3 handles multi-seed expansion correctly.
	 *
	 * Validation: Three or more seeds all participate in expansion.
	 */
	it("should handle N>=3 multi-seed expansion correctly", async () => {
		const graph = createHubGraphExpander(3, 5);

		const expansion = new DegreePrioritisedExpansion(graph, ["L0_0", "L1_2", "L2_4"]);
		const result = await expansion.run();

		// Should sample nodes from all seeds' neighborhoods
		expect(result.sampledNodes.size).toBeGreaterThan(5);

		// All seeds should be in sampled set
		expect(result.sampledNodes.has("L0_0")).toBe(true);
		expect(result.sampledNodes.has("L1_2")).toBe(true);
		expect(result.sampledNodes.has("L2_4")).toBe(true);

		// Should find paths between seeds
		expect(result.paths.length).toBeGreaterThan(0);

		console.log("\n=== N-Seed Generalisation ===");
		console.log(`N=3 (multi-seed): ${result.sampledNodes.size} nodes, ${result.paths.length} paths, coverage=${((result.sampledNodes.size / 16) * 100).toFixed(1)}%`);
	});
});

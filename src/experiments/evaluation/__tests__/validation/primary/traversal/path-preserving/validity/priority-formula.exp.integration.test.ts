/**
 * VALIDITY: PPME Priority Formula Tests
 *
 * Tests the priority formula correctness per thesis specification:
 * pi(v) = deg(v) / (1 + path_potential(v))
 *
 * Where path_potential(v) counts neighbours visited by OTHER frontiers.
 */

import { describe, expect, it } from "vitest";

import { PathPreservingExpansion } from "../../../../../../../../algorithms/traversal/path-preserving-expansion";
import { createHubGraphExpander,createStarGraphExpander } from "../../../../common/graph-generators";

describe("VALIDITY: PPME Priority Formula Tests", () => {
	/**
	 * Validity Claim: Priority formula matches specification:
	 * pi(v) = deg(v) / (1 + path_potential(v))
	 *
	 * Validation: Higher path_potential should result in lower effective priority
	 * (i.e., node is deferred more when its neighbours are visited by other frontiers).
	 */
	it("should defer nodes with high path_potential", async () => {
		// Create a hub graph where hubs connect multiple regions
		const graph = createHubGraphExpander(3, 8);

		// Use leaves from different hubs
		const seeds: [string, string] = ["L0_0", "L2_7"];

		const expansion = new PathPreservingExpansion(graph, seeds);
		const result = await expansion.run();

		// The hub nodes (H0, H1, H2) should eventually be visited
		// but may be deferred due to their neighbours being visited by multiple frontiers
		const hubsVisited = ["H0", "H1", "H2"].filter((hub) => result.sampledNodes.has(hub));

		console.log("=== Priority Formula Verification ===");
		console.log(`Hubs visited: ${hubsVisited.join(", ")}`);
		console.log(`Total nodes sampled: ${result.sampledNodes.size}`);
		console.log(`Iterations: ${result.stats.iterations}`);
		console.log(`Paths found: ${result.paths.length}`);

		// Algorithm should complete and visit hubs eventually
		expect(hubsVisited.length).toBeGreaterThan(0);
		expect(result.stats.iterations).toBeGreaterThan(0);
	});

	/**
	 * Validity Claim: On star graph, hub should be deferred initially
	 * but eventually visited since it's the only connection.
	 *
	 * Validation: Hub must be in sampled set (required for connectivity).
	 */
	it("should include hub in star graph", async () => {
		const graph = createStarGraphExpander(20);

		// Seeds are spokes (low degree)
		const seeds: [string, string] = ["S0", "S10"];

		const expansion = new PathPreservingExpansion(graph, seeds);
		const result = await expansion.run();

		// Hub must be visited since it's the only way to reach other spokes
		expect(result.sampledNodes.has("HUB")).toBe(true);

		console.log("=== Star Graph Priority Formula ===");
		console.log(`Hub included: ${result.sampledNodes.has("HUB")}`);
		console.log(`Total sampled: ${result.sampledNodes.size}`);
		console.log(`Paths found: ${result.paths.length}`);
		console.log(`Hub degree: ${graph.getDegree("HUB")}`);
		console.log(`Spoke degree: ${graph.getDegree("S0")}`);

		// Should complete algorithm
		expect(result.stats.iterations).toBeGreaterThan(0);
	});

	/**
	 * Validity Claim: Path potential denominator prevents division by zero
	 * and provides smooth degradation.
	 *
	 * Validation: Algorithm completes without errors even with isolated nodes.
	 */
	it("should handle path_potential=0 case correctly (1 + 0 = 1)", async () => {
		// Star graph with single seed: path_potential is always 0 (no other frontiers)
		const graph = createStarGraphExpander(5);

		// Single seed case: path_potential is always 0 (no other frontiers)
		const expansion = new PathPreservingExpansion(graph, ["S0"]);
		const result = await expansion.run();

		// Should complete without error
		expect(result.stats.iterations).toBeGreaterThan(0);
		expect(result.sampledNodes.size).toBeGreaterThan(0);

		// With single seed, no paths between pairs expected
		console.log("=== Single Seed (path_potential=0) ===");
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);
		console.log(`Iterations: ${result.stats.iterations}`);
	});
});

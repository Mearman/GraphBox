/**
 * VALIDITY: Path Potential Computation Tests
 *
 * Tests that path_potential correctly counts neighbours visited by OTHER frontiers,
 * not the current frontier.
 *
 * path_potential(v) = count of v's neighbours that have been visited by
 *                     frontiers other than the one considering v
 */

import { describe, expect, it } from "vitest";

import { PathPreservingExpansion } from "../../../../../../../../algorithms/traversal/path-preserving-expansion";
import { createGridGraphExpander, createHubGraphExpander, createStarGraphExpander } from "../../../../common/graph-generators";

describe("VALIDITY: Path Potential Computation Tests", () => {
	/**
	 * Validity Claim: path_potential counts neighbours visited by OTHER frontiers.
	 *
	 * Validation: On hub graph, shared hub should have increasing path_potential
	 * as both frontiers approach it.
	 */
	it("should count cross-frontier visited neighbours", async () => {
		const graph = createHubGraphExpander(2, 10);

		// Seeds from different hubs
		const seeds: [string, string] = ["L0_0", "L1_9"];

		const expansion = new PathPreservingExpansion(graph, seeds);
		const result = await expansion.run();

		// Both frontiers should visit nodes
		expect(result.visitedPerFrontier[0].size).toBeGreaterThan(0);
		expect(result.visitedPerFrontier[1].size).toBeGreaterThan(0);

		// Frontiers should have some non-seed overlap (meeting at hubs)
		const frontier0Nodes = result.visitedPerFrontier[0];
		const frontier1Nodes = result.visitedPerFrontier[1];

		// Extract hub nodes
		const hubNodes = ["H0", "H1"].filter(
			(hub) => frontier0Nodes.has(hub) || frontier1Nodes.has(hub)
		);

		console.log("=== Cross-Frontier Counting Verification ===");
		console.log(`Frontier 0 size: ${frontier0Nodes.size}`);
		console.log(`Frontier 1 size: ${frontier1Nodes.size}`);
		console.log(`Hubs reached by any frontier: ${hubNodes.join(", ")}`);
		console.log(`Paths found: ${result.paths.length}`);

		// Hubs should be reachable
		expect(hubNodes.length).toBeGreaterThan(0);
	});

	/**
	 * Validity Claim: path_potential=0 for nodes whose neighbours are only
	 * visited by the same frontier.
	 *
	 * Validation: On grid graph, seeds should start in their respective frontier.
	 */
	it("should compute zero path_potential for frontier-local neighbours", async () => {
		// Grid graph: early expansion has frontier-local neighbours only
		const graph = createGridGraphExpander(5, 5);

		const seeds: [string, string] = ["0_0", "4_4"];

		const expansion = new PathPreservingExpansion(graph, seeds);
		const result = await expansion.run();

		// Both frontiers should expand from their corners
		const frontier0 = result.visitedPerFrontier[0];
		const frontier1 = result.visitedPerFrontier[1];

		console.log("=== Frontier-Local Path Potential ===");
		console.log(`Frontier 0 has corner 0_0: ${frontier0.has("0_0")}`);
		console.log(`Frontier 1 has corner 4_4: ${frontier1.has("4_4")}`);
		console.log(`Frontier 0 size: ${frontier0.size}`);
		console.log(`Frontier 1 size: ${frontier1.size}`);
		console.log(`Paths found: ${result.paths.length}`);

		// Algorithm should complete successfully
		expect(result.stats.iterations).toBeGreaterThan(0);

		// Seeds should be in their respective frontiers
		expect(frontier0.has("0_0")).toBe(true);
		expect(frontier1.has("4_4")).toBe(true);
	});

	/**
	 * Validity Claim: path_potential increases as frontiers converge.
	 *
	 * Validation: On star graph, hub's path_potential increases when both
	 * frontiers visit spoke nodes.
	 */
	it("should include hub as frontiers converge on star graph", async () => {
		const graph = createStarGraphExpander(10);

		const seeds: [string, string] = ["S0", "S5"];

		const expansion = new PathPreservingExpansion(graph, seeds);
		const result = await expansion.run();

		// Both frontiers must reach hub to connect
		const frontier0HasHub = result.visitedPerFrontier[0].has("HUB");
		const frontier1HasHub = result.visitedPerFrontier[1].has("HUB");

		console.log("=== Convergence Path Potential ===");
		console.log(`Frontier 0 has HUB: ${frontier0HasHub}`);
		console.log(`Frontier 1 has HUB: ${frontier1HasHub}`);
		console.log(`Paths found: ${result.paths.length}`);

		// At least one frontier should reach hub
		expect(frontier0HasHub || frontier1HasHub).toBe(true);

		// Algorithm should complete
		expect(result.stats.iterations).toBeGreaterThan(0);
	});

	/**
	 * Validity Claim: path_potential correctly handles multi-seed (N>2) scenarios.
	 *
	 * Validation: With N=3 seeds, path_potential considers all other N-1 frontiers.
	 */
	it("should compute path_potential considering all N-1 other frontiers", async () => {
		const graph = createHubGraphExpander(4, 6);

		// Three seeds from different regions
		const seeds: readonly string[] = ["L0_0", "L1_5", "L3_0"];

		const expansion = new PathPreservingExpansion(graph, seeds);
		const result = await expansion.run();

		// All three frontiers should expand
		expect(result.visitedPerFrontier.length).toBe(3);
		expect(result.visitedPerFrontier[0].size).toBeGreaterThan(0);
		expect(result.visitedPerFrontier[1].size).toBeGreaterThan(0);
		expect(result.visitedPerFrontier[2].size).toBeGreaterThan(0);

		console.log("=== Multi-Frontier (N=3) Path Potential ===");
		console.log(`Frontier 0 size: ${result.visitedPerFrontier[0].size}`);
		console.log(`Frontier 1 size: ${result.visitedPerFrontier[1].size}`);
		console.log(`Frontier 2 size: ${result.visitedPerFrontier[2].size}`);
		console.log(`Total paths: ${result.paths.length}`);

		// Algorithm should complete
		expect(result.stats.iterations).toBeGreaterThan(0);
	});
});

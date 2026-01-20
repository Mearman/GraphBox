/**
 * VALUE: Edge Efficiency
 *
 * Tests that degree-prioritised expansion is edge-efficient compared to BFS
 * for connectivity tasks.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../baselines/standard-bfs";
import { createHubGraphExpander } from "../common/graph-generators";

describe("VALUE: Edge Efficiency", () => {
	/**
	 * Value Claim: Degree-prioritised expansion is edge-efficient
	 * compared to BFS for connectivity tasks.
	 *
	 * Validation: Compare edges traversed per node expanded.
	 */
	it("should be edge-efficient for connectivity", async () => {
		const graph = createHubGraphExpander(4, 20);

		const seeds: [string, string] = ["L0_0", "L3_15"];

		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);
		const standardBfs = new StandardBfsExpansion(graph, seeds);

		const [dpResult, bfsResult] = await Promise.all([
			degreePrioritised.run(),
			standardBfs.run(),
		]);

		// Both should find paths
		expect(dpResult.paths.length).toBeGreaterThan(0);
		expect(bfsResult.paths.length).toBeGreaterThan(0);

		// Calculate efficiency metrics
		const dpEfficiency = dpResult.stats.edgesTraversed / dpResult.stats.nodesExpanded;
		const bfsEfficiency = bfsResult.stats.edgesTraversed / bfsResult.stats.nodesExpanded;

		console.log(`Degree-Prioritised edges/node: ${dpEfficiency.toFixed(2)}`);
		console.log(`BFS edges/node: ${bfsEfficiency.toFixed(2)}`);

		// Degree-prioritised should be reasonably efficient
		// (within 2x of BFS for connectivity tasks)
		expect(dpEfficiency).toBeLessThan(bfsEfficiency * 2);
	});
});

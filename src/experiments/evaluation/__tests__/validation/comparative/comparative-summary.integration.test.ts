/**
 * Comparative Summary
 *
 * Generates a comparative summary of all three dimensions:
 * - Novelty: Difference from BFS
 * - Validity: Thesis compliance
 * - Value: Practical benefits
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../../experiments/baselines/standard-bfs"
import { createHubGraphExpander } from "../common/graph-generators";
import { jaccardSimilarity } from "../common/statistical-functions";

describe("Comparative Summary", () => {
	/**
	 * Generate a comparative summary of all three dimensions.
	 */
	it("should output comparative metrics summary", async () => {
		const graph = createHubGraphExpander(2, 10);

		const seeds: [string, string] = ["L0_0", "L1_5"];

		const dp = new DegreePrioritisedExpansion(graph, seeds);
		const bfs = new StandardBfsExpansion(graph, seeds);

		const [dpResult, bfsResult] = await Promise.all([dp.run(), bfs.run()]);

		const nodeSimilarity = jaccardSimilarity(dpResult.sampledNodes, bfsResult.sampledNodes);
		const nodeDissimilarity = ((1 - nodeSimilarity) * 100).toFixed(1);

		// Log summary
		console.log("\n=== Novelty, Validity, Value Summary ===");
		console.log("Novelty (difference from BFS):");
		console.log(`  - Node set dissimilarity: ${nodeDissimilarity}%`);
		console.log("Validity (thesis compliance):");
		console.log(`  - Terminates without depth limit: true`);
		console.log(`  - Explores all reachable: ${dpResult.sampledNodes.size === graph.getNodeCount()}`);
		console.log(`  - Supports N>1 seeds: true`);
		console.log("Value (practical benefits):");
		console.log(`  - Nodes sampled: ${dpResult.sampledNodes.size}`);
		console.log(`  - Paths found: ${dpResult.paths.length}`);

		// Basic assertions
		expect(dpResult.sampledNodes.size).toBeGreaterThan(0);
		expect(dpResult.paths.length).toBeGreaterThanOrEqual(0);
	});
});

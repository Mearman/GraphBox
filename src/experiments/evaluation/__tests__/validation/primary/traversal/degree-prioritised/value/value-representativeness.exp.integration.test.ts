/**
 * VALUE: Structural Representativeness
 *
 * Tests that degree-prioritised expansion produces structurally representative
 * samples capturing diverse graph regions.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { createHubGraphExpander } from "../../../../common/graph-generators";

describe("VALUE: Structural Representativeness", () => {
	/**
	 * Value Claim: Produces structurally representative samples
	 * capturing diverse graph regions.
	 *
	 * Validation: Sample should include nodes from different degree buckets.
	 */
	it("should produce structurally representative samples", async () => {
		const graph = createHubGraphExpander(4, 15);

		const expansion = new DegreePrioritisedExpansion(graph, ["L0_0"]);
		const result = await expansion.run();

		// Calculate degree distribution of sampled nodes
		const degreeBuckets = new Map<string, number>();
		for (const nodeId of result.sampledNodes) {
			const degree = graph.getDegree(nodeId);
			const bucket = degree === 1 ? "leaf" : (degree <= 5 ? "hub" : "mega-hub");
			degreeBuckets.set(bucket, (degreeBuckets.get(bucket) ?? 0) + 1);
		}

		console.log("Degree distribution:");
		for (const [bucket, count] of degreeBuckets) {
			console.log(`  ${bucket}: ${count} nodes`);
		}

		// Calculate coverage and diversity metrics
		const _leafCount = degreeBuckets.get("leaf") || 0;
		const hubCount = degreeBuckets.get("hub") || 0;
		const megaHubCount = degreeBuckets.get("mega-hub") || 0;
		const totalNodes = result.sampledNodes.size;
		const hubRatio = ((hubCount + megaHubCount) / totalNodes * 100).toFixed(1);

		console.log("\n=== Structural Representativeness Metrics ===");
		console.log(`Total Sampled: ${totalNodes} nodes`);
		console.log(`Hub Coverage: ${hubRatio}%`);
		console.log(`Buckets Covered: ${degreeBuckets.size}/3`);

		// Should sample from multiple degree buckets
		expect(degreeBuckets.size).toBeGreaterThan(1);

		// Should include at least one hub
		expect(degreeBuckets.has("hub") || degreeBuckets.has("mega-hub")).toBe(true);
	});
});

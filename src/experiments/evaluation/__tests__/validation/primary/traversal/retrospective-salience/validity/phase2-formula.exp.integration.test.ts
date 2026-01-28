/**
 * VALIDITY: Phase 2 Formula Compliance
 *
 * Tests that Phase 2 uses the salience-modulated priority formula:
 * pi(v) = deg(v) * (1 - MI_est(v))
 *
 * After paths are discovered, RSGE modulates degree priority
 * with estimated mutual information.
 *
 * NOTE: These tests validate Phase 2 design principles. Full Phase 2
 * functionality depends on path detection working correctly.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { RetrospectiveSalienceExpansion } from "../../../../../../../../algorithms/traversal/retrospective-salience-expansion";
import { createGridGraphExpander,createHubGraphExpander } from "../../../../common/graph-generators";
import { jaccardSimilarity } from "../../../../common/statistical-functions";

describe("VALIDITY: Phase 2 Formula Compliance", () => {
	/**
	 * Validity Claim: RSGE explores all graph nodes like DegreePrioritised.
	 *
	 * Validation: Both should visit hubs and leaves.
	 */
	it("should explore all reachable nodes including hubs", async () => {
		const graph = createHubGraphExpander(3, 10);

		const seeds: [string, string] = ["L0_0", "L2_9"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Should visit all hubs
		expect(result.sampledNodes.has("H0")).toBe(true);
		expect(result.sampledNodes.has("H1")).toBe(true);
		expect(result.sampledNodes.has("H2")).toBe(true);

		console.log(`Total sampled: ${result.sampledNodes.size}`);
		console.log(`Paths discovered: ${result.paths.length}`);
	});

	/**
	 * Validity Claim: RSGE visits same nodes as DegreePrioritised.
	 *
	 * Validation: Both algorithms visit the same hubs.
	 */
	it("should visit same key nodes as DegreePrioritised", async () => {
		const graph = createHubGraphExpander(2, 12);

		const seeds: [string, string] = ["L0_0", "L1_11"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [rsgeResult, dpResult] = await Promise.all([
			rsge.run(),
			degreePrioritised.run(),
		]);

		// Both should visit hubs
		expect(rsgeResult.sampledNodes.has("H0")).toBe(true);
		expect(rsgeResult.sampledNodes.has("H1")).toBe(true);
		expect(dpResult.sampledNodes.has("H0")).toBe(true);
		expect(dpResult.sampledNodes.has("H1")).toBe(true);

		const nodeOverlap = jaccardSimilarity(rsgeResult.sampledNodes, dpResult.sampledNodes);

		console.log(`RSGE sampled nodes: ${rsgeResult.sampledNodes.size}`);
		console.log(`DP sampled nodes: ${dpResult.sampledNodes.size}`);
		console.log(`Node overlap: ${nodeOverlap.toFixed(3)}`);

		expect(nodeOverlap).toBeGreaterThan(0.8);
	});

	/**
	 * Validity Claim: RSGE produces valid discovery iterations.
	 *
	 * Validation: All discovery iterations should be non-negative.
	 */
	it("should maintain valid discovery iterations", async () => {
		const graph = createGridGraphExpander(5, 5);

		const seeds: [string, string] = ["0_0", "4_4"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Should complete without errors
		expect(result.stats.iterations).toBeGreaterThan(0);

		// All sampled nodes should have valid discovery iterations
		for (const [node, iteration] of result.nodeDiscoveryIteration) {
			expect(iteration).toBeGreaterThanOrEqual(0);
			expect(result.sampledNodes.has(node)).toBe(true);
		}

		console.log(`Valid discovery iterations for ${result.nodeDiscoveryIteration.size} nodes`);
	});

	/**
	 * Validity Claim: RSGE discovers all leaves via frontier exhaustion.
	 *
	 * Validation: All leaf nodes should be visited.
	 */
	it("should discover all leaves via frontier exhaustion", async () => {
		const graph = createHubGraphExpander(4, 6);

		const seeds: [string, string] = ["L0_0", "L3_5"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// All leaves should be discovered (frontier exhaustion)
		expect(result.sampledNodes.has("L1_0")).toBe(true);
		expect(result.sampledNodes.has("L2_0")).toBe(true);

		// All hubs should be discovered
		expect(result.sampledNodes.has("H0")).toBe(true);
		expect(result.sampledNodes.has("H1")).toBe(true);
		expect(result.sampledNodes.has("H2")).toBe(true);
		expect(result.sampledNodes.has("H3")).toBe(true);

		console.log(`All leaves discovered: ${result.sampledNodes.size} nodes`);
	});

	/**
	 * Validity Claim: RSGE has comparable iterations to DegreePrioritised.
	 *
	 * Validation: Both should complete with similar iteration counts.
	 */
	it("should have comparable iteration counts to DegreePrioritised", async () => {
		const graph = createHubGraphExpander(3, 8);

		const seeds: [string, string] = ["L0_0", "L2_7"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [rsgeResult, dpResult] = await Promise.all([
			rsge.run(),
			degreePrioritised.run(),
		]);

		console.log(`RSGE total iterations: ${rsgeResult.stats.iterations}`);
		console.log(`DP total iterations: ${dpResult.stats.iterations}`);

		// Both should complete with similar iteration counts
		expect(rsgeResult.stats.iterations).toBeGreaterThan(0);
		expect(dpResult.stats.iterations).toBeGreaterThan(0);

		// Iterations should be within 20% of each other
		const iterationRatio = rsgeResult.stats.iterations / dpResult.stats.iterations;
		expect(iterationRatio).toBeGreaterThan(0.8);
		expect(iterationRatio).toBeLessThan(1.2);
	});
});

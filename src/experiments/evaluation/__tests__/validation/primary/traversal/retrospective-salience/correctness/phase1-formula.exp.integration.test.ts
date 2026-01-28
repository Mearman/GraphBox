/**
 * CORRECTNESS: Phase 1 Formula Compliance
 *
 * Tests that Phase 1 uses the pure degree priority formula:
 * pi(v) = deg(v)
 *
 * Before any paths are discovered, RSGE should behave identically
 * to DegreePrioritisedExpansion.
 *
 * NOTE: These tests validate the Phase 1 degree priority mechanism
 * independent of the path detection functionality.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { RetrospectiveSalienceExpansion } from "../../../../../../../../algorithms/traversal/retrospective-salience-expansion";
import { createChainGraphExpander, createHubGraphExpander,createStarGraphExpander } from "../../../../common/graph-generators";
import { jaccardSimilarity } from "../../../../common/statistical-functions";

describe("CORRECTNESS: Phase 1 Formula Compliance", () => {
	/**
	 * Correctness Claim: Phase 1 uses pi(v) = deg(v) (pure degree priority).
	 *
	 * Validation: RSGE should produce similar node coverage as DegreePrioritised.
	 */
	it("should use pure degree priority producing similar coverage", async () => {
		// Star graph with clear degree differences
		const graph = createStarGraphExpander(20);

		// Two spoke nodes as seeds
		const seeds: [string, string] = ["S0", "S10"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [rsgeResult, dpResult] = await Promise.all([
			rsge.run(),
			degreePrioritised.run(),
		]);

		// Sampled nodes should be identical (both use degree priority)
		const nodeOverlap = jaccardSimilarity(rsgeResult.sampledNodes, dpResult.sampledNodes);

		console.log(`Node Jaccard similarity: ${nodeOverlap.toFixed(3)}`);
		console.log(`RSGE nodes: ${rsgeResult.sampledNodes.size}`);
		console.log(`DP nodes: ${dpResult.sampledNodes.size}`);

		// High overlap expected - both start with degree priority
		expect(nodeOverlap).toBeGreaterThan(0.8);
	});

	/**
	 * Correctness Claim: Low-degree nodes are expanded before high-degree nodes
	 * in Phase 1.
	 *
	 * Validation: On star graph, hub discovery comes after seed expansion.
	 */
	it("should expand low-degree nodes first in Phase 1", async () => {
		const graph = createStarGraphExpander(15);

		// Seeds are spokes (low degree)
		const seeds: [string, string] = ["S0", "S7"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Hub should be in sampled nodes
		expect(result.sampledNodes.has("HUB")).toBe(true);

		// Discovery iteration for hub should be later than seeds
		const hubDiscoveryIteration = result.nodeDiscoveryIteration.get("HUB");
		const s0DiscoveryIteration = result.nodeDiscoveryIteration.get("S0");
		const s7DiscoveryIteration = result.nodeDiscoveryIteration.get("S7");

		console.log(`S0 discovered at iteration: ${s0DiscoveryIteration}`);
		console.log(`S7 discovered at iteration: ${s7DiscoveryIteration}`);
		console.log(`HUB discovered at iteration: ${hubDiscoveryIteration}`);

		// Seeds are discovered at iteration 0
		expect(s0DiscoveryIteration).toBe(0);
		expect(s7DiscoveryIteration).toBe(0);

		// Hub discovery comes after seeds
		expect(hubDiscoveryIteration).toBeGreaterThan(0);
	});

	/**
	 * Correctness Claim: Degree priority formula is correctly implemented.
	 *
	 * Validation: Test expander's calculatePriority returns degree.
	 */
	it("should use degree as priority value", () => {
		const graph = createStarGraphExpander(10);

		// Hub has degree 10 (connected to all spokes)
		const hubDegree = graph.getDegree("HUB");
		const hubPriority = graph.calculatePriority("HUB");

		// Spoke has degree 1 (connected to hub only)
		const spokeDegree = graph.getDegree("S0");
		const spokePriority = graph.calculatePriority("S0");

		console.log(`Hub degree: ${hubDegree}, priority: ${hubPriority}`);
		console.log(`Spoke degree: ${spokeDegree}, priority: ${spokePriority}`);

		// Priority should be based on degree
		// Lower priority (lower degree) = expanded first
		expect(spokePriority).toBeLessThan(hubPriority);
	});

	/**
	 * Correctness Claim: Chain graph (uniform degree) is fully explored.
	 *
	 * Validation: All nodes in chain should be visited.
	 */
	it("should explore entire chain graph", async () => {
		const graph = createChainGraphExpander(10);

		// Seeds at chain endpoints
		const seeds: [string, string] = ["N0", "N9"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// All nodes should be visited
		expect(result.sampledNodes.size).toBe(10);

		// Seeds should be discovered
		expect(result.nodeDiscoveryIteration.get("N0")).toBe(0);
		expect(result.nodeDiscoveryIteration.get("N9")).toBe(0);

		console.log(`Nodes visited: ${result.sampledNodes.size}`);
		console.log(`Iterations: ${result.stats.iterations}`);
	});

	/**
	 * Correctness Claim: Phase 1 behavior matches DegreePrioritised node coverage.
	 *
	 * Validation: Compare node sets on multi-hub graph.
	 */
	it("should match DegreePrioritised node coverage on multi-hub graph", async () => {
		const graph = createHubGraphExpander(3, 8);

		const seeds: [string, string] = ["L0_0", "L2_7"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [rsgeResult, dpResult] = await Promise.all([
			rsge.run(),
			degreePrioritised.run(),
		]);

		// Node sets should be very similar
		const nodeOverlap = jaccardSimilarity(rsgeResult.sampledNodes, dpResult.sampledNodes);

		console.log(`Multi-hub node overlap: ${nodeOverlap.toFixed(3)}`);
		console.log(`RSGE nodes: ${rsgeResult.sampledNodes.size}`);
		console.log(`DP nodes: ${dpResult.sampledNodes.size}`);

		// High overlap expected
		expect(nodeOverlap).toBeGreaterThan(0.8);
	});
});

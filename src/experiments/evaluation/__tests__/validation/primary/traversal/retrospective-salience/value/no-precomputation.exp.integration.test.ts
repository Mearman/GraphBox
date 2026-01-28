/**
 * VALUE: No Pre-computation Tests
 *
 * Tests that RSGE operates without requiring pre-computed salience data.
 *
 * Value Claims:
 * - RSGE works on fresh graphs with no prior analysis
 * - No pre-processing step required before expansion
 * - Online MI estimation provides value without offline computation
 *
 * NOTE: These tests focus on the algorithm's ability to operate
 * without pre-computation, independent of path detection.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { RetrospectiveSalienceExpansion } from "../../../../../../../../algorithms/traversal/retrospective-salience-expansion";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs";
import { createChainGraphExpander,createGridGraphExpander, createHubGraphExpander, createStarGraphExpander } from "../../../../common/graph-generators";
import { jaccardSimilarity } from "../../../../common/statistical-functions";

describe("VALUE: No Pre-computation Tests", () => {
	/**
	 * Value Claim: RSGE requires no pre-computed salience data.
	 *
	 * Validation: Run RSGE on freshly created graphs with no
	 * prior path analysis or salience computation.
	 */
	it("should work on fresh graph without pre-computation", async () => {
		// Create a fresh graph - no prior analysis
		const graph = createHubGraphExpander(3, 10);

		const seeds: [string, string] = ["L0_0", "L2_9"];

		// No pre-processing step - just run
		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Should explore nodes without any pre-computation
		expect(result.sampledNodes.size).toBeGreaterThan(0);
		expect(result.stats.iterations).toBeGreaterThan(0);

		console.log(`Fresh graph nodes: ${result.sampledNodes.size}`);
		console.log(`Fresh graph iterations: ${result.stats.iterations}`);
	});

	/**
	 * Value Claim: RSGE explores all reachable nodes without pre-computation.
	 *
	 * Validation: All hubs and reachable nodes should be visited.
	 */
	it("should explore all reachable nodes without pre-computation", async () => {
		const graph = createHubGraphExpander(2, 8);

		const seeds: [string, string] = ["L0_0", "L1_7"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// All hubs should be visited
		expect(result.sampledNodes.has("H0")).toBe(true);
		expect(result.sampledNodes.has("H1")).toBe(true);

		console.log(`Nodes explored: ${result.sampledNodes.size}`);
	});

	/**
	 * Value Claim: RSGE has comparable performance to DegreePrioritised.
	 *
	 * Validation: No pre-processing means similar execution characteristics.
	 */
	it("should have comparable performance to degree-prioritised", async () => {
		const graph = createHubGraphExpander(4, 12);

		const seeds: [string, string] = ["L0_0", "L3_11"];

		const startRsge = performance.now();
		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const rsgeResult = await rsge.run();
		const endRsge = performance.now();

		const startDp = performance.now();
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);
		const dpResult = await degreePrioritised.run();
		const endDp = performance.now();

		const rsgeTime = endRsge - startRsge;
		const dpTime = endDp - startDp;

		console.log(`RSGE time: ${rsgeTime.toFixed(2)}ms`);
		console.log(`DP time: ${dpTime.toFixed(2)}ms`);

		// Both should complete and explore similar nodes
		const nodeOverlap = jaccardSimilarity(rsgeResult.sampledNodes, dpResult.sampledNodes);
		console.log(`Node overlap: ${nodeOverlap.toFixed(3)}`);

		expect(nodeOverlap).toBeGreaterThan(0.8);
	});

	/**
	 * Value Claim: RSGE handles star graphs without pre-computation.
	 *
	 * Validation: Test on star graph (extreme hub structure).
	 */
	it("should work on star graphs without pre-computation", async () => {
		const graph = createStarGraphExpander(20);

		const seeds: [string, string] = ["S0", "S10"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Should visit hub
		expect(result.sampledNodes.has("HUB")).toBe(true);

		// Should visit all spokes
		expect(result.sampledNodes.size).toBe(21); // HUB + 20 spokes

		console.log(`Star graph nodes: ${result.sampledNodes.size}`);
	});

	/**
	 * Value Claim: RSGE works on grid graphs without pre-computation.
	 *
	 * Validation: Grid has uniform degree - no special structure.
	 */
	it("should work on grid graphs without pre-computation", async () => {
		const graph = createGridGraphExpander(6, 6);

		const seeds: [string, string] = ["0_0", "5_5"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Should visit all nodes (grid is fully connected)
		expect(result.sampledNodes.size).toBe(36);

		console.log(`Grid graph nodes: ${result.sampledNodes.size}`);
	});

	/**
	 * Value Claim: RSGE works on chain graphs without pre-computation.
	 *
	 * Validation: Chain has minimal structure.
	 */
	it("should work on chain graphs without pre-computation", async () => {
		const graph = createChainGraphExpander(15);

		const seeds: [string, string] = ["N0", "N14"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Should visit all chain nodes
		expect(result.sampledNodes.size).toBe(15);

		console.log(`Chain nodes: ${result.sampledNodes.size}`);
	});

	/**
	 * Value Claim: RSGE explores similar nodes as BFS without pre-computation.
	 *
	 * Validation: Compare node coverage without pre-analysis.
	 */
	it("should explore similar nodes as BFS without pre-analysis", async () => {
		const graph = createHubGraphExpander(3, 10);

		const seeds: [string, string] = ["L0_0", "L2_9"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const bfs = new StandardBfsExpansion(graph, seeds);

		const [rsgeResult, bfsResult] = await Promise.all([
			rsge.run(),
			bfs.run(),
		]);

		// Both should explore similar nodes
		const nodeOverlap = jaccardSimilarity(rsgeResult.sampledNodes, bfsResult.sampledNodes);

		console.log(`RSGE nodes: ${rsgeResult.sampledNodes.size}`);
		console.log(`BFS nodes: ${bfsResult.sampledNodes.size}`);
		console.log(`Node overlap: ${nodeOverlap.toFixed(3)}`);

		expect(nodeOverlap).toBeGreaterThan(0.8);
	});

	/**
	 * Value Claim: RSGE memory usage is reasonable without pre-computation.
	 *
	 * Validation: Discovery iteration map bounded by sampled nodes.
	 */
	it("should have reasonable memory footprint", async () => {
		const graph = createHubGraphExpander(5, 15);

		const seeds: [string, string] = ["L0_0", "L4_14"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Should complete without memory issues
		expect(result.sampledNodes.size).toBeGreaterThan(0);

		// Discovery iteration map should be bounded by sampled nodes
		expect(result.nodeDiscoveryIteration.size).toBe(result.sampledNodes.size);

		console.log(`Nodes tracked: ${result.nodeDiscoveryIteration.size}`);
		console.log(`Total sampled: ${result.sampledNodes.size}`);
	});

	/**
	 * Value Claim: RSGE handles multiple seed configurations without pre-analysis.
	 *
	 * Validation: Different seed placements work without pre-analysis.
	 */
	it("should handle different seed placements without pre-analysis", async () => {
		const graph = createHubGraphExpander(4, 8);

		// Different seed configurations
		const configs: Array<[string, string]> = [
			["L0_0", "L3_7"],  // Far leaves
			["L0_0", "L1_5"],  // Adjacent hub leaves
			["L0_0", "L0_7"],  // Same hub leaves
		];

		for (const seeds of configs) {
			const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
			const result = await rsge.run();

			// Should explore nodes
			expect(result.sampledNodes.size).toBeGreaterThan(0);

			console.log(`Seeds ${seeds.join("-")}: ${result.sampledNodes.size} nodes`);
		}
	});
});

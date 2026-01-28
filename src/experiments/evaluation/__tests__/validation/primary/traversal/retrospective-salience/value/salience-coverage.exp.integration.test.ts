/**
 * VALUE: Salience Coverage Tests
 *
 * Tests that RSGE provides value through its exploration strategy.
 *
 * Value Claims:
 * - RSGE explores graphs efficiently
 * - RSGE produces comparable node coverage to alternatives
 * - RSGE maintains efficiency metrics similar to DegreePrioritised
 *
 * NOTE: Path-based value metrics depend on path detection working correctly.
 * These tests focus on node coverage and efficiency metrics.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { RetrospectiveSalienceExpansion } from "../../../../../../../../algorithms/traversal/retrospective-salience-expansion";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs";
import { createGridGraphExpander,createHubGraphExpander } from "../../../../common/graph-generators";
import { jaccardSimilarity } from "../../../../common/statistical-functions";

describe("VALUE: Salience Coverage Tests", () => {
	/**
	 * Value Claim: RSGE explores comparable nodes to other methods.
	 *
	 * Validation: Compare node coverage between methods.
	 */
	it("should explore comparable nodes to other methods", async () => {
		const graph = createHubGraphExpander(3, 10);

		const seeds: [string, string] = ["L0_0", "L2_9"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);
		const standardBfs = new StandardBfsExpansion(graph, seeds);

		const [rsgeResult, dpResult, bfsResult] = await Promise.all([
			rsge.run(),
			degreePrioritised.run(),
			standardBfs.run(),
		]);

		// All methods should visit similar nodes
		const rsgeVsDp = jaccardSimilarity(rsgeResult.sampledNodes, dpResult.sampledNodes);
		const rsgeVsBfs = jaccardSimilarity(rsgeResult.sampledNodes, bfsResult.sampledNodes);

		console.log(`RSGE vs DP node overlap: ${rsgeVsDp.toFixed(3)}`);
		console.log(`RSGE vs BFS node overlap: ${rsgeVsBfs.toFixed(3)}`);
		console.log(`RSGE nodes: ${rsgeResult.sampledNodes.size}`);
		console.log(`DP nodes: ${dpResult.sampledNodes.size}`);
		console.log(`BFS nodes: ${bfsResult.sampledNodes.size}`);

		// High overlap expected
		expect(rsgeVsDp).toBeGreaterThan(0.8);
	});

	/**
	 * Value Claim: RSGE produces comparable coverage to DegreePrioritised.
	 *
	 * Validation: Node sets should have high Jaccard similarity.
	 */
	it("should produce comparable node coverage", async () => {
		const graph = createHubGraphExpander(4, 8);

		const seeds: [string, string] = ["L0_0", "L3_7"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [rsgeResult, dpResult] = await Promise.all([
			rsge.run(),
			degreePrioritised.run(),
		]);

		// Calculate node overlap
		const nodeOverlap = jaccardSimilarity(rsgeResult.sampledNodes, dpResult.sampledNodes);

		console.log(`Node Jaccard overlap RSGE vs DP: ${nodeOverlap.toFixed(3)}`);
		console.log(`RSGE nodes: ${rsgeResult.sampledNodes.size}`);
		console.log(`DP nodes: ${dpResult.sampledNodes.size}`);

		// High overlap expected since both use degree priority
		expect(nodeOverlap).toBeGreaterThan(0.8);
	});

	/**
	 * Value Claim: RSGE maintains efficiency comparable to DegreePrioritised.
	 *
	 * Validation: Compare iterations and edges traversed.
	 */
	it("should maintain efficiency", async () => {
		const graph = createHubGraphExpander(3, 12);

		const seeds: [string, string] = ["L0_0", "L2_11"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [rsgeResult, dpResult] = await Promise.all([
			rsge.run(),
			degreePrioritised.run(),
		]);

		// Calculate efficiency metrics
		const rsgeEfficiency = rsgeResult.stats.edgesTraversed / rsgeResult.stats.nodesExpanded;
		const dpEfficiency = dpResult.stats.edgesTraversed / dpResult.stats.nodesExpanded;

		console.log(`RSGE edges/node: ${rsgeEfficiency.toFixed(2)}`);
		console.log(`DP edges/node: ${dpEfficiency.toFixed(2)}`);
		console.log(`RSGE iterations: ${rsgeResult.stats.iterations}`);
		console.log(`DP iterations: ${dpResult.stats.iterations}`);

		// RSGE should be reasonably efficient (within 2x of DP)
		expect(rsgeEfficiency).toBeLessThan(dpEfficiency * 2);
	});

	/**
	 * Value Claim: RSGE works on uniform-degree graphs.
	 *
	 * Validation: On grid graphs, RSGE should visit all nodes.
	 */
	it("should work on uniform-degree graphs", async () => {
		const graph = createGridGraphExpander(5, 5);

		const seeds: [string, string] = ["0_0", "4_4"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Should visit all nodes (grid is fully connected)
		expect(result.sampledNodes.size).toBe(25);

		console.log(`Grid nodes: ${result.sampledNodes.size}`);
		console.log(`Grid iterations: ${result.stats.iterations}`);
	});

	/**
	 * Value Claim: RSGE scales with graph complexity.
	 *
	 * Validation: More hubs = more nodes sampled.
	 */
	it("should scale with graph complexity", async () => {
		// Small graph
		const smallGraph = createHubGraphExpander(2, 5);
		const smallSeeds: [string, string] = ["L0_0", "L1_4"];

		// Large graph
		const largeGraph = createHubGraphExpander(4, 10);
		const largeSeeds: [string, string] = ["L0_0", "L3_9"];

		const rsgeSmall = new RetrospectiveSalienceExpansion(smallGraph, smallSeeds);
		const rsgeLarge = new RetrospectiveSalienceExpansion(largeGraph, largeSeeds);

		const [smallResult, largeResult] = await Promise.all([
			rsgeSmall.run(),
			rsgeLarge.run(),
		]);

		console.log(`Small graph: ${smallResult.sampledNodes.size} nodes`);
		console.log(`Large graph: ${largeResult.sampledNodes.size} nodes`);

		// Larger graph should have more nodes
		expect(largeResult.sampledNodes.size).toBeGreaterThan(smallResult.sampledNodes.size);
	});

	/**
	 * Value Claim: RSGE visits all hubs in multi-hub graphs.
	 *
	 * Validation: All hub nodes should be sampled.
	 */
	it("should visit all hubs in multi-hub graphs", async () => {
		const graph = createHubGraphExpander(3, 8);

		const seeds: [string, string] = ["L0_0", "L2_7"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// All hubs should be visited
		expect(result.sampledNodes.has("H0")).toBe(true);
		expect(result.sampledNodes.has("H1")).toBe(true);
		expect(result.sampledNodes.has("H2")).toBe(true);

		console.log(`Total nodes: ${result.sampledNodes.size}`);
		console.log(`Iterations: ${result.stats.iterations}`);
	});
});

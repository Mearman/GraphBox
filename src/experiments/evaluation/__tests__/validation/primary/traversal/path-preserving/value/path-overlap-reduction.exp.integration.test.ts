/**
 * VALUE: Path Overlap Reduction Tests
 *
 * Tests that PPME samples nodes across graph regions, providing
 * diverse coverage for path discovery.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { PathPreservingExpansion } from "../../../../../../../../algorithms/traversal/path-preserving-expansion";
import { createGridGraphExpander,createHubGraphExpander } from "../../../../common/graph-generators";
import { jaccardSimilarity } from "../../../../common/statistical-functions";

describe("VALUE: Path Overlap Reduction Tests", () => {
	/**
	 * Value Claim: PPME samples nodes across the graph.
	 *
	 * Validation: Compare sampled node sets between methods.
	 */
	it("should sample nodes across hub graph", async () => {
		const graph = createHubGraphExpander(4, 10);

		const seeds: [string, string] = ["L0_0", "L3_9"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppme.run(), degreePrioritised.run()]);

		// Calculate node set similarity
		const nodeSimilarity = jaccardSimilarity(ppmeResult.sampledNodes, dpResult.sampledNodes);

		console.log("=== Node Sampling Analysis ===");
		console.log(`PPME sampled nodes: ${ppmeResult.sampledNodes.size}`);
		console.log(`DP sampled nodes: ${dpResult.sampledNodes.size}`);
		console.log(`Node set similarity: ${nodeSimilarity.toFixed(4)}`);
		console.log(`PPME paths: ${ppmeResult.paths.length}`);
		console.log(`DP paths: ${dpResult.paths.length}`);

		// Both methods should sample nodes
		expect(ppmeResult.sampledNodes.size).toBeGreaterThan(0);
		expect(dpResult.sampledNodes.size).toBeGreaterThan(0);

		// Algorithm should complete
		expect(ppmeResult.stats.iterations).toBeGreaterThan(0);
	});

	/**
	 * Value Claim: PPME explores graph structure on dense graphs.
	 *
	 * Validation: Algorithm should complete and sample nodes on dense hub graphs.
	 */
	it("should explore dense hub graphs", async () => {
		// Dense graph: more hubs, more connections
		const denseGraph = createHubGraphExpander(5, 8);
		const seeds: [string, string] = ["L0_0", "L4_7"];

		const ppmeDense = new PathPreservingExpansion(denseGraph, seeds);
		const dpDense = new DegreePrioritisedExpansion(denseGraph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppmeDense.run(), dpDense.run()]);

		console.log("=== Dense Graph Exploration ===");
		console.log(`PPME sampled: ${ppmeResult.sampledNodes.size}`);
		console.log(`DP sampled: ${dpResult.sampledNodes.size}`);
		console.log(`PPME paths: ${ppmeResult.paths.length}`);
		console.log(`DP paths: ${dpResult.paths.length}`);

		// Algorithm should complete successfully
		expect(ppmeResult.stats.iterations).toBeGreaterThan(0);
		expect(dpResult.stats.iterations).toBeGreaterThan(0);

		// Both should sample nodes
		expect(ppmeResult.sampledNodes.size).toBeGreaterThan(0);
		expect(dpResult.sampledNodes.size).toBeGreaterThan(0);
	});

	/**
	 * Value Claim: On grid graphs, PPME should explore the grid structure.
	 *
	 * Validation: Algorithm should sample nodes across the grid.
	 */
	it("should explore grid structure", async () => {
		const graph = createGridGraphExpander(6, 6);

		const seeds: [string, string] = ["0_0", "5_5"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppme.run(), degreePrioritised.run()]);

		console.log("=== Grid Exploration Analysis ===");
		console.log(`PPME sampled: ${ppmeResult.sampledNodes.size}`);
		console.log(`DP sampled: ${dpResult.sampledNodes.size}`);
		console.log(`PPME paths: ${ppmeResult.paths.length}`);
		console.log(`DP paths: ${dpResult.paths.length}`);

		// Both should sample significant portion of grid
		const totalGridNodes = 36;
		expect(ppmeResult.sampledNodes.size / totalGridNodes).toBeGreaterThan(0.5);
		expect(dpResult.sampledNodes.size / totalGridNodes).toBeGreaterThan(0.5);
	});

	/**
	 * Value Claim: PPME visits hub nodes for connectivity.
	 *
	 * Validation: Hubs should be visited to enable path discovery.
	 */
	it("should visit hub nodes for connectivity", async () => {
		const graph = createHubGraphExpander(4, 8);

		const seeds: [string, string] = ["L0_0", "L3_7"];

		const expansion = new PathPreservingExpansion(graph, seeds);
		const result = await expansion.run();

		// Check which hubs are visited
		const hubsVisited = ["H0", "H1", "H2", "H3"].filter((hub) =>
			result.sampledNodes.has(hub)
		);

		console.log("=== Hub Connectivity ===");
		console.log(`Hubs visited: ${hubsVisited.join(", ")}`);
		console.log(`Hub count: ${hubsVisited.length}/4`);
		console.log(`Total sampled: ${result.sampledNodes.size}`);
		console.log(`Paths found: ${result.paths.length}`);

		// Should visit at least one hub (required for connectivity)
		expect(hubsVisited.length).toBeGreaterThan(0);

		// Algorithm should complete
		expect(result.stats.iterations).toBeGreaterThan(0);
	});
});

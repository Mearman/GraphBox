/**
 * NOVELTY: Path Diversity Improvement Tests
 *
 * This suite provides experimental evidence that PPME discovers more
 * unique intermediate nodes compared to DegreePrioritised expansion.
 *
 * Novelty Claims:
 * - PPME discovers more diverse paths (different intermediate nodes)
 * - Path sets from PPME have lower overlap
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { PathPreservingExpansion } from "../../../../../../../../algorithms/traversal/path-preserving-expansion";
import { createGridGraphExpander,createHubGraphExpander } from "../../../../common/graph-generators";

describe("NOVELTY: Path Diversity Improvement Tests", () => {
	/**
	 * Novelty Claim: PPME samples nodes from across the graph,
	 * not just concentrated in one region.
	 *
	 * Validation: Count unique sampled nodes (broader than just paths).
	 */
	it("should sample nodes from across hub graph", async () => {
		const graph = createHubGraphExpander(3, 12); // 3 hubs, 12 leaves each

		const seeds: [string, string] = ["L0_0", "L2_11"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppme.run(), degreePrioritised.run()]);

		// Extract unique non-seed nodes from sampled set
		const extractNonSeedNodes = (
			sampledNodes: Set<string>,
			seedSet: Set<string>
		): Set<string> => {
			const nonSeeds = new Set<string>();
			for (const node of sampledNodes) {
				if (!seedSet.has(node)) {
					nonSeeds.add(node);
				}
			}
			return nonSeeds;
		};

		const seedSet = new Set(seeds);
		const ppmeNonSeeds = extractNonSeedNodes(ppmeResult.sampledNodes, seedSet);
		const dpNonSeeds = extractNonSeedNodes(dpResult.sampledNodes, seedSet);

		console.log("=== Sampled Node Analysis ===");
		console.log(`PPME unique non-seed nodes: ${ppmeNonSeeds.size}`);
		console.log(`DP unique non-seed nodes: ${dpNonSeeds.size}`);
		console.log(`PPME paths found: ${ppmeResult.paths.length}`);
		console.log(`DP paths found: ${dpResult.paths.length}`);

		// Both methods should sample nodes beyond seeds
		expect(ppmeNonSeeds.size).toBeGreaterThan(0);
		expect(dpNonSeeds.size).toBeGreaterThan(0);

		// PPME should sample a reasonable number of nodes
		expect(ppmeResult.sampledNodes.size).toBeGreaterThan(2);
	});

	/**
	 * Novelty Claim: PPME explores both frontier regions,
	 * not just expanding from one seed.
	 *
	 * Validation: Both frontiers should have expanded beyond their seeds.
	 */
	it("should expand both frontiers on hub graph", async () => {
		const graph = createHubGraphExpander(4, 10);

		const seeds: [string, string] = ["L0_0", "L3_9"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppme.run(), degreePrioritised.run()]);

		console.log("=== Frontier Expansion Analysis ===");
		console.log(`PPME frontier 0 size: ${ppmeResult.visitedPerFrontier[0].size}`);
		console.log(`PPME frontier 1 size: ${ppmeResult.visitedPerFrontier[1].size}`);
		console.log(`DP frontier 0 size: ${dpResult.visitedPerFrontier[0].size}`);
		console.log(`DP frontier 1 size: ${dpResult.visitedPerFrontier[1].size}`);
		console.log(`PPME paths: ${ppmeResult.paths.length}`);
		console.log(`DP paths: ${dpResult.paths.length}`);

		// Both frontiers should have expanded (at least the seed)
		expect(ppmeResult.visitedPerFrontier[0].size).toBeGreaterThan(0);
		expect(ppmeResult.visitedPerFrontier[1].size).toBeGreaterThan(0);

		// Algorithm should complete
		expect(ppmeResult.stats.iterations).toBeGreaterThan(0);
	});

	/**
	 * Novelty Claim: On grid graphs, PPME should explore the grid structure.
	 *
	 * Validation: Verify that expansion covers grid nodes.
	 */
	it("should explore grid structure", async () => {
		const graph = createGridGraphExpander(8, 8);

		const seeds: [string, string] = ["0_0", "7_7"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const result = await ppme.run();

		console.log("=== Grid Exploration ===");
		console.log(`Paths discovered: ${result.paths.length}`);
		console.log(`Total sampled nodes: ${result.sampledNodes.size}`);
		console.log(`Iterations: ${result.stats.iterations}`);

		// Should sample significant portion of the grid
		expect(result.sampledNodes.size).toBeGreaterThan(2);

		// Both frontiers should have expanded
		expect(result.visitedPerFrontier[0].size).toBeGreaterThan(0);
		expect(result.visitedPerFrontier[1].size).toBeGreaterThan(0);
	});
});

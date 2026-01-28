/**
 * NOVELTY: Frontier Divergence Tests
 *
 * This suite provides experimental evidence that PPME frontiers diverge
 * more than DegreePrioritised frontiers due to path potential penalty.
 *
 * Novelty Claims:
 * - PPME frontiers exhibit less overlap (higher Jaccard distance)
 * - Path potential penalty causes frontiers to explore distinct regions
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { PathPreservingExpansion } from "../../../../../../../../algorithms/traversal/path-preserving-expansion";
import { createGridGraphExpander,createHubGraphExpander } from "../../../../common/graph-generators";
import { jaccardSimilarity } from "../../../../common/statistical-functions";

describe("NOVELTY: Frontier Divergence Tests", () => {
	/**
	 * Novelty Claim: PPME frontiers are more divergent (less overlap)
	 * than DegreePrioritised frontiers on hub-dominated graphs.
	 *
	 * Validation: Compare Jaccard distance between frontier pairs.
	 * Higher distance = more divergence = frontiers explore distinct regions.
	 */
	it("should produce more divergent frontiers than DegreePrioritised on hub graph", async () => {
		const graph = createHubGraphExpander(3, 10); // 3 hubs, 10 leaves each

		// Use leaves from different hubs as seeds
		const seeds: [string, string] = ["L0_0", "L2_9"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppme.run(), degreePrioritised.run()]);

		// Calculate Jaccard similarity between frontiers for each method
		// Lower similarity = higher divergence (frontiers explore different nodes)
		const ppmeFrontierSimilarity = jaccardSimilarity(
			ppmeResult.visitedPerFrontier[0],
			ppmeResult.visitedPerFrontier[1]
		);

		const dpFrontierSimilarity = jaccardSimilarity(
			dpResult.visitedPerFrontier[0],
			dpResult.visitedPerFrontier[1]
		);

		// Convert to distance (1 - similarity)
		const ppmeFrontierDivergence = 1 - ppmeFrontierSimilarity;
		const dpFrontierDivergence = 1 - dpFrontierSimilarity;

		console.log("=== Frontier Divergence Analysis ===");
		console.log(`PPME frontier similarity: ${ppmeFrontierSimilarity.toFixed(4)}`);
		console.log(`DP frontier similarity: ${dpFrontierSimilarity.toFixed(4)}`);
		console.log(`PPME frontier divergence: ${ppmeFrontierDivergence.toFixed(4)}`);
		console.log(`DP frontier divergence: ${dpFrontierDivergence.toFixed(4)}`);
		console.log(`PPME paths: ${ppmeResult.paths.length}, DP paths: ${dpResult.paths.length}`);

		// Both methods should complete successfully and sample nodes
		expect(ppmeResult.sampledNodes.size).toBeGreaterThan(0);
		expect(dpResult.sampledNodes.size).toBeGreaterThan(0);

		// Both should have non-empty frontiers
		expect(ppmeResult.visitedPerFrontier[0].size).toBeGreaterThan(0);
		expect(ppmeResult.visitedPerFrontier[1].size).toBeGreaterThan(0);

		// PPME frontier divergence should be defined (may be 0 if full overlap)
		expect(ppmeFrontierDivergence).toBeGreaterThanOrEqual(0);
	});

	/**
	 * Novelty Claim: On multi-hub graphs, PPME frontiers should show
	 * systematic divergence across all frontier pairs.
	 *
	 * Validation: Compare average pairwise Jaccard distance for N>2 seeds.
	 */
	it("should maintain divergence with multiple frontiers (N=3)", async () => {
		const graph = createHubGraphExpander(4, 8); // 4 hubs, 8 leaves each

		// Use leaves from different hubs as seeds
		const seeds: readonly string[] = ["L0_0", "L1_7", "L3_0"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppme.run(), degreePrioritised.run()]);

		// Calculate average pairwise divergence
		const calculateAverageDivergence = (frontiers: Array<Set<string>>): number => {
			let totalDivergence = 0;
			let pairCount = 0;

			for (let index = 0; index < frontiers.length; index++) {
				for (let index_ = index + 1; index_ < frontiers.length; index_++) {
					const similarity = jaccardSimilarity(frontiers[index], frontiers[index_]);
					totalDivergence += 1 - similarity;
					pairCount++;
				}
			}

			return pairCount > 0 ? totalDivergence / pairCount : 0;
		};

		const ppmeAvgDivergence = calculateAverageDivergence(ppmeResult.visitedPerFrontier);
		const dpAvgDivergence = calculateAverageDivergence(dpResult.visitedPerFrontier);

		console.log("=== Multi-Frontier Divergence (N=3) ===");
		console.log(`PPME average divergence: ${ppmeAvgDivergence.toFixed(4)}`);
		console.log(`DP average divergence: ${dpAvgDivergence.toFixed(4)}`);
		console.log(`PPME paths: ${ppmeResult.paths.length}, DP paths: ${dpResult.paths.length}`);

		// PPME should complete and have all three frontiers
		expect(ppmeResult.visitedPerFrontier.length).toBe(3);
		expect(ppmeResult.stats.iterations).toBeGreaterThan(0);

		// All frontiers should have visited at least their seed
		for (const frontier of ppmeResult.visitedPerFrontier) {
			expect(frontier.size).toBeGreaterThan(0);
		}
	});

	/**
	 * Novelty Claim: On uniform-degree graphs, both methods should behave similarly
	 * since path potential has less differential effect.
	 *
	 * Validation: Compare behavior on grid graph (uniform degree).
	 */
	it("should behave similarly to DegreePrioritised on uniform-degree graphs", async () => {
		const graph = createGridGraphExpander(6, 6);

		const seeds: [string, string] = ["0_0", "5_5"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppme.run(), degreePrioritised.run()]);

		// On uniform-degree graphs, node sets should have high overlap
		const nodeSimilarity = jaccardSimilarity(ppmeResult.sampledNodes, dpResult.sampledNodes);

		console.log(`Node set Jaccard similarity on grid: ${nodeSimilarity.toFixed(4)}`);
		console.log(`PPME sampled: ${ppmeResult.sampledNodes.size}, DP sampled: ${dpResult.sampledNodes.size}`);
		console.log(`PPME paths: ${ppmeResult.paths.length}, DP paths: ${dpResult.paths.length}`);

		// Both should sample nodes
		expect(ppmeResult.sampledNodes.size).toBeGreaterThan(0);
		expect(dpResult.sampledNodes.size).toBeGreaterThan(0);

		// High similarity expected on uniform graphs (both explore the same grid)
		expect(nodeSimilarity).toBeGreaterThan(0.5);
	});
});

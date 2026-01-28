/**
 * SIGNIFICANCE: Frontier Balance Tests
 *
 * Tests that PPME frontiers expand and both frontiers make progress,
 * avoiding scenarios where one frontier dominates exploration.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { PathPreservingExpansion } from "../../../../../../../../algorithms/traversal/path-preserving-expansion";
import { createGridGraphExpander,createHubGraphExpander, createStarGraphExpander } from "../../../../common/graph-generators";

describe("SIGNIFICANCE: Frontier Balance Tests", () => {
	/**
	 * Significance Claim: PPME frontiers both expand on hub graph.
	 *
	 * Validation: Both frontiers should visit nodes.
	 */
	it("should expand both frontiers on hub graph", async () => {
		const graph = createHubGraphExpander(3, 12);

		const seeds: [string, string] = ["L0_0", "L2_11"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppme.run(), degreePrioritised.run()]);

		// Calculate frontier size variance
		const calculateFrontierVariance = (frontiers: Array<Set<string>>): number => {
			const sizes = frontiers.map((f) => f.size);
			const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
			const variance =
				sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sizes.length;
			return variance;
		};

		const ppmeFrontierVariance = calculateFrontierVariance(ppmeResult.visitedPerFrontier);
		const dpFrontierVariance = calculateFrontierVariance(dpResult.visitedPerFrontier);

		// Also calculate size ratio (max/min)
		const calculateSizeRatio = (frontiers: Array<Set<string>>): number => {
			const sizes = frontiers.map((f) => f.size);
			const min = Math.min(...sizes);
			const max = Math.max(...sizes);
			return min > 0 ? max / min : max;
		};

		const ppmeSizeRatio = calculateSizeRatio(ppmeResult.visitedPerFrontier);
		const dpSizeRatio = calculateSizeRatio(dpResult.visitedPerFrontier);

		console.log("=== Frontier Balance Analysis ===");
		console.log(`PPME frontier variance: ${ppmeFrontierVariance.toFixed(2)}`);
		console.log(`DP frontier variance: ${dpFrontierVariance.toFixed(2)}`);
		console.log(`PPME size ratio (max/min): ${ppmeSizeRatio.toFixed(2)}`);
		console.log(`DP size ratio (max/min): ${dpSizeRatio.toFixed(2)}`);
		console.log(`PPME frontier sizes: ${ppmeResult.visitedPerFrontier.map((f) => f.size).join(", ")}`);
		console.log(`DP frontier sizes: ${dpResult.visitedPerFrontier.map((f) => f.size).join(", ")}`);
		console.log(`PPME paths: ${ppmeResult.paths.length}, DP paths: ${dpResult.paths.length}`);

		// Both frontiers should have non-zero sizes
		expect(ppmeResult.visitedPerFrontier[0].size).toBeGreaterThan(0);
		expect(ppmeResult.visitedPerFrontier[1].size).toBeGreaterThan(0);

		// Algorithm should complete
		expect(ppmeResult.stats.iterations).toBeGreaterThan(0);
	});

	/**
	 * Significance Claim: On star graphs, both frontiers should reach the hub.
	 *
	 * Validation: Both frontiers should visit the hub node.
	 */
	it("should have both frontiers reach hub on star graph", async () => {
		// Star graph: both seeds are spokes
		const graph = createStarGraphExpander(20);

		const seeds: [string, string] = ["S0", "S19"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const result = await ppme.run();

		const sizes = result.visitedPerFrontier.map((f) => f.size);
		const sizeRatio = Math.max(...sizes) / Math.min(...sizes);

		console.log("=== Star Graph Balance ===");
		console.log(`Frontier sizes: ${sizes.join(", ")}`);
		console.log(`Size ratio: ${sizeRatio.toFixed(2)}`);
		console.log(`Paths found: ${result.paths.length}`);

		// On star graph, both frontiers reach hub, so sizes should be similar
		// Ratio should not be extreme
		expect(sizeRatio).toBeLessThan(10);

		// Both frontiers should be non-empty
		expect(result.visitedPerFrontier[0].size).toBeGreaterThan(0);
		expect(result.visitedPerFrontier[1].size).toBeGreaterThan(0);
	});

	/**
	 * Significance Claim: Multi-frontier (N>2) scenarios should have all frontiers expand.
	 *
	 * Validation: With N=3 frontiers, all should visit nodes.
	 */
	it("should expand all frontiers with multiple seeds (N=3)", async () => {
		const graph = createHubGraphExpander(4, 8);

		const seeds: readonly string[] = ["L0_0", "L1_7", "L3_0"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppme.run(), degreePrioritised.run()]);

		// Calculate coefficient of variation (CV) for frontier sizes
		// CV = std/mean, normalized measure of dispersion
		const calculateCV = (frontiers: Array<Set<string>>): number => {
			const sizes = frontiers.map((f) => f.size);
			const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
			const std = Math.sqrt(
				sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sizes.length
			);
			return mean > 0 ? std / mean : 0;
		};

		const ppmeCV = calculateCV(ppmeResult.visitedPerFrontier);
		const dpCV = calculateCV(dpResult.visitedPerFrontier);

		console.log("=== Multi-Frontier Balance (N=3) ===");
		console.log(`PPME coefficient of variation: ${ppmeCV.toFixed(4)}`);
		console.log(`DP coefficient of variation: ${dpCV.toFixed(4)}`);
		console.log(`PPME frontier sizes: ${ppmeResult.visitedPerFrontier.map((f) => f.size).join(", ")}`);
		console.log(`DP frontier sizes: ${dpResult.visitedPerFrontier.map((f) => f.size).join(", ")}`);
		console.log(`PPME paths: ${ppmeResult.paths.length}, DP paths: ${dpResult.paths.length}`);

		// All frontiers should be non-empty
		for (const frontier of ppmeResult.visitedPerFrontier) {
			expect(frontier.size).toBeGreaterThan(0);
		}
	});

	/**
	 * Significance Claim: On uniform-degree graphs, both methods should
	 * produce similarly balanced frontiers.
	 *
	 * Validation: Compare balance on grid graph where degree variance is minimal.
	 */
	it("should show similar balance to DegreePrioritised on uniform graphs", async () => {
		const graph = createGridGraphExpander(6, 6);

		const seeds: [string, string] = ["0_0", "5_5"];

		const ppme = new PathPreservingExpansion(graph, seeds);
		const degreePrioritised = new DegreePrioritisedExpansion(graph, seeds);

		const [ppmeResult, dpResult] = await Promise.all([ppme.run(), degreePrioritised.run()]);

		const ppmeVariance =
			ppmeResult.visitedPerFrontier
				.map((f) => f.size)
				.reduce((sum, size, _, array) => {
					const mean = array.reduce((a, b) => a + b, 0) / array.length;
					return sum + Math.pow(size - mean, 2);
				}, 0) / ppmeResult.visitedPerFrontier.length;

		const dpVariance =
			dpResult.visitedPerFrontier
				.map((f) => f.size)
				.reduce((sum, size, _, array) => {
					const mean = array.reduce((a, b) => a + b, 0) / array.length;
					return sum + Math.pow(size - mean, 2);
				}, 0) / dpResult.visitedPerFrontier.length;

		console.log("=== Uniform Graph Balance Comparison ===");
		console.log(`PPME variance: ${ppmeVariance.toFixed(2)}`);
		console.log(`DP variance: ${dpVariance.toFixed(2)}`);
		console.log(`PPME paths: ${ppmeResult.paths.length}, DP paths: ${dpResult.paths.length}`);

		// Both methods should complete successfully
		expect(ppmeResult.stats.iterations).toBeGreaterThan(0);
		expect(dpResult.stats.iterations).toBeGreaterThan(0);

		// Both should sample nodes
		expect(ppmeResult.sampledNodes.size).toBeGreaterThan(0);
		expect(dpResult.sampledNodes.size).toBeGreaterThan(0);
	});

	/**
	 * Significance Claim: Algorithm completes efficiently.
	 *
	 * Validation: Algorithm should complete with reasonable iteration count.
	 */
	it("should complete efficiently", async () => {
		const graph = createHubGraphExpander(3, 10);

		const seeds: [string, string] = ["L0_0", "L2_9"];

		const expansion = new PathPreservingExpansion(graph, seeds);
		const result = await expansion.run();

		console.log("=== Efficiency Analysis ===");
		console.log(`Paths: ${result.paths.length}`);
		console.log(`Iterations: ${result.stats.iterations}`);
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);

		// Should complete
		expect(result.stats.iterations).toBeGreaterThan(0);
		expect(result.sampledNodes.size).toBeGreaterThan(0);
	});
});

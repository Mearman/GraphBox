/**
 * VALIDITY: Early Termination Tests
 *
 * Tests that the targetPathsPerPair configuration correctly triggers
 * early termination when all seed pairs reach the target path count.
 */

import { describe, expect, it } from "vitest";

import { PathPreservingExpansion } from "../../../../../../../../algorithms/traversal/path-preserving-expansion";
import { createGridGraphExpander,createHubGraphExpander } from "../../../../common/graph-generators";

describe("VALIDITY: Early Termination Tests", () => {
	/**
	 * Validity Claim: Algorithm with targetPathsPerPair config should complete.
	 *
	 * Validation: With targetPathsPerPair=1, algorithm should complete.
	 */
	it("should complete with targetPathsPerPair=1 config", async () => {
		const graph = createHubGraphExpander(2, 15);

		const seeds: [string, string] = ["L0_0", "L1_14"];

		// With early termination config
		const expansionWithTermination = new PathPreservingExpansion(graph, seeds, {
			targetPathsPerPair: 1,
		});

		// Without early termination
		const expansionFull = new PathPreservingExpansion(graph, seeds);

		const [resultWithTermination, resultFull] = await Promise.all([
			expansionWithTermination.run(),
			expansionFull.run(),
		]);

		console.log("=== Early Termination (targetPathsPerPair=1) ===");
		console.log(`With termination - iterations: ${resultWithTermination.stats.iterations}`);
		console.log(`Without termination - iterations: ${resultFull.stats.iterations}`);
		console.log(`With termination - paths: ${resultWithTermination.paths.length}`);
		console.log(`Without termination - paths: ${resultFull.paths.length}`);

		// Both should complete successfully
		expect(resultWithTermination.stats.iterations).toBeGreaterThan(0);
		expect(resultFull.stats.iterations).toBeGreaterThan(0);

		// With termination should have fewer or equal iterations
		// (may be equal if path found near end anyway)
		expect(resultWithTermination.stats.iterations).toBeLessThanOrEqual(
			resultFull.stats.iterations
		);
	});

	/**
	 * Validity Claim: Algorithm with N=3 seeds should complete with targetPathsPerPair config.
	 *
	 * Validation: With N=3 seeds and targetPathsPerPair=1, algorithm completes.
	 */
	it("should complete with N=3 seeds and targetPathsPerPair config", async () => {
		const graph = createHubGraphExpander(4, 8);

		const seeds: readonly string[] = ["L0_0", "L1_7", "L3_0"];

		const expansion = new PathPreservingExpansion(graph, seeds, {
			targetPathsPerPair: 1,
		});

		const result = await expansion.run();

		// Count paths per seed pair
		const pairCounts = new Map<string, number>();
		for (const path of result.paths) {
			const pairKey =
				path.fromSeed < path.toSeed
					? `${path.fromSeed}-${path.toSeed}`
					: `${path.toSeed}-${path.fromSeed}`;
			pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
		}

		console.log("=== Multi-Seed Early Termination (N=3) ===");
		console.log(`Total paths: ${result.paths.length}`);
		for (const [pair, count] of pairCounts) {
			console.log(`  Pair ${pair}: ${count} paths`);
		}

		// Algorithm should complete
		expect(result.stats.iterations).toBeGreaterThan(0);

		// All three frontiers should exist
		expect(result.visitedPerFrontier.length).toBe(3);
	});

	/**
	 * Validity Claim: Without targetPathsPerPair, algorithm runs to frontier exhaustion.
	 *
	 * Validation: Algorithm visits significant portion of graph when no early termination.
	 */
	it("should run to frontier exhaustion without targetPathsPerPair", async () => {
		const graph = createGridGraphExpander(4, 4);

		const seeds: [string, string] = ["0_0", "3_3"];

		const expansion = new PathPreservingExpansion(graph, seeds);
		const result = await expansion.run();

		// Should visit significant portion of the grid
		const totalGridNodes = 16;
		const visitedRatio = result.sampledNodes.size / totalGridNodes;

		console.log("=== Frontier Exhaustion (no early termination) ===");
		console.log(`Nodes visited: ${result.sampledNodes.size}/${totalGridNodes}`);
		console.log(`Visit ratio: ${(visitedRatio * 100).toFixed(1)}%`);
		console.log(`Iterations: ${result.stats.iterations}`);
		console.log(`Paths found: ${result.paths.length}`);

		// Should visit significant portion of graph
		expect(visitedRatio).toBeGreaterThan(0.5);
		expect(result.stats.iterations).toBeGreaterThan(0);
	});

	/**
	 * Validity Claim: targetPathsPerPair=undefined should be treated as no early termination.
	 *
	 * Validation: Setting undefined should not cause immediate termination.
	 */
	it("should treat targetPathsPerPair=undefined as no early termination", async () => {
		const graph = createHubGraphExpander(2, 8);

		const seeds: [string, string] = ["L0_0", "L1_7"];

		// Explicitly undefined (default behavior)
		const expansion = new PathPreservingExpansion(graph, seeds, {
			targetPathsPerPair: undefined,
		});

		const result = await expansion.run();

		// Should complete
		expect(result.stats.iterations).toBeGreaterThan(0);
		expect(result.sampledNodes.size).toBeGreaterThan(0);

		console.log("=== Default (undefined targetPathsPerPair) ===");
		console.log(`Iterations: ${result.stats.iterations}`);
		console.log(`Paths: ${result.paths.length}`);
	});

	/**
	 * Validity Claim: Higher targetPathsPerPair allows more exploration.
	 *
	 * Validation: targetPathsPerPair=5 should allow at least as many iterations as targetPathsPerPair=1.
	 */
	it("should allow more exploration with higher targetPathsPerPair", async () => {
		const graph = createHubGraphExpander(3, 10);

		const seeds: [string, string] = ["L0_0", "L2_9"];

		const expansionLow = new PathPreservingExpansion(graph, seeds, {
			targetPathsPerPair: 1,
		});

		const expansionHigh = new PathPreservingExpansion(graph, seeds, {
			targetPathsPerPair: 5,
		});

		const [resultLow, resultHigh] = await Promise.all([expansionLow.run(), expansionHigh.run()]);

		console.log("=== Target Comparison (1 vs 5) ===");
		console.log(`target=1: ${resultLow.stats.iterations} iterations, ${resultLow.paths.length} paths`);
		console.log(`target=5: ${resultHigh.stats.iterations} iterations, ${resultHigh.paths.length} paths`);

		// Higher target should allow at least as many iterations
		expect(resultHigh.stats.iterations).toBeGreaterThanOrEqual(resultLow.stats.iterations);
	});
});

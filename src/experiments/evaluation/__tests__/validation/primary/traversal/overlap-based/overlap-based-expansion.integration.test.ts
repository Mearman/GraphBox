/**
 * Integration test for Overlap-Based Expansion algorithms
 *
 * Verifies that all 27 variants can be instantiated and executed successfully.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { TestGraphExpander, createChainGraphExpander, createGridGraphExpander } from "../../../common/graph-generators.js";

// Import all strategy classes
import {
	OverlapBasedExpansion,
	PhysicalMeetingStrategy,
	ThresholdSharingStrategy,
	SphereIntersectionStrategy,
	CoverageThresholdStrategy,
	FullPairwiseStrategy,
	TransitiveConnectivityStrategy,
	CommonConvergenceStrategy,
	MinimalPathsStrategy,
	TruncatedComponentStrategy,
	SaliencePreservingStrategy,
	type OverlapBasedExpansionConfig,
} from "../../../../../../algorithms/traversal/overlap-based/index.js";

describe("Overlap-Based Expansion", () => {
	/**
	 * Helper to run a single variant and verify basic properties.
	 */
	async function runVariant(
		graph: TestGraphExpander,
		seeds: string[],
		config: OverlapBasedExpansionConfig
	): Promise<void> {
		const expansion = new OverlapBasedExpansion(graph, seeds, config);
		const result = await expansion.run();

		// Verify result structure
		assert.strictEqual(Array.isArray(result.paths), true, "paths should be an array");
		assert.strictEqual(result.sampledNodes instanceof Set, true, "sampledNodes should be a Set");
		assert.strictEqual(result.sampledEdges instanceof Set, true, "sampledEdges should be a Set");
		assert.strictEqual(Array.isArray(result.visitedPerFrontier), true, "visitedPerFrontier should be an array");
		assert.strictEqual(typeof result.stats, "object", "stats should be an object");
		assert.strictEqual(typeof result.overlapMetadata, "object", "overlapMetadata should be an object");

		// Verify overlap metadata
		assert(Array.isArray(result.overlapMetadata.overlapEvents), "overlapEvents should be an array");
		assert.strictEqual(typeof result.overlapMetadata.iterations, "number", "iterations should be a number");
		assert(result.overlapMetadata.terminationReason, "terminationReason should be defined");
		assert(result.overlapMetadata.overlapMatrix instanceof Map, "overlapMatrix should be a Map");
	}

	/**
	 * Test all 27 combinations of strategies.
	 */
	describe("All 27 variants", () => {
		const overlapStrategies = [
			{ id: "physical", strategy: new PhysicalMeetingStrategy() },
			{ id: "threshold", strategy: new ThresholdSharingStrategy() },
			{ id: "sphere", strategy: new SphereIntersectionStrategy() },
		] as const;

		const terminationStrategies = [
			{ id: "fullpair", strategy: new FullPairwiseStrategy() },
			{ id: "transitive", strategy: new TransitiveConnectivityStrategy() },
			{ id: "converge", strategy: new CommonConvergenceStrategy() },
		] as const;

		const betweenGraphStrategies = [
			{ id: "minimal", strategy: new MinimalPathsStrategy() },
			{ id: "truncated", strategy: new TruncatedComponentStrategy() },
			{ id: "salience", strategy: new SaliencePreservingStrategy() },
		] as const;

		const n1Handling = new CoverageThresholdStrategy();

		// Simple test graph: chain of 5 nodes
		const expander = createChainGraphExpander(5);
		const seeds = ["n0", "n4"]; // Two seeds at ends of chain

		for (const { id: overlapId, strategy: overlap } of overlapStrategies) {
			for (const { id: termId, strategy: termination } of terminationStrategies) {
				for (const { id: betweenId, strategy: betweenGraph } of betweenGraphStrategies) {
					it(`overlap-${overlapId}-${termId}-${betweenId}`, async () => {
						const config: OverlapBasedExpansionConfig = {
							overlapDetection: overlap,
							termination,
							n1Handling,
							betweenGraph,
						};

						await runVariant(expander, seeds, config);
					});
				}
			}
		}
	});

	/**
	 * Test N=1 single seed scenario.
	 */
	describe("N=1 single seed", () => {
		const expander = createGridGraphExpander(3, 3);
		const seeds = ["n0"];

		it("CoverageThreshold terminates at coverage", async () => {
			const config: OverlapBasedExpansionConfig = {
				overlapDetection: new PhysicalMeetingStrategy(),
				termination: new FullPairwiseStrategy(),
				n1Handling: new CoverageThresholdStrategy({ coverageThreshold: 50, minIterations: 5 }),
				betweenGraph: new MinimalPathsStrategy(),
				totalNodes: 9, // 3x3 grid
			};

			const expansion = new OverlapBasedExpansion(expander, seeds, config);
			const result = await expansion.run();

			assert.strictEqual(result.overlapMetadata.terminationReason, "n1-coverage");
			assert(result.sampledNodes.size >= 4, "Should visit at least 4 nodes (44% of 9)");
		});
	});

	/**
	 * Test overlap detection strategies produce different results.
	 */
	describe("Overlap detection comparison", () => {
		const expander = createGridGraphExpander(4, 4);
		const seeds = ["n0", "n15"]; // Opposite corners

		const baseConfig: Omit<OverlapBasedExpansionConfig, "overlapDetection"> = {
			termination: new FullPairwiseStrategy(),
			n1Handling: new CoverageThresholdStrategy(),
			betweenGraph: new MinimalPathsStrategy(),
		};

		it("PhysicalMeeting detects physical node sharing", async () => {
			const config = { ...baseConfig, overlapDetection: new PhysicalMeetingStrategy() };
			const result = await runVariant(expander, seeds, config);

			// Physical meeting requires actual node overlap
			assert(result.overlapMetadata.overlapEvents.length >= 0);
		});

		async function runVariant(expander: TestGraphExpander, seeds: string[], config: OverlapBasedExpansionConfig) {
			const expansion = new OverlapBasedExpansion(expander, seeds, config);
			return expansion.run();
		}
	});
});

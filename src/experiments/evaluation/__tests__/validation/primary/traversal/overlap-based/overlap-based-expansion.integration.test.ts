/**
 * Integration test for Overlap-Based Expansion algorithms
 *
 * Verifies that all 27 variants can be instantiated and executed successfully.
 */

import { describe, expect, it } from "vitest";

// Import all strategy classes
import {
	CommonConvergenceStrategy,
	CoverageThresholdStrategy,
	FullPairwiseStrategy,
	MinimalPathsStrategy,
	OverlapBasedExpansion,
	type OverlapBasedExpansionConfig,
	PhysicalMeetingStrategy,
	SaliencePreservingStrategy,
	SphereIntersectionStrategy,
	ThresholdSharingStrategy,
	TransitiveConnectivityStrategy,
	TruncatedComponentStrategy,
} from "../../../../../../../algorithms/traversal/overlap-based/index.js";
import { createChainGraphExpander, createGridGraphExpander,TestGraphExpander } from "../../../common/graph-generators.js";

describe("Overlap-Based Expansion", () => {
	/**
	 * Helper to run a single variant and verify basic properties.
	 * @param graph
	 * @param seeds
	 * @param config
	 */
	const runVariant = async (graph: TestGraphExpander, seeds: string[], config: OverlapBasedExpansionConfig): Promise<void> => {
		const expansion = new OverlapBasedExpansion(graph, seeds, config);
		const result = await expansion.run();

		// Verify result structure
		expect(result.paths).toBeInstanceOf(Array);
		expect(result.sampledNodes).toBeInstanceOf(Set);
		expect(result.sampledEdges).toBeInstanceOf(Set);
		expect(result.visitedPerFrontier).toBeInstanceOf(Array);
		expect(result.stats).toBeTypeOf("object");
		expect(result.overlapMetadata).toBeTypeOf("object");

		// Verify overlap metadata
		expect(result.overlapMetadata.overlapEvents).toBeInstanceOf(Array);
		expect(result.overlapMetadata.iterations).toBeTypeOf("number");
		expect(result.overlapMetadata.terminationReason).toBeDefined();
		expect(result.overlapMetadata.overlapMatrix).toBeInstanceOf(Map);
	};

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
				n1Handling: new CoverageThresholdStrategy({ coverageThreshold: 80, minIterations: 2 }),
				betweenGraph: new MinimalPathsStrategy(),
				totalNodes: 9, // 3x3 grid
			};

			const expansion = new OverlapBasedExpansion(expander, seeds, config);
			const result = await expansion.run();

			expect(result.overlapMetadata.terminationReason).toBe("n1-coverage");
			expect(result.sampledNodes.size).toBeGreaterThan(0);
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

			// Physical meeting on 4x4 grid from opposite corners should detect overlap
			expect(result.overlapMetadata.overlapEvents.length).toBeGreaterThan(0);
		});

		const runVariant = async (expander: TestGraphExpander, seeds: string[], config: OverlapBasedExpansionConfig) => {
			const expansion = new OverlapBasedExpansion(expander, seeds, config);
			return expansion.run();
		};
	});
});

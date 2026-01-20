/**
 * Tests for Aggregation
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { enumerateBetweenGraph } from "../../../../../../ground-truth/between-graph";
import {
	aggregateRepresentativenessResults,
	computeStructuralRepresentativeness,
} from "../../../../../../metrics/structural-representativeness";
import { createGridGraph, GraphExpanderAdapter } from "./fixtures/test-graph-expander.js";

describe("Aggregation", () => {
	it("should aggregate results across multiple seed pairs", async () => {
		const graph = createGridGraph(5, 5);
		const expander = new GraphExpanderAdapter(graph, false);

		const seedPairs: Array<[string, string]> = [
			["0_0", "4_4"],
			["0_4", "4_0"],
			["2_0", "2_4"],
		];

		const allMetrics = [];

		for (const [seedA, seedB] of seedPairs) {
			const groundTruth = enumerateBetweenGraph(graph, seedA, seedB, {
				maxPathLength: 10,
				maxPaths: 100,
			});

			if (groundTruth.nodes.size < 3) continue;

			const expansion = new DegreePrioritisedExpansion(expander, [seedA, seedB]);
			const result = await expansion.run();

			const sampledDegrees = new Map<string, number>();
			for (const nodeId of result.sampledNodes) {
				sampledDegrees.set(nodeId, expander.getDegree(nodeId));
			}

			const metrics = computeStructuralRepresentativeness(
				result.sampledNodes,
				groundTruth.nodes,
				sampledDegrees,
				groundTruth.degrees
			);

			allMetrics.push(metrics);
		}

		if (allMetrics.length > 0) {
			const aggregated = aggregateRepresentativenessResults(allMetrics);

			// Aggregated metrics should be averages
			expect(aggregated.coverage).toBeGreaterThanOrEqual(0);
			expect(aggregated.coverage).toBeLessThanOrEqual(1);
			expect(Number.isFinite(aggregated.degreeKL)).toBe(true);
		}
	});
});

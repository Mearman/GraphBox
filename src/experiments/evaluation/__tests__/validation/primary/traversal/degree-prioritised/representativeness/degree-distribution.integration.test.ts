/**
 * Tests for Degree Distribution Integration
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../graphbox/src/algorithms/traversal/degree-prioritised-expansion";
import { enumerateBetweenGraph } from "../../../ground-truth/between-graph";
import { compareDegreeDistributions } from "../../../metrics/degree-distribution";
import { createGridGraph, GraphExpanderAdapter } from "./common/test-graph-expander";

describe("Degree Distribution Integration", () => {
	it("should compare degree distributions", async () => {
		const graph = createGridGraph(6, 6);
		const expander = new GraphExpanderAdapter(graph, false);

		const groundTruth = enumerateBetweenGraph(graph, "0_0", "5_5", {
			maxPathLength: 12,
			maxPaths: 200,
		});

		const expansion = new DegreePrioritisedExpansion(expander, ["0_0", "5_5"]);
		const result = await expansion.run();

		// Get degree arrays
		const sampledDegrees: number[] = [];
		for (const nodeId of result.sampledNodes) {
			sampledDegrees.push(expander.getDegree(nodeId));
		}

		const gtDegrees = [...groundTruth.degrees.values()];

		if (sampledDegrees.length > 0 && gtDegrees.length > 0) {
			const comparison = compareDegreeDistributions(sampledDegrees, gtDegrees);

			expect(comparison.klDivergence).toBeGreaterThanOrEqual(0);
			expect(comparison.jsDivergence).toBeGreaterThanOrEqual(0);
			expect(comparison.emd).toBeGreaterThanOrEqual(0);
			expect(Number.isFinite(comparison.sampledMeanDegree)).toBe(true);
			expect(Number.isFinite(comparison.groundTruthMeanDegree)).toBe(true);
		}
	});
});

/**
 * Tests for Ego Network Representativeness (N=1)
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { computeEgoNetwork } from "../../../../../../ground-truth/between-graph";
import { computeStructuralRepresentativeness } from "../../../../../../metrics/structural-representativeness";
import { createGridGraph, GraphExpanderAdapter } from "./fixtures/test-graph-expander.js";

describe("Ego Network Representativeness (N=1)", () => {
	it("should compare expansion to ego network ground truth", async () => {
		const graph = createGridGraph(7, 7);
		const expander = new GraphExpanderAdapter(graph, false);
		const seed = "3_3";

		// Compute ground truth ego network
		const groundTruth = computeEgoNetwork(graph, seed, 3);

		// Run single-seed expansion
		const expansion = new DegreePrioritisedExpansion(expander, [seed]);
		const result = await expansion.run();

		// Compute degrees
		const sampledDegrees = new Map<string, number>();
		for (const nodeId of result.sampledNodes) {
			sampledDegrees.set(nodeId, expander.getDegree(nodeId));
		}

		// Compute representativeness
		const metrics = computeStructuralRepresentativeness(
			result.sampledNodes,
			groundTruth.nodes,
			sampledDegrees,
			groundTruth.degrees
		);

		// Should have some coverage
		expect(metrics.coverage).toBeGreaterThan(0);
		expect(metrics.intersectionSize).toBeGreaterThan(0);
	});
});

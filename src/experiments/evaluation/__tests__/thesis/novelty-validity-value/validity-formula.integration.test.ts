/**
 * VALIDITY: Thesis Formula Compliance
 *
 * Tests the priority formula correctness per thesis Equation 4.106:
 * π(v) = (deg⁺(v) + deg⁻(v)) / (w_V(v) + ε)
 */

import { describe, expect, it } from "vitest";

import { createStarGraphExpander } from "../common/graph-generators";

describe("VALIDITY: Thesis Specification Compliance", () => {
	/**
	 * Validity Claim: Priority formula matches thesis Equation 4.106:
	 * π(v) = (deg⁺(v) + deg⁻(v)) / (w_V(v) + ε)
	 *
	 * Validation: Verify TestGraphExpander.calculatePriority matches formula.
	 */
	it("should correctly implement thesis priority formula", () => {
		const graph = createStarGraphExpander(10);

		// Test hub (high degree)
		const hubPriority = graph.calculatePriority("HUB", { nodeWeight: 1, epsilon: 1e-10 });
		const hubDegree = graph.getDegree("HUB");
		const expectedHubPriority = hubDegree / (1 + 1e-10);

		expect(hubPriority).toBeCloseTo(expectedHubPriority, 10);

		// Test spoke (low degree)
		const spokePriority = graph.calculatePriority("S0", { nodeWeight: 1, epsilon: 1e-10 });
		const spokeDegree = graph.getDegree("S0");
		const expectedSpokePriority = spokeDegree / (1 + 1e-10);

		expect(spokePriority).toBeCloseTo(expectedSpokePriority, 10);

		// Hub should have higher priority value (lower = better in min-queue)
		expect(hubPriority).toBeGreaterThan(spokePriority);

		console.log(`Hub priority: ${hubPriority.toFixed(4)} (degree: ${hubDegree})`);
		console.log(`Spoke priority: ${spokePriority.toFixed(4)} (degree: ${spokeDegree})`);
	});
});

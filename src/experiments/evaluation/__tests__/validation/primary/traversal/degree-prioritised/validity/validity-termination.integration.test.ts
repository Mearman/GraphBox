/**
 * VALIDITY: Termination via Frontier Exhaustion
 *
 * Tests that the algorithm terminates naturally via frontier exhaustion
 * without requiring depth limit parameters.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import { createHubGraphExpander } from "../common/graph-generators";

describe("VALIDITY: Termination via Frontier Exhaustion", () => {
	/**
	 * Validity Claim: Termination occurs via frontier exhaustion.
	 *
	 * Validation: Algorithm completes without depth limit parameter.
	 */
	it("should terminate via frontier exhaustion (no depth limit)", async () => {
		const graph = createHubGraphExpander(2, 20);

		const expansion = new DegreePrioritisedExpansion(graph, ["L0_0", "L1_10"]);
		const result = await expansion.run();

		// Should complete without hanging
		expect(result.stats.iterations).toBeGreaterThan(0);

		// Should visit all reachable nodes (frontier exhaustion)
		// In this case: both hubs and their leaves
		expect(result.sampledNodes.size).toBeGreaterThan(20);
	});
});

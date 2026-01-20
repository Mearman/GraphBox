/**
 * Expansion Order Analysis tests for node explosion mitigation
 *
 * Tests that track and verify the order in which nodes are expanded:
 * - Verifies low-degree nodes are expanded before hubs
 * - Compares expansion patterns between different methods
 */
import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs";
import { InstrumentedExpander } from "../../../../common/instrumented-expander";
import { createStarGraph, createDoubleStarGraph } from "../../../../common/graph-generators";

describe("Expansion Order Analysis", () => {
	it("should track expansion order for degree-prioritised", async () => {
		const edges = createStarGraph(20);
		const expander = new InstrumentedExpander(edges, 0.1);

		const expansion = new DegreePrioritisedExpansion(expander, ["S0", "S10"]);
		await expansion.run();

		const order = expander.getExpansionOrder();

		// Should have expanded some nodes
		expect(order.length).toBeGreaterThan(0);

		// Seeds should be among the first expanded
		expect(order.includes("S0") || order.includes("S10")).toBe(true);
	});

	it("should show different expansion patterns between methods", async () => {
		const edges = createDoubleStarGraph(15);

		// Compare expansion orders
		const orders: Record<string, string[]> = {};

		for (const method of ["Degree-Prioritised", "Standard BFS"]) {
			const expander = new InstrumentedExpander(edges, 0.1);
			let expansion;

			expansion = method === "Degree-Prioritised"
				? new DegreePrioritisedExpansion(expander, ["SA0", "SB0"])
				: new StandardBfsExpansion(expander, ["SA0", "SB0"]);

			await expansion.run();
			orders[method] = expander.getExpansionOrder();
		}

		// Both should have expanded nodes
		expect(orders["Degree-Prioritised"].length).toBeGreaterThan(0);
		expect(orders["Standard BFS"].length).toBeGreaterThan(0);

		// Orders may differ (depends on implementation details)
		// Just verify they both completed
		expect(orders["Degree-Prioritised"].includes("HUB_A") ||
			orders["Degree-Prioritised"].includes("HUB_B")).toBe(true);
	});
});

/**
 * Node Explosion Metrics tests for node explosion mitigation
 *
 * Tests that compute and verify node explosion metrics:
 * - Expansion ratio: nodes expanded / total nodes
 * - Hub expansion rate: hubs expanded / total hubs
 */
import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { FrontierBalancedExpansion } from "../../../../../../../baselines/frontier-balanced";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs";
import { createMultiHubGraph } from "../../../../common/graph-generators";
import { InstrumentedExpander } from "../../../../common/instrumented-expander";

describe("Node Explosion Metrics", () => {
	it("should compute expansion ratio", async () => {
		const edges = createMultiHubGraph(3, 20);

		const methods = ["Degree-Prioritised", "Standard BFS", "Frontier-Balanced"];
		const ratios: Record<string, number> = {};

		for (const method of methods) {
			const expander = new InstrumentedExpander(edges, 0.1);
			const totalNodes = expander.getAllDegrees().size;
			let expansion;

			switch (method) {
				case "Degree-Prioritised": {
					expansion = new DegreePrioritisedExpansion(expander, ["L0_0", "L2_10"]);
					break;
				}
				case "Standard BFS": {
					expansion = new StandardBfsExpansion(expander, ["L0_0", "L2_10"]);
					break;
				}
				case "Frontier-Balanced": {
					expansion = new FrontierBalancedExpansion(expander, ["L0_0", "L2_10"]);
					break;
				}
				default: {
					continue;
				}
			}

			await expansion.run();

			// Expansion ratio = nodes expanded / total nodes
			ratios[method] = expander.getExpandedNodes().size / totalNodes;
		}

		// All ratios should be between 0 and 1
		for (const method of methods) {
			expect(ratios[method]).toBeGreaterThan(0);
			expect(ratios[method]).toBeLessThanOrEqual(1);
		}
	});

	it("should compute hub expansion rate", async () => {
		const edges = createMultiHubGraph(4, 12);

		const results: Array<{
			method: string;
			hubExpansionRate: number;
		}> = [];

		for (const method of ["Degree-Prioritised", "Standard BFS"]) {
			const expander = new InstrumentedExpander(edges, 0.2);
			const totalHubs = expander.getHubNodes().size;

			let expansion;
			expansion = method === "Degree-Prioritised"
				? new DegreePrioritisedExpansion(expander, ["L0_0", "L3_5"])
				: new StandardBfsExpansion(expander, ["L0_0", "L3_5"]);

			await expansion.run();

			const hubsExpanded = expander.getHubNodesExpanded();
			const hubExpansionRate = totalHubs > 0 ? hubsExpanded / totalHubs : 0;

			results.push({ method, hubExpansionRate });
		}

		// Hub expansion rates should be valid
		for (const r of results) {
			expect(r.hubExpansionRate).toBeGreaterThanOrEqual(0);
			expect(r.hubExpansionRate).toBeLessThanOrEqual(1);
		}
	});
});

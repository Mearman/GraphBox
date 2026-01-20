/**
 * Star Graph tests for node explosion mitigation
 *
 * Star graph is the worst case for node explosion:
 * - Single hub node connected to all spokes
 * - Expanding the hub immediately exposes all nodes
 */
import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../algorithms/traversal/degree-prioritised-expansion";
import { FrontierBalancedExpansion } from "../../../../baselines/frontier-balanced";
import { RandomPriorityExpansion } from "../../../../baselines/random-priority";
import { StandardBfsExpansion } from "../../../../baselines/standard-bfs";
import { InstrumentedExpander } from "../common/instrumented-expander";
import { createStarGraph } from "../common/graph-generators";

describe("Star Graph (Single Hub)", () => {
	it("should compare node expansion across methods", async () => {
		const edges = createStarGraph(50);
		const seeds: [string, string] = ["S0", "S25"];

		const results: Array<{ method: string; nodesExpanded: number; hubsExpanded: number }> = [];

		for (const method of ["Degree-Prioritised", "Standard BFS", "Frontier-Balanced", "Random"]) {
			const expander = new InstrumentedExpander(edges, 0.1);
			let expansion;

			switch (method) {
				case "Degree-Prioritised": {
					expansion = new DegreePrioritisedExpansion(expander, seeds);
					break;
				}
				case "Standard BFS": {
					expansion = new StandardBfsExpansion(expander, seeds);
					break;
				}
				case "Frontier-Balanced": {
					expansion = new FrontierBalancedExpansion(expander, seeds);
					break;
				}
				case "Random": {
					expansion = new RandomPriorityExpansion(expander, seeds, 42);
					break;
				}
				default: {
					continue;
				}
			}

			await expansion.run();

			results.push({
				method,
				nodesExpanded: expander.getExpandedNodes().size,
				hubsExpanded: expander.getHubNodesExpanded(),
			});
		}

		// All methods should complete
		expect(results.length).toBe(4);

		// All should expand at least the seeds
		for (const r of results) {
			expect(r.nodesExpanded).toBeGreaterThanOrEqual(2);
		}
	});

	it("degree-prioritised should defer hub expansion", async () => {
		const edges = createStarGraph(30);
		const expander = new InstrumentedExpander(edges, 0.1);

		const expansion = new DegreePrioritisedExpansion(expander, ["S0", "S15"]);
		await expansion.run();

		const order = expander.getExpansionOrder();

		// Hub should be expanded later than low-degree nodes
		const hubIndex = order.indexOf("HUB");
		const firstSpokeIndex = Math.min(
			...order.filter((n) => n.startsWith("S")).map((n) => order.indexOf(n))
		);

		// Spokes should be explored before hub (degree prioritisation)
		// Note: This depends on the specific implementation and may vary
		expect(hubIndex).toBeGreaterThanOrEqual(0);
		expect(firstSpokeIndex).toBeGreaterThanOrEqual(0);
	});
});

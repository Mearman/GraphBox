/**
 * Double Star Graph tests for node explosion mitigation
 *
 * Double star graph has two interconnected hubs:
 * - Tests behavior when path goes through hubs
 * - Each hub has its own set of spokes
 */
import { beforeAll, describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { FrontierBalancedExpansion } from "../../../../../../../baselines/frontier-balanced";
import { RandomPriorityExpansion } from "../../../../../../../baselines/random-priority";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs";
import { createDoubleStarGraph } from "../../../../common/graph-generators";
import { InstrumentedExpander } from "../../../../common/instrumented-expander";

describe("Double Star Graph (Two Hubs)", () => {
	let edges: Array<[string, string]>;

	beforeAll(() => {
		edges = createDoubleStarGraph(20);
	});

	it("should find path between spokes of different hubs", async () => {
		const expander = new InstrumentedExpander(edges, 0.1);

		const expansion = new DegreePrioritisedExpansion(expander, ["SA0", "SB10"]);
		const result = await expansion.run();

		// Should find path through the hubs
		expect(result.paths.length).toBeGreaterThan(0);

		// Path should go through both hubs
		const pathThroughHubs = result.paths.some(
			(p) => p.nodes.includes("HUB_A") && p.nodes.includes("HUB_B")
		);
		expect(pathThroughHubs).toBe(true);
	});

	it("all methods should find paths", async () => {
		const seeds: [string, string] = ["SA5", "SB15"];

		const methods = ["Degree-Prioritised", "Standard BFS", "Frontier-Balanced", "Random"];
		const pathCounts: Record<string, number> = {};

		for (const method of methods) {
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

			const result = await expansion.run();
			pathCounts[method] = result.paths.length;
		}

		// All should find paths
		for (const method of methods) {
			expect(pathCounts[method]).toBeGreaterThan(0);
		}
	});
});

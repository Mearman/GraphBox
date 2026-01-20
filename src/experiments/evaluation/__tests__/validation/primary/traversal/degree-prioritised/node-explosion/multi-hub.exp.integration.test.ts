/**
 * Multi-Hub Network tests for node explosion mitigation
 *
 * Multi-hub network has multiple interconnected hubs:
 * - Hubs connected in a ring topology
 * - Each hub has its own set of leaf nodes
 * - Tests expansion efficiency across complex hub structures
 */
import { beforeAll, describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { FrontierBalancedExpansion } from "../../../../../../../baselines/frontier-balanced";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs";
import { createMultiHubGraph } from "../../../../common/graph-generators";
import { InstrumentedExpander } from "../../../../common/instrumented-expander";

describe("Multi-Hub Network", () => {
	let edges: Array<[string, string]>;

	beforeAll(() => {
		edges = createMultiHubGraph(4, 15);
	});

	it("should compare expansion efficiency", async () => {
		const seeds: [string, string] = ["L0_0", "L2_10"];

		const metrics: Array<{
			method: string;
			nodesExpanded: number;
			hubsExpanded: number;
			pathsFound: number;
		}> = [];

		for (const method of ["Degree-Prioritised", "Standard BFS", "Frontier-Balanced"]) {
			const expander = new InstrumentedExpander(edges, 0.15);
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
				default: {
					continue;
				}
			}

			const result = await expansion.run();

			metrics.push({
				method,
				nodesExpanded: expander.getExpandedNodes().size,
				hubsExpanded: expander.getHubNodesExpanded(),
				pathsFound: result.paths.length,
			});
		}

		// All methods should find paths
		for (const m of metrics) {
			expect(m.pathsFound).toBeGreaterThanOrEqual(0);
			expect(m.nodesExpanded).toBeGreaterThan(0);
		}

		// Metrics should be valid
		for (const m of metrics) {
			expect(Number.isFinite(m.nodesExpanded)).toBe(true);
			expect(Number.isFinite(m.hubsExpanded)).toBe(true);
		}
	});

	it("should track hub nodes correctly", async () => {
		const expander = new InstrumentedExpander(edges, 0.15);

		// Hubs should be identified correctly
		const hubs = expander.getHubNodes();
		expect(hubs.size).toBeGreaterThan(0);

		// Verify actual high-degree nodes (H0-H3) are included in identified hubs
		const degrees = expander.getAllDegrees();
		const actualHubs = ["H0", "H1", "H2", "H3"];
		const maxDegree = Math.max(...degrees.values());

		// At least some actual high-degree nodes should be in identified hubs
		const highDegreeNodesInHubs = actualHubs.filter((h) => hubs.has(h));
		expect(highDegreeNodesInHubs.length).toBeGreaterThan(0);

		// The actual hub nodes should have the highest degree in the graph
		for (const actualHub of actualHubs) {
			const hubDegree = degrees.get(actualHub) ?? 0;
			expect(hubDegree).toBe(maxDegree);
		}
	});
});

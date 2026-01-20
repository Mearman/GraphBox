/**
 * Scale-Free Graph tests for node explosion mitigation
 *
 * Scale-free graph has power-law degree distribution:
 * - Few high-degree hub nodes
 * - Many low-degree peripheral nodes
 * - Mimics real-world citation networks
 */
import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../baselines/standard-bfs";
import { InstrumentedExpander } from "../common/instrumented-expander";
import { createScaleFreeGraph } from "../common/graph-generators";

describe("Scale-Free Graph", () => {
	it("should handle power-law degree distribution", async () => {
		const edges = createScaleFreeGraph(100, 42);
		const expander = new InstrumentedExpander(edges, 0.1);

		// Find two low-degree nodes as seeds
		const degrees = expander.getAllDegrees();
		const sortedNodes = [...degrees.entries()].sort((a, b) => a[1] - b[1]);
		const seeds: [string, string] = [sortedNodes[0][0], sortedNodes[1][0]];

		const expansion = new DegreePrioritisedExpansion(expander, seeds);
		const result = await expansion.run();

		// Should complete without error
		expect(result.sampledNodes.size).toBeGreaterThan(0);
		expect(result.stats.iterations).toBeGreaterThan(0);
	});

	it("should compare methods on scale-free graph", async () => {
		const edges = createScaleFreeGraph(80, 123);

		const results: Array<{ method: string; nodesExpanded: number }> = [];

		for (const method of ["Degree-Prioritised", "Standard BFS"]) {
			const expander = new InstrumentedExpander(edges, 0.1);

			// Use nodes from different parts of degree spectrum
			const degrees = expander.getAllDegrees();
			const sortedNodes = [...degrees.entries()].sort((a, b) => a[1] - b[1]);
			const lowDegreeNode = sortedNodes[5][0];
			const midDegreeNode = sortedNodes[Math.floor(sortedNodes.length / 2)][0];

			let expansion;
			expansion = method === "Degree-Prioritised"
				? new DegreePrioritisedExpansion(expander, [lowDegreeNode, midDegreeNode])
				: new StandardBfsExpansion(expander, [lowDegreeNode, midDegreeNode]);

			await expansion.run();

			results.push({
				method,
				nodesExpanded: expander.getExpandedNodes().size,
			});
		}

		// Both methods should complete
		expect(results.length).toBe(2);
		for (const r of results) {
			expect(r.nodesExpanded).toBeGreaterThan(0);
		}
	});
});

/**
 * Tests for Path Diversity Integration
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import {
	computePathDiversityMetrics,
	identifyHubNodes,
} from "../../../metrics/path-diversity";
import { createGridGraph, createHubGraph, GraphExpanderAdapter } from "./common/test-graph-expander";

describe("Path Diversity Integration", () => {
	it("should compute diversity metrics for expansion results", async () => {
		const graph = createGridGraph(5, 5);
		const expander = new GraphExpanderAdapter(graph, false);

		const expansion = new DegreePrioritisedExpansion(expander, ["0_0", "4_4"]);
		const result = await expansion.run();

		// Convert paths to string arrays
		const pathArrays = result.paths.map((p) => p.nodes);

		if (pathArrays.length > 0) {
			const diversity = computePathDiversityMetrics(pathArrays);

			expect(diversity.pathCount).toBe(pathArrays.length);
			expect(diversity.uniqueNodeCount).toBeGreaterThan(0);
			expect(diversity.meanPathLength).toBeGreaterThan(0);

			if (pathArrays.length > 1) {
				expect(diversity.nodeJaccardDistance).toBeGreaterThanOrEqual(0);
				expect(diversity.nodeJaccardDistance).toBeLessThanOrEqual(1);
			}
		}
	});

	it("should compute hub coverage", async () => {
		const graph = createHubGraph(3, 8);
		const expander = new GraphExpanderAdapter(graph, false);

		// Identify hubs
		const hubNodes = identifyHubNodes(expander.getAllDegrees(), 0.2);

		const expansion = new DegreePrioritisedExpansion(expander, ["L0_0", "L2_7"]);
		const result = await expansion.run();

		const pathArrays = result.paths.map((p) => p.nodes);

		if (pathArrays.length > 0) {
			// Paths between leaves should go through hubs
			const hubInPaths = pathArrays.some((path) =>
				path.some((node) => hubNodes.has(node))
			);
			expect(hubInPaths).toBe(true);
		}
	});
});

/**
 * Tests for Between-Graph Ground Truth
 */

import { describe, expect, it } from "vitest";

import {
	computeEgoNetwork,
	enumerateBetweenGraph,
} from "../../../../../../ground-truth/between-graph";
import { createChainGraph, createGridGraph } from "./fixtures/test-graph-expander.js";

describe("Between-Graph Ground Truth", () => {
	it("should enumerate between-graph for chain", () => {
		const graph = createChainGraph(7);
		const result = enumerateBetweenGraph(graph, "N0", "N6");

		// Should find the path through the chain
		expect(result.paths.length).toBeGreaterThan(0);
		expect(result.nodes.size).toBe(7); // All nodes on the path

		// Statistics should be valid
		expect(result.stats.pathCount).toBeGreaterThan(0);
		expect(result.stats.meanPathLength).toBeGreaterThan(0);
	});

	it("should enumerate between-graph for grid", () => {
		const graph = createGridGraph(4, 4);
		const result = enumerateBetweenGraph(graph, "0_0", "3_3", { maxPaths: 100 });

		// Grid has multiple paths between corners
		expect(result.paths.length).toBeGreaterThan(1);
		expect(result.nodes.size).toBeGreaterThan(2);
	});

	it("should compute ego network", () => {
		const graph = createGridGraph(5, 5);
		const result = computeEgoNetwork(graph, "2_2", 2);

		// Should include center and 2-hop neighbors
		expect(result.nodes.has("2_2")).toBe(true);
		expect(result.nodes.size).toBeGreaterThan(1);

		// Degrees should be computed
		expect(result.degrees.size).toBe(result.nodes.size);
	});
});

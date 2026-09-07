/**
 * Betweenness Centrality Integration Test
 *
 * Validates that the Betweenness Centrality baseline:
 * - Produces valid rankings on benchmark datasets
 * - Works consistently across different graph types
 * - Can be compared against MI ranking methods
 */

import { Graph } from "@graph/algorithms/graph/graph.js";
import type { Edge, Node } from "@graph/algorithms/types/graph.js";
import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers.js";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/index.js";
import { betweennessRanking } from "@graph/experiments/baselines/betweenness-ranking.js";
import { describe, expect, it } from "vitest";

describe("Betweenness Centrality Baseline", { timeout: 60_000 }, () => {
	const testCases = [
		{ datasetId: "karate", source: "1", target: "34", name: "Karate Club" },
		{ datasetId: "lesmis", source: "Myriel", target: "Marius", name: "Les Misérables" },
		{ datasetId: "cora", source: "11342", target: "379288", name: "Cora" },
	];

	for (const tc of testCases) {
		describe(tc.name, () => {
			it("should produce valid ranking result", async () => {
				const benchmark = await loadBenchmarkByIdFromUrl(tc.datasetId);
				const graph = benchmark.graph;

				const result = betweennessRanking(graph, tc.source, tc.target, {
					maxPaths: 10,
					traversalMode: "undirected",
				});

				// Result should be Ok
				expect(result.ok).toBe(true);
				if (!result.ok) return;

				const rankedPaths = result.value;

				// Should find some paths (Betweenness finds all shortest paths)
				expect(rankedPaths.some).toBe(true);
				if (!rankedPaths.some) return;

				const paths = rankedPaths.value;

				// Should find at least one path
				expect(paths.length).toBeGreaterThan(0);

				// Compute metrics to verify they work
				const metrics = computeRankingMetrics(paths, graph);

				// Metrics should be non-negative
				expect(metrics.meanMI).toBeGreaterThanOrEqual(0);
				expect(metrics.stdMI).toBeGreaterThanOrEqual(0);
				expect(metrics.pathDiversity).toBeGreaterThanOrEqual(0);
				expect(metrics.hubAvoidance).toBeGreaterThanOrEqual(0);
				expect(metrics.nodeCoverage).toBeGreaterThanOrEqual(0);
			});
		});
	}

	it("should return None for disconnected nodes", () => {
		// Karate Club is a single connected component (every node reaches every other), so there is no pair of real node IDs within it with no path between them -- a genuinely disconnected two-component graph is needed to exercise this case at all.
		const graph = new Graph<Node, Edge>(false);
		graph.addNode({ id: "a1", type: "node" });
		graph.addNode({ id: "a2", type: "node" });
		graph.addEdge({ id: "e-a", source: "a1", target: "a2", type: "edge" });
		graph.addNode({ id: "b1", type: "node" });
		graph.addNode({ id: "b2", type: "node" });
		graph.addEdge({ id: "e-b", source: "b1", target: "b2", type: "edge" });

		const result = betweennessRanking(graph, "a1", "b1", {
			maxPaths: 10,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Should return None when no path exists
		expect(result.value.some).toBe(false);
	});

	it("should handle single-node paths (source === target)", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const graph = benchmark.graph;

		const result = betweennessRanking(graph, "1", "1", {
			maxPaths: 10,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.some).toBe(true);
		if (!result.value.some) return;

		const paths = result.value.value;
		expect(paths.length).toBe(1);
		expect(paths[0].path.nodes.length).toBe(1);
	});
});

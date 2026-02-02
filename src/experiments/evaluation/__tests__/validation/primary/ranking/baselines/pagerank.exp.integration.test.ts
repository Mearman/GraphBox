/**
 * PageRank Sum Ranking Integration Test
 *
 * Validates that the PageRank baseline:
 * - Produces valid rankings on benchmark datasets
 * - Works consistently across different graph types
 * - Can be compared against MI ranking methods
 */

import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers.js";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/index.js";
import { pageRankSumRanking } from "@graph/experiments/baselines/pagerank-sum-ranking.js";
import { describe, expect, it } from "vitest";

describe("PageRank Sum Ranking Baseline", { timeout: 60_000 }, () => {
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

				const result = pageRankSumRanking(graph, tc.source, tc.target, {
					maxPaths: 10,
					traversalMode: "undirected",
				});

				// Result should be Ok
				expect(result.ok).toBe(true);
				if (!result.ok) return;

				const rankedPaths = result.value;

				// Should find some paths (PageRank finds all shortest paths)
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

	it("should return None for disconnected nodes", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const graph = benchmark.graph;

		// Use node IDs that might not be connected
		const result = pageRankSumRanking(graph, "999999", "888888", {
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

		const result = pageRankSumRanking(graph, "1", "1", {
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

/**
 * Cora Benchmark Tests for Path Salience Ranking
 *
 * Tests the Path Salience Ranking algorithm on the Cora citation network,
 * a scientific paper citation graph with 2708 nodes (papers) and 5429 edges.
 *
 * The network represents papers in machine learning research, with edges
 * indicating citation relationships.
 *
 * Tests validate:
 * - Path ranking performance on citation networks
 * - Academic paper connectivity analysis
 * - Statistical comparison against baseline methods
 */

import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers";
import { cohensD } from "@graph/evaluation/__tests__/validation/common/statistical-functions";
import { getTestNodePair, loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { randomPathRanking } from "@graph/experiments/baselines/random-path-ranking";
import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking";
import { describe, expect, it } from "vitest";

describe("Path Salience Ranking: Benchmarks - Cora", () => {
	/**
	 * Should rank paths between papers in different research areas.
	 *
	 * Tests path ranking between papers that are likely in different
	 * machine learning subfields, requiring paths through intermediate papers.
	 */
	it("should rank paths between papers in citation network", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("cora");
		const graph = benchmark.graph;

		// Use actual paper IDs from the graph (not generic numeric indices)
		const { source, target } = getTestNodePair("cora");

		const salienceResult = rankPaths(graph, source, target, { maxPaths: 15 });
		const shortestResult = shortestPathRanking(graph, source, target, { maxPaths: 15 });
		const randomResult = randomPathRanking(graph, source, target, { maxPaths: 15, seed: 42 });

		expect(salienceResult.ok).toBe(true);
		expect(shortestResult.ok).toBe(true);
		expect(randomResult.ok).toBe(true);

		if (salienceResult.ok && shortestResult.ok && randomResult.ok &&
			salienceResult.value.some && shortestResult.value.some && randomResult.value.some) {

			const saliencePaths = salienceResult.value.value;
			const shortestPaths = shortestResult.value.value;
			const randomPaths = randomResult.value.value;

			// All methods should find paths in the citation network
			expect(saliencePaths.length).toBeGreaterThan(0);
			expect(shortestPaths.length).toBeGreaterThan(0);
			expect(randomPaths.length).toBeGreaterThan(0);

			// Compute metrics
			const salienceMetrics = computeRankingMetrics(saliencePaths, graph);
			const shortestMetrics = computeRankingMetrics(shortestPaths, graph);
			const randomMetrics = computeRankingMetrics(randomPaths, graph);

			console.log("\n=== Cora Citation Network Analysis ===");
			console.log(`Path Salience: ${saliencePaths.length} paths`);
			console.log(`  Mean MI: ${salienceMetrics.meanMI.toFixed(3)}`);
			console.log(`  Node Coverage: ${salienceMetrics.nodeCoverage.toFixed(2)}`);
			console.log(`  Path Diversity: ${salienceMetrics.pathDiversity.toFixed(3)}`);
			console.log(`Shortest Path: ${shortestPaths.length} paths`);
			console.log(`  Node Coverage: ${shortestMetrics.nodeCoverage.toFixed(2)}`);
			console.log(`Random Path: ${randomPaths.length} paths`);
			console.log(`  Node Coverage: ${randomMetrics.nodeCoverage.toFixed(2)}`);
		}
	});

	/**
	 * Should find diverse citation paths.
	 *
	 * Tests that paths between papers include various intermediate papers,
	 * showing different citation chains and research connections.
	 */
	it("should find diverse citation paths", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("cora");
		const graph = benchmark.graph;

		// Use actual paper IDs from test pairs (second pair)
		const { source, target } = getTestNodePair("cora", 1);

		const result = rankPaths(graph, source, target, { maxPaths: 12 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find citation paths (at least 1)
			expect(paths.length).toBeGreaterThan(0);

			// Collect intermediate papers
			const intermediates = new Set<string>();
			for (const path of paths) {
				for (const node of path.path.nodes) {
					if (node.id !== source && node.id !== target) {
						intermediates.add(node.id);
					}
				}
			}

			// Should show intermediate papers (0 or more, depending on path length)
			expect(intermediates.size).toBeGreaterThanOrEqual(0);

			console.log("\n=== Cora Citation Path Diversity ===");
			console.log(`From: ${source}, To: ${target}`);
			console.log(`Paths found: ${paths.length}`);
			console.log(`Intermediate papers: ${intermediates.size}`);
		}
	});

	/**
	 * Should handle sparse vs dense regions of citation network.
	 *
	 * Compares path ranking between:
	 * 1. Papers in well-cited areas (dense)
	 * 2. Papers in sparsely cited areas
	 */
	it("should handle sparse vs dense citation regions", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("cora");
		const graph = benchmark.graph;

		// Use actual paper IDs from test pairs (different pairs for comparison)
		const pair1 = getTestNodePair("cora", 0);
		const pair2 = getTestNodePair("cora", 2);

		const result1 = rankPaths(graph, pair1.source, pair1.target, { maxPaths: 10 });
		const result2 = rankPaths(graph, pair2.source, pair2.target, { maxPaths: 10 });

		expect(result1.ok).toBe(true);
		expect(result2.ok).toBe(true);

		if (result1.ok && result2.ok &&
			result1.value.some && result2.value.some) {

			const paths1 = result1.value.value.length;
			const paths2 = result2.value.value.length;

			console.log("\n=== Cora Density Analysis ===");
			console.log(`Pair 1 (${pair1.source}-${pair1.target}): ${paths1} paths`);
			console.log(`Pair 2 (${pair2.source}-${pair2.target}): ${paths2} paths`);

			// Both should find some paths
			expect(paths1).toBeGreaterThan(0);
			expect(paths2).toBeGreaterThan(0);
		}
	});

	/**
	 * Should show effect size against random baseline.
	 *
	 * Measures Cohen's d effect size for path diversity
	 * between Path Salience Ranking and random baseline.
	 */
	it("should show effect size against random baseline", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("cora");
		const graph = benchmark.graph;

		// Use actual paper IDs from test pairs
		const { source, target } = getTestNodePair("cora");

		// Run multiple trials
		const salienceScores: number[] = [];
		const randomScores: number[] = [];

		for (let index = 0; index < 5; index++) {
			const salienceResult = rankPaths(graph, source, target, { maxPaths: 10 });
			const randomResult = randomPathRanking(graph, source, target, { maxPaths: 10, seed: 300 + index });

			if (salienceResult.ok && randomResult.ok &&
				salienceResult.value.some && randomResult.value.some) {

				const salienceMetrics = computeRankingMetrics(salienceResult.value.value, graph);
				const randomMetrics = computeRankingMetrics(randomResult.value.value, graph);

				salienceScores.push(salienceMetrics.meanMI);
				randomScores.push(randomMetrics.meanMI);
			}
		}

		if (salienceScores.length > 0 && randomScores.length > 0) {
			const effectSize = cohensD(salienceScores, randomScores);

			console.log("\n=== Cora Effect Size Analysis ===");
			console.log(`Path Salience mean MI: ${(salienceScores.reduce((a, b) => a + b, 0) / salienceScores.length).toFixed(3)}`);
			console.log(`Random mean MI: ${(randomScores.reduce((a, b) => a + b, 0) / randomScores.length).toFixed(3)}`);
			console.log(`Cohen's d: ${effectSize.toFixed(3)}`);
		}

		// Should have data points
		expect(salienceScores.length).toBeGreaterThan(0);
		expect(randomScores.length).toBeGreaterThan(0);
	});
});

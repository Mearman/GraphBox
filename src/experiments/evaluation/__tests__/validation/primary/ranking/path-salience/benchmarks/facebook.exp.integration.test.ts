/**
 * Facebook Benchmark Tests for Path Salience Ranking
 *
 * Tests the Path Salience Ranking algorithm on the Facebook social network,
 * a large undirected graph with 4039 nodes (users) and 88234 edges.
 *
 * The network represents verified Facebook friends, making it a
 * representative example of real-world social network structures.
 *
 * Tests validate:
 * - Path ranking performance on large-scale social networks
 * - Social connection analysis
 * - Statistical comparison against baseline methods
 */

import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers";
import { cohensD } from "@graph/evaluation/__tests__/validation/common/statistical-functions";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { randomPathRanking } from "@graph/experiments/baselines/random-path-ranking";
import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking";
import { describe, expect, it } from "vitest";

describe("Path Salience Ranking: Benchmarks - Facebook", () => {
	/**
	 * Should rank paths between Facebook users.
	 *
	 * Tests path ranking between users in the Facebook social network,
	 * which has a scale-free structure with hub users having many connections.
	 */
	it("should rank paths between social network users", { timeout: 60_000 }, async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const graph = benchmark.graph;

		// Use nodes representing different users
		const source = "0";
		const target = "500";

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

			// All methods should find paths in the social network
			expect(saliencePaths.length).toBeGreaterThan(0);
			expect(shortestPaths.length).toBeGreaterThan(0);
			expect(randomPaths.length).toBeGreaterThan(0);

			// Compute metrics
			const salienceMetrics = computeRankingMetrics(saliencePaths, graph);
			const shortestMetrics = computeRankingMetrics(shortestPaths, graph);
			const randomMetrics = computeRankingMetrics(randomPaths, graph);

			console.log("\n=== Facebook Social Network Analysis ===");
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
	 * Should find diverse friend connection paths.
	 *
	 * Tests that paths between users include various intermediate friends,
	 * showing different social connection patterns.
	 */
	it("should find diverse friend connection paths", { timeout: 60_000 }, async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const graph = benchmark.graph;

		// Select users likely to have multiple friend paths
		const source = "100";
		const target = "800";

		const result = rankPaths(graph, source, target, { maxPaths: 12 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find multiple friend paths
			expect(paths.length).toBeGreaterThan(1);

			// Collect intermediate users
			const intermediates = new Set<string>();
			for (const path of paths) {
				for (const node of path.path.nodes) {
					if (node.id !== source && node.id !== target) {
						intermediates.add(node.id);
					}
				}
			}

			// Should show diverse intermediate users
			expect(intermediates.size).toBeGreaterThan(1);

			console.log("\n=== Facebook Friend Path Diversity ===");
			console.log(`From: ${source}, To: ${target}`);
			console.log(`Paths found: ${paths.length}`);
			console.log(`Intermediate users: ${intermediates.size}`);
		}
	});

	/**
	 * Should handle scale-free network structure.
	 *
	 * Tests path ranking on a network with hub users (high degree)
	 * and peripheral users (low degree).
	 */
	it("should handle scale-free network structure", { timeout: 60_000 }, async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const graph = benchmark.graph;

		// Test paths that might go through hub users
		const source = "0";
		const target = "2000";

		const result = rankPaths(graph, source, target, { maxPaths: 10 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find paths in the large network
			expect(paths.length).toBeGreaterThan(0);

			// All paths should be valid
			for (const path of paths) {
				const nodes = path.path.nodes;
				expect(nodes[0].id).toBe(source);
				expect(nodes.at(-1)?.id).toBe(target);
			}

			console.log("\n=== Facebook Scale-Free Structure ===");
			console.log(`From: ${source}, To: ${target}`);
			console.log(`Paths found: ${paths.length}`);
		}
	});

	/**
	 * Should show effect size against random baseline.
	 *
	 * Measures Cohen's d effect size for path diversity
	 * between Path Salience Ranking and random baseline.
	 */
	it("should show effect size against random baseline", { timeout: 60_000 }, async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const graph = benchmark.graph;

		const source = "0";
		const target = "500";

		// Run multiple trials
		const salienceScores: number[] = [];
		const randomScores: number[] = [];

		for (let index = 0; index < 3; index++) {
			const salienceResult = rankPaths(graph, source, target, { maxPaths: 10 });
			const randomResult = randomPathRanking(graph, source, target, { maxPaths: 10, seed: 500 + index });

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

			console.log("\n=== Facebook Effect Size Analysis ===");
			console.log(`Path Salience mean MI: ${(salienceScores.reduce((a, b) => a + b, 0) / salienceScores.length).toFixed(3)}`);
			console.log(`Random mean MI: ${(randomScores.reduce((a, b) => a + b, 0) / randomScores.length).toFixed(3)}`);
			console.log(`Cohen's d: ${effectSize.toFixed(3)}`);
		}

		// Should have data points
		expect(salienceScores.length).toBeGreaterThan(0);
		expect(randomScores.length).toBeGreaterThan(0);
	});
});

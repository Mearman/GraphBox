/**
 * CiteSeer Benchmark Tests for Path Salience Ranking
 *
 * Tests the Path Salience Ranking algorithm on the CiteSeer citation network,
 * a scientific paper citation graph with 3312 nodes (papers) and 4536 edges.
 *
 * The network represents papers in computer science research, with edges
 * indicating citation relationships.
 *
 * Tests validate:
 * - Path ranking performance on larger citation networks
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

describe("Path Salience Ranking: Benchmarks - CiteSeer", () => {
	/**
	 * Should rank paths between computer science papers.
	 *
	 * Tests path ranking between papers in the CiteSeer database,
	 * which covers various areas of computer science research.
	 */
	it("should rank paths between computer science papers", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("citeseer");
		const graph = benchmark.graph;

		// Use actual paper IDs from the graph (not generic numeric indices)
		const { source, target } = getTestNodePair("citeseer");

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

			// All methods should find citation paths
			expect(saliencePaths.length).toBeGreaterThan(0);
			expect(shortestPaths.length).toBeGreaterThan(0);
			expect(randomPaths.length).toBeGreaterThan(0);

			// Compute metrics
			const salienceMetrics = computeRankingMetrics(saliencePaths, graph);
			const shortestMetrics = computeRankingMetrics(shortestPaths, graph);
			const randomMetrics = computeRankingMetrics(randomPaths, graph);

			console.log("\n=== CiteSeer Citation Network Analysis ===");
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
	 * Should find diverse citation chains.
	 *
	 * Tests that paths include various intermediate papers,
	 * showing different citation chains through computer science literature.
	 */
	it("should find diverse citation chains", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("citeseer");
		const graph = benchmark.graph;

		// Select papers likely to have multiple citation paths
		const source = "100";
		const target = "500";

		const result = rankPaths(graph, source, target, { maxPaths: 12 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find multiple citation paths
			expect(paths.length).toBeGreaterThan(1);

			// Collect intermediate papers
			const intermediates = new Set<string>();
			for (const path of paths) {
				for (const node of path.path.nodes) {
					if (node.id !== source && node.id !== target) {
						intermediates.add(node.id);
					}
				}
			}

			// Should show diverse intermediate papers
			expect(intermediates.size).toBeGreaterThan(1);

			console.log("\n=== CiteSeer Citation Chain Diversity ===");
			console.log(`From: ${source}, To: ${target}`);
			console.log(`Paths found: ${paths.length}`);
			console.log(`Intermediate papers: ${intermediates.size}`);
		}
	});

	/**
	 * Should compare different paper pairs.
	 *
	 * Tests path ranking between multiple paper pairs to verify
	 * consistent performance across different parts of the network.
	 */
	it("should compare different paper pairs", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("citeseer");
		const graph = benchmark.graph;

		// Test different paper pairs using actual paper IDs from graph
		const pairs = [
			getTestNodePair("citeseer", 0),
			getTestNodePair("citeseer", 1),
			getTestNodePair("citeseer", 2),
		];

		const results: Array<{ pair: string; paths: number }> = [];

		for (const pair of pairs) {
			const result = rankPaths(graph, pair.source, pair.target, { maxPaths: 10 });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				results.push({
					pair: `${pair.source}-${pair.target}`,
					paths: result.value.value.length,
				});
			}
		}

		console.log("\n=== CiteSeer Paper Pair Analysis ===");
		for (const r of results) {
			console.log(`${r.pair}: ${r.paths} paths`);
		}

		// All pairs should find some paths
		expect(results.every((r) => r.paths > 0)).toBe(true);
	});

	/**
	 * Should calculate effect size against baseline.
	 *
	 * Measures Cohen's d for path diversity improvement
	 * over random baseline.
	 */
	it("should calculate effect size against baseline", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("citeseer");
		const graph = benchmark.graph;

		// Use actual paper IDs from test pairs
		const { source, target } = getTestNodePair("citeseer");

		// Run multiple trials
		const salienceScores: number[] = [];
		const randomScores: number[] = [];

		for (let index = 0; index < 5; index++) {
			const salienceResult = rankPaths(graph, source, target, { maxPaths: 10 });
			const randomResult = randomPathRanking(graph, source, target, { maxPaths: 10, seed: 400 + index });

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

			console.log("\n=== CiteSeer Effect Size Analysis ===");
			console.log(`Path Salience mean MI: ${(salienceScores.reduce((a, b) => a + b, 0) / salienceScores.length).toFixed(3)}`);
			console.log(`Random mean MI: ${(randomScores.reduce((a, b) => a + b, 0) / randomScores.length).toFixed(3)}`);
			console.log(`Cohen's d: ${effectSize.toFixed(3)}`);
		}

		// Should have data points
		expect(salienceScores.length).toBeGreaterThan(0);
		expect(randomScores.length).toBeGreaterThan(0);
	});
});

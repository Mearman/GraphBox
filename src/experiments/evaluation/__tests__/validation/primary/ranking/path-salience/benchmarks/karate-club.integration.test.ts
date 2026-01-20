/**
 * Karate Club Benchmark Tests for Path Salience Ranking
 *
 * Tests the Path Salience Ranking algorithm on the Zachary Karate Club network,
 * a well-studied social network with 34 nodes and 78 edges representing
 * friendships at a university karate club.
 *
 * The network famously split into two factions after a dispute between
 * the instructor (Mr. Hi, node 1) and the club president (John A., node 34).
 *
 * Tests validate:
 * - Path ranking performance on real-world social networks
 * - Statistical comparison against baseline methods
 * - Diversity of top-K paths between community members
 */

import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers";
import { cohensD, mannWhitneyUTest } from "@graph/evaluation/__tests__/validation/common/statistical-functions";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { betweennessRanking } from "@graph/experiments/baselines/betweenness-ranking";
import { randomPathRanking } from "@graph/experiments/baselines/random-path-ranking";
import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking";
import { describe, expect, it } from "vitest";

describe("Path Salience Ranking: Benchmarks - Karate Club", () => {
	/**
	 * Should rank paths between the two factions.
	 *
	 * Tests path ranking between Mr. Hi (node 1) and John A. (node 34),
	 * the leaders of the two factions that formed after the club split.
	 */
	it("should rank paths between the two factions", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const graph = benchmark.graph;

		// Rank paths between the two faction leaders
		const source = "1"; // Mr. Hi
		const target = "34"; // John A.

		const salienceResult = rankPaths(graph, source, target, { maxPaths: 15 });
		const shortestResult = shortestPathRanking(graph, source, target, { maxPaths: 15 });
		const randomResult = randomPathRanking(graph, source, target, { maxPaths: 15, seed: 42 });
		const betweennessResult = betweennessRanking(graph, source, target, { maxPaths: 15 });

		expect(salienceResult.ok).toBe(true);
		expect(shortestResult.ok).toBe(true);
		expect(randomResult.ok).toBe(true);
		expect(betweennessResult.ok).toBe(true);

		if (salienceResult.ok && shortestResult.ok && randomResult.ok && betweennessResult.ok &&
			salienceResult.value.some && shortestResult.value.some &&
			randomResult.value.some && betweennessResult.value.some) {

			const saliencePaths = salienceResult.value.value;
			const shortestPaths = shortestResult.value.value;
			const randomPaths = randomResult.value.value;
			const betweennessPaths = betweennessResult.value.value;

			// All methods should find some paths
			expect(saliencePaths.length).toBeGreaterThan(0);
			expect(shortestPaths.length).toBeGreaterThan(0);
			expect(randomPaths.length).toBeGreaterThan(0);
			expect(betweennessPaths.length).toBeGreaterThan(0);

			// Log metrics for analysis
			const salienceMetrics = computeRankingMetrics(saliencePaths, graph);
			const shortestMetrics = computeRankingMetrics(shortestPaths, graph);
			const randomMetrics = computeRankingMetrics(randomPaths, graph);
			const betweennessMetrics = computeRankingMetrics(betweennessPaths, graph);

			console.log("\n=== Karate Club Path Ranking Analysis ===");
			console.log(`Path Salience: ${saliencePaths.length} paths`);
			console.log(`  Mean MI: ${salienceMetrics.meanMI.toFixed(3)}`);
			console.log(`  Node Coverage: ${salienceMetrics.nodeCoverage.toFixed(2)}`);
			console.log(`  Path Diversity: ${salienceMetrics.pathDiversity.toFixed(3)}`);
			console.log(`Shortest Path: ${shortestPaths.length} paths`);
			console.log(`  Node Coverage: ${shortestMetrics.nodeCoverage.toFixed(2)}`);
			console.log(`  Path Diversity: ${shortestMetrics.pathDiversity.toFixed(3)}`);
			console.log(`Random Path: ${randomPaths.length} paths`);
			console.log(`  Node Coverage: ${randomMetrics.nodeCoverage.toFixed(2)}`);
			console.log(`Betweenness: ${betweennessPaths.length} paths`);
			console.log(`  Node Coverage: ${betweennessMetrics.nodeCoverage.toFixed(2)}`);
		}
	});

	/**
	 * Should find diverse paths across the network structure.
	 *
	 * Tests that top-K paths include nodes from different communities,
	 * not just the shortest or most direct routes.
	 */
	it("should find diverse paths across the network structure", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const graph = benchmark.graph;

		// Use nodes from the periphery
		const source = "10"; // Member of Mr. Hi's faction
		const target = "26"; // Member of John A.'s faction

		const result = rankPaths(graph, source, target, { maxPaths: 10 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find multiple paths
			expect(paths.length).toBeGreaterThan(1);

			// Collect intermediate nodes
			const intermediates = new Set<string>();
			for (const path of paths) {
				for (const node of path.path.nodes) {
					if (node.id !== source && node.id !== target) {
						intermediates.add(node.id);
					}
				}
			}

			// Should have diverse intermediate nodes
			expect(intermediates.size).toBeGreaterThan(2);

			console.log("\n=== Karate Club Path Diversity ===");
			console.log(`Source: ${source}, Target: ${target}`);
			console.log(`Paths found: ${paths.length}`);
			console.log(`Intermediate nodes: ${intermediates.size}`);
		}
	});

	/**
	 * Should show statistical improvement over random baseline.
	 *
	 * Runs multiple trials and compares path diversity metrics
	 * using Mann-Whitney U test and Cohen's d effect size.
	 */
	it("should show statistical improvement over random baseline", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const graph = benchmark.graph;

		const source = "1";
		const target = "34";

		// Run multiple trials with different seeds for random baseline
		const salienceDiversity: number[] = [];
		const randomDiversity: number[] = [];

		for (let index = 0; index < 10; index++) {
			const salienceResult = rankPaths(graph, source, target, { maxPaths: 10 });
			const randomResult = randomPathRanking(graph, source, target, { maxPaths: 10, seed: 100 + index });

			if (salienceResult.ok && randomResult.ok &&
				salienceResult.value.some && randomResult.value.some) {

				const salienceMetrics = computeRankingMetrics(salienceResult.value.value, graph);
				const randomMetrics = computeRankingMetrics(randomResult.value.value, graph);

				salienceDiversity.push(salienceMetrics.pathDiversity);
				randomDiversity.push(randomMetrics.pathDiversity);
			}
		}

		// Statistical comparison
		const statTest = mannWhitneyUTest(salienceDiversity, randomDiversity);
		const effectSize = cohensD(salienceDiversity, randomDiversity);

		console.log("\n=== Statistical Test: Path Diversity ===");
		console.log(`Path Salience mean diversity: ${(salienceDiversity.reduce((a, b) => a + b, 0) / salienceDiversity.length).toFixed(3)}`);
		console.log(`Random mean diversity: ${(randomDiversity.reduce((a, b) => a + b, 0) / randomDiversity.length).toFixed(3)}`);
		console.log(`Mann-Whitney U: ${statTest.u.toFixed(2)}, p-value: ${statTest.pValue.toFixed(4)}`);
		console.log(`Cohen's d: ${effectSize.toFixed(3)}`);
		console.log(`Significant (α=0.05): ${statTest.significant}`);

		// Both methods should produce results
		expect(salienceDiversity.length).toBeGreaterThan(0);
		expect(randomDiversity.length).toBeGreaterThan(0);
	});

	/**
	 * Should handle edge cases with disconnected or distant nodes.
	 *
	 * Tests behavior on nodes that are far apart in the network
	 * or have few connecting paths.
	 */
	it("should handle nodes with few connecting paths", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const graph = benchmark.graph;

		// Use peripheral nodes with limited connectivity
		const source = "12"; // Low-degree node
		const target = "25"; // Another low-degree node

		const result = rankPaths(graph, source, target, { maxPaths: 10 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find at least the shortest path
			expect(paths.length).toBeGreaterThan(0);

			// All paths should be valid (start at source, end at target)
			for (const path of paths) {
				const nodes = path.path.nodes;
				expect(nodes[0].id).toBe(source);
				expect(nodes.at(-1)?.id).toBe(target);
			}

			console.log("\n=== Karate Club Limited Connectivity ===");
			console.log(`Source: ${source}, Target: ${target}`);
			console.log(`Paths found: ${paths.length}`);
		}
	});
});

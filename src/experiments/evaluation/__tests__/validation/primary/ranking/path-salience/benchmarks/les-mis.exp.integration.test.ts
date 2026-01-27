/**
 * Les Misérables Benchmark Tests for Path Salience Ranking
 *
 * Tests the Path Salience Ranking algorithm on the co-appearance network
 * of characters in Victor Hugo's novel "Les Misérables".
 *
 * The network has 77 nodes (characters) and 254 edges (co-appearances).
 * Characters are connected if they appear in the same chapter.
 *
 * Tests validate:
 * - Path ranking on literature-based social networks
 * - Character relationship analysis through network paths
 * - Statistical comparison against baseline methods
 */

import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers";
import { cohensD } from "@graph/evaluation/__tests__/validation/common/statistical-functions";
import { getTestNodePair, loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { randomPathRanking } from "@graph/experiments/baselines/random-path-ranking";
import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking";
import { describe, expect, it } from "vitest";

describe("Path Salience Ranking: Benchmarks - Les Misérables", () => {
	/**
	 * Should rank paths between main characters.
	 *
	 * Tests path ranking between Jean Valjean (node 11) and
	 * Javert (node 27), the two central characters with the
	 * most co-appearances in the novel.
	 */
	it("should rank paths between main characters", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const graph = benchmark.graph;

		// Use actual character names from the graph (not numeric indices)
		const { source, target } = getTestNodePair("lesmis"); // Valjean and Javert

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

			// All methods should find paths
			expect(saliencePaths.length).toBeGreaterThan(0);
			expect(shortestPaths.length).toBeGreaterThan(0);
			expect(randomPaths.length).toBeGreaterThan(0);

			// Compute metrics
			const salienceMetrics = computeRankingMetrics(saliencePaths, graph);
			const shortestMetrics = computeRankingMetrics(shortestPaths, graph);
			const randomMetrics = computeRankingMetrics(randomPaths, graph);

			console.log("\n=== Les Misérables Character Path Analysis ===");
			console.log(`Path Salience: ${saliencePaths.length} paths`);
			console.log(`  Mean MI: ${salienceMetrics.meanMI.toFixed(3)}`);
			console.log(`  Node Coverage: ${salienceMetrics.nodeCoverage.toFixed(2)}`);
			console.log(`  Path Diversity: ${salienceMetrics.pathDiversity.toFixed(3)}`);
			console.log(`Shortest Path: ${shortestPaths.length} paths`);
			console.log(`  Node Coverage: ${shortestMetrics.nodeCoverage.toFixed(2)}`);
			console.log(`Random Path: ${randomPaths.length} paths`);
			console.log(`  Node Coverage: ${randomMetrics.nodeCoverage.toFixed(2)}`);

			// Path Salience should provide competitive coverage
			expect(salienceMetrics.nodeCoverage).toBeGreaterThanOrEqual(shortestMetrics.nodeCoverage * 0.8);
		}
	});

	/**
	 * Should find diverse character connection paths.
	 *
	 * Tests that paths between peripheral characters include
	 * a variety of intermediate characters, showing different
	 * ways characters are connected in the story.
	 */
	it("should find diverse character connection paths", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const graph = benchmark.graph;

		// Use two characters who are not directly connected
		// but appear in the same storylines
		const source = "1"; // Myriel
		const target = "55"; // Mother Innocent (a peripheral character)

		const result = rankPaths(graph, source, target, { maxPaths: 12 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find multiple paths through the character network
			expect(paths.length).toBeGreaterThan(1);

			// Collect intermediate characters
			const intermediates = new Set<string>();
			for (const path of paths) {
				for (const node of path.path.nodes) {
					if (node.id !== source && node.id !== target) {
						intermediates.add(node.id);
					}
				}
			}

			// Should show diverse character connections
			expect(intermediates.size).toBeGreaterThan(1);

			console.log("\n=== Les Misérables Character Diversity ===");
			console.log(`From: ${source}, To: ${target}`);
			console.log(`Paths found: ${paths.length}`);
			console.log(`Intermediate characters: ${intermediates.size}`);
		}
	});

	/**
	 * Should handle central vs peripheral character queries.
	 *
	 * Compares path ranking between:
	 * 1. Two central characters (high degree)
	 * 2. Central to peripheral character
	 * 3. Two peripheral characters
	 */
	it("should handle central vs peripheral character queries", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const graph = benchmark.graph;

		// Central characters have many connections (use test pairs)
		const { source: central1, target: central2 } = getTestNodePair("lesmis"); // Valjean and Javert

		// Peripheral characters have few connections (actual character names from graph)
		const peripheral1 = "Myriel"; // Bishop who appears mainly in early chapters
		const peripheral2 = "Napoleon"; // Minor character

		// Test central-central
		const ccResult = rankPaths(graph, central1, central2, { maxPaths: 10 });

		// Test central-peripheral
		const cpResult = rankPaths(graph, central1, peripheral1, { maxPaths: 10 });

		// Test peripheral-peripheral
		const ppResult = rankPaths(graph, peripheral1, peripheral2, { maxPaths: 10 });

		expect(ccResult.ok).toBe(true);
		expect(cpResult.ok).toBe(true);
		expect(ppResult.ok).toBe(true);

		if (ccResult.ok && cpResult.ok && ppResult.ok &&
			ccResult.value.some && cpResult.value.some && ppResult.value.some) {

			const ccPaths = ccResult.value.value.length;
			const cpPaths = cpResult.value.value.length;
			const ppPaths = ppResult.value.value.length;

			console.log("\n=== Les Misérables Central vs Peripheral ===");
			console.log(`Central-Central: ${ccPaths} paths`);
			console.log(`Central-Peripheral: ${cpPaths} paths`);
			console.log(`Peripheral-Peripheral: ${ppPaths} paths`);

			// All should find some paths
			expect(ccPaths).toBeGreaterThan(0);
			expect(cpPaths).toBeGreaterThan(0);
			expect(ppPaths).toBeGreaterThan(0);
		}
	});

	/**
	 * Should show effect size against random baseline.
	 *
	 * Measures Cohen's d effect size for path diversity
	 * between Path Salience Ranking and random baseline.
	 */
	it("should show effect size against random baseline", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const graph = benchmark.graph;

		// Use actual character names from test pairs
		const { source, target } = getTestNodePair("lesmis"); // Valjean and Javert

		// Run multiple trials
		const salienceScores: number[] = [];
		const randomScores: number[] = [];

		for (let index = 0; index < 8; index++) {
			const salienceResult = rankPaths(graph, source, target, { maxPaths: 10 });
			const randomResult = randomPathRanking(graph, source, target, { maxPaths: 10, seed: 200 + index });

			if (salienceResult.ok && randomResult.ok &&
				salienceResult.value.some && randomResult.value.some) {

				const salienceMetrics = computeRankingMetrics(salienceResult.value.value, graph);
				const randomMetrics = computeRankingMetrics(randomResult.value.value, graph);

				salienceScores.push(salienceMetrics.meanMI);
				randomScores.push(randomMetrics.meanMI);
			}
		}

		const effectSize = cohensD(salienceScores, randomScores);

		console.log("\n=== Les Misérables Effect Size Analysis ===");
		console.log(`Path Salience mean MI: ${(salienceScores.reduce((a, b) => a + b, 0) / salienceScores.length).toFixed(3)}`);
		console.log(`Random mean MI: ${(randomScores.reduce((a, b) => a + b, 0) / randomScores.length).toFixed(3)}`);
		console.log(`Cohen's d: ${effectSize.toFixed(3)}`);

		// Should have data points
		expect(salienceScores.length).toBeGreaterThan(0);
		expect(randomScores.length).toBeGreaterThan(0);
	});
});

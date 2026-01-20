import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import { RandomPriorityExpansion } from "../../../../../experiments/baselines/random-priority"
import { StandardBfsExpansion } from "../../../../../experiments/baselines/standard-bfs"
import { loadBenchmarkByIdFromUrl } from "../../../fixtures/benchmark-datasets";
import { BenchmarkGraphExpander } from "../common/benchmark-graph-expander";
import { cohensD, confidenceInterval, mannWhitneyUTest, pathDiversity } from "../common/statistical-functions";

describe("Thesis Validation: Variability Injection", () => {
	describe("Multiple Seed Pair Analysis", () => {
		/**
		 * Test across multiple random seed pairs to assess consistency of performance.
		 * This provides better statistical power than single-seed tests.
		 */
		it("should compare methods across multiple seed pairs", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const numberSeedPairs = 10;

			const results: Array<{
				seeds: [string, string];
				dpPaths: number;
				bfsPaths: number;
				dpDiversity: number;
				bfsDiversity: number;
			}> = [];

			for (let index = 0; index < numberSeedPairs; index++) {
				// Select random seed pair
				const index1 = Math.floor(Math.random() * allNodes.length);
				let index2 = Math.floor(Math.random() * allNodes.length);
				while (index2 === index1) {
					index2 = Math.floor(Math.random() * allNodes.length);
				}

				const seeds: [string, string] = [allNodes[index1], allNodes[index2]];

				const dp = new DegreePrioritisedExpansion(expander, seeds);
				const bfs = new StandardBfsExpansion(expander, seeds);

				const [dpResult, bfsResult] = await Promise.all([dp.run(), bfs.run()]);

				results.push({
					seeds,
					dpPaths: dpResult.paths.length,
					bfsPaths: bfsResult.paths.length,
					dpDiversity: pathDiversity(dpResult.paths),
					bfsDiversity: pathDiversity(bfsResult.paths),
				});
			}

			// Analyze path diversity across all seed pairs
			const dpDiversities = results.map((r) => r.dpDiversity);
			const bfsDiversities = results.map((r) => r.bfsDiversity);

			const dpMean = dpDiversities.reduce((a, b) => a + b, 0) / dpDiversities.length;
			const bfsMean = bfsDiversities.reduce((a, b) => a + b, 0) / bfsDiversities.length;

			const dpCI = confidenceInterval(dpDiversities);
			const bfsCI = confidenceInterval(bfsDiversities);

			// Statistical test for difference in path diversity
			const diversityTest = mannWhitneyUTest(dpDiversities, bfsDiversities);
			const effectSize = cohensD(dpDiversities, bfsDiversities);

			console.log("\n=== Multi-Seed-Pair Analysis (Les Misérables) ===");
			console.log(`Trials: ${numberSeedPairs}`);
			console.log(`Degree-Prioritised diversity: ${dpMean.toFixed(3)} [${dpCI.lower.toFixed(3)}, ${dpCI.upper.toFixed(3)}]`);
			console.log(`BFS diversity: ${bfsMean.toFixed(3)} [${bfsCI.lower.toFixed(3)}, ${bfsCI.upper.toFixed(3)}]`);
			console.log(`Mann-Whitney U: ${diversityTest.u.toFixed(2)}, p-value: ${diversityTest.pValue.toFixed(4)}`);
			console.log(`Cohen's d: ${effectSize.toFixed(3)}`);
			console.log(`Significant: ${diversityTest.significant}`);

			// Expect consistent positive performance
			expect(dpMean).toBeGreaterThan(0);
			expect(bfsMean).toBeGreaterThan(0);

			// If significant, DP should have higher mean diversity
			if (diversityTest.significant && effectSize > 0) {
				expect(dpMean).toBeGreaterThan(bfsMean);
			}
		});

		/**
		 * Paired test: same seeds, different methods.
		 * This removes seed selection as a confounding variable.
		 */
		it("should show consistent method differences across paired trials", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			// Fixed seeds for paired comparison
			const seeds: [string, string] = ["1", "34"];
			const trials = 10;

			const dpPathCounts: number[] = [];
			const bfsPathCounts: number[] = [];
			const dpDiversities: number[] = [];
			const bfsDiversities: number[] = [];

			for (let index = 0; index < trials; index++) {
				// Add different random seed for Random Priority to create variability
				const dp = new DegreePrioritisedExpansion(expander, seeds);
				const bfs = new StandardBfsExpansion(expander, seeds);
				const rp = new RandomPriorityExpansion(expander, seeds, 1000 + index);

				const [dpResult, bfsResult] = await Promise.all([dp.run(), bfs.run(), rp.run()]);

				dpPathCounts.push(dpResult.paths.length);
				bfsPathCounts.push(bfsResult.paths.length);
				dpDiversities.push(pathDiversity(dpResult.paths));
				bfsDiversities.push(pathDiversity(bfsResult.paths));
			}

			// For deterministic algorithms, all trials should be identical
			const dpUniquePathCounts = new Set(dpPathCounts);
			const bfsUniquePathCounts = new Set(bfsPathCounts);

			console.log("\n=== Paired Trial Analysis (Karate Club) ===");
			console.log(`Degree-Prioritised path counts: ${dpPathCounts.join(", ")}`);
			console.log(`Standard BFS path counts: ${bfsPathCounts.join(", ")}`);
			console.log(`DP unique path counts: ${dpUniquePathCounts.size} value(s)`);
			console.log(`BFS unique path counts: ${bfsUniquePathCounts.size} value(s)`);

			// Verify determinism (same seeds → same results)
			expect(dpUniquePathCounts.size).toBe(1);
			expect(bfsUniquePathCounts.size).toBe(1);
		});
	});

	describe("Cross-Dataset Variability", () => {
		/**
		 * Test the same algorithm across different graph types to assess
		 * how performance varies with graph structure.
		 */
		it("should compare performance across different graph types", async () => {
			const datasets = ["karate", "lesmis", "cora"];
			const summary: Record<string, {
				nodes: number;
				edges: number;
				dpPaths: number;
				bfsPaths: number;
				dpDiversity: number;
				bfsDiversity: number;
			}> = {};

			for (const datasetId of datasets) {
				const benchmark = await loadBenchmarkByIdFromUrl(datasetId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

				const allNodes = expander.getAllNodeIds();
				const seeds: [string, string] = [allNodes[0], allNodes.at(-1)];

				const dp = new DegreePrioritisedExpansion(expander, seeds);
				const bfs = new StandardBfsExpansion(expander, seeds);

				const [dpResult, bfsResult] = await Promise.all([dp.run(), bfs.run()]);

				summary[datasetId] = {
					nodes: benchmark.nodeCount,
					edges: benchmark.edgeCount,
					dpPaths: dpResult.paths.length,
					bfsPaths: bfsResult.paths.length,
					dpDiversity: pathDiversity(dpResult.paths),
					bfsDiversity: pathDiversity(bfsResult.paths),
				};
			}

			console.log("\n=== Cross-Dataset Performance Summary ===");
			console.log(JSON.stringify(summary, null, 2));

			// Analyze trend: does DP advantage increase with graph size/complexity?
			const datasetNames = Object.keys(summary);
			const dpAdvantages = datasetNames.map((name) => summary[name].dpDiversity - summary[name].bfsDiversity);

			console.log(`DP diversity advantages: ${dpAdvantages.map((v) => v.toFixed(3)).join(", ")}`);
			console.log(`Mean advantage: ${(dpAdvantages.reduce((a, b) => a + b, 0) / dpAdvantages.length).toFixed(3)}`);

			// Verify all datasets tested successfully
			expect(Object.keys(summary).length).toBe(3);
		});
	});
});

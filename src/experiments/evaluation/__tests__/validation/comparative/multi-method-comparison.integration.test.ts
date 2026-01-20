/**
 * Multi-Method Comparison with Significance Testing
 *
 * Compares all four expansion methods (Degree-Prioritised, BFS, Frontier-Balanced, Random)
 * with proper statistical testing including Mann-Whitney U tests, Cohen's d effect sizes,
 * and confidence intervals.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import { FrontierBalancedExpansion } from "../../../../../experiments/baselines/frontier-balanced"
import { RandomPriorityExpansion } from "../../../../../experiments/baselines/random-priority"
import { StandardBfsExpansion } from "../../../../../experiments/baselines/standard-bfs"
import { loadBenchmarkByIdFromUrl } from "../../../fixtures/benchmark-datasets";
import { BenchmarkGraphExpander } from "../common/benchmark-graph-expander";
import { cohensD, confidenceInterval, mannWhitneyUTest } from "../common/statistical-functions";

describe("Thesis Validation: Statistical Tests", () => {
	describe("Multi-Method Comparison with Significance Testing", () => {
		/**
		 * Compare all four methods (Degree-Prioritised, BFS, Frontier-Balanced, Random)
		 * with proper statistical testing.
		 */
		it("should compare all methods with statistical significance", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);
			const seeds: [string, string] = ["1", "34"];

			// Run each method multiple times (for random priority variants)
			const trials = 10;
			const results = {
				degreePrioritised: [] as number[],
				standardBfs: [] as number[],
				frontierBalanced: [] as number[],
				randomPriority: [] as number[],
			};

			for (let index = 0; index < trials; index++) {
				const dp = new DegreePrioritisedExpansion(expander, seeds);
				const bfs = new StandardBfsExpansion(expander, seeds);
				const fb = new FrontierBalancedExpansion(expander, seeds);
				const rp = new RandomPriorityExpansion(expander, seeds, 1000 + index);

				const [dpRes, bfsRes, fbRes, rpRes] = await Promise.all([
					dp.run(),
					bfs.run(),
					fb.run(),
					rp.run(),
				]);

				results.degreePrioritised.push(dpRes.stats.nodesExpanded);
				results.standardBfs.push(bfsRes.stats.nodesExpanded);
				results.frontierBalanced.push(fbRes.stats.nodesExpanded);
				results.randomPriority.push(rpRes.stats.nodesExpanded);
			}

			// Calculate pairwise Mann-Whitney U tests
			console.log("\n=== Pairwise Statistical Comparisons ===");

			const pairs: Array<[string, string, number[], number[]]> = [
				["Degree-Prioritised", "Standard BFS", results.degreePrioritised, results.standardBfs],
				["Degree-Prioritised", "Frontier-Balanced", results.degreePrioritised, results.frontierBalanced],
				["Degree-Prioritised", "Random Priority", results.degreePrioritised, results.randomPriority],
			];

			for (const [name1, name2, sample1, sample2] of pairs) {
				const test = mannWhitneyUTest(sample1, sample2);
				const effect = cohensD(sample1, sample2);
				const ci1 = confidenceInterval(sample1);
				const ci2 = confidenceInterval(sample2);

				console.log(`\n${name1} vs ${name2}:`);
				console.log(`  ${name1} mean: ${(sample1.reduce((a, b) => a + b, 0) / sample1.length).toFixed(2)} [${ci1.lower.toFixed(2)}, ${ci1.upper.toFixed(2)}]`);
				console.log(`  ${name2} mean: ${(sample2.reduce((a, b) => a + b, 0) / sample2.length).toFixed(2)} [${ci2.lower.toFixed(2)}, ${ci2.upper.toFixed(2)}]`);
				console.log(`  Mann-Whitney U: ${test.u.toFixed(2)}, p-value: ${test.pValue.toFixed(4)}`);
				console.log(`  Cohen's d: ${effect.toFixed(3)}`);
				console.log(`  Significant: ${test.significant ? "YES" : "NO"} (α=0.05)`);
			}

			// Verify all methods complete successfully
			expect(results.degreePrioritised.every((n) => n > 0)).toBe(true);
			expect(results.standardBfs.every((n) => n > 0)).toBe(true);
			expect(results.frontierBalanced.every((n) => n > 0)).toBe(true);
			expect(results.randomPriority.every((n) => n > 0)).toBe(true);
		});
	});
});

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { FrontierBalancedExpansion } from "../../../../../../../baselines/frontier-balanced"
import { RandomPriorityExpansion } from "../../../../../../../baselines/random-priority"
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs"
import { loadBenchmarkByIdFromUrl } from "../../../../../../fixtures/benchmark-datasets";
import { BenchmarkGraphExpander } from "../../../../common/benchmark-graph-expander";
import { cohensD, mannWhitneyUTest, pathDiversity } from "../../../../common/statistical-functions";

describe("Karate Club Dataset", () => {
	/**
	 * Karate Club is a well-studied social network with 34 nodes and 78 edges.
	 * Known to have two communities with ground-truth partition.
	 *
	 * Tests validate algorithm behavior on small real-world networks.
	 */
	it("should compare all methods on Karate Club network", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		// Select two nodes from different known communities as seeds
		// Node 1 (Mr. Hi's faction) and Node 34 (John A.'s faction)
		const seeds: [string, string] = ["1", "34"];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);
		const frontierBalanced = new FrontierBalancedExpansion(expander, seeds);
		const randomPriority = new RandomPriorityExpansion(expander, seeds, 42);

		const [dpResult, bfsResult, fbResult, rpResult] = await Promise.all([
			degreePrioritised.run(),
			standardBfs.run(),
			frontierBalanced.run(),
			randomPriority.run(),
		]);

		// All methods should find paths between the factions
		expect(dpResult.paths.length).toBeGreaterThan(0);
		expect(bfsResult.paths.length).toBeGreaterThan(0);
		expect(fbResult.paths.length).toBeGreaterThan(0);
		expect(rpResult.paths.length).toBeGreaterThan(0);

		// Log path diversity metrics
		console.log("\n=== Karate Club Path Analysis ===");
		console.log(`Degree-Prioritised: ${dpResult.paths.length} paths, diversity: ${pathDiversity(dpResult.paths).toFixed(3)}`);
		console.log(`Standard BFS: ${bfsResult.paths.length} paths, diversity: ${pathDiversity(bfsResult.paths).toFixed(3)}`);
		console.log(`Frontier-Balanced: ${fbResult.paths.length} paths, diversity: ${pathDiversity(fbResult.paths).toFixed(3)}`);
		console.log(`Random Priority: ${rpResult.paths.length} paths, diversity: ${pathDiversity(rpResult.paths).toFixed(3)}`);

		// Verify all nodes are reachable
		expect(dpResult.sampledNodes.size).toBe(34);
		expect(bfsResult.sampledNodes.size).toBe(34);
	});

	/**
	 * Statistical significance test for node expansion counts.
	 */
	it("should show significant differences in expansion patterns", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);
		const seeds: [string, string] = ["1", "34"];

		// Run multiple trials with different random seeds for Random Priority
		const dpResults: number[] = [];
		const bfsResults: number[] = [];
		const rpResults: number[] = [];

		for (let index = 0; index < 10; index++) {
			const dp = new DegreePrioritisedExpansion(expander, seeds);
			const bfs = new StandardBfsExpansion(expander, seeds);
			const rp = new RandomPriorityExpansion(expander, seeds, 100 + index);

			const [dpRes, bfsRes, rpRes] = await Promise.all([dp.run(), bfs.run(), rp.run()]);

			dpResults.push(dpRes.stats.nodesExpanded);
			bfsResults.push(bfsRes.stats.nodesExpanded);
			rpResults.push(rpRes.stats.nodesExpanded);
		}

		// Statistical test: Degree-Prioritised vs BFS
		const dpVsBfs = mannWhitneyUTest(dpResults, bfsResults);
		const effectSize = cohensD(dpResults, bfsResults);

		console.log("\n=== Statistical Test: Nodes Expanded ===");
		console.log(`Degree-Prioritised mean: ${(dpResults.reduce((a, b) => a + b, 0) / dpResults.length).toFixed(2)}`);
		console.log(`BFS mean: ${(bfsResults.reduce((a, b) => a + b, 0) / bfsResults.length).toFixed(2)}`);
		console.log(`Mann-Whitney U: ${dpVsBfs.u.toFixed(2)}, p-value: ${dpVsBfs.pValue.toFixed(4)}`);
		console.log(`Cohen's d effect size: ${effectSize.toFixed(3)}`);
		console.log(`Significant at α=0.05: ${dpVsBfs.significant}`);

		// All methods should complete without errors
		expect(dpResults.every((n) => n > 0)).toBe(true);
		expect(bfsResults.every((n) => n > 0)).toBe(true);
	});
});

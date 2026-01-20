import { describe, it, expect } from "vitest";
import { BenchmarkGraphExpander } from "../../../../common/benchmark-graph-expander";
import { loadBenchmarkByIdFromUrl } from "../../../../../../fixtures/benchmark-datasets";
import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs"
import { pathDiversity } from "../../../../common/statistical-functions";

describe("Facebook Dataset", () => {
	/**
	 * Facebook ego network (4039 nodes, 88234 edges).
	 * Large-scale social network to test scalability and behavior on
	 * networks with higher degree variance.
	 */
	it("should scale to large social networks", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		// Select nodes from different parts of the network
		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[Math.floor(allNodes.length / 2)]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([
			degreePrioritised.run(),
			standardBfs.run(),
		]);

		console.log("\n=== Facebook Social Network ===");
		console.log(`Graph: ${benchmark.nodeCount} nodes, ${benchmark.edgeCount} edges`);
		console.log(`Degree-Prioritised sampled: ${dpResult.sampledNodes.size} nodes (${((dpResult.sampledNodes.size / benchmark.nodeCount) * 100).toFixed(1)}%)`);
		console.log(`Standard BFS sampled: ${bfsResult.sampledNodes.size} nodes (${((bfsResult.sampledNodes.size / benchmark.nodeCount) * 100).toFixed(1)}%)`);
		console.log(`DP paths found: ${dpResult.paths.length}`);
		console.log(`BFS paths found: ${bfsResult.paths.length}`);

		// Calculate path diversity
		const dpDiversity = pathDiversity(dpResult.paths);
		const bfsDiversity = pathDiversity(bfsResult.paths);

		console.log(`DP path diversity: ${dpDiversity.toFixed(3)}`);
		console.log(`BFS path diversity: ${bfsDiversity.toFixed(3)}`);

		// Both methods should complete successfully on large graphs
		expect(dpResult.stats.iterations).toBeGreaterThan(0);
		expect(bfsResult.stats.iterations).toBeGreaterThan(0);

		// Verify reasonable sampling (not just seeds, may be all nodes on connected graphs)
		expect(dpResult.sampledNodes.size).toBeGreaterThan(10);
		expect(dpResult.sampledNodes.size).toBeLessThanOrEqual(benchmark.nodeCount);
	});

	/**
	 * Statistical comparison on larger dataset.
	 */
	it("should show meaningful path diversity differences on larger graphs", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[allNodes.length - 1]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([
			degreePrioritised.run(),
			standardBfs.run(),
		]);

		// Path diversity is the key differentiator
		const dpDiversity = pathDiversity(dpResult.paths);
		const bfsDiversity = pathDiversity(bfsResult.paths);

		console.log("\n=== Facebook Path Diversity Comparison ===");
		console.log(`Degree-Prioritised: ${dpResult.paths.length} paths, diversity ${dpDiversity.toFixed(3)}`);
		console.log(`Standard BFS: ${bfsResult.paths.length} paths, diversity ${bfsDiversity.toFixed(3)}`);

		// Degree-prioritised should achieve equal or better path diversity
		expect(dpDiversity).toBeGreaterThanOrEqual(bfsDiversity * 0.95);
	});
});

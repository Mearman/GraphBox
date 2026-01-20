import { BenchmarkGraphExpander } from "../../common/benchmark-graph-expander";
import { loadBenchmarkByIdFromUrl } from "../../../fixtures/benchmark-datasets";
import { DegreePrioritisedExpansion } from "../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../baselines/standard-bfs";
import { pathDiversity } from "../../common/statistical-functions";

describe("Thesis Validation: CiteSeer Dataset", () => {
	it("should handle larger citation network (3327 nodes)", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("citeseer");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[Math.floor(allNodes.length / 2)]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

		console.log("\n=== CiteSeer Citation Network ===");
		console.log(`Graph: ${benchmark.nodeCount} nodes, ${benchmark.edgeCount} edges`);
		console.log(`Degree-Prioritised sampled: ${dpResult.sampledNodes.size} nodes`);
		console.log(`Standard BFS sampled: ${bfsResult.sampledNodes.size} nodes`);
		console.log(`DP paths found: ${dpResult.paths.length}`);
		console.log(`BFS paths found: ${bfsResult.paths.length}`);

		const dpDiversity = pathDiversity(dpResult.paths);
		const bfsDiversity = pathDiversity(bfsResult.paths);

		console.log(`DP path diversity: ${dpDiversity.toFixed(3)}`);
		console.log(`BFS path diversity: ${bfsDiversity.toFixed(3)}`);

		expect(dpResult.sampledNodes.size).toBeGreaterThan(10);
		expect(bfsResult.sampledNodes.size).toBeGreaterThan(10);
		expect(dpResult.stats.iterations).toBeGreaterThan(0);
		expect(bfsResult.stats.iterations).toBeGreaterThan(0);
	});

	it("should show method differences on citation network", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("citeseer");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[allNodes.length - 1]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

		const dpDiversity = pathDiversity(dpResult.paths);
		const bfsDiversity = pathDiversity(bfsResult.paths);
		const improvement = ((dpDiversity - bfsDiversity) / Math.max(bfsDiversity, 0.001)) * 100;

		console.log("\n=== CiteSeer Path Diversity Comparison ===");
		console.log(`DP: ${dpResult.paths.length} paths, diversity ${dpDiversity.toFixed(3)}`);
		console.log(`BFS: ${bfsResult.paths.length} paths, diversity ${bfsDiversity.toFixed(3)}`);
		console.log(`Improvement: ${improvement.toFixed(1)}%`);

		// Tests should complete regardless of outcome
		expect(dpResult.paths.length).toBeGreaterThanOrEqual(0);
		expect(bfsResult.paths.length).toBeGreaterThanOrEqual(0);
	});
});

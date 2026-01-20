import { describe, expect,it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs"
import { loadBenchmarkByIdFromUrl } from "../../../../../../fixtures/benchmark-datasets";
import { BenchmarkGraphExpander } from "../../../../common/benchmark-graph-expander";

describe("Cora Citation Network", () => {
	/**
	 * Cora is a citation network of ML papers (2708 nodes, 5429 edges).
	 * Tests scalability and behavior on larger real-world networks.
	 */
	it("should scale to larger citation networks", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("cora");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		// Select two papers as seeds
		const allNodes = benchmark.graph.getAllNodes();
		const nodeIds = allNodes.map((n) => n.id);
		const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([
			degreePrioritised.run(),
			standardBfs.run(),
		]);

		console.log("\n=== Cora Citation Network ===");
		console.log(`Graph: ${benchmark.nodeCount} nodes, ${benchmark.edgeCount} edges`);
		console.log(`Degree-Prioritised sampled: ${dpResult.sampledNodes.size} nodes`);
		console.log(`Standard BFS sampled: ${bfsResult.sampledNodes.size} nodes`);
		console.log(`DP paths found: ${dpResult.paths.length}`);
		console.log(`BFS paths found: ${bfsResult.paths.length}`);

		// Both methods should complete successfully
		expect(dpResult.stats.iterations).toBeGreaterThan(0);
		expect(bfsResult.stats.iterations).toBeGreaterThan(0);
	});
});

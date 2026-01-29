import { detectCommunities } from "@graph/algorithms/clustering/louvain";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { describe, expect, it } from "vitest";

describe("Community Detection: Louvain - Cora", () => {
	it("should detect communities with positive modularity", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("cora");
		const graph = benchmark.graph;
		const { communities, stats } = detectCommunities(graph);

		expect(communities.length).toBeGreaterThanOrEqual(2);
		const totalModularity = communities.reduce((sum, c) => sum + c.modularity, 0);
		expect(totalModularity).toBeGreaterThan(0);

		console.log("\n=== Community Detection ===");
		console.log("dataset\tmethod\tcommunities\tmodularity\titerations\tnodes");
		console.log(
			`Cora\tLouvain\t${communities.length}\t${totalModularity.toFixed(4)}\t${stats.totalIterations}\t${graph.getNodeCount()}`,
		);
	});
});

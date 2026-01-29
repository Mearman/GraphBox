import { detectCommunities } from "@graph/algorithms/clustering/louvain";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { describe, expect, it } from "vitest";

const BENCHMARKS = [
	{ id: "karate", name: "Karate Club", expectedNodes: 34 },
	{ id: "les-mis", name: "Les Miserables", expectedNodes: 77 },
	{ id: "cora", name: "Cora", expectedNodes: 2708 },
	{ id: "facebook", name: "Facebook", expectedNodes: 4039 },
] as const;

describe("Community Detection: Louvain - Modularity Quality", () => {
	it("should achieve positive modularity across all benchmark graphs", async () => {
		const rows: string[] = [];

		for (const { id, name, expectedNodes } of BENCHMARKS) {
			const benchmark = await loadBenchmarkByIdFromUrl(id);
			const graph = benchmark.graph;
			const { communities, stats } = detectCommunities(graph);

			const totalModularity = communities.reduce((sum, c) => sum + c.modularity, 0);

			expect(communities.length).toBeGreaterThanOrEqual(2);
			expect(totalModularity).toBeGreaterThan(0);
			expect(graph.getNodeCount()).toBe(expectedNodes);

			rows.push(
				`${name}\tLouvain\t${communities.length}\t${totalModularity.toFixed(4)}\t${stats.totalIterations}\t${graph.getNodeCount()}`,
			);
		}

		console.log("\n=== Community Detection ===");
		console.log("dataset\tmethod\tcommunities\tmodularity\titerations\tnodes");
		for (const row of rows) {
			console.log(row);
		}
	});
});

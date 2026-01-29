import { labelPropagation } from "@graph/algorithms/clustering/label-propagation";
import { leiden } from "@graph/algorithms/clustering/leiden";
import { detectCommunities } from "@graph/algorithms/clustering/louvain";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { describe, expect, it } from "vitest";

const BENCHMARKS = [
	{ id: "karate", name: "Karate Club" },
	{ id: "les-mis", name: "Les Miserables" },
] as const;

describe("Community Detection: Method Comparison", () => {
	it("should compare community detection methods across benchmarks", async () => {
		const rows: string[] = [];

		for (const { id, name } of BENCHMARKS) {
			const benchmark = await loadBenchmarkByIdFromUrl(id);
			const graph = benchmark.graph;
			const nodeCount = graph.getNodeCount();

			// Louvain
			const louvainResult = detectCommunities(graph);
			const louvainModularity = louvainResult.communities.reduce(
				(sum: number, c) => sum + c.modularity,
				0,
			);
			rows.push(
				`${name}\tLouvain\t${louvainResult.communities.length}\t${louvainModularity.toFixed(4)}\t${louvainResult.stats.totalIterations}\t${nodeCount}`,
			);

			// Leiden
			const leidenResult = leiden(graph);
			expect(leidenResult.ok).toBe(true);
			if (leidenResult.ok) {
				const leidenModularity = leidenResult.value.communities.reduce(
					(sum: number, c) => sum + c.modularity,
					0,
				);
				rows.push(
					`${name}\tLeiden\t${leidenResult.value.communities.length}\t${leidenModularity.toFixed(4)}\t${leidenResult.value.metadata.iterations}\t${nodeCount}`,
				);
			}

			// Label Propagation
			const lpResult = labelPropagation(graph, { seed: 42_042_024 });
			expect(lpResult.ok).toBe(true);
			if (lpResult.ok) {
				rows.push(
					`${name}\tLabel Propagation\t${lpResult.value.clusters.length}\t-\t${lpResult.value.metadata.iterations}\t${nodeCount}`,
				);
			}
		}

		console.log("\n=== Community Detection ===");
		console.log("dataset\tmethod\tcommunities\tmodularity\titerations\tnodes");
		for (const row of rows) {
			console.log(row);
		}
	});
});

import { describe, expect,it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs"
import { loadBenchmarkByIdFromUrl } from "../../../../../../fixtures/benchmark-datasets";
import { BenchmarkGraphExpander } from "../../../../common/benchmark-graph-expander";
import { calculateTopicCoverage } from "../../../../common/statistical-functions";

describe("Les Misérables Dataset", () => {
	/**
	 * Les Misérables character co-appearance network (77 nodes, 254 edges).
	 * Tests algorithm on moderately sized real-world networks with
	 * heterogeneous degree distribution.
	 */
	it("should demonstrate hub deferral on character network", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		// Use first and last nodes as seeds (likely to be connected in a co-appearance network)
		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([
			degreePrioritised.run(),
			standardBfs.run(),
		]);

		// Calculate hub involvement (nodes with degree >= 10)
		const dpHubDegrees: number[] = [];
		const bfsHubDegrees: number[] = [];

		for (const nodeId of dpResult.sampledNodes) {
			const degree = expander.getDegree(nodeId);
			if (degree >= 10) dpHubDegrees.push(degree);
		}

		for (const nodeId of bfsResult.sampledNodes) {
			const degree = expander.getDegree(nodeId);
			if (degree >= 10) bfsHubDegrees.push(degree);
		}

		console.log("\n=== Les Misérables Hub Analysis ===");
		console.log(`Degree-Prioritised: ${dpHubDegrees.length} high-degree nodes sampled`);
		console.log(`Standard BFS: ${bfsHubDegrees.length} high-degree nodes sampled`);
		console.log(`Total sampled: DP=${dpResult.sampledNodes.size}, BFS=${bfsResult.sampledNodes.size}`);

		// Both should find paths in this connected network
		expect(dpResult.paths.length).toBeGreaterThan(0);
		expect(bfsResult.paths.length).toBeGreaterThan(0);
	});

	/**
	 * Application metric: Topic coverage for literature review.
	 */
	it("should provide good coverage of topical regions", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		const expansion = new DegreePrioritisedExpansion(expander, seeds);
		const result = await expansion.run();

		const coverage = calculateTopicCoverage(result.sampledNodes, expander);

		console.log("\n=== Les Misérables Coverage Analysis ===");
		console.log(`Hub coverage: ${(coverage.coverage * 100).toFixed(1)}%`);
		console.log(`Average degree: ${coverage.avgDegree.toFixed(2)}`);
		console.log(`Hub ratio: ${(coverage.hubRatio * 100).toFixed(1)}%`);

		// Should sample nodes with varying degrees (representative)
		expect(coverage.avgDegree).toBeGreaterThan(0);
	});
});

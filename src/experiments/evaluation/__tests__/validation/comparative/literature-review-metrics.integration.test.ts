/**
 * Systematic Literature Review Metrics Tests
 *
 * Application-specific evaluation metrics for systematic literature review workflows.
 * Tests hub deferral, recall efficiency, citation coverage, and early discovery rate.
 *
 * These metrics are specific to the citation network use case where:
 * - High-degree nodes represent survey/mega-citation papers
 * - Hub deferral improves topical diversity
 * - Early discovery of diverse paths improves review efficiency
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../../experiments/baselines/standard-bfs"
import { loadBenchmarkByIdFromUrl } from "../../../fixtures/benchmark-datasets";
import { BenchmarkGraphExpander } from "../common/benchmark-graph-expander";
import { pathDiversity } from "../common/statistical-functions";

describe("Systematic Literature Review Metrics", () => {
	/**
	 * Metric: Recall efficiency - papers found per expansion step.
	 * For systematic reviews, finding relevant papers early is crucial.
	 */
	it("should measure recall efficiency for literature review", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("cora");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		// Simulate starting from a seed paper and expanding
		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[Math.floor(allNodes.length / 2)]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([
			degreePrioritised.run(),
			standardBfs.run(),
		]);

		// Calculate "recall efficiency": unique papers found per iteration
		// This is approximated by: total papers / iterations
		const dpRecallEfficiency = dpResult.sampledNodes.size / dpResult.stats.iterations;
		const bfsRecallEfficiency = bfsResult.sampledNodes.size / bfsResult.stats.iterations;

		console.log("\n=== Recall Efficiency Analysis ===");
		console.log(`Degree-Prioritised: ${dpRecallEfficiency.toFixed(2)} papers/iteration`);
		console.log(`Standard BFS: ${bfsRecallEfficiency.toFixed(2)} papers/iteration`);
		console.log(`DP iterations: ${dpResult.stats.iterations}`);
		console.log(`BFS iterations: ${bfsResult.stats.iterations}`);

		// Both should find papers efficiently
		expect(dpRecallEfficiency).toBeGreaterThan(0);
		expect(bfsRecallEfficiency).toBeGreaterThan(0);
	});

	/**
	 * Metric: Citation coverage - proportion of citation paths discovered.
	 * Measures how completely the expansion captures citation relationships.
	 */
	it("should measure citation coverage quality", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("cora");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[Math.floor(allNodes.length / 2)]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const result = await degreePrioritised.run();

		// Calculate coverage: what proportion of all possible citations are traversed
		const totalCitations = benchmark.edgeCount;
		const traversedEdges = result.stats.edgesTraversed;
		const coverage = traversedEdges / totalCitations;

		console.log("\n=== Citation Coverage Analysis ===");
		console.log(`Total citations in dataset: ${totalCitations}`);
		console.log(`Edges traversed: ${traversedEdges}`);
		console.log(`Coverage: ${(coverage * 100).toFixed(2)}%`);
		console.log(`Papers sampled: ${result.sampledNodes.size} / ${benchmark.nodeCount}`);

		// Should traverse meaningful portion of citation graph
		expect(coverage).toBeGreaterThan(0);
		expect(result.sampledNodes.size).toBeGreaterThan(100);
	});

	/**
	 * Metric: Hub deferral effectiveness - measures how well the algorithm
	 * defers expanding high-degree papers (which often represent survey papers
	 * rather than focused research).
	 */
	it("should demonstrate hub deferral in citation networks", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("cora");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		// Select two medium-degree papers as seeds (not hubs)
		const allNodes = expander.getAllNodeIds();
		const nodeDegrees = allNodes.map((id) => ({ id, degree: expander.getDegree(id) }));
		nodeDegrees.sort((a, b) => a.degree - b.degree);

		// Find papers with moderate degree (5-15 citations)
		const moderatePapers = nodeDegrees.filter((n) => n.degree >= 5 && n.degree <= 15);
		const seeds: [string, string] = [moderatePapers[0].id, moderatePapers[Math.min(10, moderatePapers.length - 1)].id];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([
			degreePrioritised.run(),
			standardBfs.run(),
		]);

		// Count high-degree papers (degree > 20) in sampled set
		const hubThreshold = 20;
		const dpHighDegreeCount = [...dpResult.sampledNodes].filter((id) => expander.getDegree(id) > hubThreshold).length;
		const bfsHighDegreeCount = [...bfsResult.sampledNodes].filter((id) => expander.getDegree(id) > hubThreshold).length;

		// Calculate ratio of high-degree papers
		const dpHubRatio = dpResult.sampledNodes.size > 0 ? dpHighDegreeCount / dpResult.sampledNodes.size : 0;
		const bfsHubRatio = bfsResult.sampledNodes.size > 0 ? bfsHighDegreeCount / bfsResult.sampledNodes.size : 0;

		console.log("\n=== Hub Deferral Effectiveness ===");
		console.log(`Hub threshold: >${hubThreshold} citations`);
		console.log(`Degree-Prioritised: ${dpHighDegreeCount} high-degree papers (${(dpHubRatio * 100).toFixed(1)}% of sampled)`);
		console.log(`Standard BFS: ${bfsHighDegreeCount} high-degree papers (${(bfsHubRatio * 100).toFixed(1)}% of sampled)`);

		// The key metric: path diversity in presence of hubs
		const dpDiversity = pathDiversity(dpResult.paths);
		const bfsDiversity = pathDiversity(bfsResult.paths);

		console.log(`DP path diversity: ${dpDiversity.toFixed(3)}`);
		console.log(`BFS path diversity: ${bfsDiversity.toFixed(3)}`);

		// Degree-prioritised should maintain or improve path diversity
		expect(dpDiversity).toBeGreaterThanOrEqual(bfsDiversity * 0.9);
	});

	/**
	 * Metric: Early discovery rate - how quickly diverse paths are found.
	 * For literature reviews, finding diverse citation paths early improves efficiency.
	 */
	it("should measure early discovery rate of diverse paths", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1)];

		// We need to instrument to track early discovery
		// For now, use total path diversity as proxy
		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const result = await degreePrioritised.run();

		// Calculate path diversity
		const diversity = pathDiversity(result.paths);

		console.log("\n=== Early Discovery Analysis ===");
		console.log(`Total paths found: ${result.paths.length}`);
		console.log(`Path diversity: ${diversity.toFixed(3)}`);
		console.log(`Iterations to completion: ${result.stats.iterations}`);
		console.log(`Discovery rate: ${(result.paths.length / result.stats.iterations).toFixed(3)} paths/iteration`);

		// Should find paths efficiently
		expect(result.paths.length).toBeGreaterThan(0);
		expect(diversity).toBeGreaterThan(0);
	});
});

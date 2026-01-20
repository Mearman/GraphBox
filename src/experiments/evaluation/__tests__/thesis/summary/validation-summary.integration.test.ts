/**
 * Thesis Validation: Summary and Additional Metrics Tests
 *
 * Comprehensive summary combining all validation dimensions,
 * plus extended metrics for path length, coverage efficiency,
 * and hub participation analysis.
 */

import { describe, expect, it } from "vitest";

import { BenchmarkGraphExpander } from "../common/benchmark-graph-expander";
import {
	createBenchmarkMeta,
	loadBenchmarkByIdFromUrl,
	loadBenchmarkFromContent,
} from "../../../fixtures/benchmark-datasets";
import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../baselines/standard-bfs";
import { jaccardSimilarity, pathDiversity } from "../common/statistical-functions";

// ============================================================================
// Thesis Validation: Summary
// ============================================================================

describe("Thesis Validation: Summary", () => {
	/**
	 * Comprehensive summary combining all validation dimensions.
	 */
	it("should output comprehensive validation summary", async () => {
		const datasets = ["karate", "lesmis", "cora", "facebook"];
		const summary: Record<string, unknown> = {};

		for (const datasetId of datasets) {
			const benchmark = await loadBenchmarkByIdFromUrl(datasetId);
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes[allNodes.length - 1]];

			const dp = new DegreePrioritisedExpansion(expander, seeds);
			const bfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([dp.run(), bfs.run()]);

			const nodeSimilarity = jaccardSimilarity(dpResult.sampledNodes, bfsResult.sampledNodes);
			const dpDiversity = pathDiversity(dpResult.paths);
			const bfsDiversity = pathDiversity(bfsResult.paths);

			// Calculate percentage of graph sampled
			const dpCoverage = (dpResult.sampledNodes.size / benchmark.nodeCount) * 100;
			const bfsCoverage = (bfsResult.sampledNodes.size / benchmark.nodeCount) * 100;

			summary[datasetId] = {
				nodes: benchmark.nodeCount,
				edges: benchmark.edgeCount,
				dpCoverage: `${dpCoverage.toFixed(1)}%`,
				bfsCoverage: `${bfsCoverage.toFixed(1)}%`,
				dpPaths: dpResult.paths.length,
				bfsPaths: bfsResult.paths.length,
				dpDiversity: dpDiversity.toFixed(3),
				bfsDiversity: bfsDiversity.toFixed(3),
				diversityImprovement: `${((dpDiversity - bfsDiversity) / Math.max(bfsDiversity, 0.001) * 100).toFixed(1)}%`,
			};
		}

		console.log("\n=== Comprehensive Validation Summary ===");
		console.log(JSON.stringify(summary, null, 2));

		// Calculate aggregate statistics
		const summaryKeys = Object.keys(summary);
		const avgDiversityImprovement = summaryKeys.reduce((sum, key) => {
			const entry = summary[key] as { diversityImprovement: string };
			return sum + parseFloat(entry.diversityImprovement);
		}, 0) / summaryKeys.length;

		console.log(`\nAverage path diversity improvement: ${avgDiversityImprovement.toFixed(2)}%`);

		// Basic validation that tests ran successfully
		expect(Object.keys(summary).length).toBe(4);
	});
});

// ============================================================================
// Thesis Validation: Additional Metrics
// ============================================================================

describe("Thesis Validation: Additional Metrics", () => {
	/**
	 * Calculate path length statistics.
	 */
	const pathLengthStats = (paths: Array<{ nodes: string[] }>) => {
		const lengths = paths.map((p) => p.nodes.length);
		if (lengths.length === 0) {
			return { min: 0, max: 0, mean: 0, median: 0 };
		}
		const sorted = [...lengths].sort((a, b) => a - b);
		return {
			min: sorted[0],
			max: sorted[sorted.length - 1],
			mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
			median: sorted[Math.floor(sorted.length / 2)],
		};
	};

	/**
	 * Calculate coverage efficiency (nodes sampled per iteration).
	 */
	const coverageEfficiency = (sampledNodes: number, iterations: number): number => {
		return iterations > 0 ? sampledNodes / iterations : 0;
	};

	/**
	 * Calculate hub participation ratio (high-degree nodes in sampled set).
	 */
	const hubParticipation = (
		sampledIds: string[],
		allNodes: Array<{ id: string }>,
		getDegree: (id: string) => number,
		percentile: number = 90
	): { sampledHubs: number; totalHubs: number; ratio: number } => {
		const degrees = allNodes.map((n) => ({ id: n.id, degree: getDegree(n.id) }));
		const hubThreshold = percentile === 90
			? degrees.sort((a, b) => b.degree - a.degree)[Math.floor(degrees.length * 0.1)]?.degree ?? 0
			: degrees.sort((a, b) => b.degree - a.degree)[Math.floor(degrees.length * (1 - percentile / 100))]?.degree ?? 0;

		const totalHubs = degrees.filter((n) => n.degree >= hubThreshold).length;
		const sampledHubs = sampledIds.filter((id) => getDegree(id) >= hubThreshold).length;

		return {
			sampledHubs,
			totalHubs,
			ratio: totalHubs > 0 ? sampledHubs / totalHubs : 0,
		};
	};

	it("should analyse path length distributions", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[allNodes.length - 1]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

		const dpStats = pathLengthStats(dpResult.paths);
		const bfsStats = pathLengthStats(bfsResult.paths);

		console.log("\n=== Path Length Distribution ===");
		console.log("Degree-Prioritised:");
		console.log(`  Min: ${dpStats.min}, Max: ${dpStats.max}, Mean: ${dpStats.mean.toFixed(2)}, Median: ${dpStats.median}`);
		console.log("Standard BFS:");
		console.log(`  Min: ${bfsStats.min}, Max: ${bfsStats.max}, Mean: ${bfsStats.mean.toFixed(2)}, Median: ${bfsStats.median}`);

		expect(dpResult.paths.length).toBeGreaterThanOrEqual(0);
		expect(bfsResult.paths.length).toBeGreaterThanOrEqual(0);
	});

	it("should measure coverage efficiency", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[allNodes.length - 1]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

		const dpEfficiency = coverageEfficiency(dpResult.sampledNodes.size, dpResult.stats.iterations);
		const bfsEfficiency = coverageEfficiency(bfsResult.sampledNodes.size, bfsResult.stats.iterations);

		console.log("\n=== Coverage Efficiency ===");
		console.log(`Degree-Prioritised: ${dpEfficiency.toFixed(3)} nodes/iteration`);
		console.log(`Standard BFS: ${bfsEfficiency.toFixed(3)} nodes/iteration`);
		console.log(`DP iterations: ${dpResult.stats.iterations}`);
		console.log(`BFS iterations: ${bfsResult.stats.iterations}`);

		// Both should have reasonable efficiency
		expect(dpEfficiency).toBeGreaterThan(0);
		expect(bfsEfficiency).toBeGreaterThan(0);
	});

	it("should analyse hub participation patterns", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[Math.floor(allNodes.length / 2)]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

		const dpSampled = Array.from(dpResult.sampledNodes);
		const bfsSampled = Array.from(bfsResult.sampledNodes);
		const allNodeData = benchmark.graph.getAllNodes();

		const dpHubs = hubParticipation(dpSampled, allNodeData, (id) => expander.getDegree(id), 90);
		const bfsHubs = hubParticipation(bfsSampled, allNodeData, (id) => expander.getDegree(id), 90);

		console.log("\n=== Hub Participation (top 10% degree) ===");
		console.log(`Degree-Prioritised: ${dpHubs.sampledHubs}/${dpHubs.totalHubs} hubs (${(dpHubs.ratio * 100).toFixed(1)}%)`);
		console.log(`Standard BFS: ${bfsHubs.sampledHubs}/${bfsHubs.totalHubs} hubs (${(bfsHubs.ratio * 100).toFixed(1)}%)`);

		// Both methods should sample hubs
		expect(dpHubs.sampledHubs).toBeGreaterThan(0);
		expect(bfsHubs.sampledHubs).toBeGreaterThan(0);
	});

	it("should compare degree distributions of sampled nodes", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[allNodes.length - 1]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const standardBfs = new StandardBfsExpansion(expander, seeds);

		const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

		// Calculate degree distribution statistics
		const dpDegrees = Array.from(dpResult.sampledNodes).map((id) => expander.getDegree(id));
		const bfsDegrees = Array.from(bfsResult.sampledNodes).map((id) => expander.getDegree(id));

		const dpMean = dpDegrees.reduce((a, b) => a + b, 0) / dpDegrees.length;
		const bfsMean = bfsDegrees.reduce((a, b) => a + b, 0) / bfsDegrees.length;

		const dpMax = Math.max(...dpDegrees);
		const bfsMax = Math.max(...bfsDegrees);

		console.log("\n=== Sampled Node Degree Distribution ===");
		console.log("Degree-Prioritised:");
		console.log(`  Mean degree: ${dpMean.toFixed(2)}, Max degree: ${dpMax}`);
		console.log("Standard BFS:");
		console.log(`  Mean degree: ${bfsMean.toFixed(2)}, Max degree: ${bfsMax}`);

		expect(dpMean).toBeGreaterThan(0);
		expect(bfsMean).toBeGreaterThan(0);
	});
});

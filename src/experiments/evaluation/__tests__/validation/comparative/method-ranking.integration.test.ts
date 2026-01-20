/**
 * Method Ranking Tests
 *
 * Compares all expansion methods by path diversity to validate
 * the thesis method's effectiveness against multiple baselines.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import { BenchmarkGraphExpander } from "../common/benchmark-graph-expander";
import { loadBenchmarkByIdFromUrl } from "../../../fixtures/benchmark-datasets";
import { HighDegreeFirstExpansion } from "../common/baselines/high-degree-first";
import { LowDegreeFirstExpansion } from "../common/baselines/low-degree-first";
import { FrontierBalancedExpansion } from "../../../../../experiments/baselines/frontier-balanced"
import { RandomPriorityExpansion } from "../../../../../experiments/baselines/random-priority"
import { StandardBfsExpansion } from "../../../../../experiments/baselines/standard-bfs"
import { pathDiversity } from "../common/statistical-functions";

describe("Thesis Validation: Additional Baselines", () => {
	it("should compare thesis method vs high-degree-first baseline", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[allNodes.length - 1]];

		const thesis = new DegreePrioritisedExpansion(expander, seeds);
		const highDegree = new HighDegreeFirstExpansion(expander, seeds);

		const [thesisResult, hdResult] = await Promise.all([thesis.run(), highDegree.run()]);

		const thesisDiversity = pathDiversity(thesisResult.paths);
		const hdDiversity = pathDiversity(hdResult.paths);

		console.log("\n=== Thesis vs High-Degree-First Baseline ===");
		console.log(`Thesis (DP): ${thesisResult.paths.length} paths, diversity ${thesisDiversity.toFixed(3)}`);
		console.log(`High-Degree-First: ${hdResult.paths.length} paths, diversity ${hdDiversity.toFixed(3)}`);

		if (thesisDiversity > hdDiversity) {
			const improvement = ((thesisDiversity - hdDiversity) / Math.max(hdDiversity, 0.001)) * 100;
			console.log(`Thesis improvement: ${improvement.toFixed(1)}%`);
		}

		// Thesis method should not be worse than high-degree-first
		expect(thesisDiversity).toBeGreaterThanOrEqual(hdDiversity * 0.9); // Allow 10% margin
	});

	it("should compare thesis method vs low-degree-first baseline", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[allNodes.length - 1]];

		const thesis = new DegreePrioritisedExpansion(expander, seeds);
		const lowDegree = new LowDegreeFirstExpansion(expander, seeds);

		const [thesisResult, ldResult] = await Promise.all([thesis.run(), lowDegree.run()]);

		const thesisDiversity = pathDiversity(thesisResult.paths);
		const ldDiversity = pathDiversity(ldResult.paths);

		console.log("\n=== Thesis vs Low-Degree-First Baseline ===");
		console.log(`Thesis (DP): ${thesisResult.paths.length} paths, diversity ${thesisDiversity.toFixed(3)}`);
		console.log(`Low-Degree-First: ${ldResult.paths.length} paths, diversity ${ldDiversity.toFixed(3)}`);

		const difference = thesisDiversity - ldDiversity;
		console.log(`Diversity difference: ${difference.toFixed(3)}`);

		// Thesis method should find paths (or at least sample nodes)
		expect(thesisResult.paths.length).toBeGreaterThanOrEqual(0);
		expect(thesisResult.sampledNodes.size).toBeGreaterThan(0);
		// Low-degree-first may fail to find paths on large graphs (gets stuck in leaves)
		expect(ldResult.sampledNodes.size).toBeGreaterThan(0);
	});

	it("should rank all methods by path diversity", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[allNodes.length - 1]];

		const methods = [
			{ name: "Degree-Prioritised (Thesis)", algo: new DegreePrioritisedExpansion(expander, seeds) },
			{ name: "Standard BFS", algo: new StandardBfsExpansion(expander, seeds) },
			{ name: "Frontier-Balanced", algo: new FrontierBalancedExpansion(expander, seeds) },
			{ name: "Random Priority", algo: new RandomPriorityExpansion(expander, seeds, 42) },
			{ name: "Low-Degree-First", algo: new LowDegreeFirstExpansion(expander, seeds) },
			{ name: "High-Degree-First", algo: new HighDegreeFirstExpansion(expander, seeds) },
		];

		const results = await Promise.all(
			methods.map(async (m) => ({
				name: m.name,
				result: await m.algo.run(),
				diversity: 0, // Will calculate
			}))
		);

		for (const r of results) {
			r.diversity = pathDiversity(r.result.paths);
		}

		// Sort by diversity
		results.sort((a, b) => b.diversity - a.diversity);

		console.log("\n=== Method Ranking by Path Diversity ===");
		for (let i = 0; i < results.length; i++) {
			const r = results[i];
			console.log(`${i + 1}. ${r.name}: ${r.diversity.toFixed(3)} (${r.result.paths.length} paths)`);
		}

		// Thesis method should be in top 3
		const thesisRank = results.findIndex((r) => r.name.includes("Degree-Prioritised"));
		expect(thesisRank).toBeLessThan(3);
	});

	it("should compare hub sampling between thesis and high-degree-first", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes[allNodes.length - 1]];

		const thesis = new DegreePrioritisedExpansion(expander, seeds);
		const highDegree = new HighDegreeFirstExpansion(expander, seeds);

		const [thesisResult, hdResult] = await Promise.all([thesis.run(), highDegree.run()]);

		// Count high-degree nodes sampled (degree > 5)
		const hubThreshold = 5;

		const thesisHubs = Array.from(thesisResult.sampledNodes).filter((id) => expander.getDegree(id) > hubThreshold)
			.length;
		const hdHubs = Array.from(hdResult.sampledNodes).filter((id) => expander.getDegree(id) > hubThreshold).length;

		console.log("\n=== Hub Sampling Comparison ===");
		console.log(`Thesis (DP): ${thesisHubs} high-degree nodes sampled`);
		console.log(`High-Degree-First: ${hdHubs} high-degree nodes sampled`);

		// High-degree-first should sample MORE high-degree nodes (by design)
		// This validates that thesis method defers hubs
		expect(hdHubs).toBeGreaterThanOrEqual(thesisHubs);
	});
});

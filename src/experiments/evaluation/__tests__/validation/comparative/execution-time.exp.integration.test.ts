/**
 * Thesis Validation: Runtime Performance Tests
 *
 * Extracted from thesis-validation.integration.test.ts
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import {
	FrontierBalancedExpansion,
	RandomPriorityExpansion,
	StandardBfsExpansion,
} from "../../../../baselines";
import { loadBenchmarkByIdFromUrl } from "../../../fixtures/benchmark-datasets";
import { BenchmarkGraphExpander } from "../common/benchmark-graph-expander";
import { pathDiversity } from "../common/statistical-functions";

describe("Thesis Validation: Runtime Performance", () => {
	interface PerformanceMetrics {
		method: string;
		executionTime: number;
		nodesExpanded: number;
		edgesTraversed: number;
		iterations: number;
		nodesPerSecond: number;
		pathsFound: number;
		pathDiversity: number;
	}

	const runPerformanceTest = async (
		method: string,
		expander: BenchmarkGraphExpander,
		seeds: [string, string],
		algorithm: () => { run(): Promise<{ sampledNodes: Set<string>; stats: { nodesExpanded: number; edgesTraversed: number; iterations: number }; paths: Array<{ nodes: string[] }> }> }
	): Promise<PerformanceMetrics> => {
		const startTime = performance.now();
		const result = await algorithm().run();
		const endTime = performance.now();

		const executionTime = endTime - startTime;
		const nodesPerSecond = result.stats.nodesExpanded / (executionTime / 1000);

		return {
			method,
			executionTime,
			nodesExpanded: result.stats.nodesExpanded,
			edgesTraversed: result.stats.edgesTraversed,
			iterations: result.stats.iterations,
			nodesPerSecond,
			pathsFound: result.paths.length,
			pathDiversity: pathDiversity(result.paths),
		};
	};

	it("should compare execution time across methods (small graph)", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		const results: PerformanceMetrics[] = [];

		// Test all 4 methods
		results.push(
			await runPerformanceTest(
				"Degree-Prioritised",
				expander,
				seeds,
				() => new DegreePrioritisedExpansion(expander, seeds)
			)
		);

		results.push(
			await runPerformanceTest(
				"Standard BFS",
				expander,
				seeds,
				() => new StandardBfsExpansion(expander, seeds)
			)
		);

		results.push(
			await runPerformanceTest(
				"Frontier-Balanced",
				expander,
				seeds,
				() => new FrontierBalancedExpansion(expander, seeds)
			)
		);

		results.push(
			await runPerformanceTest(
				"Random Priority",
				expander,
				seeds,
				() => new RandomPriorityExpansion(expander, seeds, 42)
			)
		);

		console.log("\n=== Runtime Performance (Karate Club) ===");
		for (const r of results) {
			console.log(`${r.method}:`);
			console.log(`  Time: ${r.executionTime.toFixed(2)}ms`);
			console.log(`  Nodes/sec: ${r.nodesPerSecond.toFixed(0)}`);
			console.log(`  Iterations: ${r.iterations}`);
			console.log(`  Paths: ${r.pathsFound}, Diversity: ${r.pathDiversity.toFixed(3)}`);
		}

		// All methods should complete in reasonable time
		for (const r of results) {
			expect(r.executionTime).toBeLessThan(10_000); // 10 seconds max
			expect(r.nodesPerSecond).toBeGreaterThan(0);
		}
	});

	it("should compare execution time on larger graph", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		const startTime1 = performance.now();
		const dp = new DegreePrioritisedExpansion(expander, seeds);
		const dpResult = await dp.run();
		const endTime1 = performance.now();

		const startTime2 = performance.now();
		const bfs = new StandardBfsExpansion(expander, seeds);
		const bfsResult = await bfs.run();
		const endTime2 = performance.now();

		const dpTime = endTime1 - startTime1;
		const bfsTime = endTime2 - startTime2;

		console.log("\n=== Runtime Performance (Facebook) ===");
		console.log(`Degree-Prioritised: ${dpTime.toFixed(2)}ms`);
		console.log(`Standard BFS: ${bfsTime.toFixed(2)}ms`);
		console.log(`DP nodes/sec: ${(dpResult.stats.nodesExpanded / (dpTime / 1000)).toFixed(0)}`);
		console.log(`BFS nodes/sec: ${(bfsResult.stats.nodesExpanded / (bfsTime / 1000)).toFixed(0)}`);
		console.log(`DP iterations: ${dpResult.stats.iterations}`);
		console.log(`BFS iterations: ${bfsResult.stats.iterations}`);

		// Both should complete in reasonable time for 4039 nodes
		expect(dpTime).toBeLessThan(30_000);
		expect(bfsTime).toBeLessThan(30_000);
	});

	it("should measure scalability with increasing graph sizes", async () => {
		const datasets = ["karate", "lesmis", "facebook"];
		const results: Array<{ dataset: string; nodes: number; dpTime: number; bfsTime: number; dpBfsRatio: number }> = [];

		for (const datasetId of datasets) {
			const benchmark = await loadBenchmarkByIdFromUrl(datasetId);
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const startTime1 = performance.now();
			const dp = new DegreePrioritisedExpansion(expander, seeds);
			await dp.run();
			const endTime1 = performance.now();

			const startTime2 = performance.now();
			const bfs = new StandardBfsExpansion(expander, seeds);
			await bfs.run();
			const endTime2 = performance.now();

			const dpTime = endTime1 - startTime1;
			const bfsTime = endTime2 - startTime2;

			results.push({
				dataset: datasetId,
				nodes: benchmark.nodeCount,
				dpTime,
				bfsTime,
				dpBfsRatio: dpTime / bfsTime,
			});
		}

		console.log("\n=== Scalability Analysis ===");
		console.log("Dataset\tNodes\tDP(ms)\tBFS(ms)\tRatio");
		for (const r of results) {
			console.log(`${r.dataset}\t${r.nodes}\t${r.dpTime.toFixed(1)}\t${r.bfsTime.toFixed(1)}\t${r.dpBfsRatio.toFixed(2)}`);
		}

		// Ratio should be reasonably close (within 20x) to account for timing variance
		for (const r of results) {
			expect(r.dpBfsRatio).toBeGreaterThan(0.05);
			expect(r.dpBfsRatio).toBeLessThan(20);
		}
	});

	it("should compare memory efficiency (iterations as proxy)", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		const [dpResult, bfsResult] = await Promise.all([
			new DegreePrioritisedExpansion(expander, seeds).run(),
			new StandardBfsExpansion(expander, seeds).run(),
		]);

		console.log("\n=== Memory Efficiency (iterations = frontier operations) ===");
		console.log(`Degree-Prioritised: ${dpResult.stats.iterations} iterations`);
		console.log(`Standard BFS: ${bfsResult.stats.iterations} iterations`);
		console.log(`DP nodes/iteration: ${(dpResult.sampledNodes.size / dpResult.stats.iterations).toFixed(3)}`);
		console.log(`BFS nodes/iteration: ${(bfsResult.sampledNodes.size / bfsResult.stats.iterations).toFixed(3)}`);

		// Both should use similar number of iterations for same graph
		const ratio = dpResult.stats.iterations / bfsResult.stats.iterations;
		console.log(`Iteration ratio DP/BFS: ${ratio.toFixed(3)}`);

		expect(ratio).toBeGreaterThan(0.1);
		expect(ratio).toBeLessThan(10);
	});
});

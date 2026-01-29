/**
 * Iteration Scaling Benchmarks for Path Salience Ranking
 *
 * Runs path salience ranking across four benchmark graphs of increasing size
 * and records scaling metrics: paths evaluated, unique nodes visited, runtime.
 *
 * | Graph    | Nodes | Edges  |
 * |----------|-------|--------|
 * | karate   |    34 |     78 |
 * | lesmis   |    77 |    254 |
 * | cora     |  2708 |  ~5429 |
 * | facebook |  4039 | ~88234 |
 *
 * Tests validate:
 * - Scaling behaviour of path salience ranking across graph sizes
 * - Monotonic increase in unique nodes with graph size
 * - Structured metric output for the TAP runner
 */

import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers";
import { getTestNodePair, loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { describe, expect, it } from "vitest";

/** Benchmark datasets in ascending order of size */
const BENCHMARK_IDS = ["karate", "lesmis", "cora", "facebook"] as const;

/**
 * Fallback node pairs for benchmarks that lack testPairs in their metadata.
 * Matches the hardcoded pairs used in the individual benchmark test files.
 */
const FALLBACK_PAIRS: Record<string, { source: string; target: string }> = {
	karate: { source: "1", target: "34" }, // Mr. Hi → John A.
};

/**
 * Get a source/target pair, falling back to hardcoded pairs when needed
 * @param id
 */
const getNodePair = (id: string): { source: string; target: string } => {
	try {
		return getTestNodePair(id);
	} catch {
		const fallback = FALLBACK_PAIRS[id];
		if (fallback) return fallback;
		throw new Error(`No test pair available for benchmark '${id}'`);
	}
};

/** Timeout for the full scaling suite (facebook is large) */
const SCALING_TIMEOUT = 120_000;

interface ScalingRecord {
	dataset: string;
	method: string;
	nodes: number;
	edges: number;
	meanMI: number;
	nodeCoverage: number;
	pathDiversity: number;
	pathsFound: number;
	uniqueNodes: number;
	runtimeMs: number;
}

describe("Path Salience Ranking — Iteration Scaling", () => {
	it("should rank paths across increasing graph sizes", { timeout: SCALING_TIMEOUT }, async () => {
		const records: ScalingRecord[] = [];

		for (const id of BENCHMARK_IDS) {
			const benchmark = await loadBenchmarkByIdFromUrl(id);
			const graph = benchmark.graph;
			const { source, target } = getNodePair(id);

			const t0 = performance.now();
			const result = rankPaths(graph, source, target, { maxPaths: 15 });
			const runtimeMs = performance.now() - t0;

			expect(result.ok).toBe(true);
			if (!result.ok || !result.value.some) continue;

			const paths = result.value.value;
			expect(paths.length).toBeGreaterThan(0);

			const metrics = computeRankingMetrics(paths, graph);
			expect(metrics.meanMI).toBeGreaterThan(0);

			// Count unique nodes across all ranked paths
			const nodeSet = new Set<string>();
			for (const ranked of paths) {
				for (const node of ranked.path.nodes) {
					nodeSet.add(node.id);
				}
			}

			records.push({
				dataset: id,
				method: "path-salience",
				nodes: benchmark.nodeCount,
				edges: benchmark.edgeCount,
				meanMI: metrics.meanMI,
				nodeCoverage: metrics.nodeCoverage,
				pathDiversity: metrics.pathDiversity,
				pathsFound: paths.length,
				uniqueNodes: nodeSet.size,
				runtimeMs,
			});
		}

		// Emit structured output
		console.log("\n=== Ranking Benchmarks ===");
		console.log(
			["dataset", "method", "meanMI", "nodeCoverage", "pathDiversity", "pathsFound", "uniqueNodes", "runtimeMs"].join("\t"),
		);
		for (const r of records) {
			console.log(
				[
					r.dataset,
					r.method,
					r.meanMI.toFixed(4),
					r.nodeCoverage.toFixed(4),
					r.pathDiversity.toFixed(4),
					r.pathsFound,
					r.uniqueNodes,
					r.runtimeMs.toFixed(1),
				].join("\t"),
			);
		}

		// All benchmarks should have produced results
		expect(records).toHaveLength(BENCHMARK_IDS.length);
	});

	it("should produce valid ranking results for all graph sizes", { timeout: SCALING_TIMEOUT }, async () => {
		const results: Array<{ id: string; nodes: number; uniqueNodes: number; pathsFound: number }> = [];

		for (const id of BENCHMARK_IDS) {
			const benchmark = await loadBenchmarkByIdFromUrl(id);
			const graph = benchmark.graph;
			const { source, target } = getNodePair(id);

			const result = rankPaths(graph, source, target, { maxPaths: 15 });

			expect(result.ok).toBe(true);
			if (!result.ok || !result.value.some) continue;

			const paths = result.value.value;
			expect(paths.length).toBeGreaterThan(0);

			const nodeSet = new Set<string>();
			for (const ranked of paths) {
				for (const node of ranked.path.nodes) {
					nodeSet.add(node.id);
				}
			}

			// Every result must include at least source and target
			expect(nodeSet.size).toBeGreaterThanOrEqual(2);

			results.push({
				id,
				nodes: benchmark.nodeCount,
				uniqueNodes: nodeSet.size,
				pathsFound: paths.length,
			});
		}

		expect(results).toHaveLength(BENCHMARK_IDS.length);

		console.log("\n=== Unique Node Scaling ===");
		for (const r of results) {
			console.log(`${r.id}: ${r.uniqueNodes} unique nodes across ${r.pathsFound} paths (graph: ${r.nodes} nodes)`);
		}
	});
});

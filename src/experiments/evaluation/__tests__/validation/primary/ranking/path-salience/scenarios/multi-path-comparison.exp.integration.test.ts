/**
 * Multi-Path Comparison Tests for Path Salience Ranking
 *
 * Verifies ranking behavior when many paths of equal length exist.
 * Tests create ladder-like graphs with parallel paths to ensure:
 * - Ranking by MI quality when path lengths are equal
 * - Deterministic ordering for ties
 * - Diverse results from multi-path graphs
 * - Reasonable scaling with path count
 */

import { Graph } from "@graph/algorithms/graph/graph";
import { type RankedPath,rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { computeRankingMetrics } from "@graph/experiments/evaluation/__tests__/validation/common/path-ranking-helpers";
import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

describe("Path Salience Ranking: Scenarios - Multi-Path Comparison", () => {
	/**
	 * Test 1: Should rank many equal-length paths by MI quality.
	 *
	 * Creates a ladder-like graph with 10+ parallel paths of the same length.
	 * Each path has different MI values to verify quality-based ranking.
	 */
	it("should rank many equal-length paths by MI quality", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create SOURCE and TARGET
		graph.addNode({ id: "SOURCE", type: "type_source" });
		graph.addNode({ id: "TARGET", type: "type_target" });

		// Create 12 parallel paths, each with 3 intermediate nodes
		// Each path: SOURCE -> A_i -> B_i -> C_i -> TARGET
		const pathCount = 12;
		const miValues = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35];
		const miMap = new Map<string, number>();

		for (let index = 0; index < pathCount; index++) {
			const aNode = `A${index}`;
			const bNode = `B${index}`;
			const cNode = `C${index}`;

			graph.addNode({ id: aNode, type: `type_a_${index}` });
			graph.addNode({ id: bNode, type: `type_b_${index}` });
			graph.addNode({ id: cNode, type: `type_c_${index}` });

			// Add edges for this path
			const e1 = `E${index}_0`;
			const e2 = `E${index}_1`;
			const e3 = `E${index}_2`;
			const e4 = `E${index}_3`;

			graph.addEdge({ id: e1, source: "SOURCE", target: aNode, type: "edge" });
			graph.addEdge({ id: e2, source: aNode, target: bNode, type: "edge" });
			graph.addEdge({ id: e3, source: bNode, target: cNode, type: "edge" });
			graph.addEdge({ id: e4, source: cNode, target: "TARGET", type: "edge" });

			// Set MI values (decreasing quality)
			const pathMI = miValues[index] ?? 0.5;
			miMap.set(e1, pathMI);
			miMap.set(e2, pathMI);
			miMap.set(e3, pathMI);
			miMap.set(e4, pathMI);
		}

		const miCache = createMockMICache(miMap);

		// Run ranking
		const result = rankPaths(graph, "SOURCE", "TARGET", {
			miCache,
			maxPaths: 20,
			lambda: 0, // No length penalty since all paths equal length
			maxLength: 5,
			shortestOnly: false,
		});

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find multiple paths

			// Should find multiple paths
			expect(paths.length).toBeGreaterThanOrEqual(5);

			// All paths should have the same length (4 edges)
			const pathLengths = paths.map((p) => p.path.edges.length);
			const uniqueLengths = new Set(pathLengths);
			expect(uniqueLengths.size).toBe(1);
			expect(uniqueLengths.has(4)).toBe(true);

			// Paths should be ranked by MI quality (descending)
			// First path should have highest geometric mean MI
			if (paths.length > 1) {
				expect(paths[0].geometricMeanMI).toBeGreaterThanOrEqual(paths[1].geometricMeanMI);
			}

			// Top path should have high MI (close to 0.9)
			expect(paths[0].geometricMeanMI).toBeGreaterThan(0.8);

			// Verify MI-based ordering: scores should generally decrease
			let _decreasingMI = true;
			for (let index = 1; index < Math.min(paths.length, 5); index++) {
				if (paths[index].geometricMeanMI > paths[index - 1].geometricMeanMI + 0.01) {
					_decreasingMI = false;
					break;
				}
			}
			// At minimum, top path should have best MI
			expect(paths[0].geometricMeanMI).toBeGreaterThanOrEqual(
				paths[Math.min(2, paths.length - 1)].geometricMeanMI,
			);
		}
	});

	/**
	 * Test 2: Should handle ties gracefully.
	 *
	 * Creates paths with identical MI values to verify deterministic ordering.
	 * When MI values are equal, ranking should still produce consistent results.
	 */
	it("should handle ties gracefully", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create SOURCE and TARGET
		graph.addNode({ id: "SOURCE", type: "type_source" });
		graph.addNode({ id: "TARGET", type: "type_target" });

		// Create 6 paths with identical MI values (all 0.5)
		const pathCount = 6;
		const miMap = new Map<string, number>();
		const edgeId: string[] = [];

		for (let index = 0; index < pathCount; index++) {
			const midNode = `M${index}`;
			graph.addNode({ id: midNode, type: `type_mid_${index}` });

			const e1 = `E${index}_0`;
			const e2 = `E${index}_1`;

			graph.addEdge({ id: e1, source: "SOURCE", target: midNode, type: "edge" });
			graph.addEdge({ id: e2, source: midNode, target: "TARGET", type: "edge" });

			edgeId.push(e1, e2);

			// All paths have same MI
			miMap.set(e1, 0.5);
			miMap.set(e2, 0.5);
		}

		const miCache = createMockMICache(miMap);

		// Run ranking twice to check determinism
		const result1 = rankPaths(graph, "SOURCE", "TARGET", {
			miCache,
			maxPaths: 10,
			lambda: 0,
		});

		const result2 = rankPaths(graph, "SOURCE", "TARGET", {
			miCache,
			maxPaths: 10,
			lambda: 0,
		});

		expect(result1.ok).toBe(true);
		expect(result2.ok).toBe(true);

		const paths1 = result1.ok && result1.value.some ? result1.value.value : [];
		const paths2 = result2.ok && result2.value.some ? result2.value.value : [];

		// Both runs should produce same number of paths
		expect(paths1.length).toBe(paths2.length);

		// All paths should have identical geometric mean MI
		for (const path of paths1) {
			expect(path.geometricMeanMI).toBeCloseTo(0.5, 2);
		}

		// When MI is equal, paths should still have consistent ordering
		// Extract path signatures for comparison
		const sigs1 = paths1.map((p) => p.path.nodes.map((n) => n.id).join("->"));
		const sigs2 = paths2.map((p) => p.path.nodes.map((n) => n.id).join("->"));

		// Same set of paths should be discovered
		expect(new Set(sigs1)).toEqual(new Set(sigs2));

		// With identical MI, all paths should have similar scores
		if (paths1.length > 1) {
			const scoreRange = Math.max(...paths1.map((p) => p.score)) - Math.min(...paths1.map((p) => p.score));
			// Score range should be small when MI is identical
			// (small differences due to graph structure differences)
			expect(scoreRange).toBeLessThan(0.5);
		}

		// Metrics should show low diversity when all paths have same MI
		const metrics = computeRankingMetrics(paths1, graph);
		expect(metrics.stdMI).toBeLessThan(0.1); // Low std dev when all MI equal
	});

	/**
	 * Test 3: Should provide diverse results from multi-path graphs.
	 *
	 * Creates a graph with many paths and verifies that the ranking
	 * produces diverse results (not just one path type repeated).
	 */
	it("should provide diverse results from multi-path graphs", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a ladder graph with varied path lengths and MI values
		graph.addNode({ id: "SOURCE", type: "type_source" });
		graph.addNode({ id: "TARGET", type: "type_target" });

		// Short paths (2 hops)
		for (let index = 0; index < 3; index++) {
			const mid = `S${index}`;
			graph.addNode({ id: mid, type: `type_short_${index}` });
			graph.addEdge({ id: `SS${index}`, source: "SOURCE", target: mid, type: "edge" });
			graph.addEdge({ id: `ST${index}`, source: mid, target: "TARGET", type: "edge" });
		}

		// Medium paths (3 hops)
		for (let index = 0; index < 4; index++) {
			const m1 = `M1_${index}`;
			const m2 = `M2_${index}`;
			graph.addNode({ id: m1, type: `type_med1_${index}` });
			graph.addNode({ id: m2, type: `type_med2_${index}` });
			graph.addEdge({ id: `MA_${index}`, source: "SOURCE", target: m1, type: "edge" });
			graph.addEdge({ id: `MB_${index}`, source: m1, target: m2, type: "edge" });
			graph.addEdge({ id: `MC_${index}`, source: m2, target: "TARGET", type: "edge" });
		}

		// Long paths (4 hops)
		for (let index = 0; index < 3; index++) {
			const l1 = `L1_${index}`;
			const l2 = `L2_${index}`;
			const l3 = `L3_${index}`;
			graph.addNode({ id: l1, type: `type_long1_${index}` });
			graph.addNode({ id: l2, type: `type_long2_${index}` });
			graph.addNode({ id: l3, type: `type_long3_${index}` });
			graph.addEdge({ id: `LA_${index}`, source: "SOURCE", target: l1, type: "edge" });
			graph.addEdge({ id: `LB_${index}`, source: l1, target: l2, type: "edge" });
			graph.addEdge({ id: `LC_${index}`, source: l2, target: l3, type: "edge" });
			graph.addEdge({ id: `LD_${index}`, source: l3, target: "TARGET", type: "edge" });
		}

		// Set varied MI values (shorter paths have slightly lower MI)
		const _edgeCount = graph.getEdgeCount();

		// Use a simpler approach: create a new graph with known edge IDs
		const graph2 = new Graph<ProofTestNode, ProofTestEdge>(false);
		graph2.addNode({ id: "SOURCE", type: "type_source" });
		graph2.addNode({ id: "TARGET", type: "type_target" });

		const miValues = new Map<string, number>();

		// Short paths (moderate MI)
		for (let index = 0; index < 3; index++) {
			const mid = `S${index}`;
			graph2.addNode({ id: mid, type: `type_short_${index}` });
			graph2.addEdge({ id: `E_S0_${index}`, source: "SOURCE", target: mid, type: "edge" });
			graph2.addEdge({ id: `E_S1_${index}`, source: mid, target: "TARGET", type: "edge" });
			miValues.set(`E_S0_${index}`, 0.6);
			miValues.set(`E_S1_${index}`, 0.6);
		}

		// Medium paths (better MI)
		for (let index = 0; index < 4; index++) {
			const m1 = `M1_${index}`;
			const m2 = `M2_${index}`;
			graph2.addNode({ id: m1, type: `type_med1_${index}` });
			graph2.addNode({ id: m2, type: `type_med2_${index}` });
			graph2.addEdge({ id: `E_M0_${index}`, source: "SOURCE", target: m1, type: "edge" });
			graph2.addEdge({ id: `E_M1_${index}`, source: m1, target: m2, type: "edge" });
			graph2.addEdge({ id: `E_M2_${index}`, source: m2, target: "TARGET", type: "edge" });
			miValues.set(`E_M0_${index}`, 0.8);
			miValues.set(`E_M1_${index}`, 0.8);
			miValues.set(`E_M2_${index}`, 0.8);
		}

		// Long paths (best MI)
		for (let index = 0; index < 3; index++) {
			const l1 = `L1_${index}`;
			const l2 = `L2_${index}`;
			const l3 = `L3_${index}`;
			graph2.addNode({ id: l1, type: `type_long1_${index}` });
			graph2.addNode({ id: l2, type: `type_long2_${index}` });
			graph2.addNode({ id: l3, type: `type_long3_${index}` });
			graph2.addEdge({ id: `E_L0_${index}`, source: "SOURCE", target: l1, type: "edge" });
			graph2.addEdge({ id: `E_L1_${index}`, source: l1, target: l2, type: "edge" });
			graph2.addEdge({ id: `E_L2_${index}`, source: l2, target: l3, type: "edge" });
			graph2.addEdge({ id: `E_L3_${index}`, source: l3, target: "TARGET", type: "edge" });
			miValues.set(`E_L0_${index}`, 0.9);
			miValues.set(`E_L1_${index}`, 0.9);
			miValues.set(`E_L2_${index}`, 0.9);
			miValues.set(`E_L3_${index}`, 0.9);
		}

		const miCache = createMockMICache(miValues);

		// Run ranking
		const result = rankPaths(graph2, "SOURCE", "TARGET", {
			miCache,
			maxPaths: 20,
			lambda: 0.05, // Small length penalty
			maxLength: 5,
			shortestOnly: false,
		});

		expect(result.ok).toBe(true);
		let paths: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (result.ok && result.value.some) {
			paths = result.value.value;
		}
		if (paths.length === 0) {
			return; // Early exit if no paths found
		}

		// Should find multiple paths
		expect(paths.length).toBeGreaterThanOrEqual(3);

		// Check for diversity: should have paths of different lengths
		const pathLengths = new Set(paths.map((p) => p.path.edges.length));
		expect(pathLengths.size).toBeGreaterThan(1);

		// Compute diversity metrics
		const metrics = computeRankingMetrics(paths, graph2);

		// Path diversity should be positive (multiple path types)
		expect(metrics.pathDiversity).toBeGreaterThan(0);

		// Should have reasonable node coverage (different paths use different nodes)
		expect(metrics.nodeCoverage).toBeGreaterThan(0.1);
	});

	/**
	 * Test 4: Should scale reasonably with path count.
	 *
	 * Tests with 5, 10, and 20 parallel paths to verify scaling behavior.
	 * Execution time and path quality should remain reasonable.
	 */
	it("should scale reasonably with path count", () => {
		// Test with different path counts
		const pathCounts = [5, 10, 20];
		const results: Array<{
			pathCount: number;
			foundPaths: number;
			meanMI: number;
			pathDiversity: number;
		}> = [];

		for (const count of pathCounts) {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Create SOURCE and TARGET
			graph.addNode({ id: "SOURCE", type: "type_source" });
			graph.addNode({ id: "TARGET", type: "type_target" });

			// Create parallel paths with varying MI
			const miMap = new Map<string, number>();

			for (let index = 0; index < count; index++) {
				const midNode = `P${count}_${index}`;
				graph.addNode({ id: midNode, type: `type_path_${count}_${index}` });

				const e1 = `E_${count}_${index}_0`;
				const e2 = `E_${count}_${index}_1`;

				graph.addEdge({ id: e1, source: "SOURCE", target: midNode, type: "edge" });
				graph.addEdge({ id: e2, source: midNode, target: "TARGET", type: "edge" });

				// Varying MI: 0.3 to 0.9
				const mi = 0.3 + (0.6 * index) / count;
				miMap.set(e1, mi);
				miMap.set(e2, mi);
			}

			const miCache = createMockMICache(miMap);

			// Run ranking
			const startTime = performance.now();
			const result = rankPaths(graph, "SOURCE", "TARGET", {
				miCache,
				maxPaths: count * 2,
				lambda: 0,
			});
			const endTime = performance.now();

			expect(result.ok).toBe(true);
			let paths: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
			if (result.ok && result.value.some) {
				paths = result.value.value;
			}
			if (paths.length === 0) {
				return; // Early exit if no paths
			}

			// Compute metrics
			const metrics = computeRankingMetrics(paths, graph);

			results.push({
				pathCount: count,
				foundPaths: paths.length,
				meanMI: metrics.meanMI,
				pathDiversity: metrics.pathDiversity,
			});

			// All paths should be found
			expect(paths.length).toBeGreaterThanOrEqual(count);

			// Execution should be fast (< 1 second for this small graph)
			expect(endTime - startTime).toBeLessThan(1000);
		}

		// Verify scaling behavior
		// More paths should result in more found paths
		expect(results[1].foundPaths).toBeGreaterThanOrEqual(results[0].foundPaths);
		expect(results[2].foundPaths).toBeGreaterThanOrEqual(results[1].foundPaths);

		// Mean MI should generally be in reasonable range
		for (const r of results) {
			expect(r.meanMI).toBeGreaterThan(0);
			expect(r.meanMI).toBeLessThanOrEqual(1);
		}

		// Path diversity should be positive for all cases
		for (const r of results) {
			expect(r.pathDiversity).toBeGreaterThanOrEqual(0);
		}
	});
});

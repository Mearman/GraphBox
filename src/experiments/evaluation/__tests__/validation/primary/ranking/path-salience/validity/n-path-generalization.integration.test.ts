/**
 * N-Path Generalization Tests for Path Salience Ranking
 *
 * Validates behavior when multiple paths exist between source and target.
 *
 * Tests include:
 * - Multiple shortest paths should all be ranked
 * - Ranking should handle paths of different lengths when shortestOnly=false
 * - MaxPaths should limit returned paths
 * - Paths should be sorted by score descending
 */

import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

import { Graph } from "../../../../../../../../algorithms/graph/graph";
import { rankPaths } from "../../../../../../../../algorithms/pathfinding/path-ranking";

describe("Path Salience Ranking: N-Path Generalization", () => {
	/**
	 * Should find and rank all shortest paths when multiple exist.
	 *
	 * Diamond graph: A to D via B or C (both 2-edge paths).
	 */
	it("should enumerate all shortest paths", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });
		graph.addNode({ id: "D", type: "type_3" });

		graph.addEdge({ id: "E_AB", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E_AC", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E_BD", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E_CD", source: "C", target: "D", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E_AB", 0.5],
				["E_AC", 0.5],
				["E_BD", 0.5],
				["E_CD", 0.5],
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;
			expect(paths.length).toBe(2);
			// Both paths have same MI, so same score
			expect(paths[0].score).toBeCloseTo(paths[1].score, 0.001);
		}
	});

	/**
	 * Should return paths sorted by score descending (highest first).
	 */
	it("should sort paths by score descending", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });
		graph.addNode({ id: "D", type: "type_3" });

		graph.addEdge({ id: "E_AB", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E_AC", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E_BD", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E_CD", source: "C", target: "D", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E_AB", 0.9], // Path 1 (via B): higher MI
				["E_BD", 0.8],
				["E_AC", 0.3], // Path 2 (via C): lower MI
				["E_CD", 0.3],
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;
			expect(paths.length).toBe(2);

			// Scores should be descending
			expect(paths[0].score).toBeGreaterThanOrEqual(paths[1].score);

			// Path via B should have higher score (higher MI)
			expect(paths[0].geometricMeanMI).toBeCloseTo(Math.sqrt(0.9 * 0.8), 0.001);
			expect(paths[1].geometricMeanMI).toBeCloseTo(Math.abs(0.3), 0.001);
		}
	});

	/**
	 * MaxPaths should limit the number of returned paths.
	 */
	it("should respect maxPaths limit", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });
		graph.addNode({ id: "D", type: "type_3" });
		graph.addNode({ id: "E", type: "type_4" });

		graph.addEdge({ id: "E_AB", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E_AC", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E_AD", source: "A", target: "D", type: "edge" });
		graph.addEdge({ id: "E_BE", source: "B", target: "E", type: "edge" });
		graph.addEdge({ id: "E_CE", source: "C", target: "E", type: "edge" });
		graph.addEdge({ id: "E_DE", source: "D", target: "E", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E_AB", 0.8],
				["E_AC", 0.7],
				["E_AD", 0.6],
				["E_BE", 0.5],
				["E_CE", 0.4],
				["E_DE", 0.3],
			]),
		);

		const result = rankPaths(graph, "A", "E", { miCache, maxPaths: 2 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;
			expect(paths.length).toBeLessThanOrEqual(2);
		}
	});

	/**
	 * When shortestOnly=true, should only consider shortest paths.
	 */
	it("should only return shortest paths when shortestOnly=true", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });
		graph.addNode({ id: "D", type: "type_3" });

		graph.addEdge({ id: "E_AB", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E_BD", source: "B", target: "D", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E_AB", 0.5],
				["E_BD", 0.5],
			]),
		);

		// With shortestOnly=true (default)
		const resultShortest = rankPaths(graph, "A", "D", { miCache, shortestOnly: true });

		expect(resultShortest.ok).toBe(true);
		if (resultShortest.ok && resultShortest.value.some) {
			const paths = resultShortest.value.value;
			// Should only get the 2-edge path via B
			expect(paths.length).toBe(1);
			expect(paths[0].path.edges.length).toBe(2);
		}
	});

	/**
	 * When shortestOnly=false with maxLength, should consider longer paths.
	 */
	it("should include longer paths when shortestOnly=false with maxLength", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });
		graph.addNode({ id: "D", type: "type_3" });
		graph.addNode({ id: "E", type: "type_4" });

		// Short path (2 edges) with low MI
		graph.addEdge({ id: "E_AB", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E_BD", source: "B", target: "D", type: "edge" });

		// Longer path (3 edges) with high MI
		graph.addEdge({ id: "E_AC", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E_CE", source: "C", target: "E", type: "edge" });
		graph.addEdge({ id: "E_ED", source: "E", target: "D", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E_AB", 0.2],
				["E_BD", 0.2],
				["E_AC", 0.9],
				["E_CE", 0.9],
				["E_ED", 0.9],
			]),
		);

		// With shortestOnly=false and lambda=0 (no length penalty)
		// The longer path should rank higher due to higher MI
		const result = rankPaths(graph, "A", "D", {
			miCache,
			shortestOnly: false,
			maxLength: 3,
			lambda: 0,
		});

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;
			// Should find both paths
			expect(paths.length).toBeGreaterThanOrEqual(2);

			// With lambda=0, the 3-edge path should rank higher (higher MI, no length penalty)
			// GM of path via B: sqrt(0.2 * 0.2) = 0.2
			// GM of path via C->E->D: (0.9 * 0.9 * 0.9)^(1/3) ≈ 0.9
			const topPath = paths[0];
			expect(topPath.geometricMeanMI).toBeCloseTo(0.9, 0.01);
			expect(topPath.path.edges.length).toBe(3);
		}
	});

	/**
	 * Should find no paths when nodes are disconnected.
	 */
	it("should return None when no path exists", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		// No edge connecting them

		const result = rankPaths(graph, "A", "B");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.some).toBe(false);
		}
	});

	/**
	 * Should handle source equals target (self-path).
	 */
	it("should handle source equals target", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_A" });

		const result = rankPaths(graph, "A", "A");

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			expect(path.path.edges.length).toBe(0);
			expect(path.score).toBe(1);
		}
	});

	/**
	 * With lambda and multiple paths, shorter paths may outrank longer paths
	 * even with lower MI.
	 */
	it("should balance MI and length when lambda is positive", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });
		graph.addNode({ id: "D", type: "type_3" });
		graph.addNode({ id: "E", type: "type_4" });

		// Short path (2 edges) with moderate MI
		graph.addEdge({ id: "E_AB", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E_BD", source: "B", target: "D", type: "edge" });

		// Long path (3 edges) with very high MI
		graph.addEdge({ id: "E_AC", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E_CE", source: "C", target: "E", type: "edge" });
		graph.addEdge({ id: "E_ED", source: "E", target: "D", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E_AB", 0.6],
				["E_BD", 0.6],
				["E_AC", 0.9],
				["E_CE", 0.9],
				["E_ED", 0.9],
			]),
		);

		// Small lambda: length penalty minimal
		const resultLowLambda = rankPaths(graph, "A", "D", {
			miCache,
			shortestOnly: false,
			maxLength: 3,
			lambda: 0.01,
		});

		// Large lambda: length penalty significant
		const resultHighLambda = rankPaths(graph, "A", "D", {
			miCache,
			shortestOnly: false,
			maxLength: 3,
			lambda: 1,
		});

		expect(resultLowLambda.ok).toBe(true);
		expect(resultHighLambda.ok).toBe(true);

		if (resultLowLambda.ok && resultLowLambda.value.some && resultHighLambda.ok && resultHighLambda.value.some) {
			const [pathLow] = resultLowLambda.value.value;
			const [pathHigh] = resultHighLambda.value.value;

			// With low lambda: longer high-MI path should win
			expect(pathLow.path.edges.length).toBe(3);

			// With high lambda: shorter path should win (penalty dominates)
			expect(pathHigh.path.edges.length).toBe(2);
		}
	});

	/**
	 * Should rank paths consistently when all have same MI.
	 */
	it("should rank paths consistently when MI values are equal", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });
		graph.addNode({ id: "D", type: "type_3" });

		graph.addEdge({ id: "E_AB", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E_AC", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E_BD", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E_CD", source: "C", target: "D", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E_AB", 0.5],
				["E_AC", 0.5],
				["E_BD", 0.5],
				["E_CD", 0.5],
			]),
		);

		const result1 = rankPaths(graph, "A", "D", { miCache });
		const result2 = rankPaths(graph, "A", "D", { miCache });

		expect(result1.ok).toBe(true);
		expect(result2.ok).toBe(true);

		if (result1.ok && result1.value.some && result2.ok && result2.value.some) {
			const paths1 = result1.value.value;
			const paths2 = result2.value.value;

			// Both results should have same number of paths
			expect(paths1.length).toBe(paths2.length);

			// Scores should be identical (deterministic)
			for (const [index, element] of paths1.entries()) {
				expect(element.score).toBeCloseTo(paths2[index].score, 0.001);
			}
		}
	});
});

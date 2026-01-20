/**
 * Length Penalty Tests for Path Salience Ranking
 *
 * Validates the length penalty component: exp(-λk)
 *
 * Tests include:
 * - Zero lambda: no penalty (λ=0 ⇒ exp(0)=1)
 * - Positive lambda: exponential decay
 * - Lambda approaches infinity: reduces to shortest path
 * - Lambda scaling behavior
 */

import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

import { Graph } from "../../../../../../../../algorithms/graph/graph";
import { rankPaths } from "../../../../../../../../algorithms/pathfinding/path-ranking";

describe("Path Salience Ranking: Length Penalty", () => {
	/**
	 * Lambda = 0 should apply no length penalty.
	 * exp(-0 × k) = exp(0) = 1
	 */
	it("should apply no penalty when lambda is zero", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });
		graph.addNode({ id: "D", type: "type_3" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });
		graph.addEdge({ id: "E2", source: "C", target: "D", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E0", 0.5],
				["E1", 0.5],
				["E2", 0.5],
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache, lambda: 0 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			expect(path.lengthPenalty).toBeUndefined();
			// Score should equal geometric mean
			expect(path.score).toBe(path.geometricMeanMI);
		}
	});

	/**
	 * Positive lambda should multiply score by exp(-λk).
	 */
	it("should apply exponential length penalty for positive lambda", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E0", 1],
				["E1", 1],
			]),
		);

		// 2-edge path with λ=0.5
		const result = rankPaths(graph, "A", "C", { miCache, lambda: 0.5 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			expect(path.lengthPenalty).toBeDefined();
			// exp(-0.5 * 2) = exp(-1) ≈ 0.368
			expect(path.lengthPenalty).toBeCloseTo(Math.exp(-1), 0.001);
			// Score = GM * penalty = 1.0 * 0.368
			expect(path.score).toBeCloseTo(0.368, 0.01);
		}
	});

	/**
	 * Score should decrease as path length increases (for fixed λ > 0).
	 */
	it("should decrease score with longer paths for fixed lambda", () => {
		const lambda = 0.1;

		// 2-edge path
		const graph2 = new Graph<ProofTestNode, ProofTestEdge>(false);
		graph2.addNode({ id: "A", type: "type_0" });
		graph2.addNode({ id: "B", type: "type_1" });
		graph2.addNode({ id: "C", type: "type_2" });
		graph2.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph2.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		// 3-edge path
		const graph3 = new Graph<ProofTestNode, ProofTestEdge>(false);
		graph3.addNode({ id: "A", type: "type_0" });
		graph3.addNode({ id: "B", type: "type_1" });
		graph3.addNode({ id: "C", type: "type_2" });
		graph3.addNode({ id: "D", type: "type_3" });
		graph3.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph3.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });
		graph3.addEdge({ id: "E2", source: "C", target: "D", type: "edge" });

		const miCache2 = createMockMICache(
			new Map([
				["E0", 1],
				["E1", 1],
			]),
		);

		const miCache3 = createMockMICache(
			new Map([
				["E0", 1],
				["E1", 1],
				["E2", 1],
			]),
		);

		const result2 = rankPaths(graph2, "A", "C", { miCache: miCache2, lambda });
		const result3 = rankPaths(graph3, "A", "D", { miCache: miCache3, lambda });

		expect(result2.ok).toBe(true);
		expect(result3.ok).toBe(true);

		if (result2.ok && result2.value.some && result3.ok && result3.value.some) {
			const [path2] = result2.value.value;
			const [path3] = result3.value.value;

			// 3-edge path should have lower score due to higher penalty
			expect(path3.score).toBeLessThan(path2.score);
		}
	});

	/**
	 * Penalty should scale exponentially with path length.
	 *
	 * For λ=0.1:
	 * - k=1: exp(-0.1) ≈ 0.905
	 * - k=2: exp(-0.2) ≈ 0.819
	 * - k=3: exp(-0.3) ≈ 0.741
	 */
	it("should scale penalty exponentially with path length", () => {
		const lambda = 0.1;
		const paths: Array<{ k: number; expectedPenalty: number }> = [
			{ k: 1, expectedPenalty: Math.exp(-lambda * 1) },
			{ k: 2, expectedPenalty: Math.exp(-lambda * 2) },
			{ k: 3, expectedPenalty: Math.exp(-lambda * 3) },
		];

		for (const { k, expectedPenalty } of paths) {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);
			const nodes = Array.from({ length: k + 1 }, (_, index) => `N${index}`);
			const edgeIds: string[] = [];

			for (const id of nodes) {
				graph.addNode({ id, type: `type_${id}` });
			}

			for (let index = 0; index < k; index++) {
				const edgeId = `E${index}`;
				edgeIds.push(edgeId);
				graph.addEdge({
					id: edgeId,
					source: `N${index}`,
					target: `N${index + 1}`,
					type: "edge",
				});
			}

			const miCache = createMockMICache(new Map(edgeIds.map((id) => [id, 1] as [string, number])));

			const result = rankPaths(graph, "N0", `N${k}`, { miCache, lambda });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const [path] = result.value.value;
				expect(path.lengthPenalty).toBeDefined();
				expect(path.lengthPenalty).toBeCloseTo(expectedPenalty, 0.001);
			}
		}
	});

	/**
	 * Larger lambda should penalise length more heavily.
	 */
	it("should penalise more heavily with larger lambda", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E0", 1],
				["E1", 1],
			]),
		);

		const resultLambda0 = rankPaths(graph, "A", "C", { miCache, lambda: 0 });
		const resultLambda1 = rankPaths(graph, "A", "C", { miCache, lambda: 0.1 });
		const resultLambda10 = rankPaths(graph, "A", "C", { miCache, lambda: 1 });

		expect(resultLambda0.ok).toBe(true);
		expect(resultLambda1.ok).toBe(true);
		expect(resultLambda10.ok).toBe(true);

		if (
			resultLambda0.ok &&
			resultLambda0.value.some &&
			resultLambda1.ok &&
			resultLambda1.value.some &&
			resultLambda10.ok &&
			resultLambda10.value.some
		) {
			const [path0] = resultLambda0.value.value;
			const [path1] = resultLambda1.value.value;
			const [path10] = resultLambda10.value.value;

			// λ=0: no penalty
			expect(path0.lengthPenalty).toBeUndefined();
			expect(path0.score).toBeCloseTo(1, 0.001);

			// λ=0.1: exp(-0.1*2) = exp(-0.2) ≈ 0.819
			expect(path1.lengthPenalty).toBeCloseTo(Math.exp(-0.2), 0.001);

			// λ=1.0: exp(-1*2) = exp(-2) ≈ 0.135
			expect(path10.lengthPenalty).toBeCloseTo(Math.exp(-2), 0.001);

			// Higher lambda → lower score
			expect(path10.score).toBeLessThan(path1.score);
			expect(path1.score).toBeLessThan(path0.score);
		}
	});

	/**
	 * Very large lambda should make longer paths score near zero.
	 */
	it("should nearly eliminate long paths with very large lambda", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E0", 1],
				["E1", 1],
			]),
		);

		const result = rankPaths(graph, "A", "C", { miCache, lambda: 100 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			// exp(-100 * 2) = exp(-200) ≈ 0
			expect(path.lengthPenalty).toBeDefined();
			expect(path.lengthPenalty).toBeLessThan(0.001);
			expect(path.score).toBeLessThan(0.001);
		}
	});

	/**
	 * Length penalty should be independent of MI values.
	 */
	it("should apply penalty independently of MI values", () => {
		// Low MI graph
		const graph1 = new Graph<ProofTestNode, ProofTestEdge>(false);
		graph1.addNode({ id: "A", type: "type_0" });
		graph1.addNode({ id: "B", type: "type_1" });
		graph1.addNode({ id: "C", type: "type_2" });
		graph1.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph1.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		// High MI graph (same structure)
		const graph2 = new Graph<ProofTestNode, ProofTestEdge>(false);
		graph2.addNode({ id: "A", type: "type_0" });
		graph2.addNode({ id: "B", type: "type_1" });
		graph2.addNode({ id: "C", type: "type_2" });
		graph2.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph2.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		const miCache1 = createMockMICache(
			new Map([
				["E0", 0.1],
				["E1", 0.1],
			]),
		);

		const miCache2 = createMockMICache(
			new Map([
				["E0", 1],
				["E1", 1],
			]),
		);

		const lambda = 0.5;
		const result1 = rankPaths(graph1, "A", "C", { miCache: miCache1, lambda });
		const result2 = rankPaths(graph2, "A", "C", { miCache: miCache2, lambda });

		expect(result1.ok).toBe(true);
		expect(result2.ok).toBe(true);

		if (result1.ok && result1.value.some && result2.ok && result2.value.some) {
			const [path1] = result1.value.value;
			const [path2] = result2.value.value;

			// Both paths have same length, so penalty should be identical
			expect(path1.lengthPenalty).toEqual(path2.lengthPenalty);
			// exp(-0.5 * 2) = exp(-1) ≈ 0.368
			expect(path1.lengthPenalty).toBeCloseTo(Math.exp(-1), 0.001);
		}
	});

	/**
	 * Lambda should default to 0 (no penalty) when not specified.
	 */
	it("should default to lambda=0 (no penalty)", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E0", 0.5],
				["E1", 0.5],
			]),
		);

		// No lambda specified - should default to 0
		const result = rankPaths(graph, "A", "C", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			expect(path.lengthPenalty).toBeUndefined();
			// Score should equal geometric mean (no penalty)
			expect(path.score).toBe(path.geometricMeanMI);
		}
	});
});

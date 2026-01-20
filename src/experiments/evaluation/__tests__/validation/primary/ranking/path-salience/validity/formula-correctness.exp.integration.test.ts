/**
 * Formula Correctness Tests for Path Salience Ranking
 *
 * Validates mathematical correctness of the MI-based formula:
 * M(P) = exp((1/k) × Σᵢ log(I(uᵢ; vᵢ))) × exp(-λk)
 *
 * Tests include:
 * - Hand-calculated expected scores for simple graphs
 * - Verification of score components (geometric mean MI, length penalty)
 * - Edge case handling (empty paths, single-edge paths)
 */

import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

import { Graph } from "../../../../../../../../algorithms/graph/graph";
import { rankPaths } from "../../../../../../../../algorithms/pathfinding/path-ranking";

describe("Path Salience Ranking: Formula Correctness", () => {
	/**
	 * Single edge path should score exactly the edge's MI value.
	 */
	it("should score single-edge path with edge MI value", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });

		// Provide explicit MI value
		const miCache = createMockMICache(new Map([["E0", 0.5]]));
		const result = rankPaths(graph, "A", "B", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			// Single edge path: score = geometric_mean(MI) = MI_value
			expect(path.score).toBeCloseTo(0.5, 0.01);
			expect(path.geometricMeanMI).toBe(path.score);
			expect(path.edgeMIValues).toEqual([0.5]);
			expect(path.path.edges.length).toBe(1);
		}
	});

	/**
	 * Two-edge path with equal MI values.
	 * Score = exp((log(MI) + log(MI))/2) = exp(log(MI)) = MI
	 */
	it("should compute geometric mean correctly for equal MI values", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge_A" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge_B" });

		const miCache = createMockMICache(
			new Map([
				["E0", 0.6],
				["E1", 0.6],
			]),
		);
		const result = rankPaths(graph, "A", "C", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			expect(path.edgeMIValues.length).toBe(2);
			// For geometric mean with equal values: sqrt(0.6 * 0.6) = 0.6
			expect(path.geometricMeanMI).toBeCloseTo(0.6, 0.01);
			expect(path.score).toBeCloseTo(0.6, 0.01);
		}
	});

	/**
	 * Hand-calculated score for diamond graph with known MI values.
	 *
	 * Graph structure:
	 *   A
	 *  / \
	 * B   C
	 *  \ /
	 *   D
	 *
	 * Edge MI values:
	 * - A→B: 0.5
	 * - A→C: 0.8
	 * - B→D: 0.6
	 * - C→D: 0.4
	 *
	 * Path A→B→D: geometric_mean(0.5, 0.6) = sqrt(0.5 * 0.6) ≈ 0.548
	 * Path A→C→D: geometric_mean(0.8, 0.4) = sqrt(0.8 * 0.4) ≈ 0.566
	 *
	 * Path A→C→D should be ranked higher despite C→D having lower MI.
	 */
	it("should correctly rank paths by geometric mean of edge MI values", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Add nodes
		graph.addNode({ id: "A", type: "start" });
		graph.addNode({ id: "B", type: "middle1" });
		graph.addNode({ id: "C", type: "middle2" });
		graph.addNode({ id: "D", type: "end" });

		// Add edges
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E2", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E3", source: "C", target: "D", type: "edge" });

		// Provide explicit MI values
		const miCache = createMockMICache(
			new Map([
				["E0", 0.5], // A→B
				["E1", 0.8], // A→C
				["E2", 0.6], // B→D
				["E3", 0.4], // C→D
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;
			expect(paths.length).toBe(2);

			// Path A->B->D: geometric_mean(0.5, 0.6) = sqrt(0.5 * 0.6) ≈ 0.548
			// Path A->C->D: geometric_mean(0.8, 0.4) = sqrt(0.8 * 0.4) ≈ 0.566
			// Path A->C->D should rank higher despite C->D having lower MI
			const [topPath, secondPath] = paths;

			// Top path should have GM ≈ 0.566 (A->C->D)
			expect(topPath.geometricMeanMI).toBeCloseTo(Math.sqrt(0.8 * 0.4), 0.01);
			expect(topPath.score).toBeCloseTo(Math.sqrt(0.8 * 0.4), 0.01);

			// Second path should have GM ≈ 0.548 (A->B->D)
			expect(secondPath.geometricMeanMI).toBeCloseTo(Math.sqrt(0.5 * 0.6), 0.01);
			expect(secondPath.score).toBeCloseTo(Math.sqrt(0.5 * 0.6), 0.01);

			// Top path should have higher score
			expect(topPath.score).toBeGreaterThan(secondPath.score);
		}
	});

	/**
	 * Self-loop path (A to A) should score 1.0.
	 */
	it("should score self-loop path as 1.0", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_A" });

		const result = rankPaths(graph, "A", "A");

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			expect(path.score).toBe(1);
			expect(path.path.edges.length).toBe(0);
			expect(path.edgeMIValues.length).toBe(0);
		}
	});

	/**
	 * Length penalty should multiply geometric mean by exp(-λk).
	 *
	 * For λ=0.1 and k=3: penalty = exp(-0.3) ≈ 0.741
	 */
	it("should correctly apply length penalty factor", () => {
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

		// Test without length penalty (lambda=0)
		const resultNoPenalty = rankPaths(graph, "A", "D", { miCache, lambda: 0 });
		expect(resultNoPenalty.ok).toBe(true);
		if (resultNoPenalty.ok && resultNoPenalty.value.some) {
			const [path] = resultNoPenalty.value.value;
			expect(path.lengthPenalty).toBeUndefined();
			// Score = geometric_mean(0.5, 0.5, 0.5) = 0.5
			expect(path.score).toBeCloseTo(0.5, 0.01);
		}

		// Test with length penalty
		const resultWithPenalty = rankPaths(graph, "A", "D", { miCache, lambda: 0.1 });
		expect(resultWithPenalty.ok).toBe(true);
		if (resultWithPenalty.ok && resultWithPenalty.value.some) {
			const [path] = resultWithPenalty.value.value;
			expect(path.lengthPenalty).toBeDefined();
			// Penalty for k=3: exp(-0.1 * 3) = exp(-0.3) ≈ 0.741
			expect(path.lengthPenalty).toBeCloseTo(0.741, 0.01);
			// Score = 0.5 * 0.741 ≈ 0.371
			expect(path.score).toBeCloseTo(0.371, 0.01);
		}
	});

	/**
	 * Very large λ should heavily penalise longer paths.
	 * λ → ∞ approaches shortest-path behavior.
	 */
	it("should heavily penalise longer paths with large lambda", () => {
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
				["E0", 1],
				["E1", 1],
				["E2", 1],
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache, lambda: 10 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			// exp(-10 * 3) = exp(-30) ≈ 9.35e-14
			expect(path.lengthPenalty).toBeDefined();
			expect(path.lengthPenalty).toBeLessThan(0.001);
			// Score should be very small due to large penalty
			expect(path.score).toBeLessThan(0.1);
		}
	});

	/**
	 * Zero-length path (A to A) should return score 1.0.
	 */
	it("should handle zero-length path correctly", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "node" });

		const result = rankPaths(graph, "A", "A");

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			expect(path.score).toBe(1);
			expect(path.path.edges.length).toBe(0);
		}
	});

	/**
	 * Disconnected nodes should return None.
	 */
	it("should return None for disconnected nodes", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		// No edge added

		const result = rankPaths(graph, "A", "B");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.some).toBe(false);
		}
	});

	/**
	 * Formula should handle mixed MI values correctly.
	 *
	 * Graph with high MI on one edge and low MI on another.
	 * Geometric mean should penalise the low MI edge.
	 */
	it("should penalise paths with weak links via geometric mean", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "start" });
		graph.addNode({ id: "B", type: "middle" });
		graph.addNode({ id: "C", type: "end" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "strong" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "weak" });

		const miCache = createMockMICache(
			new Map([
				["E0", 0.9], // Strong link
				["E1", 0.1], // Weak link
			]),
		);

		const result = rankPaths(graph, "A", "C", { miCache, lambda: 0 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			// geometric_mean(0.9, 0.1) = sqrt(0.09) = 0.3
			expect(path.geometricMeanMI).toBeCloseTo(0.3, 0.01);
			// Weak link dominates the geometric mean
			expect(path.geometricMeanMI).toBeLessThan(0.5);
		}
	});
});

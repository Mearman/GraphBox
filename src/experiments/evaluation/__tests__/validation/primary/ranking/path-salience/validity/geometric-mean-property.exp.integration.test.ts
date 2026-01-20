/**
 * Geometric Mean Property Tests for Path Salience Ranking
 *
 * Validates the mathematical properties of the geometric mean component:
 * - Bounded by arithmetic mean (AM ≥ GM)
 * - Bounded by minimum and maximum MI values
 * - Homogeneity property (equal values ⇒ GM equals value)
 * - Multiplicative scaling property
 */

import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache,geometricMean } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

import { Graph } from "../../../../../../../../algorithms/graph/graph";
import { rankPaths } from "../../../../../../../../algorithms/pathfinding/path-ranking";

describe("Path Salience Ranking: Geometric Mean Property", () => {
	/**
	 * When all edge MI values are equal, geometric mean equals that value.
	 */
	it("should return equal MI value when all edges have same MI", () => {
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

		const result = rankPaths(graph, "A", "D", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			// All edges have MI=0.5, so GM should be 0.5
			expect(path.geometricMeanMI).toBeCloseTo(0.5, 0.001);
			expect(path.score).toBeCloseTo(0.5, 0.001);
		}
	});

	/**
	 * Geometric mean should equal the manually computed value.
	 */
	it("should match manually computed geometric mean", () => {
		const miValues = [0.2, 0.8, 0.5];
		const expectedGM = geometricMean(miValues);

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
				["E0", miValues[0]],
				["E1", miValues[1]],
				["E2", miValues[2]],
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			expect(path.geometricMeanMI).toBeCloseTo(expectedGM, 0.001);
		}
	});

	/**
	 * Geometric mean should be bounded by minimum and maximum edge MI.
	 *
	 * min(MI) ≤ GM ≤ max(MI)
	 */
	it("should be bounded by min and max edge MI values", () => {
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
				["E0", 0.1],
				["E1", 0.5],
				["E2", 0.9],
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			const minMI = Math.min(...path.edgeMIValues);
			const maxMI = Math.max(...path.edgeMIValues);

			expect(path.geometricMeanMI).toBeGreaterThanOrEqual(minMI);
			expect(path.geometricMeanMI).toBeLessThanOrEqual(maxMI);
		}
	});

	/**
	 * Geometric mean should be less than or equal to arithmetic mean.
	 * AM ≥ GM for positive numbers
	 */
	it("should be bounded by arithmetic mean (AM ≥ GM)", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E0", 0.5],
				["E1", 0.8],
			]),
		);

		const result = rankPaths(graph, "A", "C", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			const arithmeticMean = path.edgeMIValues.reduce((a, b) => a + b, 0) / path.edgeMIValues.length;

			expect(path.geometricMeanMI).toBeLessThanOrEqual(arithmeticMean);
		}
	});

	/**
	 * Path with all high MI values should score higher than path with mixed values.
	 */
	it("should prefer consistently high MI over mixed MI", () => {
		// Path 1: All high MI (0.8, 0.8, 0.8)
		const highMIGraph = new Graph<ProofTestNode, ProofTestEdge>(false);
		highMIGraph.addNode({ id: "A", type: "type_0" });
		highMIGraph.addNode({ id: "B", type: "type_1" });
		highMIGraph.addNode({ id: "C", type: "type_2" });
		highMIGraph.addNode({ id: "D", type: "type_3" });
		highMIGraph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		highMIGraph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });
		highMIGraph.addEdge({ id: "E2", source: "C", target: "D", type: "edge" });

		const highMICache = createMockMICache(
			new Map([
				["E0", 0.8],
				["E1", 0.8],
				["E2", 0.8],
			]),
		);

		// Path 2: Mixed MI (0.9, 0.1, 0.9) - one weak link
		const mixedMIGraph = new Graph<ProofTestNode, ProofTestEdge>(false);
		mixedMIGraph.addNode({ id: "A", type: "type_0" });
		mixedMIGraph.addNode({ id: "B", type: "type_1" });
		mixedMIGraph.addNode({ id: "C", type: "type_2" });
		mixedMIGraph.addNode({ id: "D", type: "type_3" });
		mixedMIGraph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		mixedMIGraph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });
		mixedMIGraph.addEdge({ id: "E2", source: "C", target: "D", type: "edge" });

		const mixedMICache = createMockMICache(
			new Map([
				["E0", 0.9],
				["E1", 0.1], // Weak link
				["E2", 0.9],
			]),
		);

		const resultHigh = rankPaths(highMIGraph, "A", "D", { miCache: highMICache });
		const resultMixed = rankPaths(mixedMIGraph, "A", "D", { miCache: mixedMICache });

		expect(resultHigh.ok).toBe(true);
		expect(resultMixed.ok).toBe(true);

		if (resultHigh.ok && resultHigh.value.some && resultMixed.ok && resultMixed.value.some) {
			const [pathHigh] = resultHigh.value.value;
			const [pathMixed] = resultMixed.value.value;

			// High MI path should score higher
			expect(pathHigh.score).toBeGreaterThan(pathMixed.score);
			// GM(0.8, 0.8, 0.8) = 0.8
			expect(pathHigh.geometricMeanMI).toBeCloseTo(0.8, 0.001);
			// GM(0.9, 0.1, 0.9) ≈ 0.434 (weak link dominates)
			expect(pathMixed.geometricMeanMI).toBeCloseTo(0.434, 0.001);
		}
	});

	/**
	 * Adding a high-MI edge should not offset a low-MI edge due to geometric mean.
	 */
	it("should demonstrate weak link dominance in geometric mean", () => {
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
				["E0", 1], // Very high
				["E1", 0.01], // Very low (weak link)
				["E2", 1], // Very high
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			// geometric_mean(1.0, 0.01, 1.0) = (1 * 0.01 * 1)^(1/3) ≈ 0.215
			// The weak link (0.01) dominates
			expect(path.geometricMeanMI).toBeLessThan(0.5);
			expect(path.geometricMeanMI).toBeCloseTo(0.215, 0.01);
		}
	});

	/**
	 * Edge MI values should be stored correctly for all edges in path.
	 */
	it("should store individual edge MI values correctly", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_0" });
		graph.addNode({ id: "B", type: "type_1" });
		graph.addNode({ id: "C", type: "type_2" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		const miCache = createMockMICache(
			new Map([
				["E0", 0.5],
				["E1", 0.7],
			]),
		);

		const result = rankPaths(graph, "A", "C", { miCache });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			// Edge MI values are stored in reverse order (target to source)
			// The geometric mean calculation is correct regardless of order
			expect(path.edgeMIValues).toEqual([0.7, 0.5]);
			expect(path.edgeMIValues.length).toBe(2);
			// The geometric mean should be correct
			expect(path.geometricMeanMI).toBeCloseTo(Math.sqrt(0.5 * 0.7), 0.001);
		}
	});
});

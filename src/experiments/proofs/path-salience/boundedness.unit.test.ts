/**
 * Boundedness Property Tests for Path Salience Ranking
 *
 * Validates: min(MI) ≤ M(P) ≤ max(MI)
 *
 * The geometric mean is always bounded by the minimum and maximum
 * edge MI values in the path.
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import { rankPaths } from "../../../algorithms/pathfinding/path-ranking";
import type { ProofTestEdge, ProofTestNode } from "../test-utils";
import { geometricMean } from "../test-utils";

describe("Boundedness Property", () => {
	describe("Geometric Mean Bounds", () => {
		it("geometric mean within [min, max] bounds", () => {
			const testCases = [
				[0.3, 0.5, 0.7],
				[0.1, 0.9],
				[0.2, 0.4, 0.6, 0.8],
				[0.01, 0.5, 0.99],
				[0.5, 0.5, 0.5, 0.5],
			];

			for (const values of testCases) {
				const geo = geometricMean(values);
				const min = Math.min(...values);
				const max = Math.max(...values);

				expect(geo).toBeGreaterThanOrEqual(min - 0.0001);
				expect(geo).toBeLessThanOrEqual(max + 0.0001);
			}
		});

		it("uniform values: geometric mean equals that value", () => {
			const uniform = [0.6, 0.6, 0.6, 0.6];
			const geo = geometricMean(uniform);

			expect(Math.abs(geo - 0.6)).toBeLessThan(0.0001);
		});

		it("two-element path: geometric mean is between values", () => {
			const values = [0.4, 0.8];
			const geo = geometricMean(values);

			expect(geo).toBeGreaterThan(0.4);
			expect(geo).toBeLessThan(0.8);
			expect(Math.abs(geo - Math.sqrt(0.4 * 0.8))).toBeLessThan(0.0001);
		});
	});

	describe("Path Score Boundedness", () => {
		it("path score bounded by edge MI values", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Create path A → B → C → D
			for (const [index, id] of ["A", "B", "C", "D"].entries()) graph.addNode({ id, type: `t${index}` });
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });
			graph.addEdge({ id: "E2", source: "C", target: "D", type: "edge" });

			const result = rankPaths(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value[0];
				const minMI = Math.min(...path.edgeMIValues);
				const maxMI = Math.max(...path.edgeMIValues);

				// Property: min(MI) ≤ M(P) ≤ max(MI)
				expect(path.geometricMeanMI).toBeGreaterThanOrEqual(minMI - 0.0001);
				expect(path.geometricMeanMI).toBeLessThanOrEqual(maxMI + 0.0001);
			}
		});

		it("longer path maintains bounds", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Create longer path
			const nodes = ["A", "B", "C", "D", "E", "F"];
			for (const [index, id] of nodes.entries()) graph.addNode({ id, type: `t${index}` });

			for (let index = 0; index < nodes.length - 1; index++) {
				graph.addEdge({
					id: `E${index}`,
					source: nodes[index],
					target: nodes[index + 1],
					type: "edge",
				});
			}

			const result = rankPaths(graph, "A", "F");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value[0];
				const minMI = Math.min(...path.edgeMIValues);
				const maxMI = Math.max(...path.edgeMIValues);

				expect(path.geometricMeanMI).toBeGreaterThanOrEqual(minMI - 0.0001);
				expect(path.geometricMeanMI).toBeLessThanOrEqual(maxMI + 0.0001);
			}
		});
	});

	describe("Finite Values", () => {
		it("no infinite scores", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			for (const [index, id] of ["A", "B", "C"].entries()) graph.addNode({ id, type: `t${index}` });
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

			const result = rankPaths(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				for (const path of result.value.value) {
					expect(Number.isFinite(path.score)).toBe(true);
					expect(Number.isFinite(path.geometricMeanMI)).toBe(true);
					for (const mi of path.edgeMIValues) {
						expect(Number.isFinite(mi)).toBe(true);
					}
				}
			}
		});

		it("no NaN scores", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			for (const [index, id] of ["A", "B", "C", "D"].entries()) graph.addNode({ id, type: `t${index}` });
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });
			graph.addEdge({ id: "E2", source: "C", target: "D", type: "edge" });

			const result = rankPaths(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				for (const path of result.value.value) {
					expect(Number.isNaN(path.score)).toBe(false);
					expect(Number.isNaN(path.geometricMeanMI)).toBe(false);
					for (const mi of path.edgeMIValues) {
						expect(Number.isNaN(mi)).toBe(false);
					}
				}
			}
		});
	});

	describe("Bound Tightness", () => {
		it("single-edge path: score equals edge MI", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "t0" });
			graph.addNode({ id: "B", type: "t1" });
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });

			const result = rankPaths(graph, "A", "B");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value[0];

				// For single edge, geometric mean = that edge's MI
				expect(path.edgeMIValues.length).toBe(1);
				expect(Math.abs(path.geometricMeanMI - path.edgeMIValues[0])).toBeLessThan(0.0001);
			}
		});

		it("uniform path: score equals common MI value", () => {
			// When all edges have same MI, bounds collapse to a single point
			const values = [0.5, 0.5, 0.5, 0.5];
			const geo = geometricMean(values);

			expect(Math.abs(geo - 0.5)).toBeLessThan(0.0001);
			expect(geo).toBeGreaterThanOrEqual(0.5 - 0.0001);
			expect(geo).toBeLessThanOrEqual(0.5 + 0.0001);
		});
	});

	describe("Extreme Value Bounds", () => {
		it("very small values bounded correctly", () => {
			const small = [0.001, 0.002, 0.003];
			const geo = geometricMean(small);

			expect(geo).toBeGreaterThanOrEqual(0.001 - 0.0001);
			expect(geo).toBeLessThanOrEqual(0.003 + 0.0001);
		});

		it("values close to 1 bounded correctly", () => {
			const large = [0.95, 0.98, 0.99];
			const geo = geometricMean(large);

			expect(geo).toBeGreaterThanOrEqual(0.95 - 0.0001);
			expect(geo).toBeLessThanOrEqual(0.99 + 0.0001);
		});

		it("wide range of values bounded correctly", () => {
			const wide = [0.01, 0.5, 0.99];
			const geo = geometricMean(wide);

			expect(geo).toBeGreaterThanOrEqual(0.01 - 0.0001);
			expect(geo).toBeLessThanOrEqual(0.99 + 0.0001);
		});
	});

	describe("Ordering Within Bounds", () => {
		it("geometric mean closer to smaller values", () => {
			// Due to geometric mean property
			const skewed = [0.1, 0.9, 0.9];
			const geo = geometricMean(skewed);
			const arithmeticMean = (0.1 + 0.9 + 0.9) / 3;

			// Geometric mean is always ≤ arithmetic mean
			expect(geo).toBeLessThanOrEqual(arithmeticMean);
		});

		it("geometric ≤ arithmetic mean (AM-GM inequality)", () => {
			const testCases = [
				[0.2, 0.8],
				[0.1, 0.5, 0.9],
				[0.3, 0.4, 0.5, 0.6],
			];

			for (const values of testCases) {
				const geo = geometricMean(values);
				const arith = values.reduce((a, b) => a + b, 0) / values.length;

				expect(geo).toBeLessThanOrEqual(arith + 0.0001);
			}
		});
	});
});

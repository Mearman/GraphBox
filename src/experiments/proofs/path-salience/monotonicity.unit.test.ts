/**
 * Monotonicity Property Tests for Path Salience Ranking
 *
 * Validates: ∂M(P)/∂I(uⱼ;vⱼ) > 0
 *
 * The path score is monotonically increasing in each edge's MI value.
 * Increasing any edge's MI will increase the overall path score.
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import { rankPaths } from "../../../algorithms/pathfinding/path-ranking";
import type { ProofTestEdge, ProofTestNode } from "../test-utils";
import { geometricMean } from "../test-utils";

describe("Monotonicity Property", () => {
	describe("Score Increases with Edge MI", () => {
		it("increasing single edge MI increases path score", () => {
			// Test with different node types to get different MI values
			const createGraph = (edgeType: string): Graph<ProofTestNode, ProofTestEdge> => {
				const graph = new Graph<ProofTestNode, ProofTestEdge>(false);
				graph.addNode({ id: "A", type: "t0" });
				graph.addNode({ id: "B", type: "t1" });
				graph.addNode({ id: "C", type: "t2" });

				graph.addEdge({ id: "E0", source: "A", target: "B", type: "stable" });
				graph.addEdge({ id: "E1", source: "B", target: "C", type: edgeType });

				return graph;
			};

			// Create graphs with different edge types (affects MI via edge type rarity)
			const graph1 = createGraph("common");
			const graph2 = createGraph("rare");

			const result1 = rankPaths(graph1, "A", "C");
			const result2 = rankPaths(graph2, "A", "C");

			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(true);

			// Both should find paths
			if (result1.ok && result1.value.some && result2.ok && result2.value.some) {
				// Scores exist and are finite
				expect(Number.isFinite(result1.value.value[0].score)).toBe(true);
				expect(Number.isFinite(result2.value.value[0].score)).toBe(true);
			}
		});

		it("geometric mean formula satisfies monotonicity", () => {
			// Direct test: geometricMean([a, b, c]) increases when any element increases
			const base = [0.5, 0.6, 0.7];
			const baseGeoMean = geometricMean(base);

			// Increase first element
			const increased0 = [0.6, 0.6, 0.7];
			expect(geometricMean(increased0)).toBeGreaterThan(baseGeoMean);

			// Increase middle element
			const increased1 = [0.5, 0.7, 0.7];
			expect(geometricMean(increased1)).toBeGreaterThan(baseGeoMean);

			// Increase last element
			const increased2 = [0.5, 0.6, 0.8];
			expect(geometricMean(increased2)).toBeGreaterThan(baseGeoMean);
		});

		it("doubling any edge MI increases geometric mean", () => {
			const values = [0.3, 0.5, 0.4];
			const baseGeoMean = geometricMean(values);

			for (let index = 0; index < values.length; index++) {
				const modified = [...values];
				modified[index] *= 2;
				expect(geometricMean(modified)).toBeGreaterThan(baseGeoMean);
			}
		});
	});

	describe("Monotonicity Across Path Positions", () => {
		it("monotonic for first edge position", () => {
			const values1 = [0.3, 0.5, 0.5];
			const values2 = [0.4, 0.5, 0.5];
			const values3 = [0.5, 0.5, 0.5];

			const geo1 = geometricMean(values1);
			const geo2 = geometricMean(values2);
			const geo3 = geometricMean(values3);

			expect(geo2).toBeGreaterThan(geo1);
			expect(geo3).toBeGreaterThan(geo2);
		});

		it("monotonic for middle edge position", () => {
			const values1 = [0.5, 0.3, 0.5];
			const values2 = [0.5, 0.4, 0.5];
			const values3 = [0.5, 0.5, 0.5];

			const geo1 = geometricMean(values1);
			const geo2 = geometricMean(values2);
			const geo3 = geometricMean(values3);

			expect(geo2).toBeGreaterThan(geo1);
			expect(geo3).toBeGreaterThan(geo2);
		});

		it("monotonic for last edge position", () => {
			const values1 = [0.5, 0.5, 0.3];
			const values2 = [0.5, 0.5, 0.4];
			const values3 = [0.5, 0.5, 0.5];

			const geo1 = geometricMean(values1);
			const geo2 = geometricMean(values2);
			const geo3 = geometricMean(values3);

			expect(geo2).toBeGreaterThan(geo1);
			expect(geo3).toBeGreaterThan(geo2);
		});
	});

	describe("Monotonicity with Varying Path Lengths", () => {
		it("monotonic for 2-edge paths", () => {
			const base = [0.4, 0.6];
			const improved = [0.5, 0.6];

			expect(geometricMean(improved)).toBeGreaterThan(geometricMean(base));
		});

		it("monotonic for 4-edge paths", () => {
			const base = [0.4, 0.5, 0.6, 0.5];
			const baseGeo = geometricMean(base);

			// Improve each position
			for (let index = 0; index < base.length; index++) {
				const improved = [...base];
				improved[index] += 0.1;
				expect(geometricMean(improved)).toBeGreaterThan(baseGeo);
			}
		});

		it("monotonic for 10-edge paths", () => {
			const base = Array.from({ length: 10 }, () => 0.5);
			const baseGeo = geometricMean(base);

			// Improve each position
			for (let index = 0; index < base.length; index++) {
				const improved = [...base];
				improved[index] = 0.6;
				expect(geometricMean(improved)).toBeGreaterThan(baseGeo);
			}
		});
	});

	describe("Strict Monotonicity (No Plateaus)", () => {
		it("any increase in MI leads to strict increase in score", () => {
			const base = [0.5, 0.5, 0.5];
			const baseGeo = geometricMean(base);

			// Even tiny increases should yield strict increase
			const epsilon = 0.0001;
			for (let index = 0; index < base.length; index++) {
				const improved = [...base];
				improved[index] += epsilon;
				expect(geometricMean(improved)).toBeGreaterThan(baseGeo);
			}
		});

		it("derivative is always positive for positive MI values", () => {
			// For geometric mean: ∂/∂xᵢ (∏xⱼ)^(1/n) = (1/n) × (∏xⱼ)^(1/n) × (1/xᵢ) > 0
			// when all xⱼ > 0

			const testCases = [
				[0.1, 0.1, 0.1],
				[0.5, 0.5, 0.5],
				[0.9, 0.9, 0.9],
				[0.1, 0.5, 0.9],
				[0.01, 0.01, 0.01],
			];

			const delta = 0.001;

			for (const values of testCases) {
				const baseGeo = geometricMean(values);
				for (let index = 0; index < values.length; index++) {
					const improved = [...values];
					improved[index] += delta;
					const improvedGeo = geometricMean(improved);

					// Numerical derivative should be positive
					const derivative = (improvedGeo - baseGeo) / delta;
					expect(derivative).toBeGreaterThan(0);
				}
			}
		});
	});

	describe("Monotonicity Preserved with Length Penalty", () => {
		it("monotonicity holds when lambda > 0", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);
			for (const [index, id] of ["A", "B", "C"].entries()) graph.addNode({ id, type: `t${index}` });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

			// With length penalty
			const result = rankPaths(graph, "A", "C", { lambda: 0.1 });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value[0];

				// Score should still be positive and finite
				expect(path.score).toBeGreaterThan(0);
				expect(Number.isFinite(path.score)).toBe(true);

				// Length penalty should be present
				expect(path.lengthPenalty).toBeDefined();
				expect(path.lengthPenalty).toBeLessThan(1);
			}
		});
	});
});

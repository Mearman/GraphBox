/**
 * Equal-Length Invariance Tests for Path Salience Ranking
 *
 * Validates: For equal-length paths, 1/k cancels out.
 *
 * When comparing paths of the same length, the 1/k exponent cancels,
 * and ranking depends only on the product of MI values (equivalently,
 * the sum of log(MI) values).
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import { rankPaths } from "../../../algorithms/pathfinding/path-ranking";
import type { ProofTestEdge, ProofTestNode } from "../test-utils";
import { geometricMean } from "../test-utils";

describe("Equal-Length Invariance", () => {
	describe("1/k Cancellation", () => {
		it("ranking depends on product for same-length paths", () => {
			// For paths of length k:
			// M(P) = (∏ MI_i)^(1/k)
			// When k is same, ranking by M(P) = ranking by ∏ MI_i

			const path1 = [0.6, 0.8]; // Product = 0.48
			const path2 = [0.5, 0.9]; // Product = 0.45

			const geo1 = geometricMean(path1);
			const geo2 = geometricMean(path2);

			// Higher product → higher geometric mean
			expect(geo1).toBeGreaterThan(geo2);

			// Product ordering matches geometric mean ordering
			const production1 = path1.reduce((a, b) => a * b, 1);
			const production2 = path2.reduce((a, b) => a * b, 1);
			expect(production1).toBeGreaterThan(production2);
		});

		it("sum of logs determines ranking for equal-length paths", () => {
			// log(geometric_mean) = (1/k) × Σlog(MI_i)
			// For same k, ranking by Σlog(MI_i)

			const path1 = [0.5, 0.6, 0.7];
			const path2 = [0.4, 0.7, 0.7];

			const logSum1 = path1.reduce((s, v) => s + Math.log(v), 0);
			const logSum2 = path2.reduce((s, v) => s + Math.log(v), 0);

			const geo1 = geometricMean(path1);
			const geo2 = geometricMean(path2);

			// Higher log sum → higher geometric mean
			if (logSum1 > logSum2) {
				expect(geo1).toBeGreaterThan(geo2);
			} else {
				expect(geo2).toBeGreaterThan(geo1);
			}
		});
	});

	describe("Same-Length Path Comparison", () => {
		it("compares two 2-edge paths correctly", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Diamond: A → B → D and A → C → D
			graph.addNode({ id: "A", type: "t0" });
			graph.addNode({ id: "B", type: "t1" });
			graph.addNode({ id: "C", type: "t2" });
			graph.addNode({ id: "D", type: "t3" });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "high" });
			graph.addEdge({ id: "E1", source: "B", target: "D", type: "high" });
			graph.addEdge({ id: "E2", source: "A", target: "C", type: "medium" });
			graph.addEdge({ id: "E3", source: "C", target: "D", type: "medium" });

			const result = rankPaths(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const paths = result.value.value;

				// Both paths have length 2 (2 edges)
				expect(paths.length).toBe(2);
				for (const path of paths) {
					expect(path.path.edges.length).toBe(2);
				}

				// Ranking by product of MI values
				const production0 = paths[0].edgeMIValues.reduce((a, b) => a * b, 1);
				const production1 = paths[1].edgeMIValues.reduce((a, b) => a * b, 1);

				// Higher product should be ranked higher (first)
				expect(production0).toBeGreaterThanOrEqual(production1);
			}
		});

		it("compares multiple same-length paths", () => {
			// Create graph with 3 paths of same length
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "t0" });
			graph.addNode({ id: "B1", type: "t1" });
			graph.addNode({ id: "B2", type: "t2" });
			graph.addNode({ id: "B3", type: "t3" });
			graph.addNode({ id: "D", type: "t4" });

			// Three 2-edge paths with different types
			graph.addEdge({ id: "E0", source: "A", target: "B1", type: "type1" });
			graph.addEdge({ id: "E1", source: "B1", target: "D", type: "type1" });
			graph.addEdge({ id: "E2", source: "A", target: "B2", type: "type2" });
			graph.addEdge({ id: "E3", source: "B2", target: "D", type: "type2" });
			graph.addEdge({ id: "E4", source: "A", target: "B3", type: "type3" });
			graph.addEdge({ id: "E5", source: "B3", target: "D", type: "type3" });

			const result = rankPaths(graph, "A", "D", { maxPaths: 10 });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const paths = result.value.value;

				// All paths have same length
				const lengths = paths.map((p) => p.path.edges.length);
				expect(new Set(lengths).size).toBe(1);

				// Should be sorted by score (descending)
				for (let index = 1; index < paths.length; index++) {
					expect(paths[index - 1].score).toBeGreaterThanOrEqual(paths[index].score);
				}
			}
		});
	});

	describe("Mathematical Equivalence", () => {
		it("geometric mean ordering equals product ordering", () => {
			// For same-length paths, both orderings are equivalent
			const paths = [
				[0.4, 0.8],
				[0.5, 0.7],
				[0.6, 0.6],
				[0.3, 0.9],
			];

			// Sort by geometric mean
			const byGeoMean = [...paths].toSorted((a, b) => geometricMean(b) - geometricMean(a));

			// Sort by product
			const byProduct = [...paths].toSorted(
				(a, b) =>
					b.reduce((x, y) => x * y, 1) - a.reduce((x, y) => x * y, 1),
			);

			// Orderings should match
			for (let index = 0; index < paths.length; index++) {
				expect(byGeoMean[index]).toEqual(byProduct[index]);
			}
		});

		it("geometric mean ordering equals log-sum ordering", () => {
			const paths = [
				[0.3, 0.5, 0.7],
				[0.4, 0.4, 0.8],
				[0.5, 0.5, 0.5],
				[0.2, 0.6, 0.9],
			];

			// Sort by geometric mean
			const byGeoMean = [...paths].toSorted((a, b) => geometricMean(b) - geometricMean(a));

			// Sort by sum of logs
			const byLogSum = [...paths].toSorted(
				(a, b) =>
					b.reduce((s, v) => s + Math.log(v), 0) - a.reduce((s, v) => s + Math.log(v), 0),
			);

			// Orderings should match
			for (let index = 0; index < paths.length; index++) {
				expect(byGeoMean[index]).toEqual(byLogSum[index]);
			}
		});
	});

	describe("Length Independence of Ranking Logic", () => {
		it("ranking logic same for 2-edge and 5-edge paths", () => {
			// The same ranking logic applies regardless of path length
			const twoEdge = [
				[0.6, 0.8],
				[0.5, 0.9],
			];

			const fiveEdge = [
				[0.6, 0.7, 0.8, 0.6, 0.8],
				[0.5, 0.9, 0.7, 0.7, 0.7],
			];

			// For 2-edge: product determines ranking
			const production2_0 = twoEdge[0].reduce((a, b) => a * b, 1);
			const production2_1 = twoEdge[1].reduce((a, b) => a * b, 1);
			const geo2_0 = geometricMean(twoEdge[0]);
			const geo2_1 = geometricMean(twoEdge[1]);

			if (production2_0 > production2_1) {
				expect(geo2_0).toBeGreaterThan(geo2_1);
			}

			// For 5-edge: same logic
			const production5_0 = fiveEdge[0].reduce((a, b) => a * b, 1);
			const production5_1 = fiveEdge[1].reduce((a, b) => a * b, 1);
			const geo5_0 = geometricMean(fiveEdge[0]);
			const geo5_1 = geometricMean(fiveEdge[1]);

			if (production5_0 > production5_1) {
				expect(geo5_0).toBeGreaterThan(geo5_1);
			}
		});
	});

	describe("Tie Breaking", () => {
		it("equal products result in equal scores", () => {
			// [0.4, 0.6] and [0.6, 0.4] have same product
			const path1 = [0.4, 0.6];
			const path2 = [0.6, 0.4];

			const geo1 = geometricMean(path1);
			const geo2 = geometricMean(path2);

			expect(Math.abs(geo1 - geo2)).toBeLessThan(0.0001);
		});

		it("permutations of same values have equal scores", () => {
			const permutations = [
				[0.3, 0.5, 0.7],
				[0.3, 0.7, 0.5],
				[0.5, 0.3, 0.7],
				[0.5, 0.7, 0.3],
				[0.7, 0.3, 0.5],
				[0.7, 0.5, 0.3],
			];

			const geos = permutations.map(geometricMean);

			// All should be equal
			for (const geo of geos) {
				expect(Math.abs(geo - geos[0])).toBeLessThan(0.0001);
			}
		});
	});
});

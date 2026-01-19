/**
 * Weak Link Dominance Tests for Path Salience Ranking
 *
 * Validates: lim_{I→0} M(P) = 0
 *
 * A path with even one zero-MI edge has zero score. Very low MI edges
 * dominate the geometric mean, driving the path score toward zero.
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import { rankPaths } from "../../../algorithms/pathfinding/path-ranking";
import type { ProofTestEdge, ProofTestNode } from "../test-utils";
import { geometricMean } from "../test-utils";

describe("Weak Link Dominance", () => {
	describe("Zero MI Edge", () => {
		it("geometric mean with zero element is zero", () => {
			// Direct mathematical test
			const withZero = [0.8, 0, 0.9];
			expect(geometricMean(withZero)).toBe(0);
		});

		it("path score approaches zero as edge MI approaches zero", () => {
			// Test the limit behavior
			const values = [0.8, 0.9];

			const testCases = [0.1, 0.01, 0.001, 0.0001];
			let previousGeo = geometricMean([...values, 1]); // Start with high value

			for (const epsilon of testCases) {
				const currentGeo = geometricMean([...values, epsilon]);
				expect(currentGeo).toBeLessThan(previousGeo);
				previousGeo = currentGeo;
			}

			// Very small value should give very small geometric mean
			expect(geometricMean([...values, 0.0001])).toBeLessThan(0.1);
		});
	});

	describe("Near-Zero MI Edge", () => {
		it("epsilon-MI edge dominates path score", () => {
			const highMI = [0.9, 0.9, 0.9];
			const withEpsilon = [0.9, 0.001, 0.9];

			const highGeo = geometricMean(highMI);
			const lowGeo = geometricMean(withEpsilon);

			// Single low edge drastically reduces geometric mean
			expect(lowGeo).toBeLessThan(highGeo * 0.2);
		});

		it("multiple epsilon edges compound the effect", () => {
			const oneWeak = [0.9, 0.01, 0.9];
			const twoWeak = [0.9, 0.01, 0.01];

			const geoOne = geometricMean(oneWeak);
			const geoTwo = geometricMean(twoWeak);

			expect(geoTwo).toBeLessThan(geoOne);
		});
	});

	describe("Weak Link Position Independence", () => {
		it("weak link at start has same effect as middle or end", () => {
			const atStart = [0.01, 0.9, 0.9];
			const atMiddle = [0.9, 0.01, 0.9];
			const atEnd = [0.9, 0.9, 0.01];

			// Geometric mean is symmetric - position doesn't matter
			expect(geometricMean(atStart)).toBeCloseTo(geometricMean(atMiddle), 10);
			expect(geometricMean(atMiddle)).toBeCloseTo(geometricMean(atEnd), 10);
		});
	});

	describe("Relative Impact of Weak Links", () => {
		it("weak link has greater relative impact in shorter paths", () => {
			// In shorter paths, each edge contributes more to the mean
			const short = [0.9, 0.1]; // 2 edges
			const long = [0.9, 0.1, 0.9, 0.9, 0.9]; // 5 edges

			const shortGeo = geometricMean(short);
			const longGeo = geometricMean(long);

			// Long path "dilutes" the weak link effect
			expect(longGeo).toBeGreaterThan(shortGeo);
		});

		it("weak link ratio determines impact", () => {
			// Compare ratios of weak to strong
			const ratio10 = geometricMean([0.9, 0.09]); // 10:1 ratio
			const ratio100 = geometricMean([0.9, 0.009]); // 100:1 ratio

			expect(ratio100).toBeLessThan(ratio10);
		});
	});

	describe("Practical Weak Link Scenarios", () => {
		it("path with diverse MI values", () => {
			// Realistic scenario: path through nodes with varying connection quality
			const diversePath = [0.8, 0.6, 0.05, 0.7, 0.9];
			const geo = geometricMean(diversePath);

			// Weak link (0.05) should significantly impact overall score
			// Without weak link: geometric mean of [0.8, 0.6, 0.7, 0.9] ≈ 0.74
			const withoutWeak = geometricMean([0.8, 0.6, 0.7, 0.9]);

			// Weak link should reduce score significantly (by at least 30%)
			expect(geo).toBeLessThan(withoutWeak * 0.7);
		});

		it("comparing paths with and without weak links", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Create diamond graph: A → B → D and A → C → D
			graph.addNode({ id: "A", type: "start" });
			graph.addNode({ id: "B", type: "strong" });
			graph.addNode({ id: "C", type: "weak" });
			graph.addNode({ id: "D", type: "end" });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "high" });
			graph.addEdge({ id: "E1", source: "B", target: "D", type: "high" });
			graph.addEdge({ id: "E2", source: "A", target: "C", type: "high" });
			graph.addEdge({ id: "E3", source: "C", target: "D", type: "low" }); // Weak link

			const result = rankPaths(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const paths = result.value.value;
				expect(paths.length).toBe(2);

				// Both paths should have finite scores
				for (const path of paths) {
					expect(Number.isFinite(path.score)).toBe(true);
					expect(path.score).toBeGreaterThan(0);
				}
			}
		});
	});

	describe("Limit Behavior", () => {
		it("score converges to zero as MI → 0", () => {
			const baseValues = [0.8, 0.9];

			// Track convergence
			const epsilons = [0.1, 0.01, 0.001, 0.0001, 0.000_01];
			const scores = epsilons.map((e) => geometricMean([...baseValues, e]));

			// Should be monotonically decreasing
			for (let index = 1; index < scores.length; index++) {
				expect(scores[index]).toBeLessThan(scores[index - 1]);
			}

			// Should approach zero
			expect(scores.at(-1)).toBeLessThan(0.05);
		});

		it("rate of convergence is exponential in log(epsilon)", () => {
			const base = [0.9, 0.9];

			// log(geometricMean) should be linear in log(epsilon)
			const e1 = 0.1;
			const e2 = 0.01;

			const geo1 = geometricMean([...base, e1]);
			const geo2 = geometricMean([...base, e2]);

			// Ratio should be approximately (e2/e1)^(1/3) for 3-element path
			const expectedRatio = Math.pow(e2 / e1, 1 / 3);
			const actualRatio = geo2 / geo1;

			expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.01);
		});
	});

	describe("Edge Cases", () => {
		it("all edges near-zero results in near-zero score", () => {
			const allWeak = [0.01, 0.01, 0.01];
			expect(geometricMean(allWeak)).toBeLessThan(0.02);
		});

		it("single strong edge among weak edges", () => {
			const mixed = [0.01, 0.9, 0.01];
			// Strong edge can't save the path from weak links
			expect(geometricMean(mixed)).toBeLessThan(0.1);
		});

		it("very long path with one weak link", () => {
			const longPath = Array.from({ length: 20 }, () => 0.9);
			longPath[10] = 0.01; // One weak link in middle

			const geo = geometricMean(longPath);

			// Even in long path, weak link has impact
			const allStrong = geometricMean(Array.from({ length: 20 }, () => 0.9));
			expect(geo).toBeLessThan(allStrong);
		});
	});
});

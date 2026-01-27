/**
 * Property-Based Tests for Metric Calculators
 *
 * Uses fast-check to verify mathematical properties hold across
 * randomized inputs. These tests catch edge cases and invariant
 * violations that might be missed by example-based tests.
 *
 * Properties tested:
 * - KL divergence: non-negativity, self-divergence = 0
 * - JS divergence: symmetry, bounded [0, log 2]
 * - EMD: triangle inequality, symmetry
 * - Degree distribution: probabilities sum to 1
 * - Jaccard distance: bounded [0, 1], symmetry
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
	computeDegreeDistribution,
	earthMoversDistance,
	jsDivergence,
	klDivergence,
} from "./degree-distribution.js";
import { jaccardDistance } from "./path-diversity.js";

// ============================================================================
// Arbitraries (Generators for test data)
// ============================================================================

/**
 * Generate a normalized probability distribution.
 * Returns a Map<number, number> where values sum to 1.
 */
const arbDistribution = fc
	.array(fc.tuple(fc.integer({ min: 0, max: 100 }), fc.float({ min: Math.fround(0.001), max: 1 })))
	.filter((array) => array.length > 0)
	.filter((array) => {
		// Filter out arrays with invalid weights
		return array.every(([, weight]) => Number.isFinite(weight) && weight > 0);
	})
	.map((array) => {
		const totalWeight = array.reduce((sum, [, weight]) => sum + weight, 0);
		const normalized = new Map<number, number>();
		for (const [degree, weight] of array) {
			const existing = normalized.get(degree) ?? 0;
			normalized.set(degree, existing + weight / totalWeight);
		}
		return normalized;
	})
	.filter((map) => {
		// Ensure no NaN or Infinity values in final distribution
		for (const value of map.values()) {
			if (!Number.isFinite(value) || value < 0) {
				return false;
			}
		}
		return true;
	});

/**
 * Generate an array of positive integers (degree values).
 */
const arbDegrees = fc
	.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 50 })
	.filter((array) => array.length > 0);

/**
 * Generate a set of strings (for Jaccard distance testing).
 */
const arbStringSet = fc
	.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 0, maxLength: 20 })
	.map((array) => new Set(array));

// ============================================================================
// Property Tests: KL Divergence
// ============================================================================

describe("KL Divergence Properties", () => {
	it("is always non-negative", () => {
		fc.assert(
			fc.property(arbDistribution, arbDistribution, (p, q) => {
				const kl = klDivergence(p, q);
				expect(kl).toBeGreaterThanOrEqual(0);
			}),
			{ numRuns: 100 }
		);
	});

	it("KL(P||P) = 0 (self-divergence is zero)", () => {
		fc.assert(
			fc.property(arbDistribution, (p) => {
				const kl = klDivergence(p, p);
				expect(kl).toBeCloseTo(0, 5);
			}),
			{ numRuns: 100 }
		);
	});

	it("KL(P||Q) = 0 implies P = Q (identical distributions)", () => {
		fc.assert(
			fc.property(arbDistribution, (p) => {
				const q = new Map(p); // Clone distribution
				const kl = klDivergence(p, q);
				expect(kl).toBeCloseTo(0, 5);
			}),
			{ numRuns: 100 }
		);
	});
});

// ============================================================================
// Property Tests: JS Divergence
// ============================================================================

describe("JS Divergence Properties", () => {
	it("is symmetric: JS(P, Q) = JS(Q, P)", () => {
		fc.assert(
			fc.property(arbDistribution, arbDistribution, (p, q) => {
				const js_pq = jsDivergence(p, q);
				const js_qp = jsDivergence(q, p);
				expect(js_pq).toBeCloseTo(js_qp, 5);
			}),
			{ numRuns: 100 }
		);
	});

	it("is bounded: JS(P, Q) ∈ [0, log(2)]", () => {
		const log2 = Math.log(2);
		fc.assert(
			fc.property(arbDistribution, arbDistribution, (p, q) => {
				const js = jsDivergence(p, q);
				expect(js).toBeGreaterThanOrEqual(0);
				expect(js).toBeLessThanOrEqual(log2 + 1e-10); // Small epsilon for floating point
			}),
			{ numRuns: 100 }
		);
	});

	it("JS(P, P) = 0 (self-divergence is zero)", () => {
		fc.assert(
			fc.property(arbDistribution, (p) => {
				const js = jsDivergence(p, p);
				expect(js).toBeCloseTo(0, 5);
			}),
			{ numRuns: 100 }
		);
	});
});

// ============================================================================
// Property Tests: Earth Mover's Distance
// ============================================================================

describe("Earth Mover's Distance Properties", () => {
	it("is symmetric: EMD(P, Q) = EMD(Q, P)", () => {
		fc.assert(
			fc.property(arbDistribution, arbDistribution, (p, q) => {
				const emd_pq = earthMoversDistance(p, q);
				const emd_qp = earthMoversDistance(q, p);
				expect(emd_pq).toBeCloseTo(emd_qp, 5);
			}),
			{ numRuns: 100 }
		);
	});

	it("is non-negative", () => {
		fc.assert(
			fc.property(arbDistribution, arbDistribution, (p, q) => {
				const emd = earthMoversDistance(p, q);
				expect(emd).toBeGreaterThanOrEqual(0);
			}),
			{ numRuns: 100 }
		);
	});

	it("EMD(P, P) = 0 (self-distance is zero)", () => {
		fc.assert(
			fc.property(arbDistribution, (p) => {
				const emd = earthMoversDistance(p, p);
				expect(emd).toBeCloseTo(0, 5);
			}),
			{ numRuns: 100 }
		);
	});

	it("satisfies triangle inequality: EMD(P, R) ≤ EMD(P, Q) + EMD(Q, R)", () => {
		fc.assert(
			fc.property(arbDistribution, arbDistribution, arbDistribution, (p, q, r) => {
				const emd_pr = earthMoversDistance(p, r);
				const emd_pq = earthMoversDistance(p, q);
				const emd_qr = earthMoversDistance(q, r);
				expect(emd_pr).toBeLessThanOrEqual(emd_pq + emd_qr + 1e-10); // Small epsilon
			}),
			{ numRuns: 50 } // Fewer runs for 3-distribution tests
		);
	});
});

// ============================================================================
// Property Tests: Degree Distribution
// ============================================================================

describe("Degree Distribution Properties", () => {
	it("probabilities sum to 1", () => {
		fc.assert(
			fc.property(arbDegrees, (degrees) => {
				const distribution = computeDegreeDistribution(degrees);
				const sum = [...distribution.values()].reduce((a, b) => a + b, 0);
				expect(sum).toBeCloseTo(1, 5);
			}),
			{ numRuns: 100 }
		);
	});

	it("all probabilities are non-negative", () => {
		fc.assert(
			fc.property(arbDegrees, (degrees) => {
				const distribution = computeDegreeDistribution(degrees);
				for (const probability of distribution.values()) {
					expect(probability).toBeGreaterThanOrEqual(0);
				}
			}),
			{ numRuns: 100 }
		);
	});

	it("all probabilities are ≤ 1", () => {
		fc.assert(
			fc.property(arbDegrees, (degrees) => {
				const distribution = computeDegreeDistribution(degrees);
				for (const probability of distribution.values()) {
					expect(probability).toBeLessThanOrEqual(1);
				}
			}),
			{ numRuns: 100 }
		);
	});

	it("handles single-degree arrays", () => {
		fc.assert(
			fc.property(fc.integer({ min: 1, max: 100 }), (degree) => {
				const distribution = computeDegreeDistribution([degree]);
				expect(distribution.size).toBe(1);
				expect(distribution.get(degree)).toBeCloseTo(1, 5);
			}),
			{ numRuns: 100 }
		);
	});

	it("empty array returns empty distribution", () => {
		const distribution = computeDegreeDistribution([]);
		expect(distribution.size).toBe(0);
	});
});

// ============================================================================
// Property Tests: Jaccard Distance
// ============================================================================

describe("Jaccard Distance Properties", () => {
	it("is bounded: J(A, B) ∈ [0, 1]", () => {
		fc.assert(
			fc.property(arbStringSet, arbStringSet, (setA, setB) => {
				const distance = jaccardDistance(setA, setB);
				expect(distance).toBeGreaterThanOrEqual(0);
				expect(distance).toBeLessThanOrEqual(1);
			}),
			{ numRuns: 100 }
		);
	});

	it("is symmetric: J(A, B) = J(B, A)", () => {
		fc.assert(
			fc.property(arbStringSet, arbStringSet, (setA, setB) => {
				const index_ab = jaccardDistance(setA, setB);
				const index_ba = jaccardDistance(setB, setA);
				expect(index_ab).toBeCloseTo(index_ba, 10);
			}),
			{ numRuns: 100 }
		);
	});

	it("J(A, A) = 0 (self-distance is zero)", () => {
		fc.assert(
			fc.property(arbStringSet, (setA) => {
				const distance = jaccardDistance(setA, setA);
				expect(distance).toBeCloseTo(0, 10);
			}),
			{ numRuns: 100 }
		);
	});

	it("J(A, B) = 1 for disjoint sets", () => {
		fc.assert(
			fc.property(
				fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 10 }),
				fc.array(fc.string({ minLength: 6, maxLength: 10 }), { minLength: 1, maxLength: 10 }),
				(arrayA, arrayB) => {
					const setA = new Set(arrayA);
					const setB = new Set(arrayB);
					const distance = jaccardDistance(setA, setB);
					expect(distance).toBeCloseTo(1, 10);
				}
			),
			{ numRuns: 100 }
		);
	});

	it("handles empty sets correctly", () => {
		const emptySet = new Set<string>();
		const nonEmptySet = new Set(["a", "b", "c"]);

		// J(∅, ∅) = 0
		expect(jaccardDistance(emptySet, emptySet)).toBeCloseTo(0, 10);

		// J(∅, A) = 1 for non-empty A
		expect(jaccardDistance(emptySet, nonEmptySet)).toBeCloseTo(1, 10);
	});
});

// ============================================================================
// Property Tests: Distribution Comparison Consistency
// ============================================================================

describe("Distribution Comparison Consistency", () => {
	it("all divergences are zero for identical distributions", () => {
		fc.assert(
			fc.property(arbDistribution, (p) => {
				const q = new Map(p);
				expect(klDivergence(p, q)).toBeCloseTo(0, 5);
				expect(jsDivergence(p, q)).toBeCloseTo(0, 5);
				expect(earthMoversDistance(p, q)).toBeCloseTo(0, 5);
			}),
			{ numRuns: 100 }
		);
	});

	it("JS divergence ≤ KL divergence (for non-identical distributions)", () => {
		fc.assert(
			fc.property(arbDistribution, arbDistribution, (p, q) => {
				const js = jsDivergence(p, q);
				const kl_pq = klDivergence(p, q);
				const kl_qp = klDivergence(q, p);
				// JS ≤ 0.5 * (KL(P||Q) + KL(Q||P))
				expect(js).toBeLessThanOrEqual(0.5 * (kl_pq + kl_qp) + 1e-10);
			}),
			{ numRuns: 100 }
		);
	});
});

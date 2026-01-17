/**
 * Unit tests for rank correlation metrics
 */

import { describe, expect, it } from "vitest";

import { kendallTau, spearmanCorrelation } from "./rank-correlation";

describe("spearmanCorrelation", () => {
	it("should return 1 for identical rankings", () => {
		const ranking = ["a", "b", "c", "d", "e"];
		expect(spearmanCorrelation(ranking, ranking)).toBeCloseTo(1);
	});

	it("should return -1 for completely reversed rankings", () => {
		const predicted = ["a", "b", "c", "d", "e"];
		const groundTruth = ["e", "d", "c", "b", "a"];
		expect(spearmanCorrelation(predicted, groundTruth)).toBeCloseTo(-1);
	});

	it("should return 0 for empty inputs", () => {
		expect(spearmanCorrelation([], [])).toBe(0);
		expect(spearmanCorrelation(["a"], [])).toBe(0);
		expect(spearmanCorrelation([], ["a"])).toBe(0);
	});

	it("should return 1 for single item", () => {
		expect(spearmanCorrelation(["a"], ["a"])).toBe(1);
	});

	it("should handle partial overlap", () => {
		const predicted = ["a", "b", "c", "x"];
		const groundTruth = ["a", "b", "c", "y"];
		// Only a, b, c are common
		expect(spearmanCorrelation(predicted, groundTruth)).toBeCloseTo(1);
	});

	it("should return 0 when no common items", () => {
		const predicted = ["a", "b", "c"];
		const groundTruth = ["x", "y", "z"];
		expect(spearmanCorrelation(predicted, groundTruth)).toBe(0);
	});

	it("should handle moderate correlation", () => {
		// Slightly shuffled
		const predicted = ["a", "c", "b", "d", "e"];
		const groundTruth = ["a", "b", "c", "d", "e"];

		const rho = spearmanCorrelation(predicted, groundTruth);
		expect(rho).toBeGreaterThan(0.5);
		expect(rho).toBeLessThan(1);
	});
});

describe("kendallTau", () => {
	it("should return 1 for identical rankings", () => {
		const ranking = ["a", "b", "c", "d"];
		expect(kendallTau(ranking, ranking)).toBeCloseTo(1);
	});

	it("should return -1 for completely reversed rankings", () => {
		const predicted = ["a", "b", "c", "d"];
		const groundTruth = ["d", "c", "b", "a"];
		expect(kendallTau(predicted, groundTruth)).toBeCloseTo(-1);
	});

	it("should return 1 for both empty inputs", () => {
		expect(kendallTau([], [])).toBe(1);
	});

	it("should return 0 when one input is empty", () => {
		expect(kendallTau(["a"], [])).toBe(0);
		expect(kendallTau([], ["a"])).toBe(0);
	});

	it("should return 1 for single item", () => {
		expect(kendallTau(["a"], ["a"])).toBe(1);
	});

	it("should return 1 for two items in same order", () => {
		expect(kendallTau(["a", "b"], ["a", "b"])).toBe(1);
	});

	it("should return -1 for two items in opposite order", () => {
		expect(kendallTau(["a", "b"], ["b", "a"])).toBe(-1);
	});

	it("should handle partial overlap", () => {
		const predicted = ["a", "b", "c", "x"];
		const groundTruth = ["a", "b", "c", "y"];
		// Only a, b, c are common - perfect agreement
		expect(kendallTau(predicted, groundTruth)).toBeCloseTo(1);
	});

	it("should return 1 when no common items (less than 2)", () => {
		const predicted = ["a", "b"];
		const groundTruth = ["x", "y"];
		expect(kendallTau(predicted, groundTruth)).toBe(1);
	});

	it("should calculate moderate correlation correctly", () => {
		// One swap: b and c swapped
		const predicted = ["a", "c", "b", "d"];
		const groundTruth = ["a", "b", "c", "d"];

		// Pairs: (a,b), (a,c), (a,d), (b,c), (b,d), (c,d) = 6 pairs
		// Discordant: (b,c) is swapped = 1 discordant
		// Concordant: 5
		// tau = (5-1)/6 = 4/6 = 2/3
		expect(kendallTau(predicted, groundTruth)).toBeCloseTo(2 / 3);
	});

	it("should handle multiple swaps", () => {
		const predicted = ["d", "c", "b", "a"];
		const groundTruth = ["a", "b", "c", "d"];

		// All 6 pairs are discordant
		// tau = (0-6)/6 = -1
		expect(kendallTau(predicted, groundTruth)).toBeCloseTo(-1);
	});
});

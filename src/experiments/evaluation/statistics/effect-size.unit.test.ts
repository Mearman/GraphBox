/**
 * Unit tests for effect size measures
 */

import { describe, expect, it } from "vitest";

import { cliffsDelta, cohensD, glassDelta, rankBiserialCorrelation } from "./effect-size";

describe("cohensD", () => {
	it("should throw for groups with less than 2 samples", () => {
		expect(() => cohensD([1], [2, 3])).toThrow("at least 2 samples");
		expect(() => cohensD([1, 2], [3])).toThrow("at least 2 samples");
		expect(() => cohensD([], [1, 2])).toThrow("at least 2 samples");
	});

	it("should return negligible effect for identical groups", () => {
		const group = [5, 5, 5, 5, 5];
		const result = cohensD(group, group);

		expect(result.effectSize).toBeCloseTo(0);
		expect(result.interpretation).toBe("negligible");
	});

	it("should return positive effect when group1 mean is higher", () => {
		const group1 = [8, 9, 7, 8, 10];
		const group2 = [5, 6, 5, 6, 7];
		const result = cohensD(group1, group2);

		expect(result.effectSize).toBeGreaterThan(0);
		expect(result.magnitude).toBeGreaterThan(0.8);
		expect(result.interpretation).toBe("very-large");
	});

	it("should return negative effect when group1 mean is lower", () => {
		const group1 = [2, 3, 2, 3, 2];
		const group2 = [8, 9, 8, 9, 8];
		const result = cohensD(group1, group2);

		expect(result.effectSize).toBeLessThan(0);
		expect(result.magnitude).toBeGreaterThan(0.8);
	});

	it("should return small effect for slightly different means", () => {
		// With small variance difference, should give small-medium effect
		const group1 = [50, 51, 52, 53, 54, 55, 56, 57, 58, 59];
		const group2 = [49, 50, 51, 52, 53, 54, 55, 56, 57, 58];
		const result = cohensD(group1, group2);

		// Should be small effect (d < 0.5)
		expect(result.magnitude).toBeLessThan(0.5);
	});

	it("should handle identical values in one group", () => {
		const group1 = [5, 5, 5, 5];
		const group2 = [3, 4, 3, 4];
		const result = cohensD(group1, group2);

		expect(result.effectSize).toBeGreaterThan(0);
	});
});

describe("cliffsDelta", () => {
	it("should throw for empty groups", () => {
		expect(() => cliffsDelta([], [1, 2])).toThrow("at least 1 sample");
		expect(() => cliffsDelta([1, 2], [])).toThrow("at least 1 sample");
	});

	it("should return 1 when all group1 values exceed group2", () => {
		const group1 = [10, 11, 12];
		const group2 = [1, 2, 3];
		const result = cliffsDelta(group1, group2);

		expect(result.effectSize).toBe(1);
		expect(result.probability).toBe(1);
		expect(result.interpretation).toBe("large");
	});

	it("should return -1 when all group2 values exceed group1", () => {
		const group1 = [1, 2, 3];
		const group2 = [10, 11, 12];
		const result = cliffsDelta(group1, group2);

		expect(result.effectSize).toBe(-1);
		expect(result.probability).toBe(0);
		expect(result.interpretation).toBe("large");
	});

	it("should return 0 effect size for symmetric distributions", () => {
		const group1 = [1, 2, 3, 4, 5];
		const group2 = [1, 2, 3, 4, 5];
		const result = cliffsDelta(group1, group2);

		// Effect size is 0 because greater and less counts are equal
		expect(result.effectSize).toBe(0);
		// Probability is 0.4 (10 greater comparisons / 25 total pairs)
		expect(result.probability).toBeCloseTo(0.4);
		expect(result.interpretation).toBe("negligible");
	});

	it("should handle ties correctly", () => {
		const group1 = [5, 5, 5];
		const group2 = [5, 5, 5];
		const result = cliffsDelta(group1, group2);

		expect(result.effectSize).toBe(0);
	});

	it("should return effect size between -1 and 1", () => {
		const group1 = [6, 7, 8, 9, 10];
		const group2 = [4, 5, 6, 7, 8];
		const result = cliffsDelta(group1, group2);

		// Effect size should be positive (group1 tends to be larger)
		expect(result.effectSize).toBeGreaterThan(0);
		expect(result.effectSize).toBeLessThanOrEqual(1);
	});
});

describe("glassDelta", () => {
	it("should throw for groups with less than 2 samples", () => {
		expect(() => glassDelta([1], [2, 3])).toThrow("at least 2 samples");
		expect(() => glassDelta([1, 2], [3])).toThrow("at least 2 samples");
	});

	it("should return 0 for identical groups", () => {
		const group = [5, 6, 5, 6, 5];
		const result = glassDelta(group, group);

		expect(result.effectSize).toBeCloseTo(0);
		expect(result.interpretation).toBe("negligible");
	});

	it("should use control group SD for normalization", () => {
		const treatment = [10, 10, 10, 10];
		const control = [5, 6, 5, 6];
		const result = glassDelta(treatment, control);

		expect(result.effectSize).toBeGreaterThan(0);
		expect(result.interpretation).toBe("very-large");
	});

	it("should return 0 when control has no variance", () => {
		const treatment = [10, 11, 12];
		const control = [5, 5, 5];
		const result = glassDelta(treatment, control);

		// When control SD is 0, effect size is 0
		expect(result.effectSize).toBe(0);
	});
});

describe("rankBiserialCorrelation", () => {
	it("should throw for empty groups", () => {
		expect(() => rankBiserialCorrelation([], [1, 2])).toThrow("at least 1 sample");
		expect(() => rankBiserialCorrelation([1, 2], [])).toThrow("at least 1 sample");
	});

	it("should return positive correlation when group1 ranks higher", () => {
		const group1 = [8, 9, 10, 11, 12];
		const group2 = [1, 2, 3, 4, 5];
		const result = rankBiserialCorrelation(group1, group2);

		expect(result.correlation).toBeGreaterThan(0);
		expect(result.effectSize).toBeGreaterThan(0.474);
		expect(result.interpretation).toBe("large");
	});

	it("should return negative correlation when group2 ranks higher", () => {
		const group1 = [1, 2, 3, 4, 5];
		const group2 = [8, 9, 10, 11, 12];
		const result = rankBiserialCorrelation(group1, group2);

		expect(result.correlation).toBeLessThan(0);
		expect(result.interpretation).toBe("large");
	});

	it("should handle ties correctly", () => {
		const group1 = [5, 5, 5];
		const group2 = [5, 5, 5];
		const result = rankBiserialCorrelation(group1, group2);

		expect(result.correlation).toBeCloseTo(0);
		expect(result.interpretation).toBe("negligible");
	});

	it("should return near-zero for interleaved values", () => {
		const group1 = [1, 3, 5, 7, 9];
		const group2 = [2, 4, 6, 8, 10];
		const result = rankBiserialCorrelation(group1, group2);

		// Slightly negative since group2 tends to rank higher
		expect(result.effectSize).toBeLessThan(0.3);
	});
});

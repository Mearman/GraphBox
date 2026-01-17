/**
 * Unit tests for bootstrap methods
 */

import { describe, expect, it } from "vitest";

import { bootstrapCI, bootstrapDifferenceTest } from "./bootstrap";

describe("bootstrapCI", () => {
	it("should throw for less than 2 samples", () => {
		expect(() => bootstrapCI([1])).toThrow("at least 2 samples");
		expect(() => bootstrapCI([])).toThrow("at least 2 samples");
	});

	it("should throw for invalid confidence level", () => {
		expect(() => bootstrapCI([1, 2, 3], 0)).toThrow("between 0 and 1");
		expect(() => bootstrapCI([1, 2, 3], 1)).toThrow("between 0 and 1");
		expect(() => bootstrapCI([1, 2, 3], -0.5)).toThrow("between 0 and 1");
		expect(() => bootstrapCI([1, 2, 3], 1.5)).toThrow("between 0 and 1");
	});

	it("should return CI containing the mean", () => {
		const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const result = bootstrapCI(samples, 0.95, 1000, 42);

		expect(result.mean).toBeCloseTo(5.5);
		expect(result.lower).toBeLessThanOrEqual(result.mean);
		expect(result.upper).toBeGreaterThanOrEqual(result.mean);
	});

	it("should produce tighter CI with more samples", () => {
		const smallSample = [1, 5, 10];
		const largeSample = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

		const smallCI = bootstrapCI(smallSample, 0.95, 1000, 42);
		const largeCI = bootstrapCI(largeSample, 0.95, 1000, 42);

		const smallWidth = smallCI.upper - smallCI.lower;
		const largeWidth = largeCI.upper - largeCI.lower;

		// Larger sample should produce tighter CI (relative to mean)
		expect(largeWidth / largeCI.mean).toBeLessThan(smallWidth / smallCI.mean);
	});

	it("should produce reproducible results with seed", () => {
		const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const result1 = bootstrapCI(samples, 0.95, 1000, 42);
		const result2 = bootstrapCI(samples, 0.95, 1000, 42);

		expect(result1.lower).toBe(result2.lower);
		expect(result1.upper).toBe(result2.upper);
		expect(result1.mean).toBe(result2.mean);
	});

	it("should produce wider CI with higher confidence", () => {
		const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const ci90 = bootstrapCI(samples, 0.9, 1000, 42);
		const ci99 = bootstrapCI(samples, 0.99, 1000, 42);

		const width90 = ci90.upper - ci90.lower;
		const width99 = ci99.upper - ci99.lower;

		expect(width99).toBeGreaterThan(width90);
	});

	it("should return narrow CI for constant values", () => {
		const samples = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
		const result = bootstrapCI(samples, 0.95, 1000, 42);

		expect(result.mean).toBe(5);
		expect(result.lower).toBe(5);
		expect(result.upper).toBe(5);
	});
});

describe("bootstrapDifferenceTest", () => {
	it("should throw for less than 2 samples in either group", () => {
		expect(() => bootstrapDifferenceTest([1], [2, 3])).toThrow("at least 2 samples");
		expect(() => bootstrapDifferenceTest([1, 2], [3])).toThrow("at least 2 samples");
	});

	it("should detect significant difference between clearly different groups", () => {
		const method1 = [80, 85, 82, 88, 90, 87, 83, 86, 89, 84];
		const method2 = [50, 55, 52, 58, 60, 57, 53, 56, 59, 54];
		const result = bootstrapDifferenceTest(method1, method2, 1000, 0.05, 42);

		expect(result.significant).toBe(true);
		expect(result.meanDifference).toBeGreaterThan(20);
		expect(result.ci.lower).toBeGreaterThan(0);
	});

	it("should not detect significance for similar groups", () => {
		const method1 = [50, 51, 52, 49, 50, 51, 50, 49, 52, 51];
		const method2 = [50, 49, 51, 50, 52, 50, 51, 49, 50, 51];
		const result = bootstrapDifferenceTest(method1, method2, 1000, 0.05, 42);

		// CI should include 0 for similar groups
		expect(result.ci.lower).toBeLessThanOrEqual(0);
		expect(result.ci.upper).toBeGreaterThanOrEqual(0);
	});

	it("should return correct mean difference", () => {
		const method1 = [10, 10, 10, 10, 10];
		const method2 = [5, 5, 5, 5, 5];
		const result = bootstrapDifferenceTest(method1, method2, 1000, 0.05, 42);

		expect(result.meanDifference).toBe(5);
	});

	it("should produce reproducible results with seed", () => {
		const method1 = [80, 85, 82, 88, 90];
		const method2 = [50, 55, 52, 58, 60];

		const result1 = bootstrapDifferenceTest(method1, method2, 1000, 0.05, 42);
		const result2 = bootstrapDifferenceTest(method1, method2, 1000, 0.05, 42);

		expect(result1.pValue).toBe(result2.pValue);
		expect(result1.ci.lower).toBe(result2.ci.lower);
		expect(result1.ci.upper).toBe(result2.ci.upper);
	});

	it("should handle negative difference correctly", () => {
		const method1 = [50, 55, 52, 58, 60];
		const method2 = [80, 85, 82, 88, 90];
		const result = bootstrapDifferenceTest(method1, method2, 1000, 0.05, 42);

		expect(result.meanDifference).toBeLessThan(0);
		expect(result.ci.upper).toBeLessThan(0);
	});
});

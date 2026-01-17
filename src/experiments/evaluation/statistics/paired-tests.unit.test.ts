/**
 * Unit tests for paired statistical tests
 */

import { describe, expect, it } from "vitest";

import { pairedTTest, wilcoxonSignedRank } from "./paired-tests";

describe("pairedTTest", () => {
	it("should throw for unequal length arrays", () => {
		expect(() => pairedTTest([1, 2, 3], [1, 2])).toThrow("equal length");
	});

	it("should throw for less than 2 observations", () => {
		expect(() => pairedTTest([1], [2])).toThrow("at least 2 observations");
		expect(() => pairedTTest([], [])).toThrow("at least 2 observations");
	});

	it("should detect significant difference", () => {
		const method1 = [85, 82, 88, 90, 87, 83, 86, 89, 84, 88];
		const method2 = [65, 70, 68, 72, 69, 67, 71, 73, 66, 70];
		const result = pairedTTest(method1, method2);

		expect(result.significant).toBe(true);
		expect(result.pValue).toBeLessThan(0.05);
		expect(result.tStatistic).toBeGreaterThan(0);
	});

	it("should not detect significance for identical values", () => {
		const values = [50, 55, 52, 58, 60, 57, 53, 56, 59, 54];
		const result = pairedTTest(values, values);

		expect(result.significant).toBe(false);
		// t-statistic should be 0 or NaN for identical values
		// pValue should be 1 or NaN
	});

	it("should not detect significance for similar values", () => {
		const method1 = [50, 51, 49, 50, 52, 51, 50, 49, 51, 50];
		const method2 = [50, 50, 50, 51, 51, 50, 51, 50, 50, 51];
		const result = pairedTTest(method1, method2, 0.05);

		// p-value should be high for such similar values
		expect(result.pValue).toBeGreaterThan(0.1);
	});

	it("should return negative t-statistic when method2 is better", () => {
		const method1 = [50, 55, 52, 58, 60];
		const method2 = [80, 85, 82, 88, 90];
		const result = pairedTTest(method1, method2);

		expect(result.tStatistic).toBeLessThan(0);
	});

	it("should use custom alpha level", () => {
		const method1 = [10, 11, 12, 13, 14];
		const method2 = [9, 10, 11, 12, 13];

		const resultStrict = pairedTTest(method1, method2, 0.01);
		const resultLoose = pairedTTest(method1, method2, 0.1);

		// With constant difference of 1, could be significant at loose but not strict alpha
		expect(resultStrict.pValue).toBe(resultLoose.pValue);
	});
});

describe("wilcoxonSignedRank", () => {
	it("should throw for unequal length arrays", () => {
		expect(() => wilcoxonSignedRank([1, 2, 3], [1, 2])).toThrow("equal length");
	});

	it("should throw for less than 2 observations", () => {
		expect(() => wilcoxonSignedRank([1], [2])).toThrow("at least 2 observations");
	});

	it("should return pValue=1 and statistic=0 for identical values", () => {
		const values = [50, 55, 52, 58, 60];
		const result = wilcoxonSignedRank(values, values);

		expect(result.pValue).toBe(1);
		expect(result.statistic).toBe(0);
		expect(result.significant).toBe(false);
	});

	it("should detect significant difference", () => {
		const method1 = [85, 82, 88, 90, 87, 83, 86, 89, 84, 88,
			91, 92, 93, 85, 86, 87, 88, 89, 90, 91, 92];
		const method2 = [65, 70, 68, 72, 69, 67, 71, 73, 66, 70,
			71, 72, 73, 65, 66, 67, 68, 69, 70, 71, 72];
		const result = wilcoxonSignedRank(method1, method2);

		expect(result.significant).toBe(true);
		expect(result.pValue).toBeLessThan(0.05);
	});

	it("should handle ties correctly", () => {
		const method1 = [10, 10, 10, 20, 20, 20, 30, 30, 30, 40,
			40, 40, 50, 50, 50, 60, 60, 60, 70, 70, 70];
		const method2 = [5, 5, 5, 15, 15, 15, 25, 25, 25, 35,
			35, 35, 45, 45, 45, 55, 55, 55, 65, 65, 65];
		const result = wilcoxonSignedRank(method1, method2);

		// All differences are positive, should be significant
		expect(result.significant).toBe(true);
	});

	it("should not detect significance for similar values", () => {
		const method1 = [50, 51, 49, 50, 52, 51, 50, 49, 51, 50,
			50, 51, 49, 50, 52, 51, 50, 49, 51, 50, 50];
		const method2 = [50, 50, 50, 51, 51, 50, 51, 50, 50, 51,
			50, 50, 50, 51, 51, 50, 51, 50, 50, 51, 50];
		const result = wilcoxonSignedRank(method1, method2, 0.05);

		expect(result.pValue).toBeGreaterThan(0.05);
	});

	it("should use custom alpha level", () => {
		const method1 = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
			20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
		const method2 = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
			19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];

		const result = wilcoxonSignedRank(method1, method2, 0.05);

		// p-value should be the same regardless of alpha
		expect(result.pValue).toBeDefined();
	});
});

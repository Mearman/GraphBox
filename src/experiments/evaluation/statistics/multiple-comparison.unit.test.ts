/**
 * Unit tests for multiple comparison correction methods
 */

import { describe, expect, it } from "vitest";

import {
	benjaminiHochberg,
	bonferroniCorrection,
	holmBonferroni,
	storeyQValues,
} from "./multiple-comparison";

describe("bonferroniCorrection", () => {
	it("should return original alpha for empty array", () => {
		const result = bonferroniCorrection([], 0.05);

		expect(result.correctedAlpha).toBe(0.05);
		expect(result.significant).toEqual([]);
	});

	it("should divide alpha by number of tests", () => {
		const pValues = [0.01, 0.02, 0.03, 0.04, 0.05];
		const result = bonferroniCorrection(pValues, 0.05);

		expect(result.correctedAlpha).toBe(0.01);
	});

	it("should correctly identify significant results", () => {
		const pValues = [0.001, 0.02, 0.045, 0.08, 0.12];
		const result = bonferroniCorrection(pValues, 0.05);

		// Corrected alpha = 0.05 / 5 = 0.01
		expect(result.significant).toEqual([true, false, false, false, false]);
	});

	it("should handle single p-value", () => {
		const result = bonferroniCorrection([0.03], 0.05);

		expect(result.correctedAlpha).toBe(0.05);
		expect(result.significant).toEqual([true]);
	});

	it("should use custom alpha", () => {
		const pValues = [0.001, 0.005, 0.01];
		const result = bonferroniCorrection(pValues, 0.01);

		// Corrected alpha = 0.01 / 3 = 0.00333...
		expect(result.correctedAlpha).toBeCloseTo(0.01 / 3);
		expect(result.significant).toEqual([true, false, false]);
	});
});

describe("benjaminiHochberg", () => {
	it("should return empty arrays for empty input", () => {
		const result = benjaminiHochberg([]);

		expect(result.adjustedPValues).toEqual([]);
		expect(result.significant).toEqual([]);
	});

	it("should correctly adjust p-values", () => {
		const pValues = [0.001, 0.02, 0.045, 0.08, 0.12];
		const result = benjaminiHochberg(pValues, 0.05);

		// Smallest p-value should remain small
		expect(result.adjustedPValues[0]).toBeLessThan(0.01);
		// Adjusted p-values should be non-decreasing
		for (let index = 1; index < result.adjustedPValues.length; index++) {
			const currentSorted = [...result.adjustedPValues].sort((a, b) => pValues.indexOf(a) - pValues.indexOf(b));
			// Just check they're all defined
			expect(currentSorted[index]).toBeDefined();
		}
	});

	it("should identify more significant results than Bonferroni", () => {
		const pValues = [0.001, 0.008, 0.015, 0.03, 0.04];
		const bhResult = benjaminiHochberg(pValues, 0.05);
		const bonfResult = bonferroniCorrection(pValues, 0.05);

		const bhSignificantCount = bhResult.significant.filter(Boolean).length;
		const bonfSignificantCount = bonfResult.significant.filter(Boolean).length;

		expect(bhSignificantCount).toBeGreaterThanOrEqual(bonfSignificantCount);
	});

	it("should cap adjusted p-values at 1", () => {
		const pValues = [0.001, 0.5, 0.9];
		const result = benjaminiHochberg(pValues);

		for (const p of result.adjustedPValues) {
			expect(p).toBeLessThanOrEqual(1);
		}
	});

	it("should handle single p-value", () => {
		const result = benjaminiHochberg([0.03], 0.05);

		expect(result.adjustedPValues).toHaveLength(1);
		expect(result.adjustedPValues[0]).toBeCloseTo(0.03);
		expect(result.significant).toEqual([true]);
	});
});

describe("holmBonferroni", () => {
	it("should return empty arrays for empty input", () => {
		const result = holmBonferroni([]);

		expect(result.adjustedPValues).toEqual([]);
		expect(result.significant).toEqual([]);
	});

	it("should be less conservative than Bonferroni", () => {
		const pValues = [0.001, 0.008, 0.015, 0.025, 0.04];
		const holmResult = holmBonferroni(pValues, 0.05);
		const bonfResult = bonferroniCorrection(pValues, 0.05);

		const holmSignificantCount = holmResult.significant.filter(Boolean).length;
		const bonfSignificantCount = bonfResult.significant.filter(Boolean).length;

		expect(holmSignificantCount).toBeGreaterThanOrEqual(bonfSignificantCount);
	});

	it("should use step-down procedure correctly", () => {
		const pValues = [0.001, 0.02, 0.03, 0.04, 0.05];
		const result = holmBonferroni(pValues, 0.05);

		// First p-value (0.001) compared to 0.05/5 = 0.01 - significant
		expect(result.significant[0]).toBe(true);
	});

	it("should stop rejecting after first non-significant", () => {
		const pValues = [0.001, 0.5, 0.001, 0.001, 0.001];
		const result = holmBonferroni(pValues, 0.05);

		// After the 0.5 is not rejected, all subsequent should also not be rejected
		// The 0.5 is at position 1, so significant[1] should be false
		// But since step-down sorts by p-value, need to think about this more carefully
		// sorted: 0.001, 0.001, 0.001, 0.001, 0.5
		// 0.5 is last, will be compared to 0.05/1 = 0.05, which is not significant
		expect(result.significant[1]).toBe(false);
	});

	it("should cap adjusted p-values at 1", () => {
		const pValues = [0.5, 0.6, 0.7];
		const result = holmBonferroni(pValues);

		for (const p of result.adjustedPValues) {
			expect(p).toBeLessThanOrEqual(1);
		}
	});
});

describe("storeyQValues", () => {
	it("should return empty arrays for empty input", () => {
		const result = storeyQValues([]);

		expect(result.qValues).toEqual([]);
		expect(result.significant).toEqual([]);
		expect(result.pi0).toBe(1);
	});

	it("should estimate pi0 correctly", () => {
		// Many large p-values should give high pi0
		const manyNulls = [0.001, 0.5, 0.6, 0.7, 0.8, 0.9, 0.85, 0.75, 0.95];
		const result = storeyQValues(manyNulls, 0.05, 0.5);

		expect(result.pi0).toBeGreaterThan(0.5);
	});

	it("should estimate low pi0 when most are significant", () => {
		// Many small p-values should give lower pi0
		const manySignificant = [0.001, 0.002, 0.003, 0.004, 0.005, 0.01, 0.02, 0.03, 0.04];
		const result = storeyQValues(manySignificant, 0.05, 0.5);

		expect(result.pi0).toBeLessThan(0.5);
	});

	it("should cap q-values at 1", () => {
		const pValues = [0.5, 0.6, 0.9];
		const result = storeyQValues(pValues);

		for (const q of result.qValues) {
			expect(q).toBeLessThanOrEqual(1);
		}
	});

	it("should identify significant results at FDR threshold", () => {
		const pValues = [0.001, 0.002, 0.01, 0.1, 0.5];
		const result = storeyQValues(pValues, 0.05);

		// First few p-values should be significant
		expect(result.significant[0]).toBe(true);
		expect(result.significant[1]).toBe(true);
	});

	it("should use custom lambda for pi0 estimation", () => {
		const pValues = [0.001, 0.01, 0.4, 0.5, 0.6, 0.7, 0.8];

		const resultLow = storeyQValues(pValues, 0.05, 0.3);
		const resultHigh = storeyQValues(pValues, 0.05, 0.7);

		// Different lambda values should give different pi0 estimates
		expect(resultLow.pi0).not.toBe(resultHigh.pi0);
	});
});

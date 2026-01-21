/**
 * Unit tests for aggregation functions
 */

import { describe, expect, it } from "vitest";

import { createMockResult } from "../__tests__/test-helpers.js";
import {
	computeComparison,
	computeMaxSpeedup,
	computeRankings,
	computeSpeedup,
	computeSummaryStats,
	getMethodAbbreviation,
	getVariantDisplayName,
	METHOD_ABBREVIATIONS,
	VARIANT_DISPLAY_NAMES,
} from "./aggregators.js";

describe("computeSummaryStats", () => {
	it("should compute stats for normal distribution", () => {
		const values = [10, 20, 30, 40, 50];
		const stats = computeSummaryStats(values);

		expect(stats.n).toBe(5);
		expect(stats.mean).toBe(30);
		expect(stats.median).toBe(30);
		expect(stats.min).toBe(10);
		expect(stats.max).toBe(50);
		expect(stats.std).toBeDefined();
		expect(stats.sum).toBe(150);
	});

	it("should handle empty array", () => {
		const stats = computeSummaryStats([]);

		expect(stats.n).toBe(0);
		expect(Number.isNaN(stats.mean)).toBe(true);
		expect(Number.isNaN(stats.median)).toBe(true);
		expect(Number.isNaN(stats.min)).toBe(true);
		expect(Number.isNaN(stats.max)).toBe(true);
	});

	it("should handle single value", () => {
		const stats = computeSummaryStats([42]);

		expect(stats.n).toBe(1);
		expect(stats.mean).toBe(42);
		expect(stats.median).toBe(42);
		expect(stats.min).toBe(42);
		expect(stats.max).toBe(42);
		expect(stats.std).toBeUndefined(); // Can't compute std with n=1
	});

	it("should compute correct median for odd length array", () => {
		const stats = computeSummaryStats([1, 2, 3, 4, 5]);

		expect(stats.median).toBe(3);
	});

	it("should compute correct median for even length array", () => {
		const stats = computeSummaryStats([1, 2, 3, 4]);

		expect(stats.median).toBe(2.5);
	});

	it("should compute 95% confidence interval", () => {
		const values = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
		const stats = computeSummaryStats(values);

		expect(stats.confidence95).toBeDefined();
		expect(stats.confidence95?.[0]).toBeLessThan(stats.mean);
		expect(stats.confidence95?.[1]).toBeGreaterThan(stats.mean);
	});

	it("should compute percentiles", () => {
		const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const stats = computeSummaryStats(values);

		expect(stats.p25).toBeDefined();
		expect(stats.p75).toBeDefined();
		expect(stats.p25).toBeLessThan(stats.median);
		expect(stats.p75).toBeGreaterThan(stats.median);
	});

	it("should handle identical values", () => {
		const stats = computeSummaryStats([5, 5, 5, 5, 5]);

		expect(stats.mean).toBe(5);
		expect(stats.std).toBeCloseTo(0);
	});
});

describe("computeComparison", () => {
	it("should compute delta and ratio", () => {
		const primary = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "test-metric": 10 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-a", sutRole: "primary", caseId: "case-2" }, metrics: { numeric: { "test-metric": 12 } } }),
			createMockResult({ run: { runId: "c", sut: "sut-a", sutRole: "primary", caseId: "case-3" }, metrics: { numeric: { "test-metric": 14 } } }),
		];
		const baseline = [
			createMockResult({ run: { runId: "d", sut: "sut-b", sutRole: "baseline", caseId: "case-1" }, metrics: { numeric: { "test-metric": 20 } } }),
			createMockResult({ run: { runId: "e", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "test-metric": 22 } } }),
			createMockResult({ run: { runId: "f", sut: "sut-b", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "test-metric": 24 } } }),
		];
		const comparison = computeComparison(primary, baseline, "test-metric");

		expect(comparison.deltas.default).toBeCloseTo(-10); // primary - baseline
		expect(comparison.ratios.default).toBeCloseTo(0.545, 2); // primary / baseline
	});

	it("should compute Cohen's d effect size", () => {
		const primary = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "test-metric": 80 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-a", sutRole: "primary", caseId: "case-2" }, metrics: { numeric: { "test-metric": 85 } } }),
			createMockResult({ run: { runId: "c", sut: "sut-a", sutRole: "primary", caseId: "case-3" }, metrics: { numeric: { "test-metric": 82 } } }),
			createMockResult({ run: { runId: "d", sut: "sut-a", sutRole: "primary", caseId: "case-4" }, metrics: { numeric: { "test-metric": 88 } } }),
			createMockResult({ run: { runId: "e", sut: "sut-a", sutRole: "primary", caseId: "case-5" }, metrics: { numeric: { "test-metric": 90 } } }),
		];
		const baseline = [
			createMockResult({ run: { runId: "f", sut: "sut-b", sutRole: "baseline", caseId: "case-1" }, metrics: { numeric: { "test-metric": 120 } } }),
			createMockResult({ run: { runId: "g", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "test-metric": 125 } } }),
			createMockResult({ run: { runId: "h", sut: "sut-b", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "test-metric": 122 } } }),
			createMockResult({ run: { runId: "i", sut: "sut-b", sutRole: "baseline", caseId: "case-4" }, metrics: { numeric: { "test-metric": 128 } } }),
			createMockResult({ run: { runId: "j", sut: "sut-b", sutRole: "baseline", caseId: "case-5" }, metrics: { numeric: { "test-metric": 130 } } }),
		];
		const comparison = computeComparison(primary, baseline, "test-metric");

		expect(comparison.effectSize).toBeDefined();
		// effectSize is now absolute value, so should be positive
		expect(comparison.effectSize).toBeGreaterThan(0);
	});

	it("should handle equal arrays (d=0)", () => {
		const primary = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "test-metric": 10 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-a", sutRole: "primary", caseId: "case-2" }, metrics: { numeric: { "test-metric": 20 } } }),
			createMockResult({ run: { runId: "c", sut: "sut-a", sutRole: "primary", caseId: "case-3" }, metrics: { numeric: { "test-metric": 30 } } }),
		];
		const baseline = [
			createMockResult({ run: { runId: "d", sut: "sut-b", sutRole: "baseline", caseId: "case-1" }, metrics: { numeric: { "test-metric": 10 } } }),
			createMockResult({ run: { runId: "e", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "test-metric": 20 } } }),
			createMockResult({ run: { runId: "f", sut: "sut-b", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "test-metric": 30 } } }),
		];
		const comparison = computeComparison(primary, baseline, "test-metric");

		expect(comparison.deltas.default).toBeCloseTo(0);
		expect(comparison.ratios.default).toBeCloseTo(1);
		expect(comparison.effectSize).toBeCloseTo(0);
	});

	it("should handle zero variance baseline", () => {
		const primary = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "test-metric": 10 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-a", sutRole: "primary", caseId: "case-2" }, metrics: { numeric: { "test-metric": 12 } } }),
			createMockResult({ run: { runId: "c", sut: "sut-a", sutRole: "primary", caseId: "case-3" }, metrics: { numeric: { "test-metric": 14 } } }),
		];
		const baseline = [
			createMockResult({ run: { runId: "d", sut: "sut-b", sutRole: "baseline", caseId: "case-1" }, metrics: { numeric: { "test-metric": 20 } } }),
			createMockResult({ run: { runId: "e", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "test-metric": 20 } } }),
			createMockResult({ run: { runId: "f", sut: "sut-b", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "test-metric": 20 } } }),
		];
		const comparison = computeComparison(primary, baseline, "test-metric");

		expect(comparison.deltas.default).toBeDefined();
		expect(comparison.ratios.default).toBeDefined();
	});

	it("should compute win rate (paired by case ID)", () => {
		const primary = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "test-metric": 10 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-a", sutRole: "primary", caseId: "case-2" }, metrics: { numeric: { "test-metric": 30 } } }),
			createMockResult({ run: { runId: "c", sut: "sut-a", sutRole: "primary", caseId: "case-3" }, metrics: { numeric: { "test-metric": 50 } } }),
		];
		const baseline = [
			createMockResult({ run: { runId: "d", sut: "sut-b", sutRole: "baseline", caseId: "case-1" }, metrics: { numeric: { "test-metric": 20 } } }),
			createMockResult({ run: { runId: "e", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "test-metric": 20 } } }),
			createMockResult({ run: { runId: "f", sut: "sut-b", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "test-metric": 20 } } }),
		];
		const comparison = computeComparison(primary, baseline, "test-metric");

		expect(comparison.betterRate).toBeDefined();
		// primary wins 2 out of 3 (case-2 and case-3)
		expect(comparison.betterRate).toBeCloseTo(2 / 3, 2);
	});

	it("should handle zero baseline mean", () => {
		const primary = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "test-metric": 10 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-a", sutRole: "primary", caseId: "case-2" }, metrics: { numeric: { "test-metric": 20 } } }),
			createMockResult({ run: { runId: "c", sut: "sut-a", sutRole: "primary", caseId: "case-3" }, metrics: { numeric: { "test-metric": 30 } } }),
		];
		const baseline = [
			createMockResult({ run: { runId: "d", sut: "sut-b", sutRole: "baseline", caseId: "case-1" }, metrics: { numeric: { "test-metric": 0 } } }),
			createMockResult({ run: { runId: "e", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "test-metric": 0 } } }),
			createMockResult({ run: { runId: "f", sut: "sut-b", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "test-metric": 0 } } }),
		];
		const comparison = computeComparison(primary, baseline, "test-metric");

		expect(comparison.ratios.default).toBe(Infinity);
	});

	it("should compute Mann-Whitney U and p-value", () => {
		const primary = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "test-metric": 10 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-a", sutRole: "primary", caseId: "case-2" }, metrics: { numeric: { "test-metric": 12 } } }),
			createMockResult({ run: { runId: "c", sut: "sut-a", sutRole: "primary", caseId: "case-3" }, metrics: { numeric: { "test-metric": 14 } } }),
		];
		const baseline = [
			createMockResult({ run: { runId: "d", sut: "sut-b", sutRole: "baseline", caseId: "case-1" }, metrics: { numeric: { "test-metric": 20 } } }),
			createMockResult({ run: { runId: "e", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "test-metric": 22 } } }),
			createMockResult({ run: { runId: "f", sut: "sut-b", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "test-metric": 24 } } }),
		];
		const comparison = computeComparison(primary, baseline, "test-metric");

		expect(comparison.uStatistic).toBeDefined();
		expect(comparison.pValue).toBeDefined();
		// With distinct distributions, U should be > 0
		expect(comparison.uStatistic).toBeGreaterThan(0);
	});
});

describe("computeSpeedup", () => {
	it("should compute baseline/treatment ratio", () => {
		const speedup = computeSpeedup(100, 50);

		expect(speedup).toBe(2);
	});

	it("should handle zero treatment time", () => {
		const speedup = computeSpeedup(100, 0);

		expect(speedup).toBe(Infinity);
	});

	it("should return ratio less than 1 when treatment is slower", () => {
		const speedup = computeSpeedup(50, 100);

		expect(speedup).toBe(0.5);
	});

	it("should return 1 for equal times", () => {
		const speedup = computeSpeedup(100, 100);

		expect(speedup).toBe(1);
	});
});

describe("computeMaxSpeedup", () => {
	it("should return maximum speedup from pairs", () => {
		const pairs: Array<[number, number]> = [
			[100, 50], // 2x
			[100, 25], // 4x
			[100, 100], // 1x
		];

		const maxSpeedup = computeMaxSpeedup(pairs);

		expect(maxSpeedup).toBe(4);
	});

	it("should return 0 for empty array", () => {
		const maxSpeedup = computeMaxSpeedup([]);

		expect(maxSpeedup).toBe(0);
	});

	it("should handle single pair", () => {
		const maxSpeedup = computeMaxSpeedup([[200, 100]]);

		expect(maxSpeedup).toBe(2);
	});
});

describe("computeRankings", () => {
	it("should rank ascending by default", () => {
		const results = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "execution-time": 100 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "execution-time": 50 } } }),
			createMockResult({ run: { runId: "c", sut: "sut-c", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "execution-time": 150 } } }),
		];

		const rankings = computeRankings(results, "execution-time", true);

		expect(rankings[0].value).toBe(50);
		expect(rankings[0].rank).toBe(1);
		expect(rankings[2].value).toBe(150);
		expect(rankings[2].rank).toBe(3);
	});

	it("should handle ties with sequential ranks", () => {
		const results = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "execution-time": 100 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "execution-time": 100 } } }),
			createMockResult({ run: { runId: "c", sut: "sut-c", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "execution-time": 100 } } }),
		];

		const rankings = computeRankings(results, "execution-time", true);

		expect(rankings).toHaveLength(3);
		// All have same value, sequential ranks
		expect(rankings[0].rank).toBe(1);
		expect(rankings[1].rank).toBe(2);
		expect(rankings[2].rank).toBe(3);
	});

	it("should rank descending when specified", () => {
		const results = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "path-diversity": 0.5 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "path-diversity": 0.8 } } }),
			createMockResult({ run: { runId: "c", sut: "sut-c", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "path-diversity": 0.3 } } }),
		];

		const rankings = computeRankings(results, "path-diversity", false);

		expect(rankings[0].value).toBe(0.8);
		expect(rankings[0].rank).toBe(1);
		expect(rankings[2].value).toBe(0.3);
		expect(rankings[2].rank).toBe(3);
	});

	it("should filter out NaN values", () => {
		const results = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "execution-time": 100 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: { "execution-time": Number.NaN } } }),
			createMockResult({ run: { runId: "c", sut: "sut-c", sutRole: "baseline", caseId: "case-3" }, metrics: { numeric: { "execution-time": 50 } } }),
		];

		const rankings = computeRankings(results, "execution-time", true);

		expect(rankings).toHaveLength(2);
	});

	it("should handle missing metrics", () => {
		const results = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: { "execution-time": 100 } } }),
			createMockResult({ run: { runId: "b", sut: "sut-b", sutRole: "baseline", caseId: "case-2" }, metrics: { numeric: {} } }),
		];

		const rankings = computeRankings(results, "execution-time", true);

		expect(rankings).toHaveLength(1);
	});

	it("should return empty array for no valid results", () => {
		const results = [
			createMockResult({ run: { runId: "a", sut: "sut-a", sutRole: "primary", caseId: "case-1" }, metrics: { numeric: {} } }),
		];

		const rankings = computeRankings(results, "execution-time", true);

		expect(rankings).toHaveLength(0);
	});
});

describe("getMethodAbbreviation", () => {
	it("should return abbreviation for known methods", () => {
		expect(getMethodAbbreviation("Degree-Prioritised")).toBe("DP");
		expect(getMethodAbbreviation("Standard BFS")).toBe("BFS");
		expect(getMethodAbbreviation("Frontier-Balanced")).toBe("FB");
		expect(getMethodAbbreviation("Random Priority")).toBe("Rand");
	});

	it("should return original name for unknown methods", () => {
		expect(getMethodAbbreviation("Unknown Method")).toBe("Unknown Method");
	});
});

describe("getVariantDisplayName", () => {
	it("should return display name for known variants", () => {
		expect(getVariantDisplayName("ego-graph")).toBe("Ego Network");
		expect(getVariantDisplayName("between-graph")).toBe("Bidirectional");
		expect(getVariantDisplayName("multi-seed")).toBe("Multi-Seed");
	});

	it("should return original name for unknown variants", () => {
		expect(getVariantDisplayName("unknown-variant")).toBe("unknown-variant");
	});
});

describe("METHOD_ABBREVIATIONS", () => {
	it("should contain expected abbreviations", () => {
		expect(METHOD_ABBREVIATIONS).toHaveProperty("Degree-Prioritised");
		expect(METHOD_ABBREVIATIONS).toHaveProperty("Standard BFS");
	});
});

describe("VARIANT_DISPLAY_NAMES", () => {
	it("should contain expected display names", () => {
		expect(VARIANT_DISPLAY_NAMES).toHaveProperty("ego-graph");
		expect(VARIANT_DISPLAY_NAMES).toHaveProperty("between-graph");
		expect(VARIANT_DISPLAY_NAMES).toHaveProperty("multi-seed");
	});
});

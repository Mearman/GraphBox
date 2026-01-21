/**
 * Unit tests for aggregation pipeline
 */

import { describe, expect, it } from "vitest";

import { createMockResult, createMockResults } from "../__tests__/test-helpers.js";
import type { EvaluationResult } from "../types/result.js";
import { aggregateResults, createAggregationOutput } from "./pipeline.js";

describe("aggregateResults", () => {
	it("should group by SUT only when groupByCaseClass is false", () => {
		const results = [
			...createMockResults(3, "sut-a", "primary", "class-x"),
			...createMockResults(2, "sut-a", "primary", "class-y"),
			...createMockResults(2, "sut-b", "baseline", "class-x"),
		];

		const aggregates = aggregateResults(results, { groupByCaseClass: false });

		// Should have 2 aggregates: sut-a and sut-b
		expect(aggregates).toHaveLength(2);
		expect(aggregates.find((a) => a.sut === "sut-a")?.group.runCount).toBe(5);
		expect(aggregates.find((a) => a.sut === "sut-b")?.group.runCount).toBe(2);
	});

	it("should group by SUT and caseClass by default", () => {
		const results = [
			...createMockResults(3, "sut-a", "primary", "class-x"),
			...createMockResults(2, "sut-a", "primary", "class-y"),
			...createMockResults(2, "sut-b", "baseline", "class-x"),
		];

		const aggregates = aggregateResults(results);

		// Should have 3 aggregates: sut-a::class-x, sut-a::class-y, sut-b::class-x
		expect(aggregates).toHaveLength(3);

		const sutAClassX = aggregates.find((a) => a.sut === "sut-a" && a.caseClass === "class-x");
		expect(sutAClassX?.group.runCount).toBe(3);

		const sutAClassY = aggregates.find((a) => a.sut === "sut-a" && a.caseClass === "class-y");
		expect(sutAClassY?.group.runCount).toBe(2);
	});

	it("should compute correctness rates", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "test-sut", sutRole: "primary", caseId: "c1" },
				correctness: { expectedExists: true, producedOutput: true, valid: true, matchesExpected: true },
			}),
			createMockResult({
				run: { runId: "2", sut: "test-sut", sutRole: "primary", caseId: "c2" },
				correctness: { expectedExists: true, producedOutput: true, valid: true, matchesExpected: true },
			}),
			createMockResult({
				run: { runId: "3", sut: "test-sut", sutRole: "primary", caseId: "c3" },
				correctness: { expectedExists: true, producedOutput: true, valid: false, matchesExpected: false },
			}),
			createMockResult({
				run: { runId: "4", sut: "test-sut", sutRole: "primary", caseId: "c4" },
				correctness: { expectedExists: true, producedOutput: false, valid: false, matchesExpected: null },
			}),
		];

		const aggregates = aggregateResults(results, { groupByCaseClass: false });

		expect(aggregates).toHaveLength(1);
		expect(aggregates[0].correctness.validRate).toBeCloseTo(0.5); // 2/4
		expect(aggregates[0].correctness.producedOutputRate).toBeCloseTo(0.75); // 3/4
		expect(aggregates[0].correctness.matchesExpectedRate).toBeCloseTo(0.5); // 2/4
	});

	it("should aggregate metrics with SummaryStats", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "test-sut", sutRole: "primary", caseId: "c1" },
				metrics: { numeric: { "execution-time": 100 } },
			}),
			createMockResult({
				run: { runId: "2", sut: "test-sut", sutRole: "primary", caseId: "c2" },
				metrics: { numeric: { "execution-time": 120 } },
			}),
			createMockResult({
				run: { runId: "3", sut: "test-sut", sutRole: "primary", caseId: "c3" },
				metrics: { numeric: { "execution-time": 140 } },
			}),
		];

		const aggregates = aggregateResults(results, { groupByCaseClass: false });

		const stats = aggregates[0].metrics["execution-time"];
		expect(stats).toBeDefined();
		expect(stats.n).toBe(3);
		expect(stats.mean).toBeCloseTo(120);
		expect(stats.min).toBe(100);
		expect(stats.max).toBe(140);
	});

	it("should compute comparisons between primary and baselines", () => {
		const results: EvaluationResult[] = [
			// Primary SUT - faster
			createMockResult({
				run: { runId: "1", sut: "primary-sut", sutRole: "primary", caseId: "c1", caseClass: "test" },
				metrics: { numeric: { "execution-time": 80 } },
			}),
			createMockResult({
				run: { runId: "2", sut: "primary-sut", sutRole: "primary", caseId: "c2", caseClass: "test" },
				metrics: { numeric: { "execution-time": 90 } },
			}),
			// Baseline SUT - slower
			createMockResult({
				run: { runId: "3", sut: "baseline-sut", sutRole: "baseline", caseId: "c1", caseClass: "test" },
				metrics: { numeric: { "execution-time": 120 } },
			}),
			createMockResult({
				run: { runId: "4", sut: "baseline-sut", sutRole: "baseline", caseId: "c2", caseClass: "test" },
				metrics: { numeric: { "execution-time": 130 } },
			}),
		];

		const aggregates = aggregateResults(results, { computeComparisons: true });

		const primaryAgg = aggregates.find((a) => a.sut === "primary-sut");
		expect(primaryAgg?.comparisons).toBeDefined();
		expect(primaryAgg?.comparisons?.["baseline-sut"]).toBeDefined();

		// Delta should be negative (primary - baseline)
		const delta = primaryAgg?.comparisons?.["baseline-sut"]?.deltas["execution-time"];
		expect(delta).toBeLessThan(0);
	});

	it("should handle missing metrics gracefully", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "test-sut", sutRole: "primary", caseId: "c1" },
				metrics: { numeric: { "metric-a": 100 } },
			}),
			createMockResult({
				run: { runId: "2", sut: "test-sut", sutRole: "primary", caseId: "c2" },
				metrics: { numeric: { "metric-b": 200 } },
			}),
		];

		const aggregates = aggregateResults(results, { groupByCaseClass: false });

		// Both metrics should be aggregated
		expect(aggregates[0].metrics["metric-a"]).toBeDefined();
		expect(aggregates[0].metrics["metric-b"]).toBeDefined();
		// Each has n=1
		expect(aggregates[0].metrics["metric-a"].n).toBe(1);
		expect(aggregates[0].metrics["metric-b"].n).toBe(1);
	});

	it("should filter by specific metrics when provided", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "test-sut", sutRole: "primary", caseId: "c1" },
				metrics: { numeric: { "metric-a": 100, "metric-b": 200, "metric-c": 300 } },
			}),
		];

		const aggregates = aggregateResults(results, {
			groupByCaseClass: false,
			metrics: ["metric-a", "metric-c"],
		});

		expect(aggregates[0].metrics["metric-a"]).toBeDefined();
		expect(aggregates[0].metrics["metric-c"]).toBeDefined();
		expect(aggregates[0].metrics["metric-b"]).toBeUndefined();
	});

	it("should skip NaN values when aggregating metrics", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "test-sut", sutRole: "primary", caseId: "c1" },
				metrics: { numeric: { "execution-time": 100 } },
			}),
			createMockResult({
				run: { runId: "2", sut: "test-sut", sutRole: "primary", caseId: "c2" },
				metrics: { numeric: { "execution-time": Number.NaN } },
			}),
			createMockResult({
				run: { runId: "3", sut: "test-sut", sutRole: "primary", caseId: "c3" },
				metrics: { numeric: { "execution-time": 200 } },
			}),
		];

		const aggregates = aggregateResults(results, { groupByCaseClass: false });

		expect(aggregates[0].metrics["execution-time"].n).toBe(2); // NaN excluded
		expect(aggregates[0].metrics["execution-time"].mean).toBeCloseTo(150);
	});

	it("should compute metric coverage", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "test-sut", sutRole: "primary", caseId: "c1" },
				metrics: { numeric: { "metric-a": 100, "metric-b": 200 } },
			}),
			createMockResult({
				run: { runId: "2", sut: "test-sut", sutRole: "primary", caseId: "c2" },
				metrics: { numeric: { "metric-a": 150 } }, // Missing metric-b
			}),
		];

		const aggregates = aggregateResults(results, { groupByCaseClass: false });

		expect(aggregates[0].coverage?.metricCoverage["metric-a"]).toBe(1); // 2/2
		expect(aggregates[0].coverage?.metricCoverage["metric-b"]).toBe(0.5); // 1/2
	});

	it("should count unique cases", () => {
		const results: EvaluationResult[] = [
			createMockResult({ run: { runId: "1", sut: "test-sut", sutRole: "primary", caseId: "case-a" } }),
			createMockResult({ run: { runId: "2", sut: "test-sut", sutRole: "primary", caseId: "case-a" } }), // duplicate case
			createMockResult({ run: { runId: "3", sut: "test-sut", sutRole: "primary", caseId: "case-b" } }),
		];

		const aggregates = aggregateResults(results, { groupByCaseClass: false });

		expect(aggregates[0].group.runCount).toBe(3);
		expect(aggregates[0].group.caseCount).toBe(2); // Only 2 unique cases
	});

	it("should handle empty results", () => {
		const aggregates = aggregateResults([]);

		expect(aggregates).toHaveLength(0);
	});

	it("should not compute comparisons when disabled", () => {
		const results: EvaluationResult[] = [
			createMockResult({ run: { runId: "1", sut: "primary-sut", sutRole: "primary", caseId: "c1" } }),
			createMockResult({ run: { runId: "2", sut: "baseline-sut", sutRole: "baseline", caseId: "c1" } }),
		];

		const aggregates = aggregateResults(results, { computeComparisons: false });

		const primaryAgg = aggregates.find((a) => a.sut === "primary-sut");
		expect(primaryAgg?.comparisons).toBeUndefined();
	});
});

describe("createAggregationOutput", () => {
	it("should create output with metadata", () => {
		const results = createMockResults(5, "test-sut", "primary", "test-class");
		const aggregates = aggregateResults(results);

		const output = createAggregationOutput(aggregates, results);

		expect(output.version).toBe("1.0.0");
		expect(output.timestamp).toBeDefined();
		expect(output.aggregates).toHaveLength(1);
		expect(output.metadata?.totalRuns).toBe(5);
		expect(output.metadata?.sutsIncluded).toContain("test-sut");
	});

	it("should include unique case classes", () => {
		const results = [
			...createMockResults(3, "sut-a", "primary", "class-x"),
			...createMockResults(2, "sut-a", "primary", "class-y"),
		];
		const aggregates = aggregateResults(results);

		const output = createAggregationOutput(aggregates, results);

		expect(output.metadata?.caseClassesIncluded).toContain("class-x");
		expect(output.metadata?.caseClassesIncluded).toContain("class-y");
	});

	it("should count unique cases", () => {
		const results: EvaluationResult[] = [
			createMockResult({ run: { runId: "1", sut: "test-sut", sutRole: "primary", caseId: "case-a" } }),
			createMockResult({ run: { runId: "2", sut: "test-sut", sutRole: "primary", caseId: "case-b" } }),
			createMockResult({ run: { runId: "3", sut: "test-sut", sutRole: "primary", caseId: "case-a" } }), // duplicate
		];
		const aggregates = aggregateResults(results, { groupByCaseClass: false });

		const output = createAggregationOutput(aggregates, results);

		expect(output.metadata?.totalCases).toBe(2);
	});
});

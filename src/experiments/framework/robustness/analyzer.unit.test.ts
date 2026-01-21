/**
 * Unit tests for robustness analyzer
 */

import { describe, expect, it } from "vitest";

import { createMockResult } from "../__tests__/test-helpers.js";
import type { EvaluationResult } from "../types/result.js";
import {
	analyzeRobustnessForMetric,
	analyzeRobustnessWithCurve,
	compareRobustness,
	createRobustnessAnalysis,
} from "./analyzer.js";

describe("analyzeRobustnessForMetric", () => {
	it("should compute variance under perturbation", () => {
		const baseResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "execution-time": 100 } } }),
			createMockResult({ metrics: { numeric: { "execution-time": 100 } } }),
		];

		const perturbedResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "execution-time": 105 } } }),
			createMockResult({ metrics: { numeric: { "execution-time": 110 } } }),
			createMockResult({ metrics: { numeric: { "execution-time": 95 } } }),
			createMockResult({ metrics: { numeric: { "execution-time": 115 } } }),
		];

		const robustness = analyzeRobustnessForMetric(baseResults, perturbedResults, "execution-time");

		expect(robustness.varianceUnderPerturbation).toBeDefined();
		expect(robustness.varianceUnderPerturbation).toBeGreaterThan(0);
		expect(robustness.stdUnderPerturbation).toBeDefined();
		expect(robustness.stdUnderPerturbation).toBeGreaterThan(0);
	});

	it("should compute coefficient of variation", () => {
		const baseResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "metric": 100 } } }),
		];

		const perturbedResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "metric": 90 } } }),
			createMockResult({ metrics: { numeric: { "metric": 100 } } }),
			createMockResult({ metrics: { numeric: { "metric": 110 } } }),
		];

		const robustness = analyzeRobustnessForMetric(baseResults, perturbedResults, "metric");

		expect(robustness.coefficientOfVariation).toBeDefined();
		expect(robustness.coefficientOfVariation).toBeGreaterThan(0);
		expect(robustness.coefficientOfVariation).toBeLessThan(1);
	});

	it("should handle zero mean (return NaN for CV)", () => {
		const baseResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "metric": 0 } } }),
		];

		const perturbedResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "metric": 0 } } }),
			createMockResult({ metrics: { numeric: { "metric": 0 } } }),
		];

		const robustness = analyzeRobustnessForMetric(baseResults, perturbedResults, "metric");

		expect(Number.isNaN(robustness.coefficientOfVariation)).toBe(true);
	});

	it("should handle empty base results", () => {
		const perturbedResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "metric": 100 } } }),
		];

		const robustness = analyzeRobustnessForMetric([], perturbedResults, "metric");

		expect(Number.isNaN(robustness.varianceUnderPerturbation)).toBe(true);
	});

	it("should handle empty perturbed results", () => {
		const baseResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "metric": 100 } } }),
		];

		const robustness = analyzeRobustnessForMetric(baseResults, [], "metric");

		expect(Number.isNaN(robustness.varianceUnderPerturbation)).toBe(true);
	});

	it("should handle missing metric in results", () => {
		const baseResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "other-metric": 100 } } }),
		];

		const perturbedResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "other-metric": 110 } } }),
		];

		const robustness = analyzeRobustnessForMetric(baseResults, perturbedResults, "missing-metric");

		expect(Number.isNaN(robustness.varianceUnderPerturbation)).toBe(true);
	});

	it("should filter NaN values from metric data", () => {
		const baseResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "metric": 100 } } }),
		];

		const perturbedResults: EvaluationResult[] = [
			createMockResult({ metrics: { numeric: { "metric": 105 } } }),
			createMockResult({ metrics: { numeric: { "metric": Number.NaN } } }),
			createMockResult({ metrics: { numeric: { "metric": 110 } } }),
		];

		const robustness = analyzeRobustnessForMetric(baseResults, perturbedResults, "metric");

		// Should compute stats from 2 valid values
		expect(robustness.varianceUnderPerturbation).toBeDefined();
		expect(Number.isNaN(robustness.varianceUnderPerturbation)).toBe(false);
	});
});

describe("analyzeRobustnessWithCurve", () => {
	it("should build degradation curve across intensity levels", () => {
		const results: EvaluationResult[] = [
			// Base (no perturbation)
			createMockResult({
				run: { runId: "1", sut: "s", sutRole: "primary", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			// Intensity 0.1
			createMockResult({
				run: { runId: "2", sut: "s", sutRole: "primary", caseId: "c2", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 95 } },
			}),
			// Intensity 0.2
			createMockResult({
				run: { runId: "3", sut: "s", sutRole: "primary", caseId: "c3", config: { perturbationIntensity: 0.2 } },
				metrics: { numeric: { "metric": 85 } },
			}),
		];

		const robustness = analyzeRobustnessWithCurve(results, "metric", [0.1, 0.2]);

		expect(robustness.degradationCurve).toBeDefined();
		expect(robustness.degradationCurve).toHaveLength(3); // base + 2 levels
		expect(robustness.degradationCurve?.[0].perturbationLevel).toBe(0);
		expect(robustness.degradationCurve?.[1].perturbationLevel).toBe(0.1);
		expect(robustness.degradationCurve?.[2].perturbationLevel).toBe(0.2);
	});

	it("should detect breakpoint (significant degradation)", () => {
		const results: EvaluationResult[] = [
			// Base
			createMockResult({
				run: { runId: "1", sut: "s", sutRole: "primary", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			// Small degradation
			createMockResult({
				run: { runId: "2", sut: "s", sutRole: "primary", caseId: "c2", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 98 } },
			}),
			// Significant degradation (>10%)
			createMockResult({
				run: { runId: "3", sut: "s", sutRole: "primary", caseId: "c3", config: { perturbationIntensity: 0.2 } },
				metrics: { numeric: { "metric": 85 } },
			}),
		];

		const robustness = analyzeRobustnessWithCurve(results, "metric", [0.1, 0.2]);

		expect(robustness.breakpoint).toBe(0.2); // First level with >10% degradation
	});

	it("should include std in degradation curve", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "s", sutRole: "primary", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			createMockResult({
				run: { runId: "2", sut: "s", sutRole: "primary", caseId: "c2", config: {} },
				metrics: { numeric: { "metric": 110 } },
			}),
		];

		const robustness = analyzeRobustnessWithCurve(results, "metric", []);

		expect(robustness.degradationCurve?.[0].stdDev).toBeDefined();
	});

	it("should sort curve by perturbation level", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "s", sutRole: "primary", caseId: "c1", config: { perturbationIntensity: 0.3 } },
				metrics: { numeric: { "metric": 70 } },
			}),
			createMockResult({
				run: { runId: "2", sut: "s", sutRole: "primary", caseId: "c2", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 90 } },
			}),
			createMockResult({
				run: { runId: "3", sut: "s", sutRole: "primary", caseId: "c3", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
		];

		const robustness = analyzeRobustnessWithCurve(results, "metric", [0.1, 0.3]);

		expect(robustness.degradationCurve?.[0].perturbationLevel).toBe(0);
		expect(robustness.degradationCurve?.[1].perturbationLevel).toBe(0.1);
		expect(robustness.degradationCurve?.[2].perturbationLevel).toBe(0.3);
	});
});

describe("compareRobustness", () => {
	it("should compute relative robustness ratio", () => {
		// SUT A: more stable (lower variance)
		const sutAResults: EvaluationResult[] = [
			createMockResult({
				run: { runId: "a1", sut: "sut-a", sutRole: "primary", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			createMockResult({
				run: { runId: "a2", sut: "sut-a", sutRole: "primary", caseId: "c2", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 98 } },
			}),
			createMockResult({
				run: { runId: "a3", sut: "sut-a", sutRole: "primary", caseId: "c3", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 102 } },
			}),
		];

		// SUT B: less stable (higher variance)
		const sutBResults: EvaluationResult[] = [
			createMockResult({
				run: { runId: "b1", sut: "sut-b", sutRole: "baseline", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			createMockResult({
				run: { runId: "b2", sut: "sut-b", sutRole: "baseline", caseId: "c2", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 80 } },
			}),
			createMockResult({
				run: { runId: "b3", sut: "sut-b", sutRole: "baseline", caseId: "c3", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 120 } },
			}),
		];

		const comparison = compareRobustness(sutAResults, sutBResults, "metric");

		expect(comparison.sutAVariance).toBeDefined();
		expect(comparison.sutBVariance).toBeDefined();
		expect(comparison.relativeRobustness).toBeDefined();
		// A is more robust (lower variance), so ratio should be < 1
		expect(comparison.relativeRobustness).toBeLessThan(1);
	});

	it("should handle zero variance in SUT B", () => {
		// Need multiple perturbed results for SUT A to get non-NaN variance
		const sutAResults: EvaluationResult[] = [
			createMockResult({
				run: { runId: "a1", sut: "sut-a", sutRole: "primary", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			createMockResult({
				run: { runId: "a2", sut: "sut-a", sutRole: "primary", caseId: "c2", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 105 } },
			}),
			createMockResult({
				run: { runId: "a3", sut: "sut-a", sutRole: "primary", caseId: "c3", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 102 } },
			}),
		];

		const sutBResults: EvaluationResult[] = [
			createMockResult({
				run: { runId: "b1", sut: "sut-b", sutRole: "baseline", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			createMockResult({
				run: { runId: "b2", sut: "sut-b", sutRole: "baseline", caseId: "c2", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 100 } },
			}),
			createMockResult({
				run: { runId: "b3", sut: "sut-b", sutRole: "baseline", caseId: "c3", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 100 } },
			}),
		];

		const comparison = compareRobustness(sutAResults, sutBResults, "metric");

		// SUT B has zero variance (all values are 100), so ratio should be Infinity
		expect(comparison.sutBVariance).toBe(0);
		expect(comparison.relativeRobustness).toBe(Infinity);
	});

	it("should separate base and perturbed results correctly", () => {
		const sutAResults: EvaluationResult[] = [
			createMockResult({
				run: { runId: "a1", sut: "sut-a", sutRole: "primary", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			createMockResult({
				run: { runId: "a2", sut: "sut-a", sutRole: "primary", caseId: "c2", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 95 } },
			}),
		];

		const sutBResults: EvaluationResult[] = [
			createMockResult({
				run: { runId: "b1", sut: "sut-b", sutRole: "baseline", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			createMockResult({
				run: { runId: "b2", sut: "sut-b", sutRole: "baseline", caseId: "c2", config: { perturbationIntensity: 0.1 } },
				metrics: { numeric: { "metric": 90 } },
			}),
		];

		const comparison = compareRobustness(sutAResults, sutBResults, "metric");

		expect(comparison.sutAVariance).toBeDefined();
		expect(comparison.sutBVariance).toBeDefined();
	});
});

describe("createRobustnessAnalysis", () => {
	it("should create analysis output with all SUTs and metrics", () => {
		const results: EvaluationResult[] = [
			// SUT A - base
			createMockResult({
				run: { runId: "a1", sut: "sut-a", sutRole: "primary", caseId: "c1", config: {} },
				metrics: { numeric: { "metric-1": 100, "metric-2": 50 } },
			}),
			// SUT A - perturbed
			createMockResult({
				run: { runId: "a2", sut: "sut-a", sutRole: "primary", caseId: "c2", config: { perturbation: "edge-deletion" } },
				metrics: { numeric: { "metric-1": 95, "metric-2": 48 } },
			}),
			// SUT B - base
			createMockResult({
				run: { runId: "b1", sut: "sut-b", sutRole: "baseline", caseId: "c1", config: {} },
				metrics: { numeric: { "metric-1": 120, "metric-2": 60 } },
			}),
			// SUT B - perturbed
			createMockResult({
				run: { runId: "b2", sut: "sut-b", sutRole: "baseline", caseId: "c2", config: { perturbation: "edge-deletion" } },
				metrics: { numeric: { "metric-1": 110, "metric-2": 55 } },
			}),
		];

		const output = createRobustnessAnalysis(results, {
			metrics: ["metric-1", "metric-2"],
			perturbations: ["edge-deletion"],
		});

		expect(output.version).toBe("1.0.0");
		expect(output.timestamp).toBeDefined();
		// 2 SUTs × 2 metrics × 1 perturbation = 4 results
		expect(output.results).toHaveLength(4);
		expect(output.config.metrics).toContain("metric-1");
		expect(output.config.metrics).toContain("metric-2");
		expect(output.config.perturbations).toContain("edge-deletion");
	});

	it("should compute baseline values", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "sut-a", sutRole: "primary", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			createMockResult({
				run: { runId: "2", sut: "sut-a", sutRole: "primary", caseId: "c2", config: { perturbation: "test" } },
				metrics: { numeric: { "metric": 95 } },
			}),
		];

		const output = createRobustnessAnalysis(results, {
			metrics: ["metric"],
			perturbations: ["test"],
		});

		const result = output.results.find((r) => r.sut === "sut-a" && r.metric === "metric");
		expect(result?.baselineValue).toBe(100);
	});

	it("should count perturbed runs", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "sut-a", sutRole: "primary", caseId: "c1", config: {} },
				metrics: { numeric: { "metric": 100 } },
			}),
			createMockResult({
				run: { runId: "2", sut: "sut-a", sutRole: "primary", caseId: "c2", config: { perturbation: "test" } },
				metrics: { numeric: { "metric": 95 } },
			}),
			createMockResult({
				run: { runId: "3", sut: "sut-a", sutRole: "primary", caseId: "c3", config: { perturbation: "test" } },
				metrics: { numeric: { "metric": 105 } },
			}),
		];

		const output = createRobustnessAnalysis(results, {
			metrics: ["metric"],
			perturbations: ["test"],
		});

		const result = output.results.find((r) => r.sut === "sut-a");
		expect(result?.runCount).toBe(2); // 2 perturbed runs
	});

	it("should include intensity levels in config", () => {
		const results: EvaluationResult[] = [
			createMockResult({
				run: { runId: "1", sut: "s", sutRole: "primary", caseId: "c", config: {} },
				metrics: { numeric: { "m": 100 } },
			}),
		];

		const output = createRobustnessAnalysis(results, {
			metrics: ["m"],
			perturbations: ["p"],
			intensityLevels: [0.1, 0.2, 0.3],
			runsPerLevel: 5,
		});

		expect(output.config.intensityLevels).toEqual([0.1, 0.2, 0.3]);
		expect(output.config.runsPerLevel).toBe(5);
	});
});

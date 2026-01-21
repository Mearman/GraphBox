/**
 * Unit tests for ResultCollector
 */

import { beforeEach,describe, expect, it } from "vitest";

import { createInvalidResult, createMinimalValidResult, createMockResult, createMockResults } from "../__tests__/test-helpers.js";
import type { EvaluationResult } from "../types/result.js";
import { ResultCollector } from "./result-collector.js";

describe("ResultCollector", () => {
	let collector: ResultCollector;

	beforeEach(() => {
		collector = new ResultCollector();
	});

	describe("record", () => {
		it("should store valid result", () => {
			const result = createMockResult();
			collector.record(result);

			expect(collector.count).toBe(1);
			expect(collector.getAll()).toContainEqual(result);
		});

		it("should reject invalid result (missing run)", () => {
			const invalidResult = {
				correctness: { expectedExists: false, producedOutput: true, valid: true, matchesExpected: null },
				outputs: {},
				metrics: { numeric: {} },
				provenance: { runtime: { platform: "test", arch: "test", nodeVersion: "20" } },
			} as unknown as EvaluationResult;

			expect(() => collector.record(invalidResult)).toThrow("Invalid result");
		});

		it("should reject result missing runId", () => {
			const invalidResult = {
				run: { sut: "test", sutRole: "primary", caseId: "test" }, // missing runId
				correctness: { expectedExists: false, producedOutput: true, valid: true, matchesExpected: null },
				outputs: {},
				metrics: { numeric: {} },
				provenance: { runtime: { platform: "test", arch: "test", nodeVersion: "20" } },
			} as unknown as EvaluationResult;

			expect(() => collector.record(invalidResult)).toThrow("run.runId");
		});

		it("should reject result missing metrics", () => {
			const invalidResult = {
				run: { runId: "test", sut: "test", sutRole: "primary", caseId: "test" },
				correctness: { expectedExists: false, producedOutput: true, valid: true, matchesExpected: null },
				outputs: {},
				provenance: { runtime: { platform: "test", arch: "test", nodeVersion: "20" } },
			} as unknown as EvaluationResult;

			expect(() => collector.record(invalidResult)).toThrow("metrics");
		});

		it("should reject result missing provenance", () => {
			const invalidResult = {
				run: { runId: "test", sut: "test", sutRole: "primary", caseId: "test" },
				correctness: { expectedExists: false, producedOutput: true, valid: true, matchesExpected: null },
				outputs: {},
				metrics: { numeric: {} },
			} as unknown as EvaluationResult;

			expect(() => collector.record(invalidResult)).toThrow("provenance");
		});
	});

	describe("recordBatch", () => {
		it("should record multiple results", () => {
			const results = createMockResults(5, "test-sut");
			collector.recordBatch(results);

			expect(collector.count).toBe(5);
		});

		it("should fail on first invalid result", () => {
			const validResult = createMockResult();
			const invalidResult = createInvalidResult() as EvaluationResult;

			expect(() => collector.recordBatch([validResult, invalidResult])).toThrow();
			expect(collector.count).toBe(1); // Only first was recorded
		});
	});

	describe("validate", () => {
		it("should return empty array for valid result", () => {
			const result = createMinimalValidResult();
			const errors = collector.validate(result);

			expect(errors).toHaveLength(0);
		});

		it("should return errors for missing fields", () => {
			const invalidResult = {} as unknown as EvaluationResult;
			const errors = collector.validate(invalidResult);

			expect(errors.length).toBeGreaterThan(0);
			expect(errors.some((e) => e.field === "run")).toBe(true);
		});

		it("should validate nested fields", () => {
			const partialResult = {
				run: { sut: "test" }, // missing runId, sutRole, caseId
				correctness: { expectedExists: true, producedOutput: true, valid: true, matchesExpected: null },
				outputs: {},
				metrics: { numeric: {} },
				provenance: { runtime: { platform: "test", arch: "test", nodeVersion: "20" } },
			} as unknown as EvaluationResult;

			const errors = collector.validate(partialResult);

			expect(errors.some((e) => e.field === "run.runId")).toBe(true);
			expect(errors.some((e) => e.field === "run.sutRole")).toBe(true);
			expect(errors.some((e) => e.field === "run.caseId")).toBe(true);
		});
	});

	describe("query", () => {
		beforeEach(() => {
			// Set up test data
			collector.recordBatch([
				createMockResult({
					run: { runId: "r1", sut: "sut-a", sutRole: "primary", caseId: "case-1", caseClass: "class-x" },
					correctness: { expectedExists: true, producedOutput: true, valid: true, matchesExpected: true },
					metrics: { numeric: { "execution-time": 100 } },
				}),
				createMockResult({
					run: { runId: "r2", sut: "sut-b", sutRole: "baseline", caseId: "case-2", caseClass: "class-x" },
					correctness: { expectedExists: true, producedOutput: true, valid: false, matchesExpected: false },
					metrics: { numeric: { "execution-time": 150 } },
				}),
				createMockResult({
					run: { runId: "r3", sut: "sut-a", sutRole: "primary", caseId: "case-3", caseClass: "class-y" },
					correctness: { expectedExists: true, producedOutput: true, valid: true, matchesExpected: true },
					metrics: { numeric: { "path-diversity": 0.8 } },
				}),
			]);
		});

		it("should filter by SUT", () => {
			const results = collector.query({ sut: "sut-a" });

			expect(results).toHaveLength(2);
			expect(results.every((r) => r.run.sut === "sut-a")).toBe(true);
		});

		it("should filter by caseId", () => {
			const results = collector.query({ caseId: "case-1" });

			expect(results).toHaveLength(1);
			expect(results[0].run.runId).toBe("r1");
		});

		it("should filter by validity", () => {
			const validResults = collector.query({ valid: true });
			const invalidResults = collector.query({ valid: false });

			expect(validResults).toHaveLength(2);
			expect(invalidResults).toHaveLength(1);
		});

		it("should filter by SUT role", () => {
			const primaryResults = collector.query({ sutRole: "primary" });
			const baselineResults = collector.query({ sutRole: "baseline" });

			expect(primaryResults).toHaveLength(2);
			expect(baselineResults).toHaveLength(1);
		});

		it("should filter by case class", () => {
			const results = collector.query({ caseClass: "class-x" });

			expect(results).toHaveLength(2);
		});

		it("should filter by metric presence", () => {
			const results = collector.query({ hasMetric: "path-diversity" });

			expect(results).toHaveLength(1);
			expect(results[0].run.runId).toBe("r3");
		});

		it("should support custom predicates", () => {
			const results = collector.query({
				predicate: (r) => r.metrics.numeric["execution-time"] !== undefined && r.metrics.numeric["execution-time"] > 120,
			});

			expect(results).toHaveLength(1);
			expect(results[0].run.runId).toBe("r2");
		});

		it("should return all results with empty filter", () => {
			const results = collector.query({});

			expect(results).toHaveLength(3);
		});

		it("should combine multiple filters", () => {
			const results = collector.query({ sut: "sut-a", caseClass: "class-x" });

			expect(results).toHaveLength(1);
			expect(results[0].run.runId).toBe("r1");
		});
	});

	describe("getBySut", () => {
		it("should return results for specific SUT", () => {
			collector.recordBatch(createMockResults(3, "target-sut"));
			collector.recordBatch(createMockResults(2, "other-sut"));

			const results = collector.getBySut("target-sut");

			expect(results).toHaveLength(3);
		});
	});

	describe("getByCaseClass", () => {
		it("should return results for specific case class", () => {
			collector.record(createMockResult({ run: { runId: "1", sut: "s", sutRole: "primary", caseId: "c1", caseClass: "target" } }));
			collector.record(createMockResult({ run: { runId: "2", sut: "s", sutRole: "primary", caseId: "c2", caseClass: "other" } }));

			const results = collector.getByCaseClass("target");

			expect(results).toHaveLength(1);
		});
	});

	describe("getUniqueSuts", () => {
		it("should return unique SUT IDs", () => {
			collector.recordBatch(createMockResults(3, "sut-a"));
			collector.recordBatch(createMockResults(2, "sut-b"));

			const suts = collector.getUniqueSuts();

			expect(suts).toHaveLength(2);
			expect(suts).toContain("sut-a");
			expect(suts).toContain("sut-b");
		});
	});

	describe("getUniqueCaseClasses", () => {
		it("should return unique case classes", () => {
			collector.record(createMockResult({ run: { runId: "1", sut: "s", sutRole: "primary", caseId: "c1", caseClass: "class-a" } }));
			collector.record(createMockResult({ run: { runId: "2", sut: "s", sutRole: "primary", caseId: "c2", caseClass: "class-b" } }));
			collector.record(createMockResult({ run: { runId: "3", sut: "s", sutRole: "primary", caseId: "c3", caseClass: "class-a" } }));

			const classes = collector.getUniqueCaseClasses();

			expect(classes).toHaveLength(2);
			expect(classes).toContain("class-a");
			expect(classes).toContain("class-b");
		});
	});

	describe("getUniqueMetrics", () => {
		it("should return unique metric names", () => {
			collector.record(createMockResult({ metrics: { numeric: { "metric-a": 1, "metric-b": 2 } } }));
			collector.record(createMockResult({ metrics: { numeric: { "metric-b": 3, "metric-c": 4 } } }));

			const metrics = collector.getUniqueMetrics();

			expect(metrics).toContain("metric-a");
			expect(metrics).toContain("metric-b");
			expect(metrics).toContain("metric-c");
		});
	});

	describe("serialize", () => {
		it("should produce valid ResultBatch", () => {
			collector.recordBatch(createMockResults(3, "test-sut"));

			const batch = collector.serialize();

			expect(batch.version).toBe("1.0.0");
			expect(batch.timestamp).toBeDefined();
			expect(batch.results).toHaveLength(3);
		});

		it("should include metadata", () => {
			collector.record(createMockResult());

			const batch = collector.serialize({ experiment: "test-exp", seed: 42 });

			expect(batch.metadata?.experiment).toBe("test-exp");
			expect(batch.metadata?.seed).toBe(42);
		});
	});

	describe("load", () => {
		it("should load results from batch", () => {
			const results = createMockResults(3, "test-sut");
			const batch = {
				version: "1.0.0",
				timestamp: new Date().toISOString(),
				results,
			};

			collector.load(batch);

			expect(collector.count).toBe(3);
		});

		it("should append to existing results when specified", () => {
			collector.record(createMockResult({ run: { runId: "existing", sut: "s", sutRole: "primary", caseId: "c" } }));

			const batch = {
				version: "1.0.0",
				timestamp: new Date().toISOString(),
				results: createMockResults(2, "new-sut"),
			};

			collector.load(batch, true);

			expect(collector.count).toBe(3);
		});

		it("should replace existing results by default", () => {
			collector.recordBatch(createMockResults(5, "old-sut"));

			const batch = {
				version: "1.0.0",
				timestamp: new Date().toISOString(),
				results: createMockResults(2, "new-sut"),
			};

			collector.load(batch);

			expect(collector.count).toBe(2);
		});
	});

	describe("extractMetric", () => {
		it("should extract metric values with runIds", () => {
			collector.record(createMockResult({ run: { runId: "r1", sut: "s", sutRole: "primary", caseId: "c" }, metrics: { numeric: { "test-metric": 100 } } }));
			collector.record(createMockResult({ run: { runId: "r2", sut: "s", sutRole: "primary", caseId: "c" }, metrics: { numeric: { "test-metric": 200 } } }));

			const extracted = collector.extractMetric("test-metric");

			expect(extracted).toHaveLength(2);
			expect(extracted).toContainEqual({ runId: "r1", value: 100 });
			expect(extracted).toContainEqual({ runId: "r2", value: 200 });
		});

		it("should skip results without the metric", () => {
			collector.record(createMockResult({ run: { runId: "r1", sut: "s", sutRole: "primary", caseId: "c" }, metrics: { numeric: { "test-metric": 100 } } }));
			collector.record(createMockResult({ run: { runId: "r2", sut: "s", sutRole: "primary", caseId: "c" }, metrics: { numeric: { "other-metric": 200 } } }));

			const extracted = collector.extractMetric("test-metric");

			expect(extracted).toHaveLength(1);
		});
	});

	describe("getMetricValues", () => {
		it("should return metric values for specific SUT", () => {
			collector.record(createMockResult({ run: { runId: "r1", sut: "sut-a", sutRole: "primary", caseId: "c1" }, metrics: { numeric: { "test-metric": 100 } } }));
			collector.record(createMockResult({ run: { runId: "r2", sut: "sut-a", sutRole: "primary", caseId: "c2" }, metrics: { numeric: { "test-metric": 150 } } }));
			collector.record(createMockResult({ run: { runId: "r3", sut: "sut-b", sutRole: "baseline", caseId: "c3" }, metrics: { numeric: { "test-metric": 200 } } }));

			const values = collector.getMetricValues("sut-a", "test-metric");

			expect(values).toHaveLength(2);
			expect(values).toContain(100);
			expect(values).toContain(150);
		});
	});

	describe("isEmpty and count", () => {
		it("should report empty for new collector", () => {
			expect(collector.isEmpty).toBe(true);
			expect(collector.count).toBe(0);
		});

		it("should report non-empty after adding results", () => {
			collector.record(createMockResult());

			expect(collector.isEmpty).toBe(false);
			expect(collector.count).toBe(1);
		});
	});

	describe("clear", () => {
		it("should remove all results", () => {
			collector.recordBatch(createMockResults(5, "test-sut"));
			collector.clear();

			expect(collector.isEmpty).toBe(true);
			expect(collector.count).toBe(0);
		});
	});
});

/**
 * Unit tests for claims evaluator
 */

import { describe, expect, it } from "vitest";

import { createMockAggregate, createMockAggregates, createMockClaim, createMockSummaryStats } from "../__tests__/test-helpers.js";
import type { EvaluationClaim } from "../types/claims.js";
import { createClaimSummary, evaluateClaim, evaluateClaims } from "./evaluator.js";

describe("evaluateClaim", () => {
	it("should return 'satisfied' when primary > baseline (direction: greater)", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", undefined, {
				"path-diversity": createMockSummaryStats([0.8, 0.85, 0.82, 0.88, 0.9]),
			}),
			createMockAggregate("baseline-sut", "baseline", undefined, {
				"path-diversity": createMockSummaryStats([0.5, 0.55, 0.52, 0.58, 0.6]),
			}),
		];

		const claim = createMockClaim({
			claimId: "C001",
			sut: "primary-sut",
			baseline: "baseline-sut",
			metric: "path-diversity",
			direction: "greater",
		});

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.status).toBe("satisfied");
		expect(evaluation.evidence.delta).toBeGreaterThan(0);
	});

	it("should return 'violated' when primary < baseline (direction: greater)", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", undefined, {
				"path-diversity": createMockSummaryStats([0.5, 0.55, 0.52]),
			}),
			createMockAggregate("baseline-sut", "baseline", undefined, {
				"path-diversity": createMockSummaryStats([0.8, 0.85, 0.82]),
			}),
		];

		const claim = createMockClaim({
			sut: "primary-sut",
			baseline: "baseline-sut",
			metric: "path-diversity",
			direction: "greater",
		});

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.status).toBe("violated");
		expect(evaluation.evidence.delta).toBeLessThan(0);
	});

	it("should return 'satisfied' when primary < baseline (direction: less)", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", undefined, {
				"execution-time": createMockSummaryStats([80, 85, 82]),
			}),
			createMockAggregate("baseline-sut", "baseline", undefined, {
				"execution-time": createMockSummaryStats([120, 125, 122]),
			}),
		];

		const claim = createMockClaim({
			sut: "primary-sut",
			baseline: "baseline-sut",
			metric: "execution-time",
			direction: "less",
		});

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.status).toBe("satisfied");
		expect(evaluation.evidence.delta).toBeLessThan(0);
	});

	it("should return 'inconclusive' when primary SUT not found", () => {
		const aggregates = [
			createMockAggregate("other-sut", "primary"),
		];

		const claim = createMockClaim({
			sut: "missing-sut",
			baseline: "other-sut",
		});

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.status).toBe("inconclusive");
		expect(evaluation.inconclusiveReason).toContain("Primary SUT not found");
	});

	it("should return 'inconclusive' when baseline SUT not found", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary"),
		];

		const claim = createMockClaim({
			sut: "primary-sut",
			baseline: "missing-baseline",
		});

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.status).toBe("inconclusive");
		expect(evaluation.inconclusiveReason).toContain("Baseline SUT not found");
	});

	it("should return 'inconclusive' when metric not found", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", undefined, {
				"other-metric": createMockSummaryStats([100, 110, 105]),
			}),
			createMockAggregate("baseline-sut", "baseline", undefined, {
				"other-metric": createMockSummaryStats([120, 130, 125]),
			}),
		];

		const claim = createMockClaim({
			sut: "primary-sut",
			baseline: "baseline-sut",
			metric: "missing-metric",
		});

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.status).toBe("inconclusive");
	});

	it("should handle threshold comparisons (direction: greater)", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", undefined, {
				"path-diversity": createMockSummaryStats([0.65, 0.65, 0.65]),
			}),
			createMockAggregate("baseline-sut", "baseline", undefined, {
				"path-diversity": createMockSummaryStats([0.6, 0.6, 0.6]),
			}),
		];

		// Delta is 0.05, threshold is 0.1
		const claimWithThreshold = createMockClaim({
			sut: "primary-sut",
			baseline: "baseline-sut",
			metric: "path-diversity",
			direction: "greater",
			threshold: 0.1, // Requires delta >= 0.1
		});

		const evaluation = evaluateClaim(claimWithThreshold, aggregates);

		expect(evaluation.status).toBe("violated"); // Delta (0.05) < threshold (0.1)
	});

	it("should handle threshold comparisons (direction: less)", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", undefined, {
				"execution-time": createMockSummaryStats([90, 90, 90]),
			}),
			createMockAggregate("baseline-sut", "baseline", undefined, {
				"execution-time": createMockSummaryStats([100, 100, 100]),
			}),
		];

		// Delta is -10, threshold is 20
		const claim = createMockClaim({
			sut: "primary-sut",
			baseline: "baseline-sut",
			metric: "execution-time",
			direction: "less",
			threshold: 20, // Requires delta <= -20
		});

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.status).toBe("violated"); // Delta (-10) > -threshold (-20)
	});

	it("should compute evidence (delta, ratio)", () => {
		const aggregates = createMockAggregates();

		const claim = createMockClaim({
			sut: "degree-prioritised-v1.0.0",
			baseline: "standard-bfs-v1.0.0",
			metric: "execution-time",
			direction: "less",
		});

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.evidence.primaryValue).toBeDefined();
		expect(evaluation.evidence.baselineValue).toBeDefined();
		expect(evaluation.evidence.delta).toBeDefined();
		expect(evaluation.evidence.ratio).toBeDefined();
		expect(evaluation.evidence.n).toBeDefined();
	});

	it("should respect scope constraints (caseClass)", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", "scale-free", {
				"execution-time": createMockSummaryStats([80, 85, 82]),
			}),
			createMockAggregate("primary-sut", "primary", "random", {
				"execution-time": createMockSummaryStats([150, 155, 152]), // Different behavior
			}),
			createMockAggregate("baseline-sut", "baseline", "scale-free", {
				"execution-time": createMockSummaryStats([120, 125, 122]),
			}),
		];

		const claim = createMockClaim({
			sut: "primary-sut",
			baseline: "baseline-sut",
			metric: "execution-time",
			direction: "less",
			scope: "caseClass",
			scopeConstraints: { caseClass: "scale-free" },
		});

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.status).toBe("satisfied");
	});

	it("should handle direction: equal", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", undefined, {
				"metric": createMockSummaryStats([100, 100, 100]),
			}),
			createMockAggregate("baseline-sut", "baseline", undefined, {
				"metric": createMockSummaryStats([100.0005, 100.0005, 100.0005]),
			}),
		];

		const claim: EvaluationClaim = {
			claimId: "C-EQUAL",
			description: "Values should be equal",
			sut: "primary-sut",
			baseline: "baseline-sut",
			metric: "metric",
			direction: "equal",
			scope: "global",
			threshold: 0.001, // epsilon for equality
		};

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.status).toBe("satisfied");
	});

	it("should return inconclusive when p-value exceeds significance level", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", undefined, {
				"metric": createMockSummaryStats([100, 105, 102]),
			}),
			createMockAggregate("baseline-sut", "baseline", undefined, {
				"metric": createMockSummaryStats([95, 100, 97]),
			}),
		];

		// Add comparisons with high p-value
		aggregates[0].comparisons = {
			"baseline-sut": {
				deltas: { metric: 5 },
				ratios: { metric: 1.05 },
				pValue: 0.15, // > 0.05
			},
		};

		const claim = createMockClaim({
			sut: "primary-sut",
			baseline: "baseline-sut",
			metric: "metric",
			direction: "greater",
			significanceLevel: 0.05,
		});

		const evaluation = evaluateClaim(claim, aggregates);

		expect(evaluation.status).toBe("inconclusive");
	});
});

describe("evaluateClaims", () => {
	it("should evaluate multiple claims", () => {
		const aggregates = createMockAggregates();

		const claims = [
			createMockClaim({
				claimId: "C001",
				sut: "degree-prioritised-v1.0.0",
				baseline: "standard-bfs-v1.0.0",
				metric: "execution-time",
				direction: "less",
			}),
			createMockClaim({
				claimId: "C002",
				sut: "degree-prioritised-v1.0.0",
				baseline: "frontier-balanced-v1.0.0",
				metric: "execution-time",
				direction: "less",
			}),
		];

		const evaluations = evaluateClaims(claims, aggregates);

		expect(evaluations).toHaveLength(2);
		expect(evaluations[0].claim.claimId).toBe("C001");
		expect(evaluations[1].claim.claimId).toBe("C002");
	});

	it("should handle empty claims array", () => {
		const aggregates = createMockAggregates();
		const evaluations = evaluateClaims([], aggregates);

		expect(evaluations).toHaveLength(0);
	});
});

describe("createClaimSummary", () => {
	it("should return summary with counts", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", undefined, {
				"metric-a": createMockSummaryStats([100, 105, 102]),
				"metric-b": createMockSummaryStats([50, 55, 52]),
			}),
			createMockAggregate("baseline-sut", "baseline", undefined, {
				"metric-a": createMockSummaryStats([80, 85, 82]),
				"metric-b": createMockSummaryStats([60, 65, 62]),
			}),
		];

		const claims = [
			createMockClaim({
				claimId: "C001",
				sut: "primary-sut",
				baseline: "baseline-sut",
				metric: "metric-a",
				direction: "greater", // satisfied: primary > baseline
			}),
			createMockClaim({
				claimId: "C002",
				sut: "primary-sut",
				baseline: "baseline-sut",
				metric: "metric-b",
				direction: "greater", // violated: primary < baseline
			}),
		];

		const evaluations = evaluateClaims(claims, aggregates);
		const summary = createClaimSummary(evaluations);

		expect(summary.version).toBe("1.0.0");
		expect(summary.timestamp).toBeDefined();
		expect(summary.evaluations).toHaveLength(2);
		expect(summary.summary.total).toBe(2);
		expect(summary.summary.satisfied).toBe(1);
		expect(summary.summary.violated).toBe(1);
		expect(summary.summary.inconclusive).toBe(0);
	});

	it("should compute satisfaction rate", () => {
		const aggregates = [
			createMockAggregate("primary-sut", "primary", undefined, {
				"metric": createMockSummaryStats([100, 105, 102]),
			}),
			createMockAggregate("baseline-sut", "baseline", undefined, {
				"metric": createMockSummaryStats([80, 85, 82]),
			}),
		];

		const claims = [
			createMockClaim({
				claimId: "C001",
				sut: "primary-sut",
				baseline: "baseline-sut",
				metric: "metric",
				direction: "greater",
			}),
			createMockClaim({
				claimId: "C002",
				sut: "primary-sut",
				baseline: "baseline-sut",
				metric: "metric",
				direction: "greater",
			}),
		];

		const evaluations = evaluateClaims(claims, aggregates);
		const summary = createClaimSummary(evaluations);

		expect(summary.summary.satisfactionRate).toBe(1); // 2/2 = 100%
	});

	it("should handle all inconclusive", () => {
		const aggregates = createMockAggregates();

		const claims = [
			createMockClaim({
				claimId: "C001",
				sut: "missing-sut",
				baseline: "baseline-sut",
				metric: "metric",
			}),
		];

		const evaluations = evaluateClaims(claims, aggregates);
		const summary = createClaimSummary(evaluations);

		expect(summary.summary.inconclusive).toBe(1);
		expect(summary.summary.satisfactionRate).toBe(0); // No definitive results
	});

	it("should handle empty evaluations", () => {
		const summary = createClaimSummary([]);

		expect(summary.summary.total).toBe(0);
		expect(summary.summary.satisfied).toBe(0);
		expect(summary.summary.violated).toBe(0);
		expect(summary.summary.inconclusive).toBe(0);
		expect(summary.summary.satisfactionRate).toBe(0);
	});
});

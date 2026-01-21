/**
 * Integration tests for Framework Pipeline
 *
 * Tests the complete flow: Results → Aggregate → Evaluate Claims → Render
 */

import { describe, expect, it } from "vitest";

import { aggregateResults } from "../aggregation/pipeline.js";
import { createClaimSummary, evaluateClaims } from "../claims/evaluator.js";
import { ResultCollector } from "../collector/result-collector.js";
import { LaTeXRenderer } from "../renderers/latex-renderer.js";
import type { TableRenderSpec } from "../renderers/types.js";
import type { EvaluationClaim } from "../types/claims.js";
import type { EvaluationResult } from "../types/result.js";
import {
	createMockResult,
} from "./test-helpers.js";

describe("Framework Pipeline Integration", () => {
	/**
	 * Create a realistic set of evaluation results for testing
	 */
	const createTestResults = (): EvaluationResult[] => {
		const results: EvaluationResult[] = [];

		// Degree-Prioritised (primary) - faster, better hub avoidance
		for (let index = 0; index < 10; index++) {
			results.push(
				createMockResult({
					run: {
						runId: `dp-run-${index}`,
						sut: "degree-prioritised-v1.0.0",
						sutRole: "primary",
						caseId: `case-${index}`,
						caseClass: "scale-free",
					},
					correctness: {
						expectedExists: true,
						producedOutput: true,
						valid: true,
						matchesExpected: true,
					},
					metrics: {
						numeric: {
							"execution-time": 80 + Math.random() * 20,
							"nodes-expanded": 40 + Math.random() * 10,
							"hub-traversal": 5 + Math.random() * 5,
							"path-diversity": 0.75 + Math.random() * 0.15,
						},
					},
				})
			);
		}

		// Standard BFS (baseline) - slower, more hub visits
		for (let index = 0; index < 10; index++) {
			results.push(
				createMockResult({
					run: {
						runId: `bfs-run-${index}`,
						sut: "standard-bfs-v1.0.0",
						sutRole: "baseline",
						caseId: `case-${index}`,
						caseClass: "scale-free",
					},
					correctness: {
						expectedExists: true,
						producedOutput: true,
						valid: true,
						matchesExpected: true,
					},
					metrics: {
						numeric: {
							"execution-time": 120 + Math.random() * 30,
							"nodes-expanded": 70 + Math.random() * 20,
							"hub-traversal": 20 + Math.random() * 10,
							"path-diversity": 0.6 + Math.random() * 0.15,
						},
					},
				})
			);
		}

		// Frontier-Balanced (baseline) - between the two
		for (let index = 0; index < 10; index++) {
			results.push(
				createMockResult({
					run: {
						runId: `fb-run-${index}`,
						sut: "frontier-balanced-v1.0.0",
						sutRole: "baseline",
						caseId: `case-${index}`,
						caseClass: "scale-free",
					},
					correctness: {
						expectedExists: true,
						producedOutput: true,
						valid: true,
						matchesExpected: true,
					},
					metrics: {
						numeric: {
							"execution-time": 100 + Math.random() * 25,
							"nodes-expanded": 55 + Math.random() * 15,
							"hub-traversal": 12 + Math.random() * 8,
							"path-diversity": 0.65 + Math.random() * 0.15,
						},
					},
				})
			);
		}

		return results;
	};

	it("should flow: results → aggregate → evaluate claims → render", () => {
		// Step 1: Collect results
		const collector = new ResultCollector();
		const results = createTestResults();
		collector.recordBatch(results);

		expect(collector.count).toBe(30);
		expect(collector.getUniqueSuts()).toHaveLength(3);

		// Step 2: Aggregate
		const aggregates = aggregateResults(collector.getAll());

		expect(aggregates.length).toBeGreaterThan(0);

		// Find primary aggregate
		const dpAggregate = aggregates.find((a) => a.sut === "degree-prioritised-v1.0.0");
		expect(dpAggregate).toBeDefined();
		expect(dpAggregate?.metrics["execution-time"]).toBeDefined();
		expect(dpAggregate?.group.runCount).toBe(10);

		// Step 3: Define and evaluate claims
		const claims: EvaluationClaim[] = [
			{
				claimId: "C1",
				description: "DP is faster than BFS",
				sut: "degree-prioritised-v1.0.0",
				baseline: "standard-bfs-v1.0.0",
				metric: "execution-time",
				direction: "less",
				scope: "global",
			},
			{
				claimId: "C2",
				description: "DP visits fewer hubs than BFS",
				sut: "degree-prioritised-v1.0.0",
				baseline: "standard-bfs-v1.0.0",
				metric: "hub-traversal",
				direction: "less",
				scope: "global",
			},
			{
				claimId: "C3",
				description: "DP has higher path diversity than BFS",
				sut: "degree-prioritised-v1.0.0",
				baseline: "standard-bfs-v1.0.0",
				metric: "path-diversity",
				direction: "greater",
				scope: "global",
			},
		];

		const evaluations = evaluateClaims(claims, aggregates);

		expect(evaluations).toHaveLength(3);
		expect(evaluations.every((e) => e.status === "satisfied" || e.status === "violated" || e.status === "inconclusive")).toBe(true);

		// Step 4: Create summary
		const summary = createClaimSummary(evaluations);

		expect(summary.summary.total).toBe(3);
		expect(summary.summary.satisfied + summary.summary.violated + summary.summary.inconclusive).toBe(3);

		// Step 5: Render
		const renderer = new LaTeXRenderer();

		const tableSpec: TableRenderSpec = {
			id: "performance-comparison",
			filename: "06-performance-comparison.tex",
			label: "tab:performance-comparison",
			caption: "Performance comparison across methods",
			columns: [
				{ key: "method", header: "Method", align: "l" },
				{ key: "execTime", header: "Time (ms)", align: "r" },
				{ key: "nodesExpanded", header: "Nodes", align: "r" },
			],
			extractData: (aggs) =>
				aggs.map((a) => ({
					method: a.sut.replace("-v1.0.0", ""),
					execTime: a.metrics["execution-time"]?.mean.toFixed(1),
					nodesExpanded: a.metrics["nodes-expanded"]?.mean.toFixed(0),
				})),
		};

		const tableOutput = renderer.renderTable(aggregates, tableSpec);
		const claimOutput = renderer.renderClaimSummary(evaluations);

		expect(tableOutput.content).toContain(String.raw`\begin{table}`);
		expect(tableOutput.content).toContain("Performance comparison");
		expect(claimOutput.content).toContain("Claim");
		expect(claimOutput.content).toContain("Status");
	});

	it("should handle the complete pipeline with real-world-like data", () => {
		// Create results with deterministic values for predictable testing
		const results: EvaluationResult[] = [];

		// Primary: consistently better
		for (let index = 0; index < 5; index++) {
			results.push(
				createMockResult({
					run: {
						runId: `primary-${index}`,
						sut: "primary-algorithm",
						sutRole: "primary",
						caseId: `case-${index}`,
					},
					metrics: {
						numeric: {
							"execution-time": 50,
							"quality-score": 0.9,
						},
					},
				})
			);
		}

		// Baseline: consistently worse
		for (let index = 0; index < 5; index++) {
			results.push(
				createMockResult({
					run: {
						runId: `baseline-${index}`,
						sut: "baseline-algorithm",
						sutRole: "baseline",
						caseId: `case-${index}`,
					},
					metrics: {
						numeric: {
							"execution-time": 100,
							"quality-score": 0.7,
						},
					},
				})
			);
		}

		// Aggregate
		const aggregates = aggregateResults(results, { groupByCaseClass: false });

		const primaryAgg = aggregates.find((a) => a.sut === "primary-algorithm");
		const baselineAgg = aggregates.find((a) => a.sut === "baseline-algorithm");

		expect(primaryAgg?.metrics["execution-time"].mean).toBe(50);
		expect(baselineAgg?.metrics["execution-time"].mean).toBe(100);

		// Evaluate claims
		const claims: EvaluationClaim[] = [
			{
				claimId: "SPEED",
				description: "Primary is faster",
				sut: "primary-algorithm",
				baseline: "baseline-algorithm",
				metric: "execution-time",
				direction: "less",
				scope: "global",
			},
			{
				claimId: "QUALITY",
				description: "Primary has higher quality",
				sut: "primary-algorithm",
				baseline: "baseline-algorithm",
				metric: "quality-score",
				direction: "greater",
				scope: "global",
			},
		];

		const evaluations = evaluateClaims(claims, aggregates);

		// Both claims should be satisfied
		expect(evaluations.find((e) => e.claim.claimId === "SPEED")?.status).toBe("satisfied");
		expect(evaluations.find((e) => e.claim.claimId === "QUALITY")?.status).toBe("satisfied");

		// Evidence should show correct values
		const speedEvidence = evaluations.find((e) => e.claim.claimId === "SPEED")?.evidence;
		expect(speedEvidence?.primaryValue).toBe(50);
		expect(speedEvidence?.baselineValue).toBe(100);
		expect(speedEvidence?.delta).toBe(-50); // 50 - 100 = -50
	});

	it("should properly serialize and deserialize through ResultCollector", () => {
		const collector = new ResultCollector();
		const results = createTestResults();

		// Record results
		collector.recordBatch(results);

		// Serialize
		const batch = collector.serialize({ experimentName: "test-exp" });

		expect(batch.version).toBe("1.0.0");
		expect(batch.results).toHaveLength(30);
		expect(batch.metadata?.experimentName).toBe("test-exp");

		// Load into new collector
		const newCollector = new ResultCollector();
		newCollector.load(batch);

		expect(newCollector.count).toBe(30);
		expect(newCollector.getUniqueSuts()).toHaveLength(3);

		// Verify aggregation works on loaded data
		const aggregates = aggregateResults(newCollector.getAll());
		expect(aggregates.length).toBeGreaterThan(0);
	});

	it("should generate multiple tables from same aggregates", () => {
		const results = createTestResults();
		const aggregates = aggregateResults(results);
		const renderer = new LaTeXRenderer();

		const specs: TableRenderSpec[] = [
			{
				id: "runtime",
				filename: "runtime.tex",
				label: "tab:runtime",
				caption: "Runtime comparison",
				columns: [
					{ key: "method", header: "Method", align: "l" },
					{ key: "time", header: "Time (ms)", align: "r" },
				],
				extractData: (aggs) =>
					aggs.map((a) => ({
						method: a.sut,
						time: a.metrics["execution-time"]?.mean.toFixed(1),
					})),
			},
			{
				id: "quality",
				filename: "quality.tex",
				label: "tab:quality",
				caption: "Quality metrics",
				columns: [
					{ key: "method", header: "Method", align: "l" },
					{ key: "diversity", header: "Diversity", align: "r" },
				],
				extractData: (aggs) =>
					aggs.map((a) => ({
						method: a.sut,
						diversity: a.metrics["path-diversity"]?.mean.toFixed(3),
					})),
			},
		];

		const outputs = renderer.renderAll(aggregates, specs);

		expect(outputs).toHaveLength(2);
		expect(outputs[0].id).toBe("runtime");
		expect(outputs[1].id).toBe("quality");
		expect(outputs[0].content).toContain("Runtime comparison");
		expect(outputs[1].content).toContain("Quality metrics");
	});

	it("should handle claims with scope constraints", () => {
		// Create results with different case classes
		const results: EvaluationResult[] = [];

		// Scale-free: primary is better
		for (let index = 0; index < 5; index++) {
			results.push(
				createMockResult({
					run: {
						runId: `dp-sf-${index}`,
						sut: "degree-prioritised-v1.0.0",
						sutRole: "primary",
						caseId: `sf-case-${index}`,
						caseClass: "scale-free",
					},
					metrics: { numeric: { "execution-time": 50 } },
				})
			);
			results.push(
				createMockResult({
					run: {
						runId: `bfs-sf-${index}`,
						sut: "standard-bfs-v1.0.0",
						sutRole: "baseline",
						caseId: `sf-case-${index}`,
						caseClass: "scale-free",
					},
					metrics: { numeric: { "execution-time": 100 } },
				})
			);
		}

		// Random: baseline is better (hypothetically)
		for (let index = 0; index < 5; index++) {
			results.push(
				createMockResult({
					run: {
						runId: `dp-rand-${index}`,
						sut: "degree-prioritised-v1.0.0",
						sutRole: "primary",
						caseId: `rand-case-${index}`,
						caseClass: "random",
					},
					metrics: { numeric: { "execution-time": 100 } },
				})
			);
			results.push(
				createMockResult({
					run: {
						runId: `bfs-rand-${index}`,
						sut: "standard-bfs-v1.0.0",
						sutRole: "baseline",
						caseId: `rand-case-${index}`,
						caseClass: "random",
					},
					metrics: { numeric: { "execution-time": 100 } },
				})
			);
		}

		const aggregates = aggregateResults(results);

		// Claim scoped to scale-free should be satisfied
		const scopedClaim: EvaluationClaim = {
			claimId: "SF-SPEED",
			description: "DP is faster on scale-free graphs",
			sut: "degree-prioritised-v1.0.0",
			baseline: "standard-bfs-v1.0.0",
			metric: "execution-time",
			direction: "less",
			scope: "caseClass",
			scopeConstraints: { caseClass: "scale-free" },
		};

		const evaluations = evaluateClaims([scopedClaim], aggregates);

		expect(evaluations[0].status).toBe("satisfied");
	});

	it("should detect violated claims correctly", () => {
		// Create results where the claim will be violated
		const results: EvaluationResult[] = [];

		// Primary is SLOWER than baseline (claim violation)
		for (let index = 0; index < 5; index++) {
			results.push(
				createMockResult({
					run: {
						runId: `primary-${index}`,
						sut: "primary-algorithm",
						sutRole: "primary",
						caseId: `case-${index}`,
					},
					metrics: { numeric: { "execution-time": 150 } },
				})
			);
			results.push(
				createMockResult({
					run: {
						runId: `baseline-${index}`,
						sut: "baseline-algorithm",
						sutRole: "baseline",
						caseId: `case-${index}`,
					},
					metrics: { numeric: { "execution-time": 100 } },
				})
			);
		}

		const aggregates = aggregateResults(results, { groupByCaseClass: false });

		const claim: EvaluationClaim = {
			claimId: "VIOLATED",
			description: "Primary should be faster (but isn't)",
			sut: "primary-algorithm",
			baseline: "baseline-algorithm",
			metric: "execution-time",
			direction: "less",
			scope: "global",
		};

		const evaluations = evaluateClaims([claim], aggregates);

		expect(evaluations[0].status).toBe("violated");
		expect(evaluations[0].evidence.delta).toBeGreaterThan(0); // 150 - 100 = 50
	});
});

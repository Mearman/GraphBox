/**
 * Unit tests for experiment runner infrastructure
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import type { Edge, Node } from "../../../algorithms/types/graph";
import type { ExperimentConfig, PathRanker } from "./experiment-config";
import { runCrossValidation, runExperiment } from "./experiment-runner";

interface TestNode extends Node {
	id: string;
	type: string;
}

interface TestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: string;
	weight?: number;
}

const createTestGraph = (): Graph<TestNode, TestEdge> => {
	const graph = new Graph<TestNode, TestEdge>(false);

	for (let index = 0; index < 10; index++) {
		graph.addNode({ id: `n${index}`, type: "test" });
	}

	// Add some edges
	for (let index = 0; index < 9; index++) {
		graph.addEdge({ id: `e${index}`, source: `n${index}`, target: `n${index + 1}`, type: "test" });
	}

	return graph;
};

const createMockRanker = (scoreMultiplier: number = 1): PathRanker<TestNode, TestEdge> => {
	return (_graph, paths) => {
		return paths.map((path, index) => ({
			path,
			score: (1 - index / paths.length) * scoreMultiplier,
		}));
	};
};

const createBaseConfig = (): ExperimentConfig<TestNode, TestEdge> => ({
	name: "Test Experiment",
	repetitions: 3,
	pathPlanting: {
		numPaths: 3,
		pathLength: { min: 2, max: 3 },
		signalStrength: "medium",
		allowOverlap: false,
		seed: 42,
	},
	methods: [
		{ name: "Method A", ranker: createMockRanker(1) },
		{ name: "Method B", ranker: createMockRanker(0.5) },
	],
	metrics: ["spearman", "kendall"],
	statisticalTests: ["paired-t"],
	seed: 42,
});

describe("runExperiment", () => {
	it("returns experiment report with correct structure", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();

		const report = await runExperiment(config, graph);

		expect(report).toBeDefined();
		expect(report.name).toBe("Test Experiment");
		expect(report.graphSpec).toBe("custom");
		expect(report.methods).toBeDefined();
		expect(report.statisticalTests).toBeDefined();
		expect(report.winner).toBeDefined();
		expect(report.timestamp).toBeDefined();
		expect(report.duration).toBeGreaterThanOrEqual(0);
	});

	it("includes results for all configured methods", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();

		const report = await runExperiment(config, graph);

		expect(report.methods).toHaveLength(2);
		expect(report.methods.map(m => m.method)).toContain("Method A");
		expect(report.methods.map(m => m.method)).toContain("Method B");
	});

	it("computes requested metrics", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.metrics = ["spearman", "kendall", "ndcg"];

		const report = await runExperiment(config, graph);

		for (const method of report.methods) {
			expect("spearman" in method.results).toBe(true);
			expect("kendall" in method.results).toBe(true);
			expect("ndcg" in method.results).toBe(true);
		}
	});

	it("runs statistical tests when configured", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.statisticalTests = ["paired-t", "wilcoxon"];

		const report = await runExperiment(config, graph);

		// Should have tests comparing methods
		expect(report.statisticalTests.length).toBeGreaterThan(0);

		for (const test of report.statisticalTests) {
			expect(test.type).toBeDefined();
			expect(test.comparison).toBeDefined();
			expect(test.pValue).toBeDefined();
			expect(test.significant).toBeDefined();
		}
	});

	it("determines a winner", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();

		const report = await runExperiment(config, graph);

		expect(report.winner).toBeDefined();
		expect(["Method A", "Method B"]).toContain(report.winner);
	});

	it("handles single method without statistical tests", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.methods = [{ name: "Only Method", ranker: createMockRanker() }];

		const report = await runExperiment(config, graph);

		expect(report.methods).toHaveLength(1);
		expect(report.winner).toBe("Only Method");
		// No comparisons possible with single method
		expect(report.statisticalTests).toHaveLength(0);
	});

	it("handles no statistical tests configured", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.statisticalTests = [];

		const report = await runExperiment(config, graph);

		expect(report.statisticalTests).toHaveLength(0);
	});

	it("uses custom alpha for significance", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.alpha = 0.01; // Stricter significance level

		const report = await runExperiment(config, graph);

		// Should complete without error
		expect(report).toBeDefined();
	});

	it("records accurate duration", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.repetitions = 5;

		const startTime = Date.now();
		const report = await runExperiment(config, graph);
		const endTime = Date.now();

		expect(report.duration).toBeLessThanOrEqual(endTime - startTime + 10); // Allow small margin
	});

	it("records timestamp in ISO format", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();

		const report = await runExperiment(config, graph);

		// Should be valid ISO date string
		expect(() => new Date(report.timestamp)).not.toThrow();
		expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	describe("metrics computation", () => {
		it("computes spearman correlation", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.metrics = ["spearman"];

			const report = await runExperiment(config, graph);

			for (const method of report.methods) {
				expect(typeof method.results["spearman"]).toBe("number");
				expect(method.results["spearman"]).toBeGreaterThanOrEqual(-1);
				expect(method.results["spearman"]).toBeLessThanOrEqual(1);
			}
		});

		it("computes kendall tau", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.metrics = ["kendall"];

			const report = await runExperiment(config, graph);

			for (const method of report.methods) {
				expect(typeof method.results["kendall"]).toBe("number");
				expect(method.results["kendall"]).toBeGreaterThanOrEqual(-1);
				expect(method.results["kendall"]).toBeLessThanOrEqual(1);
			}
		});

		it("computes NDCG", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.metrics = ["ndcg"];

			const report = await runExperiment(config, graph);

			for (const method of report.methods) {
				expect(typeof method.results["ndcg"]).toBe("number");
				expect(method.results["ndcg"]).toBeGreaterThanOrEqual(0);
				expect(method.results["ndcg"]).toBeLessThanOrEqual(1);
			}
		});

		it("computes MAP", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.metrics = ["map"];

			const report = await runExperiment(config, graph);

			for (const method of report.methods) {
				expect(typeof method.results["map"]).toBe("number");
				expect(method.results["map"]).toBeGreaterThanOrEqual(0);
			}
		});

		it("computes MRR", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.metrics = ["mrr"];

			const report = await runExperiment(config, graph);

			for (const method of report.methods) {
				expect(typeof method.results["mrr"]).toBe("number");
				expect(method.results["mrr"]).toBeGreaterThanOrEqual(0);
				expect(method.results["mrr"]).toBeLessThanOrEqual(1);
			}
		});

		it("computes precision at K", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.metrics = ["precision"];

			const report = await runExperiment(config, graph);

			for (const method of report.methods) {
				// Should have precision_at_5 and precision_at_10
				expect("precision_at_5" in method.results || "precision_at_10" in method.results).toBe(true);
			}
		});

		it("computes recall at K", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.metrics = ["recall"];

			const report = await runExperiment(config, graph);

			for (const method of report.methods) {
				// Should have recall_at_5 and recall_at_10
				expect("recall_at_5" in method.results || "recall_at_10" in method.results).toBe(true);
			}
		});
	});

	describe("statistical tests", () => {
		it("runs paired t-test", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.statisticalTests = ["paired-t"];
			config.repetitions = 5;

			const report = await runExperiment(config, graph);

			const tTests = report.statisticalTests.filter(t => t.type === "paired-t");
			expect(tTests.length).toBeGreaterThan(0);

			for (const test of tTests) {
				expect(test.statistic).toBeDefined();
				expect(test.pValue).toBeGreaterThanOrEqual(0);
				expect(test.pValue).toBeLessThanOrEqual(1);
			}
		});

		it("runs Wilcoxon signed-rank test", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.statisticalTests = ["wilcoxon"];
			config.repetitions = 5;

			const report = await runExperiment(config, graph);

			const wilcoxonTests = report.statisticalTests.filter(t => t.type === "wilcoxon");
			expect(wilcoxonTests.length).toBeGreaterThan(0);

			for (const test of wilcoxonTests) {
				expect(test.statistic).toBeDefined();
				expect(test.pValue).toBeGreaterThanOrEqual(0);
			}
		});

		it("runs bootstrap difference test", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.statisticalTests = ["bootstrap"];
			config.repetitions = 5;

			const report = await runExperiment(config, graph);

			const bootstrapTests = report.statisticalTests.filter(t => t.type === "bootstrap");
			expect(bootstrapTests.length).toBeGreaterThan(0);

			for (const test of bootstrapTests) {
				expect(test.ci).toBeDefined();
				expect(test.pValue).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("repetitions", () => {
		it("runs configured number of repetitions", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.repetitions = 7;

			// The experiment should complete without error
			const report = await runExperiment(config, graph);

			expect(report).toBeDefined();
		});

		it("handles single repetition", async () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.repetitions = 1;
			// Single repetition cannot support paired statistical tests (require >= 2)
			config.statisticalTests = [];

			const report = await runExperiment(config, graph);

			expect(report.methods).toHaveLength(2);
		});
	});
});

describe("runCrossValidation", () => {
	it("returns fold results and aggregated results", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.repetitions = 2;

		const result = await runCrossValidation(config, graph, 3);

		expect(result.foldResults).toHaveLength(3);
		expect(result.aggregated).toBeDefined();
		expect(result.stdDev).toBeDefined();
	});

	it("runs experiment for each fold with different seed", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.repetitions = 2;

		const result = await runCrossValidation(config, graph, 3);

		// Each fold should have completed
		for (const foldResult of result.foldResults) {
			expect(foldResult.name).toBe(config.name);
			expect(foldResult.methods).toBeDefined();
		}
	});

	it("aggregates results across folds", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.repetitions = 2;

		const result = await runCrossValidation(config, graph, 3);

		// Aggregated should have same methods as individual folds
		expect(result.aggregated.methods).toHaveLength(config.methods.length);

		// Each method should have averaged results
		for (const method of result.aggregated.methods) {
			expect(method.results).toBeDefined();
		}
	});

	it("calculates standard deviation across folds", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.repetitions = 2;

		const result = await runCrossValidation(config, graph, 3);

		// stdDev should have same structure as aggregated
		expect(result.stdDev.methods).toHaveLength(config.methods.length);

		// Standard deviation values should be non-negative
		for (const method of result.stdDev.methods) {
			for (const value of Object.values(method.results)) {
				expect(value).toBeGreaterThanOrEqual(0);
			}
		}
	});

	it("defaults to 5 folds", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.repetitions = 1;
		// Single repetition cannot support paired statistical tests (require >= 2)
		config.statisticalTests = [];

		const result = await runCrossValidation(config, graph);

		expect(result.foldResults).toHaveLength(5);
	});

	it("handles 2-fold cross-validation", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.repetitions = 1;
		// Single repetition cannot support paired statistical tests (require >= 2)
		config.statisticalTests = [];

		const result = await runCrossValidation(config, graph, 2);

		expect(result.foldResults).toHaveLength(2);
	});

	it("preserves experiment name in all results", async () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.name = "CV Experiment";
		config.repetitions = 1;
		// Single repetition cannot support paired statistical tests (require >= 2)
		config.statisticalTests = [];

		const result = await runCrossValidation(config, graph, 3);

		expect(result.aggregated.name).toBe("CV Experiment");
		expect(result.stdDev.name).toBe("CV Experiment");

		for (const fold of result.foldResults) {
			expect(fold.name).toBe("CV Experiment");
		}
	});
});

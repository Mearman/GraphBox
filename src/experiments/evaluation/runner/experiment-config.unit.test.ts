/**
 * Unit tests for experiment configuration types
 *
 * This module primarily exports types, so tests focus on:
 * - Type compatibility
 * - Valid configuration structures
 * - Default value handling
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import type { Path } from "../../../algorithms/types/algorithm-results";
import type { Edge, Node } from "../../../algorithms/types/graph";
import type {
	ExperimentConfig,
	FullExperimentConfig,
	GraphSpec,
	MethodConfig,
	MetricType,
	PathRanker,
	StatisticalTestType,
} from "./experiment-config";

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

describe("PathRanker type", () => {
	it("accepts valid path ranker function", () => {
		const ranker: PathRanker<TestNode, TestEdge> = (graph, paths) => {
			return paths.map((path, index) => ({
				path,
				score: 1 / (index + 1),
			}));
		};

		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode({ id: "n1", type: "test" });

		const paths: Path<TestNode, TestEdge>[] = [
			{ nodes: [{ id: "n1", type: "test" }], edges: [], totalWeight: 0 },
		];

		const result = ranker(graph, paths);

		expect(result).toHaveLength(1);
		expect(result[0].score).toBe(1);
		expect(result[0].path).toBe(paths[0]);
	});

	it("can return paths in different order", () => {
		const ranker: PathRanker<TestNode, TestEdge> = (_graph, paths) => {
			return [...paths]
				.reverse()
				.map((path, index) => ({ path, score: index }));
		};

		const graph = new Graph<TestNode, TestEdge>(false);
		const paths: Path<TestNode, TestEdge>[] = [
			{ nodes: [{ id: "a", type: "test" }], edges: [], totalWeight: 0 },
			{ nodes: [{ id: "b", type: "test" }], edges: [], totalWeight: 0 },
		];

		const result = ranker(graph, paths);

		expect(result[0].path.nodes[0].id).toBe("b");
		expect(result[1].path.nodes[0].id).toBe("a");
	});

	it("can use graph information for scoring", () => {
		const ranker: PathRanker<TestNode, TestEdge> = (graph, paths) => {
			const nodeCount = graph.getAllNodes().length;
			return paths.map((path) => ({
				path,
				score: path.nodes.length / nodeCount,
			}));
		};

		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode({ id: "n1", type: "test" });
		graph.addNode({ id: "n2", type: "test" });

		const paths: Path<TestNode, TestEdge>[] = [
			{ nodes: [{ id: "n1", type: "test" }, { id: "n2", type: "test" }], edges: [], totalWeight: 0 },
		];

		const result = ranker(graph, paths);

		expect(result[0].score).toBe(1); // 2 nodes / 2 total nodes
	});
});

describe("MetricType", () => {
	it("includes all expected metric types", () => {
		const metrics: MetricType[] = [
			"spearman",
			"kendall",
			"ndcg",
			"map",
			"mrr",
			"precision",
			"recall",
		];

		// TypeScript will error if any invalid metric is included
		expect(metrics).toHaveLength(7);
	});
});

describe("StatisticalTestType", () => {
	it("includes all expected test types", () => {
		const tests: StatisticalTestType[] = [
			"paired-t",
			"wilcoxon",
			"bootstrap",
		];

		expect(tests).toHaveLength(3);
	});
});

describe("MethodConfig", () => {
	it("accepts minimal method configuration", () => {
		const simpleRanker: PathRanker<TestNode, TestEdge> = (_g, paths) =>
			paths.map(p => ({ path: p, score: 0 }));

		const config: MethodConfig<TestNode, TestEdge> = {
			name: "Simple Ranker",
			ranker: simpleRanker,
		};

		expect(config.name).toBe("Simple Ranker");
		expect(config.ranker).toBeDefined();
		expect(config.params).toBeUndefined();
	});

	it("accepts method configuration with params", () => {
		const parameterRanker: PathRanker<TestNode, TestEdge> = (_g, paths) =>
			paths.map(p => ({ path: p, score: 0 }));

		const config: MethodConfig<TestNode, TestEdge> = {
			name: "Param Ranker",
			ranker: parameterRanker,
			params: {
				threshold: 0.5,
				maxIterations: 100,
				useCache: true,
			},
		};

		expect(config.params?.threshold).toBe(0.5);
		expect(config.params?.maxIterations).toBe(100);
		expect(config.params?.useCache).toBe(true);
	});
});

describe("ExperimentConfig", () => {
	it("accepts minimal experiment configuration", () => {
		const ranker: PathRanker<TestNode, TestEdge> = (_g, paths) =>
			paths.map(p => ({ path: p, score: 0 }));

		const config: ExperimentConfig<TestNode, TestEdge> = {
			name: "Test Experiment",
			repetitions: 10,
			pathPlanting: {
				numPaths: 5,
				pathLength: { min: 2, max: 4 },
				signalStrength: "medium",
				allowOverlap: false,
			},
			methods: [
				{ name: "Method A", ranker },
			],
			metrics: ["spearman", "ndcg"],
			statisticalTests: ["paired-t"],
			seed: 42,
		};

		expect(config.name).toBe("Test Experiment");
		expect(config.repetitions).toBe(10);
		expect(config.methods).toHaveLength(1);
		expect(config.metrics).toContain("spearman");
		expect(config.seed).toBe(42);
	});

	it("accepts full experiment configuration with all optional fields", () => {
		const ranker: PathRanker<TestNode, TestEdge> = (_g, paths) =>
			paths.map(p => ({ path: p, score: 0 }));

		const config: ExperimentConfig<TestNode, TestEdge> = {
			name: "Full Experiment",
			description: "Testing all configuration options",
			repetitions: 100,
			pathPlanting: {
				numPaths: 10,
				pathLength: { min: 3, max: 6 },
				signalStrength: "strong",
				allowOverlap: true,
				seed: 123,
				sourceNodes: ["n1", "n2"],
				targetNodes: ["n5", "n6"],
			},
			methods: [
				{ name: "Method A", ranker, params: { version: 1 } },
				{ name: "Method B", ranker, params: { version: 2 } },
			],
			metrics: ["spearman", "kendall", "ndcg", "map", "mrr", "precision", "recall"],
			statisticalTests: ["paired-t", "wilcoxon", "bootstrap"],
			alpha: 0.01,
			nBootstrap: 20_000,
			seed: 42,
			crossValidationFolds: 5,
		};

		expect(config.description).toBe("Testing all configuration options");
		expect(config.alpha).toBe(0.01);
		expect(config.nBootstrap).toBe(20_000);
		expect(config.crossValidationFolds).toBe(5);
		expect(config.methods).toHaveLength(2);
		expect(config.metrics).toHaveLength(7);
		expect(config.statisticalTests).toHaveLength(3);
	});

	it("supports multiple signal strengths", () => {
		const ranker: PathRanker<TestNode, TestEdge> = (_g, paths) =>
			paths.map(p => ({ path: p, score: 0 }));

		const weakConfig: ExperimentConfig<TestNode, TestEdge> = {
			name: "Weak",
			repetitions: 1,
			pathPlanting: {
				numPaths: 1,
				pathLength: { min: 1, max: 1 },
				signalStrength: "weak",
				allowOverlap: false,
			},
			methods: [{ name: "M", ranker }],
			metrics: ["spearman"],
			statisticalTests: [],
			seed: 1,
		};

		const strongConfig: ExperimentConfig<TestNode, TestEdge> = {
			...weakConfig,
			name: "Strong",
			pathPlanting: { ...weakConfig.pathPlanting, signalStrength: "strong" },
		};

		expect(weakConfig.pathPlanting.signalStrength).toBe("weak");
		expect(strongConfig.pathPlanting.signalStrength).toBe("strong");
	});
});

describe("GraphSpec", () => {
	it("accepts minimal graph specification", () => {
		const spec: GraphSpec = {
			type: "random",
			nodeCount: 100,
		};

		expect(spec.type).toBe("random");
		expect(spec.nodeCount).toBe(100);
	});

	it("accepts full graph specification", () => {
		const spec: GraphSpec = {
			type: "community",
			nodeCount: 500,
			edgeProbability: 0.1,
			communities: 5,
			directed: true,
			weighted: true,
			seed: 42,
		};

		expect(spec.type).toBe("community");
		expect(spec.edgeProbability).toBe(0.1);
		expect(spec.communities).toBe(5);
		expect(spec.directed).toBe(true);
		expect(spec.weighted).toBe(true);
		expect(spec.seed).toBe(42);
	});

	it("supports various graph types", () => {
		const types = ["random", "community", "scale-free", "small-world", "citation"];

		for (const type of types) {
			const spec: GraphSpec = { type, nodeCount: 100 };
			expect(spec.type).toBe(type);
		}
	});
});

describe("FullExperimentConfig", () => {
	it("accepts minimal full experiment configuration", () => {
		const ranker: PathRanker<TestNode, TestEdge> = (_g, paths) =>
			paths.map(p => ({ path: p, score: 0 }));

		const config: FullExperimentConfig<TestNode, TestEdge> = {
			experiment: {
				name: "Full Test",
				repetitions: 10,
				pathPlanting: {
					numPaths: 5,
					pathLength: { min: 2, max: 4 },
					signalStrength: "medium",
					allowOverlap: false,
				},
				methods: [{ name: "M", ranker }],
				metrics: ["spearman"],
				statisticalTests: ["paired-t"],
				seed: 42,
			},
			graphSpecs: [
				{ type: "random", nodeCount: 100 },
			],
		};

		expect(config.experiment.name).toBe("Full Test");
		expect(config.graphSpecs).toHaveLength(1);
		expect(config.instancesPerSpec).toBeUndefined();
	});

	it("accepts full configuration with multiple graph specs", () => {
		const ranker: PathRanker<TestNode, TestEdge> = (_g, paths) =>
			paths.map(p => ({ path: p, score: 0 }));

		const config: FullExperimentConfig<TestNode, TestEdge> = {
			experiment: {
				name: "Multi-Graph Test",
				repetitions: 10,
				pathPlanting: {
					numPaths: 5,
					pathLength: { min: 2, max: 4 },
					signalStrength: "medium",
					allowOverlap: false,
				},
				methods: [{ name: "M", ranker }],
				metrics: ["spearman"],
				statisticalTests: ["paired-t"],
				seed: 42,
			},
			graphSpecs: [
				{ type: "random", nodeCount: 100, edgeProbability: 0.05 },
				{ type: "random", nodeCount: 100, edgeProbability: 0.1 },
				{ type: "community", nodeCount: 100, communities: 5 },
			],
			instancesPerSpec: 3,
		};

		expect(config.graphSpecs).toHaveLength(3);
		expect(config.instancesPerSpec).toBe(3);
	});
});

describe("configuration validation patterns", () => {
	it("allows zero repetitions (though not meaningful)", () => {
		const ranker: PathRanker<TestNode, TestEdge> = (_g, paths) =>
			paths.map(p => ({ path: p, score: 0 }));

		const config: ExperimentConfig<TestNode, TestEdge> = {
			name: "Zero Rep",
			repetitions: 0,
			pathPlanting: {
				numPaths: 1,
				pathLength: { min: 1, max: 1 },
				signalStrength: "medium",
				allowOverlap: false,
			},
			methods: [{ name: "M", ranker }],
			metrics: [],
			statisticalTests: [],
			seed: 0,
		};

		expect(config.repetitions).toBe(0);
	});

	it("allows empty methods array", () => {
		const config: ExperimentConfig<TestNode, TestEdge> = {
			name: "No Methods",
			repetitions: 1,
			pathPlanting: {
				numPaths: 1,
				pathLength: { min: 1, max: 1 },
				signalStrength: "medium",
				allowOverlap: false,
			},
			methods: [],
			metrics: [],
			statisticalTests: [],
			seed: 0,
		};

		expect(config.methods).toHaveLength(0);
	});

	it("allows empty metrics array", () => {
		const ranker: PathRanker<TestNode, TestEdge> = (_g, paths) =>
			paths.map(p => ({ path: p, score: 0 }));

		const config: ExperimentConfig<TestNode, TestEdge> = {
			name: "No Metrics",
			repetitions: 1,
			pathPlanting: {
				numPaths: 1,
				pathLength: { min: 1, max: 1 },
				signalStrength: "medium",
				allowOverlap: false,
			},
			methods: [{ name: "M", ranker }],
			metrics: [],
			statisticalTests: [],
			seed: 0,
		};

		expect(config.metrics).toHaveLength(0);
	});
});

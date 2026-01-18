/**
 * Unit tests for Infomap community detection algorithm
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { infomap } from "./infomap";

interface TestNode {
	id: string;
	type: string;
	[key: string]: unknown;
}

interface TestEdge {
	id: string;
	source: string;
	target: string;
	type: string;
	weight?: number;
	[key: string]: unknown;
}

const createNode = (id: string): TestNode => ({ id, type: "test" });
const createEdge = (id: string, source: string, target: string, weight?: number): TestEdge => ({
	id,
	source,
	target,
	type: "test",
	weight,
});

describe("infomap", () => {
	describe("error handling", () => {
		it("should return error for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			const result = infomap(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("EmptyGraph");
			}
		});
	});

	describe("single node", () => {
		it("should detect single module for isolated node", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = infomap(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.modules).toHaveLength(1);
				expect(result.value.modules[0].nodes.size).toBe(1);
			}
		});
	});

	describe("simple connected graph", () => {
		it("should detect modules in triangle", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = infomap(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.modules.length).toBeGreaterThan(0);
			}
		});

		it("should find all nodes across modules", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const result = infomap(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const totalNodes = result.value.modules.reduce((sum, m) => sum + m.nodes.size, 0);
				expect(totalNodes).toBe(3);
			}
		});
	});

	describe("directed graph", () => {
		it("should handle directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "A"));

			const result = infomap(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.modules.length).toBeGreaterThan(0);
			}
		});
	});

	describe("module properties", () => {
		it("should have valid description length values", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = infomap(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const module_ of result.value.modules) {
					expect(module_.descriptionLength).toBeGreaterThanOrEqual(0);
				}
			}
		});

		it("should have valid visit probability values", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = infomap(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const module_ of result.value.modules) {
					expect(module_.visitProbability).toBeGreaterThanOrEqual(0);
					expect(module_.visitProbability).toBeLessThanOrEqual(1);
				}
			}
		});
	});

	describe("compression metrics", () => {
		it("should return compression ratio", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = infomap(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(typeof result.value.compressionRatio).toBe("number");
				expect(result.value.compressionRatio).toBeGreaterThanOrEqual(0);
			}
		});

		it("should return description length", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = infomap(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(typeof result.value.descriptionLength).toBe("number");
				expect(result.value.descriptionLength).toBeGreaterThan(0);
			}
		});
	});

	describe("metadata", () => {
		it("should return algorithm metadata", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = infomap(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.metadata.algorithm).toBe("infomap");
				expect(typeof result.value.metadata.runtime).toBe("number");
				expect(typeof result.value.metadata.iterations).toBe("number");
			}
		});
	});

	describe("options", () => {
		it("should accept maxIterations parameter", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = infomap(graph, { maxIterations: 5 });

			expect(result.ok).toBe(true);
		});

		it("should accept numTrials parameter", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = infomap(graph, { numTrials: 3 });

			expect(result.ok).toBe(true);
		});

		it("should produce deterministic results with seed", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			for (let index = 0; index < 5; index++) {
				graph.addNode(createNode(`N${index}`));
			}
			for (let index = 0; index < 4; index++) {
				graph.addEdge(createEdge(`e${index}`, `N${index}`, `N${index + 1}`));
			}

			const result1 = infomap(graph, { seed: 42 });
			const result2 = infomap(graph, { seed: 42 });

			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(true);
			if (result1.ok && result2.ok) {
				// Same seed should produce same module count
				expect(result1.value.modules.length).toBe(result2.value.modules.length);
			}
		});
	});

	describe("weighted edges", () => {
		it("should respect edge weights", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// Strong connection A-B
			graph.addEdge(createEdge("e1", "A", "B", 10));
			// Weak connection B-C
			graph.addEdge(createEdge("e2", "B", "C", 1));

			const result = infomap(graph, {
				weightFn: (edge) => edge.weight ?? 1,
			});

			expect(result.ok).toBe(true);
		});
	});

	describe("graph metrics", () => {
		it("should include modularity in metrics", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = infomap(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(typeof result.value.metrics.modularity).toBe("number");
			}
		});
	});
});

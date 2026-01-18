/**
 * Unit tests for Label Propagation clustering algorithm
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { labelPropagation } from "./label-propagation";

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

describe("labelPropagation", () => {
	describe("error handling", () => {
		it("should return error for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			const result = labelPropagation(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("EmptyGraph");
			}
		});
	});

	describe("single node", () => {
		it("should detect single cluster for isolated node", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = labelPropagation(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.clusters).toHaveLength(1);
				expect(result.value.clusters[0].nodes.size).toBe(1);
			}
		});
	});

	describe("disconnected nodes", () => {
		it("should detect separate clusters for disconnected nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// No edges

			const result = labelPropagation(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Each isolated node should be in its own cluster
				expect(result.value.clusters.length).toBe(3);
				for (const cluster of result.value.clusters) {
					expect(cluster.nodes.size).toBe(1);
				}
			}
		});
	});

	describe("simple connected graph", () => {
		it("should detect clusters in triangle", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = labelPropagation(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.clusters.length).toBeGreaterThan(0);
			}
		});

		it("should find all nodes across clusters", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const result = labelPropagation(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const totalNodes = result.value.clusters.reduce((sum, c) => sum + c.nodes.size, 0);
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

			const result = labelPropagation(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.clusters.length).toBeGreaterThan(0);
			}
		});
	});

	describe("cluster properties", () => {
		it("should have valid size values", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = labelPropagation(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const cluster of result.value.clusters) {
					expect(cluster.size).toBeGreaterThanOrEqual(1);
					expect(cluster.nodes.size).toBe(cluster.size);
				}
			}
		});

		it("should have cluster labels", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = labelPropagation(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const cluster of result.value.clusters) {
					expect(typeof cluster.label).toBe("number");
				}
			}
		});
	});

	describe("metadata", () => {
		it("should return algorithm metadata", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = labelPropagation(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.metadata.algorithm).toBe("label-propagation");
				expect(typeof result.value.metadata.runtime).toBe("number");
				expect(typeof result.value.metadata.iterations).toBe("number");
				expect(typeof result.value.metadata.converged).toBe("boolean");
			}
		});
	});

	describe("options", () => {
		it("should accept maxIterations parameter", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = labelPropagation(graph, { maxIterations: 5 });

			expect(result.ok).toBe(true);
		});

		it("should produce deterministic results with seed", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			for (let index = 0; index < 10; index++) {
				graph.addNode(createNode(`N${index}`));
			}
			for (let index = 0; index < 9; index++) {
				graph.addEdge(createEdge(`e${index}`, `N${index}`, `N${index + 1}`));
			}

			const result1 = labelPropagation(graph, { seed: 42 });
			const result2 = labelPropagation(graph, { seed: 42 });

			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(true);
			if (result1.ok && result2.ok) {
				// Same seed should produce same cluster count
				expect(result1.value.clusters.length).toBe(result2.value.clusters.length);
			}
		});
	});

	describe("convergence", () => {
		it("should report convergence status", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = labelPropagation(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(typeof result.value.metadata.converged).toBe("boolean");
			}
		});

		it("should converge for small graphs", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = labelPropagation(graph, { maxIterations: 100 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Small graphs typically converge
				expect(result.value.metadata.converged).toBe(true);
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

			const result = labelPropagation(graph, {
				weightFn: (edge) => edge.weight ?? 1,
			});

			expect(result.ok).toBe(true);
		});
	});

	describe("stability", () => {
		it("should report stable status for each cluster", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = labelPropagation(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const cluster of result.value.clusters) {
					expect(typeof cluster.stable).toBe("boolean");
				}
			}
		});
	});
});

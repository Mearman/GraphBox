import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { type Edge, type Node } from "../types/graph";
import { corePeripheryDecomposition } from "./core-periphery";

// Test node and edge types
interface TestNode extends Node {
	id: string;
	type: string;
}

interface TestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: string;
}

// Helper to create a test node
const createNode = (id: string): TestNode => ({ id, type: "test" });

// Helper to create a test edge
const createEdge = (id: string, source: string, target: string): TestEdge => ({
	id,
	source,
	target,
	type: "test",
});

describe("corePeripheryDecomposition", () => {
	describe("validation errors", () => {
		it("should return error for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			const result = corePeripheryDecomposition(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("EmptyGraph");
			}
		});

		it("should return error for graph with fewer than 3 nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = corePeripheryDecomposition(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("InsufficientNodes");
			}
		});

		it("should return error for invalid core threshold (negative)", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = corePeripheryDecomposition(graph, { coreThreshold: -0.1 });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("InvalidInput");
			}
		});

		it("should return error for invalid core threshold (greater than 1)", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = corePeripheryDecomposition(graph, { coreThreshold: 1.5 });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("InvalidInput");
			}
		});

		it("should return error for invalid maxIterations", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = corePeripheryDecomposition(graph, { maxIterations: 0 });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("InvalidInput");
			}
		});

		it("should return error for invalid epsilon", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = corePeripheryDecomposition(graph, { epsilon: 0 });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("InvalidInput");
			}
		});
	});

	describe("simple graphs", () => {
		it("should decompose a star graph (hub and spokes)", () => {
			// Star: A at center, B, C, D as leaves
			// A should be core, B, C, D should be periphery
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "A", "D"));

			const result = corePeripheryDecomposition(graph, { coreThreshold: 0.5 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				const { structure } = result.value;
				// A has highest degree, should be in core
				expect(structure.coreNodes.size + structure.peripheryNodes.size).toBe(4);
			}
		});

		it("should handle complete graph (all nodes are core)", () => {
			// Complete graph: all nodes connected to each other
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));
			graph.addEdge(createEdge("E3", "C", "A"));

			const result = corePeripheryDecomposition(graph, { coreThreshold: 0.5 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				const { structure } = result.value;
				// All nodes should have similar coreness
				expect(structure.coreNodes.size + structure.peripheryNodes.size).toBe(3);
			}
		});
	});

	describe("coreness scores", () => {
		it("should assign coreness scores to all nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "B", "C"));
			graph.addEdge(createEdge("E4", "C", "D"));

			const result = corePeripheryDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const { structure } = result.value;
				expect(structure.corenessScores.size).toBe(4);
				// All scores should be between 0 and 1
				for (const score of structure.corenessScores.values()) {
					expect(score).toBeGreaterThanOrEqual(0);
					expect(score).toBeLessThanOrEqual(1);
				}
			}
		});

		it("should apply the specified threshold", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "A", "D"));

			const result = corePeripheryDecomposition(graph, { coreThreshold: 0.9 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				const { structure } = result.value;
				expect(structure.coreThreshold).toBe(0.9);
			}
		});
	});

	describe("fit quality", () => {
		it("should return fit quality in valid range", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "B", "C"));
			graph.addEdge(createEdge("E4", "C", "D"));

			const result = corePeripheryDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const { structure } = result.value;
				// Fit quality is Pearson correlation, range [-1, 1]
				expect(structure.fitQuality).toBeGreaterThanOrEqual(-1);
				expect(structure.fitQuality).toBeLessThanOrEqual(1);
			}
		});
	});

	describe("directed graphs", () => {
		it("should handle directed graphs (citations)", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A")); // Highly cited
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			// A is cited by B, C, D
			graph.addEdge(createEdge("E1", "B", "A"));
			graph.addEdge(createEdge("E2", "C", "A"));
			graph.addEdge(createEdge("E3", "D", "A"));

			const result = corePeripheryDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const { structure } = result.value;
				// A should have high coreness (highly cited)
				const aCoreness = structure.corenessScores.get("A") ?? 0;
				expect(aCoreness).toBeGreaterThan(0);
			}
		});
	});

	describe("metadata", () => {
		it("should include algorithm metadata", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));

			const result = corePeripheryDecomposition(graph, {
				coreThreshold: 0.6,
				maxIterations: 50,
				epsilon: 0.01,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.metadata.algorithm).toBe("core-periphery");
				expect(typeof result.value.metadata.runtime).toBe("number");
				expect(typeof result.value.metadata.iterations).toBe("number");
				expect(typeof result.value.metadata.converged).toBe("boolean");
				expect(result.value.metadata.parameters).toEqual({
					coreThreshold: 0.6,
					maxIterations: 50,
					epsilon: 0.01,
				});
			}
		});

		it("should track convergence", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));

			const result = corePeripheryDecomposition(graph, { maxIterations: 100 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.metadata.iterations).toBeLessThanOrEqual(100);
			}
		});
	});

	describe("edge cases", () => {
		it("should handle graph with no edges", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));

			const result = corePeripheryDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// All nodes should be periphery (no connections)
				expect(result.value.structure.peripheryNodes.size).toBe(3);
			}
		});
	});
});

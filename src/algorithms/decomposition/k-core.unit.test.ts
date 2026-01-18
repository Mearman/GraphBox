import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { type Edge, type Node } from "../types/graph";
import { kCoreDecomposition } from "./k-core";

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

describe("kCoreDecomposition", () => {
	describe("validation errors", () => {
		it("should return error for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("EmptyGraph");
			}
		});
	});

	describe("simple graphs", () => {
		it("should handle single node graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.degeneracy).toBe(0);
				expect(result.value.coreNumbers.get("A")).toBe(0);
				expect(result.value.cores.get(0)?.nodes.has("A")).toBe(true);
			}
		});

		it("should handle two connected nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.degeneracy).toBe(1);
				expect(result.value.coreNumbers.get("A")).toBe(1);
				expect(result.value.coreNumbers.get("B")).toBe(1);
				// 1-core contains both nodes
				expect(result.value.cores.get(1)?.nodes.has("A")).toBe(true);
				expect(result.value.cores.get(1)?.nodes.has("B")).toBe(true);
			}
		});

		it("should identify triangle as 2-core", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));
			graph.addEdge(createEdge("E3", "C", "A"));

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.degeneracy).toBe(2);
				// All nodes in triangle have core number 2
				expect(result.value.coreNumbers.get("A")).toBe(2);
				expect(result.value.coreNumbers.get("B")).toBe(2);
				expect(result.value.coreNumbers.get("C")).toBe(2);
			}
		});
	});

	describe("k-core hierarchy", () => {
		it("should produce nested k-cores", () => {
			// Triangle (A-B-C) with D attached to A
			// D has degree 1, so core number 1
			// A, B, C have degree 2-3, so core number 2
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));
			graph.addEdge(createEdge("E3", "C", "A"));
			graph.addEdge(createEdge("E4", "A", "D"));

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.degeneracy).toBe(2);
				expect(result.value.coreNumbers.get("D")).toBe(1);
				expect(result.value.coreNumbers.get("A")).toBe(2);
				expect(result.value.coreNumbers.get("B")).toBe(2);
				expect(result.value.coreNumbers.get("C")).toBe(2);

				// 1-core contains all nodes
				const core1 = result.value.cores.get(1);
				expect(core1?.nodes.size).toBe(4);

				// 2-core contains only A, B, C
				const core2 = result.value.cores.get(2);
				expect(core2?.nodes.size).toBe(3);
				expect(core2?.nodes.has("D")).toBe(false);
			}
		});

		it("should handle star graph (degeneracy 1)", () => {
			// Star: A at center, B, C, D, E as leaves
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addNode(createNode("E"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "A", "D"));
			graph.addEdge(createEdge("E4", "A", "E"));

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Leaves have degree 1, so when removed, hub also has degree 0
				expect(result.value.degeneracy).toBe(1);
				// All nodes have core number 1
				for (const node of ["A", "B", "C", "D", "E"]) {
					expect(result.value.coreNumbers.get(node)).toBe(1);
				}
			}
		});
	});

	describe("directed graphs", () => {
		it("should treat directed graphs as undirected for k-core", () => {
			// Directed triangle: A->B->C->A
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));
			graph.addEdge(createEdge("E3", "C", "A"));

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Treated as undirected, so it's a 2-core
				expect(result.value.degeneracy).toBe(2);
			}
		});
	});

	describe("disconnected components", () => {
		it("should handle disconnected components", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Component 1: Triangle
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));
			graph.addEdge(createEdge("E3", "C", "A"));

			// Component 2: Single edge
			graph.addNode(createNode("D"));
			graph.addNode(createNode("E"));
			graph.addEdge(createEdge("E4", "D", "E"));

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.degeneracy).toBe(2);
				// Triangle nodes have core number 2
				expect(result.value.coreNumbers.get("A")).toBe(2);
				// Edge nodes have core number 1
				expect(result.value.coreNumbers.get("D")).toBe(1);
				expect(result.value.coreNumbers.get("E")).toBe(1);
			}
		});

		it("should handle isolated nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// No edges

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.degeneracy).toBe(0);
				// All nodes have core number 0
				expect(result.value.coreNumbers.get("A")).toBe(0);
				expect(result.value.coreNumbers.get("B")).toBe(0);
				expect(result.value.coreNumbers.get("C")).toBe(0);
			}
		});
	});

	describe("core structure", () => {
		it("should include all required fields in Core", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const core1 = result.value.cores.get(1);
				expect(core1).toBeDefined();
				if (core1) {
					expect(core1.k).toBe(1);
					expect(core1.nodes).toBeInstanceOf(Set);
					expect(core1.size).toBe(2);
					expect(core1.degeneracy).toBe(1);
					expect(core1.coreNumbers).toBeInstanceOf(Map);
				}
			}
		});
	});

	describe("metadata", () => {
		it("should include runtime in metadata", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.metadata.algorithm).toBe("k-core");
				expect(typeof result.value.metadata.runtime).toBe("number");
				expect(result.value.metadata.runtime).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("edge cases", () => {
		it("should handle clique (complete graph)", () => {
			// K4: complete graph on 4 nodes
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "A", "D"));
			graph.addEdge(createEdge("E4", "B", "C"));
			graph.addEdge(createEdge("E5", "B", "D"));
			graph.addEdge(createEdge("E6", "C", "D"));

			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// K4 has degeneracy 3 (each node has degree 3)
				expect(result.value.degeneracy).toBe(3);
				// All nodes have core number 3
				for (const node of ["A", "B", "C", "D"]) {
					expect(result.value.coreNumbers.get(node)).toBe(3);
				}
			}
		});
	});
});

/**
 * Unit tests for topological sort algorithm
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { topologicalSort } from "./topological-sort";

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
	[key: string]: unknown;
}

const createNode = (id: string): TestNode => ({ id, type: "test" });
const createEdge = (id: string, source: string, target: string): TestEdge => ({
	id,
	source,
	target,
	type: "test",
});

describe("topologicalSort", () => {
	describe("error handling", () => {
		it("should return error for null graph", () => {
			// @ts-expect-error - Testing null input
			const result = topologicalSort(null);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should return error for undefined graph", () => {
			// @ts-expect-error - Testing undefined input
			const result = topologicalSort();

			expect(result.ok).toBe(false);
		});
	});

	describe("empty graph", () => {
		it("should return empty array for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			const result = topologicalSort(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});
	});

	describe("valid DAGs", () => {
		it("should sort single node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].id).toBe("n1");
			}
		});

		it("should sort isolated nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(3);
			}
		});

		it("should sort simple chain A -> B -> C", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const order = result.value.map((n) => n.id);
				// A must come before B, B must come before C
				expect(order.indexOf("A")).toBeLessThan(order.indexOf("B"));
				expect(order.indexOf("B")).toBeLessThan(order.indexOf("C"));
			}
		});

		it("should sort diamond DAG", () => {
			// A -> B, A -> C, B -> D, C -> D
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "A", "C"));
			graph.addEdge(createEdge("e3", "B", "D"));
			graph.addEdge(createEdge("e4", "C", "D"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const order = result.value.map((n) => n.id);
				// A must come before B, C, D
				expect(order.indexOf("A")).toBeLessThan(order.indexOf("B"));
				expect(order.indexOf("A")).toBeLessThan(order.indexOf("C"));
				expect(order.indexOf("A")).toBeLessThan(order.indexOf("D"));
				// B and C must come before D
				expect(order.indexOf("B")).toBeLessThan(order.indexOf("D"));
				expect(order.indexOf("C")).toBeLessThan(order.indexOf("D"));
			}
		});

		it("should sort tree structure", () => {
			//     A
			//    / \
			//   B   C
			//  / \
			// D   E
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addNode(createNode("E"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "A", "C"));
			graph.addEdge(createEdge("e3", "B", "D"));
			graph.addEdge(createEdge("e4", "B", "E"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const order = result.value.map((n) => n.id);
				// A is root, must come first among its descendants
				expect(order.indexOf("A")).toBeLessThan(order.indexOf("B"));
				expect(order.indexOf("A")).toBeLessThan(order.indexOf("C"));
				expect(order.indexOf("B")).toBeLessThan(order.indexOf("D"));
				expect(order.indexOf("B")).toBeLessThan(order.indexOf("E"));
			}
		});

		it("should sort multiple disconnected DAGs", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			// First DAG: A -> B
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));
			// Second DAG: C -> D
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e2", "C", "D"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(4);
				const order = result.value.map((n) => n.id);
				expect(order.indexOf("A")).toBeLessThan(order.indexOf("B"));
				expect(order.indexOf("C")).toBeLessThan(order.indexOf("D"));
			}
		});
	});

	describe("cycle detection", () => {
		it("should detect simple 2-node cycle", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "A"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("cycle-detected");
				// Type narrowing after assertion check
				const error = result.error as { type: string; cyclePath?: string[] };
				expect(error.cyclePath).toBeDefined();
			}
		});

		it("should detect 3-node cycle", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "A"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("cycle-detected");
			}
		});

		it("should detect self-loop", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addEdge(createEdge("e1", "A", "A"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("cycle-detected");
			}
		});

		it("should detect cycle in larger graph", () => {
			// A -> B -> C -> D, D -> B (cycle B -> C -> D -> B)
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "D"));
			graph.addEdge(createEdge("e4", "D", "B"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("cycle-detected");
			}
		});
	});

	describe("ordering properties", () => {
		it("should return all nodes in result", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(3);
				const ids = result.value.map((n) => n.id);
				expect(ids).toContain("A");
				expect(ids).toContain("B");
				expect(ids).toContain("C");
			}
		});

		it("should maintain source-before-target ordering for all edges", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "C"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "D"));

			const result = topologicalSort(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const order = result.value.map((n) => n.id);
				const edges = graph.getAllEdges();

				for (const edge of edges) {
					const sourceIndex = order.indexOf(edge.source);
					const targetIndex = order.indexOf(edge.target);
					expect(sourceIndex).toBeLessThan(targetIndex);
				}
			}
		});
	});
});

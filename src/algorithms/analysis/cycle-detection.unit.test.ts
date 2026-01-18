/**
 * Unit tests for cycle detection algorithm
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { detectCycle } from "./cycle-detection";

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

describe("detectCycle", () => {
	describe("error handling", () => {
		it("should return error for null graph", () => {
			// @ts-expect-error - Testing null input
			const result = detectCycle(null);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should return error for undefined graph", () => {
			// @ts-expect-error - Testing undefined input
			const result = detectCycle();

			expect(result.ok).toBe(false);
		});
	});

	describe("empty graph", () => {
		it("should return None for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(false);
			}
		});
	});

	describe("acyclic graphs", () => {
		it("should return None for single node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(false);
			}
		});

		it("should return None for chain (DAG)", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(false);
			}
		});

		it("should return None for tree", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "A", "C"));
			graph.addEdge(createEdge("e3", "B", "D"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(false);
			}
		});

		it("should return None for disconnected acyclic components", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "C", "D"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(false);
			}
		});
	});

	describe("directed cycles", () => {
		it("should detect self-loop", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addEdge(createEdge("e1", "A", "A"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(true);
			}
		});

		it("should detect 2-node cycle", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "A"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(true);
				if (result.value.some) {
					expect(result.value.value.nodes.length).toBeGreaterThan(0);
				}
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

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(true);
			}
		});

		it("should detect cycle in larger graph", () => {
			// A -> B -> C, C -> D -> B (cycle B -> C -> D -> B)
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "D"));
			graph.addEdge(createEdge("e4", "D", "B"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(true);
			}
		});

		it("should not detect cycle when edges don't form back edge", () => {
			// A -> B, A -> C, B -> D, C -> D (diamond, no cycle)
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "A", "C"));
			graph.addEdge(createEdge("e3", "B", "D"));
			graph.addEdge(createEdge("e4", "C", "D"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(false);
			}
		});
	});

	describe("undirected cycles", () => {
		it("should detect 3-node cycle in undirected graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "A"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(true);
			}
		});

		it("should not detect cycle in tree (undirected)", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "A", "C"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(false);
			}
		});

		it("should not treat single undirected edge as cycle", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Single edge should not be cycle (parent edge not counted)
				expect(result.value.some).toBe(false);
			}
		});
	});

	describe("cycle info", () => {
		it("should return cycle nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "A"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.nodes).toBeDefined();
				expect(result.value.value.nodes.length).toBeGreaterThan(0);
			}
		});

		it("should return cycle edges when available", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "A"));

			const result = detectCycle(graph);

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.edges).toBeDefined();
			}
		});
	});
});

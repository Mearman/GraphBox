/**
 * Unit tests for strongly connected components (Tarjan's algorithm)
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { stronglyConnectedComponents } from "./scc";

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

describe("stronglyConnectedComponents", () => {
	describe("error handling", () => {
		it("should return error for null graph", () => {
			// @ts-expect-error - Testing null input
			const result = stronglyConnectedComponents(null);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should return error for undefined graph", () => {
			// @ts-expect-error - Testing undefined input
			const result = stronglyConnectedComponents();

			expect(result.ok).toBe(false);
		});
	});

	describe("empty graph", () => {
		it("should return empty array for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});
	});

	describe("single nodes", () => {
		it("should find single node as its own SCC", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));

			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].size).toBe(1);
			}
		});

		it("should find each isolated node as its own SCC", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));

			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(3);
				for (const scc of result.value) {
					expect(scc.size).toBe(1);
				}
			}
		});
	});

	describe("simple cycles", () => {
		it("should find 2-node cycle as single SCC", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n1"));

			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].size).toBe(2);
			}
		});

		it("should find 3-node cycle as single SCC", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n3"));
			graph.addEdge(createEdge("e3", "n3", "n1"));

			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].size).toBe(3);
			}
		});
	});

	describe("chain (DAG)", () => {
		it("should find each node as separate SCC in chain", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n3"));

			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Each node is its own SCC (no back edges)
				expect(result.value).toHaveLength(3);
				for (const scc of result.value) {
					expect(scc.size).toBe(1);
				}
			}
		});
	});

	describe("complex graphs", () => {
		it("should find multiple SCCs in graph with cycles", () => {
			// Graph: (A -> B -> C -> A) -> (D -> E -> D) -> F
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addNode(createNode("E"));
			graph.addNode(createNode("F"));

			// First cycle: A -> B -> C -> A
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "A"));

			// Connection from first cycle to second
			graph.addEdge(createEdge("e4", "C", "D"));

			// Second cycle: D -> E -> D
			graph.addEdge(createEdge("e5", "D", "E"));
			graph.addEdge(createEdge("e6", "E", "D"));

			// Connection from second cycle to F
			graph.addEdge(createEdge("e7", "E", "F"));

			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Should have 3 SCCs: {A,B,C}, {D,E}, {F}
				expect(result.value).toHaveLength(3);

				const sizes = result.value.map((scc) => scc.size).sort((a, b) => a - b);
				expect(sizes).toEqual([1, 2, 3]);
			}
		});

		it("should handle self-loop", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addEdge(createEdge("e1", "n1", "n1")); // Self-loop
			graph.addEdge(createEdge("e2", "n1", "n2"));

			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// n1 forms its own SCC (due to self-loop), n2 is separate
				expect(result.value).toHaveLength(2);
			}
		});

		it("should handle two separate cycles", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			// First cycle
			graph.addNode(createNode("a1"));
			graph.addNode(createNode("a2"));
			graph.addEdge(createEdge("e1", "a1", "a2"));
			graph.addEdge(createEdge("e2", "a2", "a1"));

			// Second cycle (disconnected)
			graph.addNode(createNode("b1"));
			graph.addNode(createNode("b2"));
			graph.addEdge(createEdge("e3", "b1", "b2"));
			graph.addEdge(createEdge("e4", "b2", "b1"));

			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(2);
				for (const scc of result.value) {
					expect(scc.size).toBe(2);
				}
			}
		});
	});

	describe("component properties", () => {
		it("should assign unique component IDs", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));

			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const ids = result.value.map((c) => c.id);
				const uniqueIds = new Set(ids);
				expect(uniqueIds.size).toBe(ids.length);
			}
		});

		it("should include all nodes exactly once across SCCs", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n1"));

			const result = stronglyConnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const allNodes = result.value.flatMap((c) => c.nodes);
				const nodeIds = allNodes.map((n) => n.id);
				expect(nodeIds).toHaveLength(3);
				expect(new Set(nodeIds).size).toBe(3);
			}
		});
	});
});

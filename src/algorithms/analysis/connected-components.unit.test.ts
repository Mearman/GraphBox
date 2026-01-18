/**
 * Unit tests for connected components algorithm
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { connectedComponents } from "./connected-components";

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

describe("connectedComponents", () => {
	describe("error handling", () => {
		it("should return error for null graph", () => {
			// @ts-expect-error - Testing null input
			const result = connectedComponents(null);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should return error for undefined graph", () => {
			// @ts-expect-error - Testing undefined input
			const result = connectedComponents();

			expect(result.ok).toBe(false);
		});
	});

	describe("empty graph", () => {
		it("should return empty array for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});
	});

	describe("single component", () => {
		it("should find single component with one node", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("n1"));

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].size).toBe(1);
			}
		});

		it("should find single component for connected graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n3"));

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].size).toBe(3);
			}
		});

		it("should handle cycle", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n3"));
			graph.addEdge(createEdge("e3", "n3", "n1"));

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].size).toBe(3);
			}
		});
	});

	describe("multiple components", () => {
		it("should find multiple disconnected components", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("a1"));
			graph.addNode(createNode("a2"));
			graph.addNode(createNode("b1"));
			graph.addNode(createNode("b2"));
			graph.addEdge(createEdge("e1", "a1", "a2"));
			graph.addEdge(createEdge("e2", "b1", "b2"));

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(2);
				const sizes = result.value.map((c) => c.size).sort();
				expect(sizes).toEqual([2, 2]);
			}
		});

		it("should handle isolated nodes as separate components", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			// No edges - all isolated

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(3);
				for (const component of result.value) {
					expect(component.size).toBe(1);
				}
			}
		});

		it("should find mixed isolated and connected components", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("a1"));
			graph.addNode(createNode("a2"));
			graph.addNode(createNode("isolated"));
			graph.addEdge(createEdge("e1", "a1", "a2"));

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(2);
				const sizes = result.value.map((c) => c.size).sort();
				expect(sizes).toEqual([1, 2]);
			}
		});
	});

	describe("directed graphs (weak connectivity)", () => {
		it("should treat directed edges as undirected for connectivity", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			// n1 -> n2 -> n3 (one direction only)
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n3"));

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// All nodes should be in one weakly connected component
				expect(result.value).toHaveLength(1);
				expect(result.value[0].size).toBe(3);
			}
		});

		it("should find weakly connected components in directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("a1"));
			graph.addNode(createNode("a2"));
			graph.addNode(createNode("b1"));
			graph.addNode(createNode("b2"));
			graph.addEdge(createEdge("e1", "a1", "a2"));
			graph.addEdge(createEdge("e2", "b1", "b2"));

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(2);
			}
		});
	});

	describe("component properties", () => {
		it("should assign unique component IDs", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const ids = result.value.map((c) => c.id);
				const uniqueIds = new Set(ids);
				expect(uniqueIds.size).toBe(ids.length);
			}
		});

		it("should include all nodes in components", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const allNodes = result.value.flatMap((c) => c.nodes);
				const nodeIds = allNodes.map((n) => n.id);
				expect(nodeIds).toContain("n1");
				expect(nodeIds).toContain("n2");
				expect(nodeIds).toContain("n3");
			}
		});

		it("should correctly report component size", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n3"));

			const result = connectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value[0].size).toBe(result.value[0].nodes.length);
			}
		});
	});
});

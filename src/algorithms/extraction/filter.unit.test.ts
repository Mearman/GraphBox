/**
 * Unit tests for attribute-based subgraph filtering
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { filterSubgraph } from "./filter";

interface TestNode {
	id: string;
	type: string;
	category?: string;
	year?: number;
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

const createNode = (id: string, options?: { category?: string; year?: number }): TestNode => ({
	id,
	type: "test",
	...options,
});
const createEdge = (id: string, source: string, target: string, edgeType = "test"): TestEdge => ({
	id,
	source,
	target,
	type: edgeType,
});

describe("filterSubgraph", () => {
	describe("error handling", () => {
		it("should return error for null graph", () => {
			// @ts-expect-error - Testing null input
			const result = filterSubgraph(null, {});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});
	});

	describe("node predicate filtering", () => {
		it("should filter nodes by predicate", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", { category: "paper" }));
			graph.addNode(createNode("B", { category: "author" }));
			graph.addNode(createNode("C", { category: "paper" }));

			const result = filterSubgraph(graph, {
				nodePredicate: (node) => node.category === "paper",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(2);
			}
		});

		it("should filter nodes by multiple criteria", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", { category: "paper", year: 2020 }));
			graph.addNode(createNode("B", { category: "paper", year: 2019 }));
			graph.addNode(createNode("C", { category: "author", year: 2020 }));

			const result = filterSubgraph(graph, {
				nodePredicate: (node) => node.category === "paper" && (node.year ?? 0) >= 2020,
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(1);
				expect(result.value.getNode("A").some).toBe(true);
			}
		});
	});

	describe("edge predicate filtering", () => {
		it("should filter edges by predicate", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B", "cites"));
			graph.addEdge(createEdge("e2", "B", "C", "references"));

			const result = filterSubgraph(graph, {
				edgePredicate: (edge) => edge.type === "cites",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const edges = result.value.getAllEdges();
				expect(edges).toHaveLength(1);
				expect(edges[0].type).toBe("cites");
			}
		});
	});

	describe("edge type filtering", () => {
		it("should filter by edge types", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B", "cites"));
			graph.addEdge(createEdge("e2", "B", "C", "references"));
			graph.addEdge(createEdge("e3", "A", "C", "cites"));

			const result = filterSubgraph(graph, {
				edgeTypes: new Set(["cites"]),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllEdges()).toHaveLength(2);
			}
		});

		it("should filter by multiple edge types", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B", "cites"));
			graph.addEdge(createEdge("e2", "B", "C", "references"));
			graph.addEdge(createEdge("e3", "A", "C", "other"));

			const result = filterSubgraph(graph, {
				edgeTypes: new Set(["cites", "references"]),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllEdges()).toHaveLength(2);
			}
		});
	});

	describe("combined filtering", () => {
		it("should combine node and edge filters with AND mode (default)", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", { category: "paper" }));
			graph.addNode(createNode("B", { category: "paper" }));
			graph.addNode(createNode("C", { category: "author" }));
			graph.addEdge(createEdge("e1", "A", "B", "cites"));
			graph.addEdge(createEdge("e2", "B", "C", "authored_by"));

			const result = filterSubgraph(graph, {
				nodePredicate: (node) => node.category === "paper",
				edgeTypes: new Set(["cites"]),
				combineMode: "and",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(2); // Only papers
				expect(result.value.getAllEdges()).toHaveLength(1); // Only cites between papers
			}
		});
	});

	describe("empty results", () => {
		it("should return empty graph when no nodes match", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", { category: "author" }));

			const result = filterSubgraph(graph, {
				nodePredicate: (node) => node.category === "paper",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(0);
			}
		});

		it("should return empty edges when no edges match", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B", "other"));

			const result = filterSubgraph(graph, {
				edgeTypes: new Set(["cites"]),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllEdges()).toHaveLength(0);
			}
		});
	});

	describe("directedness preservation", () => {
		it("should preserve directed graph property", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));

			const result = filterSubgraph(graph, {});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.isDirected()).toBe(true);
			}
		});

		it("should preserve undirected graph property", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = filterSubgraph(graph, {});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.isDirected()).toBe(false);
			}
		});
	});
});

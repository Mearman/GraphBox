/**
 * Unit tests for subgraph extraction utilities
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { extractInducedSubgraph, filterByEdgeType, filterGraph } from "./subgraph";

interface TestNode {
	id: string;
	type: string;
	category?: string;
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

const createNode = (id: string, category?: string): TestNode => ({ id, type: "test", category });
const createEdge = (id: string, source: string, target: string, edgeType = "test"): TestEdge => ({
	id,
	source,
	target,
	type: edgeType,
});

describe("extractInducedSubgraph", () => {
	describe("error handling", () => {
		it("should return error for null graph", () => {
			// @ts-expect-error - Testing null input
			const result = extractInducedSubgraph(null, new Set(["A"]));

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});
	});

	describe("empty input", () => {
		it("should return empty graph for empty node set", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = extractInducedSubgraph(graph, new Set());

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(0);
			}
		});

		it("should handle empty source graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);

			const result = extractInducedSubgraph(graph, new Set(["A"]));

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(0);
			}
		});
	});

	describe("node extraction", () => {
		it("should extract specified nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));

			const result = extractInducedSubgraph(graph, new Set(["A", "B"]));

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(2);
				expect(result.value.getNode("A").some).toBe(true);
				expect(result.value.getNode("B").some).toBe(true);
				expect(result.value.getNode("C").some).toBe(false);
			}
		});

		it("should ignore non-existent node IDs", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = extractInducedSubgraph(graph, new Set(["A", "nonexistent"]));

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(1);
			}
		});
	});

	describe("edge extraction", () => {
		it("should include edges between included nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const result = extractInducedSubgraph(graph, new Set(["A", "B"]));

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllEdges()).toHaveLength(1);
				expect(result.value.getAllEdges()[0].id).toBe("e1");
			}
		});

		it("should exclude edges to excluded nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const result = extractInducedSubgraph(graph, new Set(["A", "C"]));

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllEdges()).toHaveLength(0);
			}
		});
	});

	describe("directedness", () => {
		it("should preserve directed graph property", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));

			const result = extractInducedSubgraph(graph, new Set(["A"]));

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.isDirected()).toBe(true);
			}
		});

		it("should preserve undirected graph property", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = extractInducedSubgraph(graph, new Set(["A"]));

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.isDirected()).toBe(false);
			}
		});
	});
});

describe("filterGraph", () => {
	describe("error handling", () => {
		it("should return error for null graph", () => {
			// @ts-expect-error - Testing null input
			const result = filterGraph(null, () => true);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});
	});

	describe("node filtering", () => {
		it("should filter nodes by predicate", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", "cat1"));
			graph.addNode(createNode("B", "cat2"));
			graph.addNode(createNode("C", "cat1"));

			const result = filterGraph(graph, (node) => node.category === "cat1");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(2);
			}
		});

		it("should return empty graph when no nodes match", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = filterGraph(graph, () => false);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(0);
			}
		});

		it("should return all nodes when predicate always returns true", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));

			const result = filterGraph(graph, () => true);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllNodes()).toHaveLength(2);
			}
		});
	});

	describe("edge filtering", () => {
		it("should filter edges by predicate", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B", "type1"));
			graph.addEdge(createEdge("e2", "B", "C", "type2"));

			const result = filterGraph(
				graph,
				() => true,
				(edge) => edge.type === "type1",
			);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllEdges()).toHaveLength(1);
				expect(result.value.getAllEdges()[0].type).toBe("type1");
			}
		});

		it("should only include edges between filtered nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", "keep"));
			graph.addNode(createNode("B", "remove"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = filterGraph(graph, (node) => node.category === "keep");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllEdges()).toHaveLength(0);
			}
		});
	});
});

describe("filterByEdgeType", () => {
	it("should filter edges by type", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addEdge(createEdge("e1", "A", "B", "cites"));
		graph.addEdge(createEdge("e2", "B", "C", "references"));

		const result = filterByEdgeType(graph, new Set(["cites"]));

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.getAllEdges()).toHaveLength(1);
			expect(result.value.getAllEdges()[0].type).toBe("cites");
		}
	});

	it("should include edges of multiple types", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addEdge(createEdge("e1", "A", "B", "cites"));
		graph.addEdge(createEdge("e2", "B", "C", "references"));
		graph.addEdge(createEdge("e3", "A", "C", "other"));

		const result = filterByEdgeType(graph, new Set(["cites", "references"]));

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.getAllEdges()).toHaveLength(2);
		}
	});
});

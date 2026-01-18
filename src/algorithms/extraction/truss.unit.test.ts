/**
 * Unit tests for K-Truss extraction algorithm
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { computeTriangleSupport, extractKTruss } from "./truss";

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

describe("computeTriangleSupport", () => {
	describe("empty and trivial graphs", () => {
		it("should return empty map for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);

			const result = computeTriangleSupport(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.size).toBe(0);
			}
		});

		it("should return zero support for edges not in triangles", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = computeTriangleSupport(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.get("e1")).toBe(0);
			}
		});
	});

	describe("triangle support calculation", () => {
		it("should calculate support for edges in single triangle", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = computeTriangleSupport(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Each edge is in exactly one triangle
				expect(result.value.get("e1")).toBe(1);
				expect(result.value.get("e2")).toBe(1);
				expect(result.value.get("e3")).toBe(1);
			}
		});

		it("should calculate higher support for shared edges", () => {
			// 4-clique: Every edge participates in 2 triangles
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			// All 6 edges of 4-clique
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "A", "C"));
			graph.addEdge(createEdge("e3", "A", "D"));
			graph.addEdge(createEdge("e4", "B", "C"));
			graph.addEdge(createEdge("e5", "B", "D"));
			graph.addEdge(createEdge("e6", "C", "D"));

			const result = computeTriangleSupport(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Each edge in a 4-clique is in 2 triangles
				for (const [, support] of result.value) {
					expect(support).toBe(2);
				}
			}
		});
	});

	describe("directed graphs", () => {
		it("should treat directed graph as undirected for triangle counting", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// Directed cycle forms triangle when treated as undirected
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "A"));

			const result = computeTriangleSupport(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Should detect triangle even though edges are directed
				expect(result.value.get("e1")).toBe(1);
			}
		});
	});
});

describe("extractKTruss", () => {
	describe("error handling", () => {
		it("should return error for k < 2", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = extractKTruss(graph, { k: 1 });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-truss");
			}
		});
	});

	describe("2-truss", () => {
		it("should return all edges for k=2 (any edge qualifies)", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = extractKTruss(graph, { k: 2 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllEdges()).toHaveLength(1);
			}
		});
	});

	describe("3-truss", () => {
		it("should extract edges in at least 1 triangle", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Triangle
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));
			// Dangling edge (not in triangle)
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e4", "C", "D"));

			const result = extractKTruss(graph, { k: 3 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.getAllEdges()).toHaveLength(3); // Only triangle edges
				expect(result.value.getNode("D").some).toBe(false); // D not included
			}
		});
	});

	describe("4-truss", () => {
		it("should extract edges in at least 2 triangles", () => {
			// 4-clique where each edge is in 2 triangles
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "A", "C"));
			graph.addEdge(createEdge("e3", "A", "D"));
			graph.addEdge(createEdge("e4", "B", "C"));
			graph.addEdge(createEdge("e5", "B", "D"));
			graph.addEdge(createEdge("e6", "C", "D"));

			const result = extractKTruss(graph, { k: 4 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				// 4-clique is a valid 4-truss
				expect(result.value.getAllEdges()).toHaveLength(6);
			}
		});

		it("should return empty for single triangle with k=4", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = extractKTruss(graph, { k: 4 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Single triangle edges are only in 1 triangle, not 2
				expect(result.value.getAllEdges()).toHaveLength(0);
			}
		});
	});

	describe("directedness preservation", () => {
		it("should preserve graph directedness", () => {
			const directedGraph = new Graph<TestNode, TestEdge>(true);
			directedGraph.addNode(createNode("A"));
			directedGraph.addNode(createNode("B"));
			directedGraph.addNode(createNode("C"));
			directedGraph.addEdge(createEdge("e1", "A", "B"));
			directedGraph.addEdge(createEdge("e2", "B", "C"));
			directedGraph.addEdge(createEdge("e3", "C", "A"));

			const result = extractKTruss(directedGraph, { k: 3 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.isDirected()).toBe(true);
			}
		});
	});
});

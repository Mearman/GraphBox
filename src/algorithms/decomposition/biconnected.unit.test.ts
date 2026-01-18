import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { type Edge, type Node } from "../types/graph";
import { biconnectedComponents } from "./biconnected";

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

describe("biconnectedComponents", () => {
	describe("validation errors", () => {
		it("should return error for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("EmptyGraph");
			}
		});

		it("should return error for single node graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("InsufficientNodes");
			}
		});

		it("should return error for directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("InvalidInput");
			}
		});
	});

	describe("simple graphs", () => {
		it("should handle two nodes with no edges", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Each node is its own trivial component
				expect(result.value.components.length).toBe(2);
				expect(result.value.articulationPoints.size).toBe(0);
			}
		});

		it("should handle two connected nodes (bridge)", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.components.length).toBe(1);
				expect(result.value.components[0].isBridge).toBe(true);
				expect(result.value.components[0].size).toBe(2);
			}
		});

		it("should identify triangle as single biconnected component", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));
			graph.addEdge(createEdge("E3", "C", "A"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.components.length).toBe(1);
				expect(result.value.components[0].size).toBe(3);
				expect(result.value.components[0].isBridge).toBe(false);
				expect(result.value.articulationPoints.size).toBe(0);
			}
		});
	});

	describe("articulation points", () => {
		it("should identify articulation point in linear graph", () => {
			// A - B - C (B is articulation point)
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.articulationPoints.has("B")).toBe(true);
				expect(result.value.components.length).toBe(2);
			}
		});

		it("should identify articulation point connecting two triangles", () => {
			// Triangle (A-B-C) connected to triangle (C-D-E) via C
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addNode(createNode("E"));

			// First triangle
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));
			graph.addEdge(createEdge("E3", "C", "A"));

			// Second triangle
			graph.addEdge(createEdge("E4", "C", "D"));
			graph.addEdge(createEdge("E5", "D", "E"));
			graph.addEdge(createEdge("E6", "E", "C"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.articulationPoints.has("C")).toBe(true);
				expect(result.value.components.length).toBe(2);
			}
		});

		it("should identify root articulation point with multiple children", () => {
			// Star graph: A at center connected to B, C, D
			// A has multiple DFS children, so it's an articulation point
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "A", "D"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.articulationPoints.has("A")).toBe(true);
				// 3 bridge components
				expect(result.value.components.length).toBe(3);
			}
		});
	});

	describe("complex graphs", () => {
		it("should handle disconnected components", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Component 1: A - B
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			// Component 2: C - D
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E2", "C", "D"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.components.length).toBe(2);
				expect(result.value.articulationPoints.size).toBe(0);
			}
		});

		it("should handle graph with multiple biconnected components and articulation points", () => {
			// Graph: A-B-C-D-E with B-C forming a triangle
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addNode(createNode("E"));

			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));
			graph.addEdge(createEdge("E3", "B", "D")); // Creates back edge
			graph.addEdge(createEdge("E4", "C", "D"));
			graph.addEdge(createEdge("E5", "D", "E"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// B is articulation point (connects A to rest)
				// D is articulation point (connects E to rest)
				expect(result.value.articulationPoints.size).toBeGreaterThanOrEqual(1);
			}
		});
	});

	describe("metadata", () => {
		it("should include runtime in metadata", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = biconnectedComponents(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.metadata.algorithm).toBe("biconnected");
				expect(typeof result.value.metadata.runtime).toBe("number");
				expect(result.value.metadata.runtime).toBeGreaterThanOrEqual(0);
			}
		});
	});
});

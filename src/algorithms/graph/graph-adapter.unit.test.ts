import { describe, expect, it } from "vitest";

import { type Edge, type Node } from "../types/graph";
import { Graph } from "./graph";
import { GraphAdapter } from "./graph-adapter";

// Test node and edge types
interface TestNode extends Node {
	id: string;
	type: string;
	label?: string;
}

interface TestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: string;
	weight?: number;
}

// Helper to create a test node
const createNode = (id: string, label?: string): TestNode => ({
	id,
	type: "test",
	label,
});

// Helper to create a test edge
const createEdge = (id: string, source: string, target: string, weight?: number): TestEdge => ({
	id,
	source,
	target,
	type: "test",
	weight,
});

describe("GraphAdapter", () => {
	describe("hasNode", () => {
		it("should return true for existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			const adapter = new GraphAdapter(graph);

			expect(adapter.hasNode("A")).toBe(true);
		});

		it("should return false for non-existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			const adapter = new GraphAdapter(graph);

			expect(adapter.hasNode("B")).toBe(false);
		});

		it("should return false for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			const adapter = new GraphAdapter(graph);

			expect(adapter.hasNode("A")).toBe(false);
		});
	});

	describe("getNode", () => {
		it("should return node for existing ID", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A", "Node A"));
			const adapter = new GraphAdapter(graph);

			const node = adapter.getNode("A");

			expect(node).not.toBeNull();
			expect(node?.id).toBe("A");
			expect(node?.label).toBe("Node A");
		});

		it("should return null for non-existing ID", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			const adapter = new GraphAdapter(graph);

			const node = adapter.getNode("B");

			expect(node).toBeNull();
		});

		it("should return null for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			const adapter = new GraphAdapter(graph);

			expect(adapter.getNode("A")).toBeNull();
		});
	});

	describe("getNeighbors", () => {
		it("should return neighbor IDs for directed graph (outgoing)", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));

			const adapter = new GraphAdapter(graph);
			const neighbors = adapter.getNeighbors("A");

			expect(neighbors).toContain("B");
			expect(neighbors).toContain("C");
			expect(neighbors.length).toBe(2);
		});

		it("should return empty array for node with no outgoing edges", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B")); // Only A -> B

			const adapter = new GraphAdapter(graph);
			const neighbors = adapter.getNeighbors("B");

			expect(neighbors.length).toBe(0);
		});

		it("should return empty array for non-existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));

			const adapter = new GraphAdapter(graph);
			const neighbors = adapter.getNeighbors("X");

			expect(neighbors.length).toBe(0);
		});

		it("should handle undirected graph (both directions)", () => {
			const graph = new Graph<TestNode, TestEdge>(false); // undirected
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const adapter = new GraphAdapter(graph);

			// Both A and B should see each other as neighbors
			expect(adapter.getNeighbors("A")).toContain("B");
			expect(adapter.getNeighbors("B")).toContain("A");
		});
	});

	describe("getAllNodes", () => {
		it("should return all nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));

			const adapter = new GraphAdapter(graph);
			const nodes = adapter.getAllNodes();

			expect(nodes.length).toBe(3);
			expect(nodes.map((n) => n.id)).toContain("A");
			expect(nodes.map((n) => n.id)).toContain("B");
			expect(nodes.map((n) => n.id)).toContain("C");
		});

		it("should return empty array for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			const adapter = new GraphAdapter(graph);

			expect(adapter.getAllNodes().length).toBe(0);
		});

		it("should return nodes with all properties", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A", "Label A"));

			const adapter = new GraphAdapter(graph);
			const nodes = adapter.getAllNodes();

			expect(nodes[0].id).toBe("A");
			expect(nodes[0].label).toBe("Label A");
		});
	});

	describe("isDirected", () => {
		it("should return true for directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			const adapter = new GraphAdapter(graph);

			expect(adapter.isDirected()).toBe(true);
		});

		it("should return false for undirected graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			const adapter = new GraphAdapter(graph);

			expect(adapter.isDirected()).toBe(false);
		});
	});

	describe("getOutgoingEdges", () => {
		it("should return outgoing edges for directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B", 1));
			graph.addEdge(createEdge("E2", "A", "C", 2));

			const adapter = new GraphAdapter(graph);
			const edges = adapter.getOutgoingEdges("A");

			expect(edges.length).toBe(2);
			expect(edges.map((e) => e.target)).toContain("B");
			expect(edges.map((e) => e.target)).toContain("C");
		});

		it("should return empty array for node with no outgoing edges", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const adapter = new GraphAdapter(graph);
			const edges = adapter.getOutgoingEdges("B");

			expect(edges.length).toBe(0);
		});

		it("should return empty array for non-existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));

			const adapter = new GraphAdapter(graph);
			const edges = adapter.getOutgoingEdges("X");

			expect(edges.length).toBe(0);
		});

		it("should return edges with all properties", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B", 3.14));

			const adapter = new GraphAdapter(graph);
			const edges = adapter.getOutgoingEdges("A");

			expect(edges[0].id).toBe("E1");
			expect(edges[0].source).toBe("A");
			expect(edges[0].target).toBe("B");
			expect(edges[0].weight).toBe(3.14);
		});

		it("should handle undirected graph (edges where node is target)", () => {
			const graph = new Graph<TestNode, TestEdge>(false); // undirected
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "C", "B")); // B is target

			const adapter = new GraphAdapter(graph);
			const edges = adapter.getOutgoingEdges("B");

			// In undirected graph, B should see both edges
			expect(edges.length).toBe(2);
		});
	});

	describe("ReadableGraph interface compatibility", () => {
		it("should implement all ReadableGraph methods", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			const adapter = new GraphAdapter(graph);

			// Verify all methods exist and are callable
			expect(typeof adapter.hasNode).toBe("function");
			expect(typeof adapter.getNode).toBe("function");
			expect(typeof adapter.getNeighbors).toBe("function");
			expect(typeof adapter.getAllNodes).toBe("function");
			expect(typeof adapter.isDirected).toBe("function");
			expect(typeof adapter.getOutgoingEdges).toBe("function");
		});
	});

	describe("complex scenarios", () => {
		it("should handle self-loops", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addEdge(createEdge("E1", "A", "A")); // Self-loop

			const adapter = new GraphAdapter(graph);

			expect(adapter.getNeighbors("A")).toContain("A");
			expect(adapter.getOutgoingEdges("A").length).toBe(1);
		});

		it("should handle multiple edges between same nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B", 1));
			graph.addEdge(createEdge("E2", "A", "B", 2));

			const adapter = new GraphAdapter(graph);
			const edges = adapter.getOutgoingEdges("A");

			expect(edges.length).toBe(2);
		});

		it("should handle disconnected components", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "C", "D"));

			const adapter = new GraphAdapter(graph);

			expect(adapter.getNeighbors("A")).toContain("B");
			expect(adapter.getNeighbors("A")).not.toContain("C");
			expect(adapter.getNeighbors("C")).toContain("D");
		});
	});
});

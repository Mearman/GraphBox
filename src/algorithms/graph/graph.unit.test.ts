/**
 * Unit tests for Graph class
 */

import { describe, expect, it } from "vitest";

import { Graph } from "./graph";

// Simple node and edge types for testing (with index signatures to match Node/Edge interfaces)
interface TestNode {
	id: string;
	type: string;
	label?: string;
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

const createNode = (id: string, label?: string): TestNode => ({
	id,
	type: "test",
	label,
});

const createEdge = (id: string, source: string, target: string, weight?: number): TestEdge => ({
	id,
	source,
	target,
	type: "test",
	weight,
});

describe("Graph", () => {
	describe("constructor", () => {
		it("should create empty directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			expect(graph.isDirected()).toBe(true);
			expect(graph.getNodeCount()).toBe(0);
			expect(graph.getEdgeCount()).toBe(0);
		});

		it("should create empty undirected graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);

			expect(graph.isDirected()).toBe(false);
			expect(graph.getNodeCount()).toBe(0);
			expect(graph.getEdgeCount()).toBe(0);
		});
	});

	describe("addNode", () => {
		it("should add node successfully", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			const result = graph.addNode(createNode("n1", "Node 1"));

			expect(result.ok).toBe(true);
			expect(graph.getNodeCount()).toBe(1);
		});

		it("should return error for duplicate node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			const result = graph.addNode(createNode("n1"));

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("duplicate-node");
				expect(result.error.nodeId).toBe("n1");
			}
		});

		it("should allow adding multiple distinct nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));

			expect(graph.getNodeCount()).toBe(3);
		});
	});

	describe("hasNode", () => {
		it("should return true for existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));

			expect(graph.hasNode("n1")).toBe(true);
		});

		it("should return false for non-existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			expect(graph.hasNode("n1")).toBe(false);
		});
	});

	describe("getNode", () => {
		it("should return Some(node) for existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			const node = createNode("n1", "Test Node");
			graph.addNode(node);

			const result = graph.getNode("n1");

			expect(result.some).toBe(true);
			if (result.some) {
				expect(result.value.label).toBe("Test Node");
			}
		});

		it("should return None for non-existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const result = graph.getNode("n1");

			expect(result.some).toBe(false);
		});
	});

	describe("removeNode", () => {
		it("should remove node successfully", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));

			const result = graph.removeNode("n1");

			expect(result.ok).toBe(true);
			expect(graph.getNodeCount()).toBe(0);
			expect(graph.hasNode("n1")).toBe(false);
		});

		it("should return error for non-existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const result = graph.removeNode("n1");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should remove incident edges when removing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n3"));

			graph.removeNode("n2");

			expect(graph.getEdgeCount()).toBe(0);
		});
	});

	describe("addEdge", () => {
		it("should add edge between existing nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));

			const result = graph.addEdge(createEdge("e1", "n1", "n2"));

			expect(result.ok).toBe(true);
			expect(graph.getEdgeCount()).toBe(1);
		});

		it("should return error if source node does not exist", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n2"));

			const result = graph.addEdge(createEdge("e1", "n1", "n2"));

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
				expect(result.error.input).toBe("n1");
			}
		});

		it("should return error if target node does not exist", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));

			const result = graph.addEdge(createEdge("e1", "n1", "n2"));

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
				expect(result.error.input).toBe("n2");
			}
		});

		it("should allow self-loops", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));

			const result = graph.addEdge(createEdge("e1", "n1", "n1"));

			expect(result.ok).toBe(true);
		});
	});

	describe("getEdge", () => {
		it("should return Some(edge) for existing edge", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addEdge(createEdge("e1", "n1", "n2", 5));

			const result = graph.getEdge("e1");

			expect(result.some).toBe(true);
			if (result.some) {
				expect(result.value.weight).toBe(5);
			}
		});

		it("should return None for non-existing edge", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const result = graph.getEdge("e1");

			expect(result.some).toBe(false);
		});
	});

	describe("removeEdge", () => {
		it("should remove edge successfully", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addEdge(createEdge("e1", "n1", "n2"));

			const result = graph.removeEdge("e1");

			expect(result.ok).toBe(true);
			expect(graph.getEdgeCount()).toBe(0);
		});

		it("should return error for non-existing edge", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const result = graph.removeEdge("e1");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should update adjacency list when removing edge", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addEdge(createEdge("e1", "n1", "n2"));

			graph.removeEdge("e1");
			const neighbors = graph.getNeighbors("n1");

			expect(neighbors.ok).toBe(true);
			if (neighbors.ok) {
				expect(neighbors.value).toHaveLength(0);
			}
		});
	});

	describe("getNeighbors", () => {
		it("should return neighbors for directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n1", "n3"));

			const result = graph.getNeighbors("n1");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toContain("n2");
				expect(result.value).toContain("n3");
				expect(result.value).toHaveLength(2);
			}
		});

		it("should return neighbors for undirected graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addEdge(createEdge("e1", "n1", "n2"));

			// Both n1 and n2 should see each other as neighbors
			const n1Neighbors = graph.getNeighbors("n1");
			const n2Neighbors = graph.getNeighbors("n2");

			expect(n1Neighbors.ok).toBe(true);
			expect(n2Neighbors.ok).toBe(true);
			if (n1Neighbors.ok && n2Neighbors.ok) {
				expect(n1Neighbors.value).toContain("n2");
				expect(n2Neighbors.value).toContain("n1");
			}
		});

		it("should return error for non-existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const result = graph.getNeighbors("n1");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should return empty array for node with no neighbors", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));

			const result = graph.getNeighbors("n1");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});
	});

	describe("getOutgoingEdges", () => {
		it("should return outgoing edges for directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n3"));

			const result = graph.getOutgoingEdges("n1");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].target).toBe("n2");
			}
		});

		it("should return edges from both directions for undirected graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addEdge(createEdge("e1", "n1", "n2"));

			// For undirected, n2 should also "see" the edge
			const result = graph.getOutgoingEdges("n2");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
			}
		});

		it("should return error for non-existing node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const result = graph.getOutgoingEdges("n1");

			expect(result.ok).toBe(false);
		});
	});

	describe("getAllNodes", () => {
		it("should return all nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));

			const nodes = graph.getAllNodes();

			expect(nodes).toHaveLength(3);
			const ids = nodes.map((n) => n.id);
			expect(ids).toContain("n1");
			expect(ids).toContain("n2");
			expect(ids).toContain("n3");
		});

		it("should return empty array for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const nodes = graph.getAllNodes();

			expect(nodes).toHaveLength(0);
		});
	});

	describe("getAllEdges", () => {
		it("should return all edges", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addNode(createNode("n3"));
			graph.addEdge(createEdge("e1", "n1", "n2"));
			graph.addEdge(createEdge("e2", "n2", "n3"));

			const edges = graph.getAllEdges();

			expect(edges).toHaveLength(2);
			const ids = edges.map((e) => e.id);
			expect(ids).toContain("e1");
			expect(ids).toContain("e2");
		});

		it("should return empty array for graph with no edges", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));

			const edges = graph.getAllEdges();

			expect(edges).toHaveLength(0);
		});
	});

	describe("getNodeCount and getEdgeCount", () => {
		it("should return correct counts", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addEdge(createEdge("e1", "n1", "n2"));

			expect(graph.getNodeCount()).toBe(2);
			expect(graph.getEdgeCount()).toBe(1);
		});

		it("should update counts after removal", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("n1"));
			graph.addNode(createNode("n2"));
			graph.addEdge(createEdge("e1", "n1", "n2"));

			graph.removeNode("n2");

			expect(graph.getNodeCount()).toBe(1);
			expect(graph.getEdgeCount()).toBe(0);
		});
	});
});

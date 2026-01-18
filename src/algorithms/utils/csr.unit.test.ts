import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { type Edge, type Node } from "../types/graph";
import { convertToCSR } from "./csr";

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

describe("convertToCSR", () => {
	describe("basic conversion", () => {
		it("should convert empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const csr = convertToCSR(graph);

			expect(csr.nodeIds.length).toBe(0);
			expect(csr.nodeIndex.size).toBe(0);
			expect(csr.offsets.length).toBe(1); // n + 1 = 0 + 1
			expect(csr.edges.length).toBe(0);
			expect(csr.weights.length).toBe(0);
		});

		it("should convert single node graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));

			const csr = convertToCSR(graph);

			expect(csr.nodeIds.length).toBe(1);
			expect(csr.nodeIds[0]).toBe("A");
			expect(csr.nodeIndex.get("A")).toBe(0);
			expect(csr.offsets.length).toBe(2);
			expect(csr.offsets[0]).toBe(0);
			expect(csr.offsets[1]).toBe(0);
		});

		it("should convert simple directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B", 1));

			const csr = convertToCSR(graph);

			expect(csr.nodeIds.length).toBe(2);
			expect(csr.nodeIndex.get("A")).toBe(0);
			expect(csr.nodeIndex.get("B")).toBe(1);
			expect(csr.offsets.length).toBe(3);
			expect(csr.edges.length).toBe(1);
			expect(csr.weights.length).toBe(1);
			expect(csr.weights[0]).toBe(1);
		});
	});

	describe("CSR structure", () => {
		it("should correctly populate offsets array", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "B", "C"));

			const csr = convertToCSR(graph);

			const aIndex = csr.nodeIndex.get("A")!;
			const bIndex = csr.nodeIndex.get("B")!;
			const cIndex = csr.nodeIndex.get("C")!;

			// A has 2 outgoing edges
			expect(csr.offsets[aIndex + 1] - csr.offsets[aIndex]).toBe(2);
			// B has 1 outgoing edge
			expect(csr.offsets[bIndex + 1] - csr.offsets[bIndex]).toBe(1);
			// C has 0 outgoing edges
			expect(csr.offsets[cIndex + 1] - csr.offsets[cIndex]).toBe(0);
		});

		it("should correctly store neighbor indices in edges array", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B", 1));
			graph.addEdge(createEdge("E2", "A", "C", 2));

			const csr = convertToCSR(graph);

			const aIndex = csr.nodeIndex.get("A")!;
			const bIndex = csr.nodeIndex.get("B")!;
			const cIndex = csr.nodeIndex.get("C")!;

			// Get A's neighbors
			const start = csr.offsets[aIndex];
			const end = csr.offsets[aIndex + 1];
			const neighborIndices = csr.edges.slice(start, end);

			expect(neighborIndices).toContain(bIndex);
			expect(neighborIndices).toContain(cIndex);
		});

		it("should store weights for each edge", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B", 1.5));
			graph.addEdge(createEdge("E2", "A", "C", 2.5));

			const csr = convertToCSR(graph);

			const aIndex = csr.nodeIndex.get("A")!;
			const start = csr.offsets[aIndex];
			const end = csr.offsets[aIndex + 1];
			const weights = csr.weights.slice(start, end);

			expect(weights.length).toBe(2);
			expect(weights).toContain(1.5);
			expect(weights).toContain(2.5);
		});
	});

	describe("weight handling", () => {
		it("should default weight to 1 for unweighted edges", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B")); // No weight

			const csr = convertToCSR(graph);

			expect(csr.weights[0]).toBe(1);
		});

		it("should preserve explicit weights", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B", 3.14));

			const csr = convertToCSR(graph);

			expect(csr.weights[0]).toBeCloseTo(3.14);
		});
	});

	describe("typed arrays", () => {
		it("should use Uint32Array for offsets", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));

			const csr = convertToCSR(graph);

			expect(csr.offsets).toBeInstanceOf(Uint32Array);
		});

		it("should use Uint32Array for edges", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const csr = convertToCSR(graph);

			expect(csr.edges).toBeInstanceOf(Uint32Array);
		});

		it("should use Float64Array for weights", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B", 1));

			const csr = convertToCSR(graph);

			expect(csr.weights).toBeInstanceOf(Float64Array);
		});
	});

	describe("graph reference", () => {
		it("should maintain reference to original graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A", "Node A"));

			const csr = convertToCSR(graph);

			expect(csr.graph).toBe(graph);
			// Can access original node through reference
			const node = csr.graph.getNode("A");
			expect(node.some).toBe(true);
			if (node.some) {
				expect(node.value.label).toBe("Node A");
			}
		});
	});

	describe("node index mapping", () => {
		it("should provide bidirectional mapping", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("X"));
			graph.addNode(createNode("Y"));
			graph.addNode(createNode("Z"));

			const csr = convertToCSR(graph);

			// Index to ID
			const index0 = csr.nodeIndex.get(csr.nodeIds[0]);
			expect(index0).toBe(0);

			// ID to index
			for (const [id, index] of csr.nodeIndex) {
				expect(csr.nodeIds[index]).toBe(id);
			}
		});
	});

	describe("neighbor lookup", () => {
		it("should allow O(1) neighbor lookup", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));

			const csr = convertToCSR(graph);

			// Get neighbors of A
			const aIndex = csr.nodeIndex.get("A")!;
			const start = csr.offsets[aIndex];
			const end = csr.offsets[aIndex + 1];

			const neighborIds = [];
			for (let index = start; index < end; index++) {
				neighborIds.push(csr.nodeIds[csr.edges[index]]);
			}

			expect(neighborIds).toContain("B");
			expect(neighborIds).toContain("C");
			expect(neighborIds.length).toBe(2);
		});

		it("should handle node with no outgoing edges", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B")); // Only A -> B

			const csr = convertToCSR(graph);

			// B has no outgoing edges
			const bIndex = csr.nodeIndex.get("B")!;
			const start = csr.offsets[bIndex];
			const end = csr.offsets[bIndex + 1];

			expect(end - start).toBe(0);
		});
	});

	describe("larger graphs", () => {
		it("should handle graph with many nodes and edges", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			// Create 100 nodes
			for (let index = 0; index < 100; index++) {
				graph.addNode(createNode(`N${index}`));
			}

			// Create chain edges
			for (let index = 0; index < 99; index++) {
				graph.addEdge(createEdge(`E${index}`, `N${index}`, `N${index + 1}`, index * 0.1));
			}

			const csr = convertToCSR(graph);

			expect(csr.nodeIds.length).toBe(100);
			expect(csr.edges.length).toBe(99);
			expect(csr.offsets.length).toBe(101);
		});
	});

	describe("edge cases", () => {
		it("should handle self-loops", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addEdge(createEdge("E1", "A", "A", 1)); // Self-loop

			const csr = convertToCSR(graph);

			const aIndex = csr.nodeIndex.get("A")!;
			const start = csr.offsets[aIndex];
			const end = csr.offsets[aIndex + 1];

			expect(end - start).toBe(1);
			expect(csr.edges[start]).toBe(aIndex); // Points to itself
		});

		it("should handle multiple edges between same nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B", 1));
			graph.addEdge(createEdge("E2", "A", "B", 2)); // Parallel edge

			const csr = convertToCSR(graph);

			const aIndex = csr.nodeIndex.get("A")!;
			const start = csr.offsets[aIndex];
			const end = csr.offsets[aIndex + 1];

			expect(end - start).toBe(2);
		});
	});
});

/**
 * Unit tests for Dijkstra's shortest path algorithm
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { dijkstra } from "./dijkstra";

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
	weight?: number;
	[key: string]: unknown;
}

const createNode = (id: string): TestNode => ({ id, type: "test" });
const createEdge = (id: string, source: string, target: string, weight?: number): TestEdge => ({
	id,
	source,
	target,
	type: "test",
	weight,
});

describe("dijkstra", () => {
	describe("error handling", () => {
		it("should return error for null graph", () => {
			// @ts-expect-error - Testing null input
			const result = dijkstra(null, "A", "B");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should return error for non-existing start node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("B"));

			const result = dijkstra(graph, "A", "B");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
				expect(result.error.message).toContain("Start node");
			}
		});

		it("should return error for non-existing end node", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));

			const result = dijkstra(graph, "A", "B");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
				expect(result.error.message).toContain("End node");
			}
		});
	});

	describe("trivial cases", () => {
		it("should return path with single node when start equals end", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));

			const result = dijkstra(graph, "A", "A");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.nodes).toHaveLength(1);
				expect(result.value.value.edges).toHaveLength(0);
				expect(result.value.value.totalWeight).toBe(0);
			}
		});

		it("should return None when no path exists", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			// No edge between A and B

			const result = dijkstra(graph, "A", "B");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(false);
			}
		});
	});

	describe("simple paths", () => {
		it("should find direct path", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B", 5));

			const result = dijkstra(graph, "A", "B");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value;
				expect(path.nodes).toHaveLength(2);
				expect(path.nodes[0].id).toBe("A");
				expect(path.nodes[1].id).toBe("B");
				expect(path.edges).toHaveLength(1);
				expect(path.totalWeight).toBe(5);
			}
		});

		it("should find path through multiple nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B", 3));
			graph.addEdge(createEdge("e2", "B", "C", 4));

			const result = dijkstra(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value;
				expect(path.nodes).toHaveLength(3);
				expect(path.nodes.map((n) => n.id)).toEqual(["A", "B", "C"]);
				expect(path.totalWeight).toBe(7);
			}
		});
	});

	describe("shortest path selection", () => {
		it("should find shortest path when multiple paths exist", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// Direct path A -> C with weight 10
			graph.addEdge(createEdge("e1", "A", "C", 10));
			// Indirect path A -> B -> C with total weight 7
			graph.addEdge(createEdge("e2", "A", "B", 3));
			graph.addEdge(createEdge("e3", "B", "C", 4));

			const result = dijkstra(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value;
				// Should take the shorter indirect path
				expect(path.totalWeight).toBe(7);
				expect(path.nodes).toHaveLength(3);
			}
		});

		it("should prefer direct path when it's shorter", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// Direct path A -> C with weight 5
			graph.addEdge(createEdge("e1", "A", "C", 5));
			// Indirect path A -> B -> C with total weight 10
			graph.addEdge(createEdge("e2", "A", "B", 6));
			graph.addEdge(createEdge("e3", "B", "C", 4));

			const result = dijkstra(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value;
				expect(path.totalWeight).toBe(5);
				expect(path.nodes).toHaveLength(2);
			}
		});
	});

	describe("undirected graphs", () => {
		it("should find path in undirected graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B", 3));
			graph.addEdge(createEdge("e2", "B", "C", 4));

			// Can go either direction
			const result = dijkstra(graph, "C", "A");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value;
				expect(path.totalWeight).toBe(7);
			}
		});
	});

	describe("default weights", () => {
		it("should use weight 1 when edge has no weight", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B")); // No weight
			graph.addEdge(createEdge("e2", "B", "C")); // No weight

			const result = dijkstra(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value;
				expect(path.totalWeight).toBe(2); // 1 + 1
			}
		});
	});

	describe("custom weight function", () => {
		it("should use custom weight function", () => {
			interface WeightedNode extends TestNode {
				cost: number;
			}

			const graph = new Graph<WeightedNode, TestEdge>(true);
			graph.addNode({ id: "A", type: "test", cost: 1 });
			graph.addNode({ id: "B", type: "test", cost: 5 });
			graph.addNode({ id: "C", type: "test", cost: 2 });
			graph.addEdge(createEdge("e1", "A", "B", 1));
			graph.addEdge(createEdge("e2", "B", "C", 1));

			// Custom weight function using target node cost
			const result = dijkstra(graph, "A", "C", (_edge, _source, target) => target.cost);

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value;
				expect(path.totalWeight).toBe(7); // B.cost (5) + C.cost (2)
			}
		});
	});

	describe("complex graphs", () => {
		it("should handle diamond shaped graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			// A -> B -> D (weight 5)
			graph.addEdge(createEdge("e1", "A", "B", 2));
			graph.addEdge(createEdge("e2", "B", "D", 3));
			// A -> C -> D (weight 6)
			graph.addEdge(createEdge("e3", "A", "C", 3));
			graph.addEdge(createEdge("e4", "C", "D", 3));

			const result = dijkstra(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.totalWeight).toBe(5);
			}
		});

		it("should handle graph with multiple equal-weight paths", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			// Two paths with equal weight
			graph.addEdge(createEdge("e1", "A", "B", 2));
			graph.addEdge(createEdge("e2", "B", "D", 2));
			graph.addEdge(createEdge("e3", "A", "C", 2));
			graph.addEdge(createEdge("e4", "C", "D", 2));

			const result = dijkstra(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.totalWeight).toBe(4);
			}
		});
	});

	describe("edge cases", () => {
		it("should handle zero weight edges", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B", 0));

			const result = dijkstra(graph, "A", "B");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.totalWeight).toBe(0);
			}
		});

		it("should handle graph with self-loop", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "A", 1)); // Self-loop
			graph.addEdge(createEdge("e2", "A", "B", 5));

			const result = dijkstra(graph, "A", "B");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.totalWeight).toBe(5);
			}
		});
	});
});

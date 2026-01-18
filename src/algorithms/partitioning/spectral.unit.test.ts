/**
 * Unit tests for spectral graph partitioning
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { spectralPartition } from "./spectral";

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

describe("spectralPartition", () => {
	describe("error handling", () => {
		it("should return error for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);

			const result = spectralPartition(graph, 2);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("EmptyGraph");
			}
		});

		it("should return error for k < 2", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = spectralPartition(graph, 1);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("InvalidPartitionCount");
			}
		});

		it("should return error when k exceeds node count", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));

			const result = spectralPartition(graph, 5);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("InvalidPartitionCount");
			}
		});
	});

	describe("basic partitioning", () => {
		it("should partition small graph into 2 partitions", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "C", "D"));

			const result = spectralPartition(graph, 2);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(2);

				// Check all nodes are assigned
				const allAssignedNodes = new Set<string>();
				for (const partition of result.value) {
					for (const node of partition.nodes) {
						allAssignedNodes.add(node.id);
					}
				}
				expect(allAssignedNodes.size).toBe(4);
			}
		});

		it("should partition connected graph into 2 partitions", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Line graph: A-B-C-D
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "D"));

			const result = spectralPartition(graph, 2);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(2);
			}
		});

		it("should partition into 3 partitions", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// 6 nodes to partition into 3
			for (const id of ["A", "B", "C", "D", "E", "F"]) {
				graph.addNode(createNode(id));
			}
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "C", "D"));
			graph.addEdge(createEdge("e3", "E", "F"));

			const result = spectralPartition(graph, 3);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(3);
			}
		});
	});

	describe("partition properties", () => {
		it("should return partitions with valid size", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			for (const id of ["A", "B", "C", "D"]) {
				graph.addNode(createNode(id));
			}
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "D"));

			const result = spectralPartition(graph, 2);

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const partition of result.value) {
					expect(partition.size).toBe(partition.nodes.size);
					expect(partition.size).toBeGreaterThan(0);
				}
			}
		});

		it("should have non-negative edge cuts", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			for (const id of ["A", "B", "C", "D"]) {
				graph.addNode(createNode(id));
			}
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "D"));

			const result = spectralPartition(graph, 2);

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const partition of result.value) {
					expect(partition.edgeCuts).toBeGreaterThanOrEqual(0);
				}
			}
		});

		it("should calculate balance ratio", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			for (const id of ["A", "B", "C", "D"]) {
				graph.addNode(createNode(id));
			}
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "C", "D"));

			const result = spectralPartition(graph, 2);

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const partition of result.value) {
					expect(partition.balance).toBeGreaterThan(0);
				}
			}
		});
	});

	describe("options", () => {
		it("should accept custom weight function", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B", 10));
			graph.addEdge(createEdge("e2", "C", "D", 1));

			const result = spectralPartition(graph, 2, {
				weightFn: (edge) => edge.weight ?? 1,
			});

			expect(result.ok).toBe(true);
		});

		it("should accept balance tolerance", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			for (const id of ["A", "B", "C", "D", "E"]) {
				graph.addNode(createNode(id));
			}
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "D", "E"));

			const result = spectralPartition(graph, 2, {
				balanceTolerance: 1.5,
			});

			expect(result.ok).toBe(true);
		});

		it("should accept maxKMeansIterations", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			for (const id of ["A", "B", "C", "D"]) {
				graph.addNode(createNode(id));
			}
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "C", "D"));

			const result = spectralPartition(graph, 2, {
				maxKMeansIterations: 50,
			});

			expect(result.ok).toBe(true);
		});
	});

	describe("directed graphs", () => {
		it("should partition directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "D"));

			const result = spectralPartition(graph, 2);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(2);
			}
		});
	});
});

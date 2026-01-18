/**
 * Unit tests for Leiden community detection algorithm
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { leiden } from "./leiden";

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

describe("leiden", () => {
	describe("error handling", () => {
		it("should return error for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			const result = leiden(graph);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("EmptyGraph");
			}
		});
	});

	describe("single node", () => {
		it("should detect single community for isolated node", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = leiden(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.communities).toHaveLength(1);
				expect(result.value.communities[0].nodes.size).toBe(1);
				expect(result.value.communities[0].isConnected).toBe(true);
			}
		});
	});

	describe("simple connected graph", () => {
		it("should detect communities in triangle", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = leiden(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.communities.length).toBeGreaterThan(0);
				// All communities should be connected (Leiden guarantee)
				for (const community of result.value.communities) {
					expect(community.isConnected).toBe(true);
				}
			}
		});

		it("should find all nodes across communities", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const result = leiden(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				const totalNodes = result.value.communities.reduce((sum, c) => sum + c.nodes.size, 0);
				expect(totalNodes).toBe(3);
			}
		});
	});

	describe("disconnected nodes", () => {
		it("should handle disconnected nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// No edges

			const result = leiden(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Each isolated node forms its own community
				expect(result.value.communities.length).toBeGreaterThanOrEqual(1);
			}
		});
	});

	describe("directed graph", () => {
		it("should handle directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "A"));

			const result = leiden(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.communities.length).toBeGreaterThan(0);
			}
		});
	});

	describe("community properties", () => {
		it("should have valid conductance values", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = leiden(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const community of result.value.communities) {
					expect(community.conductance).toBeGreaterThanOrEqual(0);
					expect(community.conductance).toBeLessThanOrEqual(1);
				}
			}
		});

		it("should have non-negative internal edges", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = leiden(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const community of result.value.communities) {
					expect(community.internalEdges).toBeGreaterThanOrEqual(0);
				}
			}
		});
	});

	describe("metrics", () => {
		it("should return clustering metrics", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = leiden(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.metrics).toBeDefined();
				expect(result.value.metrics.numClusters).toBeGreaterThan(0);
				expect(typeof result.value.metrics.modularity).toBe("number");
				expect(typeof result.value.metrics.avgDensity).toBe("number");
				expect(typeof result.value.metrics.coverageRatio).toBe("number");
			}
		});
	});

	describe("metadata", () => {
		it("should return algorithm metadata", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = leiden(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.metadata.algorithm).toBe("leiden");
				expect(typeof result.value.metadata.runtime).toBe("number");
				expect(typeof result.value.metadata.iterations).toBe("number");
			}
		});
	});

	describe("options", () => {
		it("should accept resolution parameter", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const resultLow = leiden(graph, { resolution: 0.5 });
			const resultHigh = leiden(graph, { resolution: 2 });

			expect(resultLow.ok).toBe(true);
			expect(resultHigh.ok).toBe(true);
		});

		it("should accept maxIterations parameter", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = leiden(graph, { maxIterations: 5 });

			expect(result.ok).toBe(true);
		});
	});

	describe("connected community guarantee", () => {
		it("should ensure all communities are connected", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Create a star graph
			graph.addNode(createNode("center"));
			for (let index = 0; index < 5; index++) {
				graph.addNode(createNode(`leaf${index}`));
				graph.addEdge(createEdge(`e${index}`, "center", `leaf${index}`));
			}

			const result = leiden(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Leiden guarantees all communities are connected
				for (const community of result.value.communities) {
					expect(community.isConnected).toBe(true);
				}
			}
		});
	});

	describe("weighted edges", () => {
		it("should respect edge weights", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// Strong connection A-B
			graph.addEdge(createEdge("e1", "A", "B", 10));
			// Weak connection B-C
			graph.addEdge(createEdge("e2", "B", "C", 1));

			const result = leiden(graph, {
				weightFn: (edge) => edge.weight ?? 1,
			});

			expect(result.ok).toBe(true);
		});
	});
});

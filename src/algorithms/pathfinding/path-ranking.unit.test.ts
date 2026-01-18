import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { type Edge, type Node } from "../types/graph";
import {
	createPathRanker,
	getBestPath,
	rankPaths,
} from "./path-ranking";

// Test node and edge types
interface TestNode extends Node {
	id: string;
	type: string;
	value?: number;
}

interface TestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: string;
	weight?: number;
}

// Helper to create a test node
const createNode = (id: string, value?: number): TestNode => ({
	id,
	type: "test",
	value,
});

// Helper to create a test edge
const createEdge = (id: string, source: string, target: string, weight?: number): TestEdge => ({
	id,
	source,
	target,
	type: "test",
	weight,
});

describe("rankPaths", () => {
	describe("validation", () => {
		it("should return error for missing start node", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = rankPaths(graph, "X", "A");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should return error for missing end node", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = rankPaths(graph, "A", "X");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});
	});

	describe("path finding", () => {
		it("should return None when no path exists", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			// No edge between A and B

			const result = rankPaths(graph, "A", "B");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(false);
			}
		});

		it("should find path from node to itself", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const result = rankPaths(graph, "A", "A");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.length).toBe(1);
				expect(result.value.value[0].path.nodes.length).toBe(1);
				expect(result.value.value[0].path.edges.length).toBe(0);
			}
		});

		it("should find single path between two nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = rankPaths(graph, "A", "B");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.length).toBe(1);
				expect(result.value.value[0].path.nodes.length).toBe(2);
				expect(result.value.value[0].path.edges.length).toBe(1);
			}
		});

		it("should find all shortest paths", () => {
			// Diamond graph: A -> B -> D and A -> C -> D
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "B", "D"));
			graph.addEdge(createEdge("E4", "C", "D"));

			const result = rankPaths(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.length).toBe(2);
				// Both paths should have length 2
				expect(result.value.value[0].path.edges.length).toBe(2);
				expect(result.value.value[1].path.edges.length).toBe(2);
			}
		});
	});

	describe("ranking scores", () => {
		it("should include score and geometric mean MI", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = rankPaths(graph, "A", "B");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const ranked = result.value.value[0];
				expect(typeof ranked.score).toBe("number");
				expect(typeof ranked.geometricMeanMI).toBe("number");
				expect(Array.isArray(ranked.edgeMIValues)).toBe(true);
			}
		});

		it("should sort paths by score descending", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "B", "D"));
			graph.addEdge(createEdge("E4", "C", "D"));

			const result = rankPaths(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some && result.value.value.length > 1) {
				expect(result.value.value[0].score).toBeGreaterThanOrEqual(
					result.value.value[1].score
				);
			}
		});
	});

	describe("length penalty", () => {
		it("should apply length penalty when lambda > 0", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = rankPaths(graph, "A", "B", { lambda: 0.5 });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const ranked = result.value.value[0];
				expect(ranked.lengthPenalty).toBeDefined();
				expect(ranked.lengthPenalty).toBeLessThan(1);
			}
		});

		it("should not include length penalty when lambda = 0", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = rankPaths(graph, "A", "B", { lambda: 0 });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const ranked = result.value.value[0];
				expect(ranked.lengthPenalty).toBeUndefined();
			}
		});
	});

	describe("weight modes", () => {
		it("should apply divide weight mode", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B", 2));

			const result = rankPaths(graph, "A", "B", { weightMode: "divide" });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const ranked = result.value.value[0];
				expect(ranked.weightFactor).toBeDefined();
			}
		});

		it("should apply multiplicative weight mode", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B", 2));

			const result = rankPaths(graph, "A", "B", { weightMode: "multiplicative" });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const ranked = result.value.value[0];
				expect(ranked.weightFactor).toBeDefined();
			}
		});

		it("should use custom weight extractor", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B", 5));

			const result = rankPaths(graph, "A", "B", {
				weightMode: "divide",
				weightExtractor: (edge) => edge.weight ?? 1,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value[0].weightFactor).toBeDefined();
			}
		});
	});

	describe("traversal modes", () => {
		it("should respect directed traversal on directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B")); // A -> B only

			// Forward direction should work
			const forward = rankPaths(graph, "A", "B", { traversalMode: "directed" });
			expect(forward.ok).toBe(true);
			if (forward.ok) {
				expect(forward.value.some).toBe(true);
			}

			// Reverse direction should not find path
			const reverse = rankPaths(graph, "B", "A", { traversalMode: "directed" });
			expect(reverse.ok).toBe(true);
			if (reverse.ok) {
				expect(reverse.value.some).toBe(false);
			}
		});

		it("should allow undirected traversal on directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const result = rankPaths(graph, "B", "A", { traversalMode: "undirected" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(true);
			}
		});
	});

	describe("maxPaths limit", () => {
		it("should limit results to maxPaths", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Create graph with multiple paths
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addNode(createNode("E"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "A", "D"));
			graph.addEdge(createEdge("E4", "B", "E"));
			graph.addEdge(createEdge("E5", "C", "E"));
			graph.addEdge(createEdge("E6", "D", "E"));

			const result = rankPaths(graph, "A", "E", { maxPaths: 2 });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				expect(result.value.value.length).toBeLessThanOrEqual(2);
			}
		});
	});

	describe("shortestOnly option", () => {
		it("should only find shortest paths by default", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));
			graph.addEdge(createEdge("E3", "A", "C")); // Direct path

			const result = rankPaths(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				// Should only find the direct path (length 1)
				expect(result.value.value.every((p) => p.path.edges.length === 1)).toBe(true);
			}
		});

		it("should find longer paths when shortestOnly is false", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));
			graph.addEdge(createEdge("E3", "A", "C"));

			const result = rankPaths(graph, "A", "C", {
				shortestOnly: false,
				maxLength: 3,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				// Should find both paths
				const lengths = result.value.value.map((p) => p.path.edges.length);
				expect(lengths).toContain(1); // Direct A->C
				expect(lengths).toContain(2); // A->B->C
			}
		});
	});
});

describe("getBestPath", () => {
	it("should return single best path", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addEdge(createEdge("E1", "A", "B"));
		graph.addEdge(createEdge("E2", "A", "C"));
		graph.addEdge(createEdge("E3", "B", "C"));

		const result = getBestPath(graph, "A", "C");

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			expect(result.value.value.path).toBeDefined();
			expect(result.value.value.score).toBeDefined();
		}
	});

	it("should return None when no path exists", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));

		const result = getBestPath(graph, "A", "B");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.some).toBe(false);
		}
	});
});

describe("createPathRanker", () => {
	it("should create ranker with pre-computed MI cache", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addEdge(createEdge("E1", "A", "B"));
		graph.addEdge(createEdge("E2", "B", "C"));

		const ranker = createPathRanker(graph);

		// Cache should be accessible
		const cache = ranker.getMICache();
		expect(cache.size).toBe(2);
	});

	it("should rank paths using cached MI", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addEdge(createEdge("E1", "A", "B"));
		graph.addEdge(createEdge("E2", "B", "C"));

		const ranker = createPathRanker(graph);

		const result = ranker.rank("A", "C");

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			expect(result.value.value.length).toBeGreaterThan(0);
		}
	});

	it("should get best path using cached MI", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addEdge(createEdge("E1", "A", "B"));

		const ranker = createPathRanker(graph);

		const result = ranker.getBest("A", "B");

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			expect(result.value.value.path).toBeDefined();
		}
	});

	it("should allow overriding config on individual calls", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addEdge(createEdge("E1", "A", "B"));

		const ranker = createPathRanker(graph, { lambda: 0 });

		// Override lambda
		const result = ranker.rank("A", "B", { lambda: 0.5 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			expect(result.value.value[0].lengthPenalty).toBeDefined();
		}
	});
});

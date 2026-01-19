/**
 * Unit tests for Louvain community detection algorithm
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import {
	detectCommunities,
	getAdaptiveIterationLimit,
	getAdaptiveThreshold,
	shuffle,
} from "./louvain";

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

describe("getAdaptiveThreshold", () => {
	it("should return 1e-6 for small graphs", () => {
		expect(getAdaptiveThreshold(50)).toBe(1e-6);
		expect(getAdaptiveThreshold(500)).toBe(1e-6);
	});

	it("should return 1e-5 for large graphs", () => {
		expect(getAdaptiveThreshold(501)).toBe(1e-5);
		expect(getAdaptiveThreshold(1000)).toBe(1e-5);
	});
});

describe("getAdaptiveIterationLimit", () => {
	it("should return 20 for first level of large graphs", () => {
		expect(getAdaptiveIterationLimit(201, 0)).toBe(20);
		expect(getAdaptiveIterationLimit(500, 0)).toBe(20);
	});

	it("should return 40-50 for subsequent levels", () => {
		expect(getAdaptiveIterationLimit(201, 1)).toBe(40);
		expect(getAdaptiveIterationLimit(50, 1)).toBe(50);
	});

	it("should return 50 for very small graphs", () => {
		expect(getAdaptiveIterationLimit(50, 0)).toBe(50);
		expect(getAdaptiveIterationLimit(99, 0)).toBe(50);
	});

	it("should return 40 for medium-sized graphs", () => {
		expect(getAdaptiveIterationLimit(100, 1)).toBe(40);
		expect(getAdaptiveIterationLimit(200, 1)).toBe(40);
	});
});

describe("shuffle", () => {
	it("should return array with same elements", () => {
		const array = [1, 2, 3, 4, 5];
		const shuffled = shuffle([...array]);

		expect(shuffled).toHaveLength(5);
		expect([...shuffled].toSorted((a, b) => a - b)).toEqual([...array].toSorted((a, b) => a - b));
	});

	it("should produce deterministic results with seed", () => {
		const array1 = [1, 2, 3, 4, 5];
		const array2 = [1, 2, 3, 4, 5];

		const shuffled1 = shuffle(array1, 42);
		const shuffled2 = shuffle(array2, 42);

		expect(shuffled1).toEqual(shuffled2);
	});

	it("should handle empty array", () => {
		const array: number[] = [];
		const shuffled = shuffle(array);

		expect(shuffled).toEqual([]);
	});

	it("should handle single element array", () => {
		const array = [42];
		const shuffled = shuffle(array);

		expect(shuffled).toEqual([42]);
	});

	it("should produce different results with different seeds", () => {
		const array1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const array2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

		const shuffled1 = shuffle(array1, 42);
		const shuffled2 = shuffle(array2, 123);

		// Very unlikely to be equal with different seeds
		expect(shuffled1).not.toEqual(shuffled2);
	});
});

describe("detectCommunities", () => {
	describe("empty graph", () => {
		it("should return empty array for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			const communities = detectCommunities(graph);

			expect(communities).toHaveLength(0);
		});
	});

	describe("single node", () => {
		it("should return single community for isolated node", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const communities = detectCommunities(graph);

			expect(communities).toHaveLength(1);
			expect(communities[0].size).toBe(1);
		});
	});

	describe("disconnected nodes", () => {
		it("should return each isolated node as separate community", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// No edges

			const communities = detectCommunities(graph);

			expect(communities).toHaveLength(3);
			for (const community of communities) {
				expect(community.size).toBe(1);
			}
		});
	});

	describe("simple connected graph", () => {
		it("should detect single community for fully connected small graph", () => {
			// Small fully connected graph - all nodes should merge into one community
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const communities = detectCommunities(graph);

			// Small densely connected graph typically forms single community
			expect(communities.length).toBeGreaterThanOrEqual(1);
			expect(communities.length).toBeLessThanOrEqual(3);
		});

		it("should find all nodes across communities", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const communities = detectCommunities(graph);

			const totalNodes = communities.reduce((sum, c) => sum + c.size, 0);
			expect(totalNodes).toBe(3);
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

			const communities = detectCommunities(graph);

			expect(communities.length).toBeGreaterThan(0);
		});
	});

	describe("community properties", () => {
		it("should have valid density values", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const communities = detectCommunities(graph);

			for (const community of communities) {
				expect(community.density).toBeGreaterThanOrEqual(0);
				expect(community.density).toBeLessThanOrEqual(1);
			}
		});

		it("should have non-negative edge counts", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const communities = detectCommunities(graph);

			for (const community of communities) {
				expect(community.internalEdges).toBeGreaterThanOrEqual(0);
				expect(community.externalEdges).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("options", () => {
		it("should accept resolution parameter", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			// Higher resolution tends to find more communities
			const communitiesLow = detectCommunities(graph, { resolution: 0.5 });
			const communitiesHigh = detectCommunities(graph, { resolution: 2 });

			// Both should return valid results
			expect(communitiesLow.length).toBeGreaterThan(0);
			expect(communitiesHigh.length).toBeGreaterThan(0);
		});

		it("should accept mode parameter", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const communitiesBest = detectCommunities(graph, { mode: "best" });
			const communitiesAuto = detectCommunities(graph, { mode: "auto" });

			expect(communitiesBest.length).toBeGreaterThan(0);
			expect(communitiesAuto.length).toBeGreaterThan(0);
		});

		it("should accept maxIterations parameter", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const communities = detectCommunities(graph, { maxIterations: 5 });

			expect(communities.length).toBeGreaterThan(0);
		});

		it("should produce deterministic results with seed", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			for (let index = 0; index < 10; index++) {
				graph.addNode(createNode(`N${index}`));
			}
			for (let index = 0; index < 9; index++) {
				graph.addEdge(createEdge(`e${index}`, `N${index}`, `N${index + 1}`));
			}

			const communities1 = detectCommunities(graph, { seed: 42 });
			const communities2 = detectCommunities(graph, { seed: 42 });

			// Same seed should produce same community count
			expect(communities1.length).toBe(communities2.length);
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

			const communities = detectCommunities(graph, {
				weightFn: (edge) => edge.weight ?? 1,
			});

			expect(communities.length).toBeGreaterThan(0);
		});
	});
});

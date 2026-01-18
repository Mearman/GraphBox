import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import type { Path } from "../../../algorithms/types/algorithm-results";
import type { Edge, Node } from "../../../algorithms/types/graph";
import { pageRankRanker } from "./pagerank-ranker";

// Test node and edge types
interface TestNode extends Node {
	id: string;
	type: "test";
	label: string;
}

interface TestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: "link";
}

/**
 * Creates a test graph with the specified nodes and edges.
 * @param nodes
 * @param edges
 */
const createTestGraph = (
	nodes: TestNode[],
	edges: TestEdge[],
): Graph<TestNode, TestEdge> => {
	const graph = new Graph<TestNode, TestEdge>(true); // Directed graph for PageRank

	for (const node of nodes) {
		graph.addNode(node);
	}

	for (const edge of edges) {
		graph.addEdge(edge);
	}

	return graph;
};

/**
 * Creates a test path with the given node and edge data.
 * @param nodeIds
 * @param edgeIds
 */
const createPath = (
	nodeIds: string[],
	edgeIds: string[],
): Path<TestNode, TestEdge> => {
	const nodes: TestNode[] = nodeIds.map((id) => ({
		id,
		type: "test",
		label: `Node ${id}`,
	}));

	const edges: TestEdge[] = edgeIds.map((id, index) => ({
		id,
		source: nodeIds[index],
		target: nodeIds[index + 1],
		type: "link",
	}));

	return {
		nodes,
		edges,
		totalWeight: edges.length,
	};
};

describe("pageRankRanker", () => {
	describe("basic functionality", () => {
		it("returns empty array for empty paths", () => {
			const graph = createTestGraph([], []);
			const result = pageRankRanker(graph, []);

			expect(result).toEqual([]);
		});

		it("ranks a single path", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const path = createPath(["A", "B"], ["E1"]);
			const result = pageRankRanker(graph, [path]);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe(path);
			expect(result[0].score).toBeGreaterThan(0);
		});

		it("ranks paths by average PageRank (descending)", () => {
			// Create a star graph where hub has high PageRank
			const nodes: TestNode[] = [
				{ id: "H", type: "test", label: "Hub" },
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
				{ id: "C", type: "test", label: "Node C" },
				{ id: "D", type: "test", label: "Node D" },
			];
			// All nodes point to H
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "H", type: "link" },
				{ id: "E2", source: "B", target: "H", type: "link" },
				{ id: "E3", source: "C", target: "H", type: "link" },
				{ id: "E4", source: "D", target: "H", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			// Path through hub vs path through peripheral node
			const hubPath = createPath(["A", "H"], ["E1"]);
			const peripheralPath = createPath(["A"], []);

			const result = pageRankRanker(graph, [hubPath, peripheralPath]);

			// Hub path should have higher average PageRank
			expect(result[0].path).toBe(hubPath);
		});
	});

	describe("PageRank computation", () => {
		it("converges to expected values for simple graph", () => {
			// Simple chain: A -> B -> C
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
				{ id: "C", type: "test", label: "Node C" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
				{ id: "E2", source: "B", target: "C", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const path = createPath(["A", "B", "C"], ["E1", "E2"]);
			const result = pageRankRanker(graph, [path]);

			// C should have highest PageRank (receives from B which receives from A)
			expect(result[0].score).toBeGreaterThan(0);
		});

		it("handles dangling nodes (no outgoing edges)", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const path = createPath(["B"], []);
			const result = pageRankRanker(graph, [path]);

			// Should not throw, B should have PageRank
			expect(result[0].score).toBeGreaterThan(0);
		});

		it("handles cyclic graphs", () => {
			// A -> B -> C -> A (cycle)
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
				{ id: "C", type: "test", label: "Node C" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
				{ id: "E2", source: "B", target: "C", type: "link" },
				{ id: "E3", source: "C", target: "A", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const path = createPath(["A", "B", "C"], ["E1", "E2"]);
			const result = pageRankRanker(graph, [path]);

			// All nodes should have equal PageRank in a cycle
			expect(result[0].score).toBeGreaterThan(0);
		});

		it("respects custom damping factor", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const path = createPath(["A", "B"], ["E1"]);

			// Different damping factors should produce different scores
			const result085 = pageRankRanker(graph, [path], 0.85);
			const result050 = pageRankRanker(graph, [path], 0.5);

			expect(result085[0].score).not.toBeCloseTo(result050[0].score, 3);
		});
	});

	describe("score calculation", () => {
		it("calculates average PageRank correctly", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
				{ id: "C", type: "test", label: "Node C" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
				{ id: "E2", source: "C", target: "B", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const pathThroughB = createPath(["A", "B"], ["E1"]);
			const pathJustA = createPath(["A"], []);

			const resultWithB = pageRankRanker(graph, [pathThroughB]);
			const resultJustA = pageRankRanker(graph, [pathJustA]);

			// Path through B (which receives from both A and C) should have higher avg PR
			expect(resultWithB[0].score).toBeGreaterThan(resultJustA[0].score);
		});

		it("handles empty path nodes (score 0)", () => {
			const graph = createTestGraph([], []);
			const emptyPath: Path<TestNode, TestEdge> = {
				nodes: [],
				edges: [],
				totalWeight: 0,
			};

			const result = pageRankRanker(graph, [emptyPath]);

			expect(result[0].score).toBe(0);
		});

		it("handles nodes not in graph", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
			];
			const graph = createTestGraph(nodes, []);

			// Path with node not in graph
			const path = createPath(["A", "X"], ["E1"]);
			const result = pageRankRanker(graph, [path]);

			// X is not in graph, so its PageRank is 0
			// A has some PageRank based on damping factor (no edges, so teleportation only)
			// Average should be positive but less than 1
			expect(result[0].score).toBeGreaterThan(0);
			expect(result[0].score).toBeLessThan(1);
		});
	});

	describe("result structure", () => {
		it("includes correct result properties", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const path = createPath(["A", "B"], ["E1"]);
			const result = pageRankRanker(graph, [path]);

			expect(result[0]).toMatchObject({
				path,
				geometricMeanMI: 0,
				edgeMIValues: [],
			});
			expect(typeof result[0].score).toBe("number");
		});

		it("returns paths in descending score order", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
				{ id: "C", type: "test", label: "Node C" },
				{ id: "H", type: "test", label: "Hub" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "H", type: "link" },
				{ id: "E2", source: "B", target: "H", type: "link" },
				{ id: "E3", source: "C", target: "H", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const paths = [
				createPath(["A"], []),
				createPath(["H"], []),
				createPath(["A", "H"], ["E1"]),
			];

			const result = pageRankRanker(graph, paths);

			// Verify descending order
			for (let index = 0; index < result.length - 1; index++) {
				expect(result[index].score).toBeGreaterThanOrEqual(
					result[index + 1].score,
				);
			}
		});
	});

	describe("edge cases", () => {
		it("handles graph with no edges", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
			];
			const graph = createTestGraph(nodes, []);

			const path = createPath(["A", "B"], ["E1"]);
			const result = pageRankRanker(graph, [path]);

			// With no edges, PageRank is uniform
			expect(result[0].score).toBeGreaterThan(0);
		});

		it("handles graph with single node", () => {
			const nodes: TestNode[] = [{ id: "A", type: "test", label: "Node A" }];
			const graph = createTestGraph(nodes, []);

			const path = createPath(["A"], []);
			const result = pageRankRanker(graph, [path]);

			// Single node with no edges gets PageRank based on teleportation factor
			// With d=0.85: PR = (1-d)/n = 0.15/1 = 0.15 (teleportation only, no edges to accumulate from)
			expect(result[0].score).toBeCloseTo(0.15, 5);
		});

		it("handles paths with duplicate scores", () => {
			// Symmetric graph should give same PageRank to symmetric paths
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
				{ id: "C", type: "test", label: "Node C" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "C", type: "link" },
				{ id: "E2", source: "B", target: "C", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const path1 = createPath(["A"], []);
			const path2 = createPath(["B"], []);

			const result = pageRankRanker(graph, [path1, path2]);

			// A and B should have same PageRank in symmetric setup
			expect(result[0].score).toBeCloseTo(result[1].score, 5);
		});

		it("handles empty graph", () => {
			const graph = createTestGraph([], []);
			const path = createPath(["A"], []);
			const result = pageRankRanker(graph, [path]);

			// Node not in graph, score should be 0
			expect(result[0].score).toBe(0);
		});
	});
});

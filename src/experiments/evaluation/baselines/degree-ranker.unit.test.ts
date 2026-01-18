import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import type { Path } from "../../../algorithms/types/algorithm-results";
import type { Edge, Node } from "../../../algorithms/types/graph";
import { degreeBasedRanker } from "./degree-ranker";

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
	const graph = new Graph<TestNode, TestEdge>(false);

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

describe("degreeBasedRanker", () => {
	describe("basic functionality", () => {
		it("returns empty array for empty paths", () => {
			const graph = createTestGraph([], []);
			const result = degreeBasedRanker(graph, []);

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
			const result = degreeBasedRanker(graph, [path]);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe(path);
			// Each node has degree 1, average = 1
			expect(result[0].score).toBe(1);
		});

		it("ranks paths by average degree (descending)", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
				{ id: "C", type: "test", label: "Node C" },
				{ id: "D", type: "test", label: "Node D" },
				{ id: "H", type: "test", label: "Hub H" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
				{ id: "E2", source: "C", target: "H", type: "link" },
				{ id: "E3", source: "H", target: "D", type: "link" },
				{ id: "E4", source: "H", target: "A", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			// Path through low-degree nodes: A -> B
			const lowDegreePath = createPath(["A", "B"], ["E1"]);
			// Path through hub: C -> H -> D (H has degree 3)
			const highDegreePath = createPath(["C", "H", "D"], ["E2", "E3"]);

			const result = degreeBasedRanker(graph, [lowDegreePath, highDegreePath]);

			expect(result).toHaveLength(2);
			// High degree path should be ranked first
			expect(result[0].path).toBe(highDegreePath);
			expect(result[1].path).toBe(lowDegreePath);
		});
	});

	describe("score calculation", () => {
		it("calculates average degree correctly", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
				{ id: "C", type: "test", label: "Node C" },
			];
			// A-B-C forms a chain, B is connected to both
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
				{ id: "E2", source: "B", target: "C", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const path = createPath(["A", "B", "C"], ["E1", "E2"]);
			const result = degreeBasedRanker(graph, [path]);

			// A has degree 1, B has degree 2, C has degree 1
			// Average = (1 + 2 + 1) / 3 = 4/3
			expect(result[0].score).toBeCloseTo(4 / 3, 5);
		});

		it("handles nodes not in graph (degree 0)", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
			];
			const graph = createTestGraph(nodes, []);

			// Path with node not in graph
			const path = createPath(["A", "X"], ["E1"]);
			const result = degreeBasedRanker(graph, [path]);

			// A has degree 0 (no edges), X is not in graph (degree 0)
			// Average = 0
			expect(result[0].score).toBe(0);
		});

		it("handles empty path nodes (score 0)", () => {
			const graph = createTestGraph([], []);
			const emptyPath: Path<TestNode, TestEdge> = {
				nodes: [],
				edges: [],
				totalWeight: 0,
			};

			const result = degreeBasedRanker(graph, [emptyPath]);

			expect(result[0].score).toBe(0);
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
			const result = degreeBasedRanker(graph, [path]);

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
				{ id: "D", type: "test", label: "Node D" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
				{ id: "E2", source: "A", target: "C", type: "link" },
				{ id: "E3", source: "A", target: "D", type: "link" },
				{ id: "E4", source: "B", target: "C", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const paths = [
				createPath(["D"], []),
				createPath(["A", "B"], ["E1"]),
				createPath(["A", "B", "C"], ["E1", "E4"]),
			];

			const result = degreeBasedRanker(graph, paths);

			// Verify descending order
			for (let index = 0; index < result.length - 1; index++) {
				expect(result[index].score).toBeGreaterThanOrEqual(
					result[index + 1].score,
				);
			}
		});
	});

	describe("edge cases", () => {
		it("handles graph with self-loops", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "A", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			const path = createPath(["A"], []);
			const result = degreeBasedRanker(graph, [path]);

			// Self-loop counts as one neighbor
			expect(result[0].score).toBe(1);
		});

		it("handles paths with duplicate scores", () => {
			const nodes: TestNode[] = [
				{ id: "A", type: "test", label: "Node A" },
				{ id: "B", type: "test", label: "Node B" },
				{ id: "C", type: "test", label: "Node C" },
				{ id: "D", type: "test", label: "Node D" },
			];
			const edges: TestEdge[] = [
				{ id: "E1", source: "A", target: "B", type: "link" },
				{ id: "E2", source: "C", target: "D", type: "link" },
			];
			const graph = createTestGraph(nodes, edges);

			// Both paths have nodes with degree 1
			const path1 = createPath(["A", "B"], ["E1"]);
			const path2 = createPath(["C", "D"], ["E2"]);

			const result = degreeBasedRanker(graph, [path1, path2]);

			expect(result).toHaveLength(2);
			expect(result[0].score).toBe(result[1].score);
		});

		it("handles large hub node", () => {
			const nodes: TestNode[] = [
				{ id: "H", type: "test", label: "Hub" },
				...Array.from({ length: 100 }, (_, index) => ({
					id: `N${index}`,
					type: "test" as const,
					label: `Node ${index}`,
				})),
			];
			const edges: TestEdge[] = Array.from({ length: 100 }, (_, index) => ({
				id: `E${index}`,
				source: "H",
				target: `N${index}`,
				type: "link" as const,
			}));
			const graph = createTestGraph(nodes, edges);

			const path = createPath(["H", "N0"], ["E0"]);
			const result = degreeBasedRanker(graph, [path]);

			// Hub has degree 100, N0 has degree 1
			// Average = (100 + 1) / 2 = 50.5
			expect(result[0].score).toBe(50.5);
		});
	});
});

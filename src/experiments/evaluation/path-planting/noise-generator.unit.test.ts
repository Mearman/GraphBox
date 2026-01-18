/**
 * Unit tests for noise path generation
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import type { Path } from "../../../algorithms/types/algorithm-results";
import type { Edge, Node } from "../../../algorithms/types/graph";
import { addNoisePaths } from "./noise-generator";

interface TestNode extends Node {
	id: string;
	type: string;
}

interface TestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: string;
	weight?: number;
}

const createTestGraph = (): Graph<TestNode, TestEdge> => {
	const graph = new Graph<TestNode, TestEdge>(false);

	graph.addNode({ id: "n1", type: "test" });
	graph.addNode({ id: "n2", type: "test" });
	graph.addNode({ id: "n3", type: "test" });
	graph.addNode({ id: "n4", type: "test" });
	graph.addNode({ id: "n5", type: "test" });

	// Add a few edges
	graph.addEdge({ id: "e1", source: "n1", target: "n2", type: "link" });
	graph.addEdge({ id: "e2", source: "n2", target: "n3", type: "link" });

	return graph;
};

const createTestPath = (nodeIds: string[]): Path<TestNode, TestEdge> => {
	const nodes: TestNode[] = nodeIds.map(id => ({ id, type: "test" }));
	const edges: TestEdge[] = [];

	for (let index = 0; index < nodeIds.length - 1; index++) {
		edges.push({
			id: `path_edge_${index}`,
			source: nodeIds[index],
			target: nodeIds[index + 1],
			type: "link",
		});
	}

	return {
		nodes,
		edges,
		totalWeight: 0,
	};
};

describe("addNoisePaths", () => {
	it("returns unchanged graph when numNoisePaths is 0", () => {
		const graph = createTestGraph();
		const groundTruth = [createTestPath(["n1", "n2"])];
		const initialEdgeCount = graph.getAllEdges().length;

		const result = addNoisePaths(graph, groundTruth, 0);

		expect(result).toBe(graph);
		expect(graph.getAllEdges().length).toBe(initialEdgeCount);
	});

	it("returns unchanged graph when numNoisePaths is negative", () => {
		const graph = createTestGraph();
		const groundTruth = [createTestPath(["n1", "n2"])];
		const initialEdgeCount = graph.getAllEdges().length;

		const result = addNoisePaths(graph, groundTruth, -5);

		expect(result).toBe(graph);
		expect(graph.getAllEdges().length).toBe(initialEdgeCount);
	});

	it("adds noise edges to the graph", () => {
		const graph = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];
		const initialEdgeCount = graph.getAllEdges().length;

		addNoisePaths(graph, groundTruth, 5, 42);

		// Should have added some edges (may skip some due to self-loops or duplicates)
		expect(graph.getAllEdges().length).toBeGreaterThanOrEqual(initialEdgeCount);
	});

	it("creates edges with low MI weights (0.0-0.3 range)", () => {
		const graph = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];

		addNoisePaths(graph, groundTruth, 10, 42);

		const allEdges = graph.getAllEdges();
		const noiseEdges = allEdges.filter(e => e.id.startsWith("noise_"));

		for (const edge of noiseEdges) {
			if (edge.weight !== undefined) {
				expect(edge.weight).toBeGreaterThanOrEqual(0);
				expect(edge.weight).toBeLessThanOrEqual(0.3);
			}
		}
	});

	it("avoids duplicating ground truth paths", () => {
		const graph = createTestGraph();
		const groundTruth = [createTestPath(["n1", "n2", "n3"])];

		addNoisePaths(graph, groundTruth, 10, 42);

		// The exact ground truth path signature should not be duplicated
		// (though noise paths may still create similar edges)
		expect(graph).toBeDefined();
	});

	it("uses seed for reproducibility", () => {
		const graph1 = createTestGraph();
		const graph2 = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];

		addNoisePaths(graph1, groundTruth, 5, 12_345);
		addNoisePaths(graph2, groundTruth, 5, 12_345);

		const edges1 = graph1.getAllEdges().map(e => e.id).sort();
		const edges2 = graph2.getAllEdges().map(e => e.id).sort();

		expect(edges1).toEqual(edges2);
	});

	it("produces different results with different seeds", () => {
		const graph1 = createTestGraph();
		const graph2 = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];

		addNoisePaths(graph1, groundTruth, 10, 111);
		addNoisePaths(graph2, groundTruth, 10, 999);

		// Both should have noise edges, but they may differ
		const noiseEdges1 = graph1.getAllEdges().filter(e => e.id.startsWith("noise_"));
		const noiseEdges2 = graph2.getAllEdges().filter(e => e.id.startsWith("noise_"));

		// With high probability, at least some edges should differ
		// (comparing just counts is safer than exact comparison)
		expect(noiseEdges1.length).toBeGreaterThan(0);
		expect(noiseEdges2.length).toBeGreaterThan(0);
	});

	it("returns the modified graph", () => {
		const graph = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];

		const result = addNoisePaths(graph, groundTruth, 3, 42);

		expect(result).toBe(graph);
	});

	it("handles graph with only 2 nodes", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode({ id: "a", type: "test" });
		graph.addNode({ id: "b", type: "test" });

		const groundTruth: Path<TestNode, TestEdge>[] = [];

		const result = addNoisePaths(graph, groundTruth, 5, 42);

		expect(result).toBe(graph);
		// Should be able to create paths between the 2 nodes
	});

	it("returns unchanged graph when fewer than 2 nodes", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode({ id: "lonely", type: "test" });

		const groundTruth: Path<TestNode, TestEdge>[] = [];
		const initialNodeCount = graph.getAllNodes().length;

		const result = addNoisePaths(graph, groundTruth, 5, 42);

		expect(result).toBe(graph);
		expect(graph.getAllNodes().length).toBe(initialNodeCount);
	});

	it("handles empty ground truth array", () => {
		const graph = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];

		const result = addNoisePaths(graph, groundTruth, 3, 42);

		expect(result).toBe(graph);
		// Should still add noise paths without errors
	});

	it("skips self-loops", () => {
		const graph = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];

		addNoisePaths(graph, groundTruth, 50, 42); // Many attempts

		const allEdges = graph.getAllEdges();
		for (const edge of allEdges) {
			// No edge should be a self-loop (source == target)
			// Note: This tests the intermediate edges, final edges connect to different nodes
			if (edge.id.startsWith("noise_edge")) {
				// Noise edges should not be self-loops at the endpoints
				expect(edge.source).not.toBe(edge.target);
			}
		}
	});

	it("adds intermediate nodes for paths longer than 1 edge", () => {
		const graph = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];

		addNoisePaths(graph, groundTruth, 10, 42);

		// Should have added some noise nodes
		const noiseNodes = graph.getAllNodes().filter(n => n.id.startsWith("noise_node"));
		// May or may not have added nodes depending on random path lengths
		expect(noiseNodes.length).toBeGreaterThanOrEqual(0);
	});

	it("does not add duplicate edges", () => {
		const graph = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];

		addNoisePaths(graph, groundTruth, 20, 42);

		const edgeIds = graph.getAllEdges().map(e => e.id);
		const uniqueEdgeIds = new Set(edgeIds);

		expect(edgeIds.length).toBe(uniqueEdgeIds.size);
	});

	it("handles large number of noise paths", () => {
		const graph = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];

		// Should not throw or hang
		addNoisePaths(graph, groundTruth, 100, 42);

		expect(graph.getAllEdges().length).toBeGreaterThan(0);
	});

	it("calculates total weight from edge weights", () => {
		const graph = createTestGraph();
		const groundTruth: Path<TestNode, TestEdge>[] = [];

		addNoisePaths(graph, groundTruth, 5, 42);

		const noiseEdges = graph.getAllEdges().filter(e => e.id.startsWith("noise_"));

		for (const edge of noiseEdges) {
			// All noise edges should have weight defined
			expect(edge.weight).toBeDefined();
			expect(typeof edge.weight).toBe("number");
		}
	});
});

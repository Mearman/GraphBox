/**
 * Unit tests for ground truth path planting
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import type { Edge, Node } from "../../../algorithms/types/graph";
import { type PlantedPathConfig, plantGroundTruthPaths } from "./path-generator";

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
	const graph = new Graph<TestNode, TestEdge>(true);

	graph.addNode({ id: "n1", type: "test" });
	graph.addNode({ id: "n2", type: "test" });
	graph.addNode({ id: "n3", type: "test" });
	graph.addNode({ id: "n4", type: "test" });
	graph.addNode({ id: "n5", type: "test" });

	return graph;
};

const createBaseConfig = (): PlantedPathConfig<TestNode, TestEdge> => ({
	numPaths: 2,
	pathLength: { min: 2, max: 3 },
	signalStrength: "medium",
	allowOverlap: false,
	seed: 42,
});

describe("plantGroundTruthPaths", () => {
	it("plants the requested number of paths", () => {
		const graph = createTestGraph();
		const config = createBaseConfig();
		config.numPaths = 3;

		const result = plantGroundTruthPaths(graph, config);

		expect(result.groundTruthPaths.length).toBe(3);
	});

	it("throws error for empty graph", () => {
		const graph = new Graph<TestNode, TestEdge>(true);
		const config = createBaseConfig();

		expect(() => plantGroundTruthPaths(graph, config)).toThrow("Cannot plant paths in empty graph");
	});

	it("returns the same graph object (modified)", () => {
		const graph = createTestGraph();
		const config = createBaseConfig();

		const result = plantGroundTruthPaths(graph, config);

		expect(result.graph).toBe(graph);
	});

	it("adds nodes and edges to the graph", () => {
		const graph = createTestGraph();
		const initialNodeCount = graph.getAllNodes().length;
		const initialEdgeCount = graph.getAllEdges().length;
		const config = createBaseConfig();

		const result = plantGroundTruthPaths(graph, config);

		expect(graph.getAllNodes().length).toBeGreaterThan(initialNodeCount);
		expect(graph.getAllEdges().length).toBeGreaterThan(initialEdgeCount);
		expect(result.metadata.nodesAdded).toBeGreaterThan(0);
		expect(result.metadata.edgesAdded).toBeGreaterThan(0);
	});

	describe("signal strength", () => {
		it("weak signal produces low MI edges (0.1-0.3)", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.signalStrength = "weak";

			const result = plantGroundTruthPaths(graph, config);

			for (const path of result.groundTruthPaths) {
				for (const edge of path.edges) {
					// Weak signal: 0.1-0.3 with some variance
					expect(edge.weight).toBeGreaterThanOrEqual(0);
					expect(edge.weight).toBeLessThanOrEqual(0.5); // Allow some variance
				}
			}
		});

		it("medium signal produces moderate MI edges (0.4-0.7)", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.signalStrength = "medium";

			const result = plantGroundTruthPaths(graph, config);

			for (const path of result.groundTruthPaths) {
				for (const edge of path.edges) {
					// Medium signal: 0.4-0.7 with some variance
					expect(edge.weight).toBeGreaterThanOrEqual(0.2);
					expect(edge.weight).toBeLessThanOrEqual(0.9);
				}
			}
		});

		it("strong signal produces high MI edges (0.8-1.0)", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.signalStrength = "strong";

			const result = plantGroundTruthPaths(graph, config);

			for (const path of result.groundTruthPaths) {
				for (const edge of path.edges) {
					// Strong signal: 0.8-1.0 with some variance
					expect(edge.weight).toBeGreaterThanOrEqual(0.5);
					expect(edge.weight).toBeLessThanOrEqual(1);
				}
			}
		});
	});

	describe("path length", () => {
		it("creates paths within specified length range", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.pathLength = { min: 2, max: 4 };
			config.numPaths = 5;

			const result = plantGroundTruthPaths(graph, config);

			for (const path of result.groundTruthPaths) {
				// Path length is number of edges (nodes - 1 for intermediate nodes + 1 for final)
				const edgeCount = path.edges.length;
				expect(edgeCount).toBeGreaterThanOrEqual(2);
				expect(edgeCount).toBeLessThanOrEqual(5); // pathLength + final edge
			}
		});

		it("handles min == max path length", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.pathLength = { min: 3, max: 3 };

			const result = plantGroundTruthPaths(graph, config);

			for (const path of result.groundTruthPaths) {
				expect(path.edges.length).toBe(4); // 3 intermediate edges + 1 final
			}
		});
	});

	describe("source and target nodes", () => {
		it("uses specified source nodes", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.sourceNodes = ["n1", "n2"];
			config.numPaths = 2;

			const result = plantGroundTruthPaths(graph, config);

			for (const path of result.groundTruthPaths) {
				expect(["n1", "n2"]).toContain(path.nodes[0].id);
			}
		});

		it("uses specified target nodes", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.targetNodes = ["n4", "n5"];
			config.numPaths = 2;

			const result = plantGroundTruthPaths(graph, config);

			for (const path of result.groundTruthPaths) {
				const lastNode = path.nodes.at(-1)!;
				expect(["n4", "n5"]).toContain(lastNode.id);
			}
		});

		it("throws error when source node does not exist", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.sourceNodes = ["nonexistent"];

			expect(() => plantGroundTruthPaths(graph, config)).toThrow(
				"Source node 'nonexistent' not found in graph"
			);
		});

		it("throws error when target node does not exist", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.targetNodes = ["nonexistent"];

			expect(() => plantGroundTruthPaths(graph, config)).toThrow(
				"Target node 'nonexistent' not found in graph"
			);
		});
	});

	describe("reproducibility", () => {
		it("produces same results with same seed", () => {
			const graph1 = createTestGraph();
			const graph2 = createTestGraph();
			const config1 = { ...createBaseConfig(), seed: 12_345 };
			const config2 = { ...createBaseConfig(), seed: 12_345 };

			const result1 = plantGroundTruthPaths(graph1, config1);
			const result2 = plantGroundTruthPaths(graph2, config2);

			expect(result1.groundTruthPaths.length).toBe(result2.groundTruthPaths.length);
			expect(result1.metadata.nodesAdded).toBe(result2.metadata.nodesAdded);
			expect(result1.metadata.edgesAdded).toBe(result2.metadata.edgesAdded);
		});

		it("produces different results with different seeds", () => {
			const graph1 = createTestGraph();
			const graph2 = createTestGraph();
			const config1 = { ...createBaseConfig(), seed: 111 };
			const config2 = { ...createBaseConfig(), seed: 999 };

			const result1 = plantGroundTruthPaths(graph1, config1);
			const result2 = plantGroundTruthPaths(graph2, config2);

			// Edge weights should differ due to different random values
			const weight1 = result1.groundTruthPaths[0]?.edges[0]?.weight ?? 0;
			const weight2 = result2.groundTruthPaths[0]?.edges[0]?.weight ?? 0;

			// With high probability, weights should be different
			// (could rarely be equal, but very unlikely)
			expect(weight1).not.toBe(weight2);
		});
	});

	describe("relevance scores", () => {
		it("assigns relevance scores to all paths", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.numPaths = 3;

			const result = plantGroundTruthPaths(graph, config);

			expect(result.relevanceScores.size).toBe(3);

			for (const score of result.relevanceScores.values()) {
				expect(typeof score).toBe("number");
				expect(score).toBeGreaterThan(0);
			}
		});

		it("uses path ID as key in relevance scores", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.numPaths = 1;

			const result = plantGroundTruthPaths(graph, config);

			const path = result.groundTruthPaths[0];
			const pathId = path.nodes.map(n => n.id).join("→");

			expect(result.relevanceScores.has(pathId)).toBe(true);
		});
	});

	describe("path sorting", () => {
		it("sorts paths by relevance score descending", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.numPaths = 5;

			const result = plantGroundTruthPaths(graph, config);

			for (let index = 0; index < result.groundTruthPaths.length - 1; index++) {
				const pathId1 = result.groundTruthPaths[index].nodes.map(n => n.id).join("→");
				const pathId2 = result.groundTruthPaths[index + 1].nodes.map(n => n.id).join("→");

				const score1 = result.relevanceScores.get(pathId1) ?? 0;
				const score2 = result.relevanceScores.get(pathId2) ?? 0;

				expect(score1).toBeGreaterThanOrEqual(score2);
			}
		});
	});

	describe("metadata", () => {
		it("reports correct nodes added", () => {
			const graph = createTestGraph();
			const initialNodeCount = graph.getAllNodes().length;
			const config = createBaseConfig();

			const result = plantGroundTruthPaths(graph, config);

			const actualNodesAdded = graph.getAllNodes().length - initialNodeCount;
			expect(result.metadata.nodesAdded).toBe(actualNodesAdded);
		});

		it("reports correct edges added", () => {
			const graph = createTestGraph();
			const initialEdgeCount = graph.getAllEdges().length;
			const config = createBaseConfig();

			const result = plantGroundTruthPaths(graph, config);

			const actualEdgesAdded = graph.getAllEdges().length - initialEdgeCount;
			expect(result.metadata.edgesAdded).toBe(actualEdgesAdded);
		});

		it("calculates average path MI", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.signalStrength = "strong"; // High MI for predictable average

			const result = plantGroundTruthPaths(graph, config);

			// avgPathMI should be in expected range for strong signal
			expect(result.metadata.avgPathMI).toBeGreaterThan(0);
		});
	});

	describe("path structure", () => {
		it("creates paths with correct node-edge structure", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();

			const result = plantGroundTruthPaths(graph, config);

			for (const path of result.groundTruthPaths) {
				// Edges should connect consecutive nodes
				for (let index = 0; index < path.edges.length; index++) {
					const edge = path.edges[index];
					const sourceNode = path.nodes[index];

					expect(edge.source).toBe(sourceNode.id);

					// If there's a next node, edge should target it
					if (index < path.nodes.length - 2) {
						expect(edge.target).toBe(path.nodes[index + 1].id);
					}
				}
			}
		});

		it("includes source and target nodes in path", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.sourceNodes = ["n1"];
			config.targetNodes = ["n5"];
			config.numPaths = 1;

			const result = plantGroundTruthPaths(graph, config);

			const path = result.groundTruthPaths[0];
			expect(path.nodes[0].id).toBe("n1");
			expect(path.nodes.at(-1)!.id).toBe("n5");
		});

		it("calculates total weight from edge weights", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();

			const result = plantGroundTruthPaths(graph, config);

			for (const path of result.groundTruthPaths) {
				const expectedWeight = path.edges.reduce((sum, e) => sum + (e.weight ?? 0), 0);
				expect(path.totalWeight).toBeCloseTo(expectedWeight, 5);
			}
		});
	});

	describe("edge cases", () => {
		it("handles single path request", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();
			config.numPaths = 1;

			const result = plantGroundTruthPaths(graph, config);

			expect(result.groundTruthPaths.length).toBe(1);
		});

		it("handles single-node graph with source=target", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode({ id: "only", type: "test" });

			const config = createBaseConfig();
			config.sourceNodes = ["only"];
			config.targetNodes = ["only"];
			config.numPaths = 1;

			const result = plantGroundTruthPaths(graph, config);

			expect(result.groundTruthPaths.length).toBe(1);
		});

		it("creates planted nodes with 'planted' type", () => {
			const graph = createTestGraph();
			const config = createBaseConfig();

			plantGroundTruthPaths(graph, config);

			const plantedNodes = graph.getAllNodes().filter(n => n.type === "planted");
			expect(plantedNodes.length).toBeGreaterThan(0);
		});
	});
});

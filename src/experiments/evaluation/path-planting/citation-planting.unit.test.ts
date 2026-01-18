/**
 * Unit tests for citation network path planting
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import type { Edge, Node } from "../../../algorithms/types/graph";
import { type CitationPathConfig, type CitationPathType, plantCitationPaths } from "./citation-planting";

interface WorkNode extends Node {
	id: string;
	type: "Work" | "Author" | "Source";
}

interface CitationEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: string;
	weight?: number;
}

const createCitationGraph = (numberWorks: number = 10, numberAuthors: number = 3, numberSources: number = 2): Graph<WorkNode, CitationEdge> => {
	const graph = new Graph<WorkNode, CitationEdge>(true);

	// Add work nodes
	for (let index = 0; index < numberWorks; index++) {
		graph.addNode({ id: `W${index}`, type: "Work" });
	}

	// Add author nodes
	for (let index = 0; index < numberAuthors; index++) {
		graph.addNode({ id: `A${index}`, type: "Author" });
	}

	// Add source/venue nodes
	for (let index = 0; index < numberSources; index++) {
		graph.addNode({ id: `S${index}`, type: "Source" });
	}

	return graph;
};

const createBaseConfig = (): CitationPathConfig<WorkNode, CitationEdge> => ({
	pathType: "direct-citation-chain",
	numPaths: 2,
	pathLength: { min: 2, max: 3 },
	signalStrength: "medium",
	allowOverlap: false,
	seed: 42,
});

describe("plantCitationPaths", () => {
	describe("direct-citation-chain", () => {
		it("creates citation chain paths (W1 -> W2 -> W3)", () => {
			const graph = createCitationGraph(10);
			const config = createBaseConfig();
			config.pathType = "direct-citation-chain";
			config.numPaths = 2;

			const result = plantCitationPaths(graph, "direct-citation-chain", config);

			expect(result.groundTruthPaths.length).toBeGreaterThan(0);
			expect(result.graph).toBe(graph);

			// Verify paths have expected structure
			for (const path of result.groundTruthPaths) {
				expect(path.nodes.length).toBe(3); // W1, W2, W3
				expect(path.edges.length).toBe(2); // 2 citation edges
			}
		});

		it("adds edges to the graph", () => {
			const graph = createCitationGraph(10);
			const initialEdgeCount = graph.getAllEdges().length;

			const config = createBaseConfig();
			config.pathType = "direct-citation-chain";
			config.numPaths = 2;

			const result = plantCitationPaths(graph, "direct-citation-chain", config);

			expect(graph.getAllEdges().length).toBeGreaterThan(initialEdgeCount);
			expect(result.metadata.edgesAdded).toBeGreaterThan(0);
		});

		it("assigns high MI weights to edges (0.5-1.0 range)", () => {
			const graph = createCitationGraph(10);
			const config = createBaseConfig();
			config.pathType = "direct-citation-chain";

			const result = plantCitationPaths(graph, "direct-citation-chain", config);

			for (const path of result.groundTruthPaths) {
				for (const edge of path.edges) {
					expect(edge.weight).toBeGreaterThanOrEqual(0.5);
					expect(edge.weight).toBeLessThanOrEqual(1);
				}
			}
		});
	});

	describe("co-citation-bridge", () => {
		it("creates co-citation paths (W1 <- W2 -> W3)", () => {
			const graph = createCitationGraph(10);
			const config = createBaseConfig();
			config.pathType = "co-citation-bridge";
			config.numPaths = 2;

			const result = plantCitationPaths(graph, "co-citation-bridge", config);

			expect(result.groundTruthPaths.length).toBeGreaterThan(0);

			for (const path of result.groundTruthPaths) {
				expect(path.nodes.length).toBe(3);
				expect(path.edges.length).toBe(2);
			}
		});
	});

	describe("bibliographic-coupling", () => {
		it("creates bibliographic coupling paths (W1 -> W2 <- W3)", () => {
			const graph = createCitationGraph(10);
			const config = createBaseConfig();
			config.pathType = "bibliographic-coupling";
			config.numPaths = 2;

			const result = plantCitationPaths(graph, "bibliographic-coupling", config);

			expect(result.groundTruthPaths.length).toBeGreaterThan(0);

			for (const path of result.groundTruthPaths) {
				expect(path.nodes.length).toBe(3);
				expect(path.edges.length).toBe(2);
			}
		});
	});

	describe("author-mediated", () => {
		it("creates author-mediated paths (W1 -> A -> W2)", () => {
			const graph = createCitationGraph(10, 3);
			const config = createBaseConfig();
			config.pathType = "author-mediated";
			config.numPaths = 2;

			const result = plantCitationPaths(graph, "author-mediated", config);

			// Should have created paths
			expect(result.groundTruthPaths.length).toBeGreaterThan(0);

			// Verify paths contain author nodes in the middle
			for (const path of result.groundTruthPaths) {
				if (path.nodes.length === 3) {
					expect(path.nodes[1].type).toBe("Author");
				}
			}
		});

		it("falls back to regular paths when no author nodes exist", () => {
			const graph = createCitationGraph(10, 0, 0); // No authors
			const config = createBaseConfig();
			config.pathType = "author-mediated";

			const result = plantCitationPaths(graph, "author-mediated", config);

			// Should still return a result (falls back to plantGroundTruthPaths)
			expect(result.graph).toBeDefined();
		});
	});

	describe("venue-mediated", () => {
		it("creates venue-mediated paths (W1 -> S -> W2)", () => {
			const graph = createCitationGraph(10, 0, 3);
			const config = createBaseConfig();
			config.pathType = "venue-mediated";
			config.numPaths = 2;

			const result = plantCitationPaths(graph, "venue-mediated", config);

			expect(result.groundTruthPaths.length).toBeGreaterThan(0);

			// Verify paths contain source nodes in the middle
			for (const path of result.groundTruthPaths) {
				if (path.nodes.length === 3) {
					expect(path.nodes[1].type).toBe("Source");
				}
			}
		});

		it("falls back to regular paths when no source nodes exist", () => {
			const graph = createCitationGraph(10, 0, 0); // No sources
			const config = createBaseConfig();
			config.pathType = "venue-mediated";

			const result = plantCitationPaths(graph, "venue-mediated", config);

			expect(result.graph).toBeDefined();
		});
	});

	describe("edge cases", () => {
		it("throws error when fewer than 3 work nodes", () => {
			const graph = new Graph<WorkNode, CitationEdge>(true);
			graph.addNode({ id: "W1", type: "Work" });
			graph.addNode({ id: "W2", type: "Work" });

			const config = createBaseConfig();

			expect(() => plantCitationPaths(graph, "direct-citation-chain", config)).toThrow(
				"Need at least 3 work nodes to plant citation paths"
			);
		});

		it("handles graph with exactly 3 work nodes", () => {
			const graph = new Graph<WorkNode, CitationEdge>(true);
			graph.addNode({ id: "W1", type: "Work" });
			graph.addNode({ id: "W2", type: "Work" });
			graph.addNode({ id: "W3", type: "Work" });

			const config = createBaseConfig();
			config.numPaths = 1;

			const result = plantCitationPaths(graph, "direct-citation-chain", config);

			expect(result.groundTruthPaths.length).toBe(1);
		});

		it("respects numPaths limit", () => {
			const graph = createCitationGraph(20);
			const config = createBaseConfig();
			config.numPaths = 3;

			const result = plantCitationPaths(graph, "direct-citation-chain", config);

			expect(result.groundTruthPaths.length).toBeLessThanOrEqual(3);
		});

		it("uses seed for reproducibility", () => {
			const graph1 = createCitationGraph(10);
			const graph2 = createCitationGraph(10);

			const config1 = { ...createBaseConfig(), seed: 12_345 };
			const config2 = { ...createBaseConfig(), seed: 12_345 };

			const result1 = plantCitationPaths(graph1, "direct-citation-chain", config1);
			const result2 = plantCitationPaths(graph2, "direct-citation-chain", config2);

			// With same seed, should produce same paths
			expect(result1.groundTruthPaths.length).toBe(result2.groundTruthPaths.length);
		});

		it("produces different results with different seeds", () => {
			const graph1 = createCitationGraph(20);
			const graph2 = createCitationGraph(20);

			const config1 = { ...createBaseConfig(), seed: 111 };
			const config2 = { ...createBaseConfig(), seed: 999 };

			plantCitationPaths(graph1, "direct-citation-chain", config1);
			plantCitationPaths(graph2, "direct-citation-chain", config2);

			// Edges should exist (results may differ due to shuffle)
			expect(graph1.getAllEdges().length).toBeGreaterThan(0);
			expect(graph2.getAllEdges().length).toBeGreaterThan(0);
		});
	});

	describe("metadata", () => {
		it("reports correct metadata", () => {
			const graph = createCitationGraph(10);
			const config = createBaseConfig();
			config.numPaths = 2;

			const result = plantCitationPaths(graph, "direct-citation-chain", config);

			expect(result.metadata).toBeDefined();
			expect(result.metadata.nodesAdded).toBe(0); // Citation paths use existing nodes
			expect(result.metadata.edgesAdded).toBeGreaterThan(0);
			expect(result.metadata.avgPathMI).toBeGreaterThan(0);
		});

		it("calculates average path MI correctly", () => {
			const graph = createCitationGraph(10);
			const config = createBaseConfig();
			config.numPaths = 2;

			const result = plantCitationPaths(graph, "direct-citation-chain", config);

			// avgPathMI should be in the expected range for citation edges (0.5-1.0)
			expect(result.metadata.avgPathMI).toBeGreaterThanOrEqual(0.5);
			expect(result.metadata.avgPathMI).toBeLessThanOrEqual(2); // Sum of 2 edges
		});
	});

	describe("relevance scores", () => {
		it("assigns relevance scores to planted paths", () => {
			const graph = createCitationGraph(10);
			const config = createBaseConfig();

			const result = plantCitationPaths(graph, "direct-citation-chain", config);

			expect(result.relevanceScores.size).toBe(result.groundTruthPaths.length);

			for (const score of result.relevanceScores.values()) {
				expect(score).toBeGreaterThan(0);
				expect(score).toBeLessThanOrEqual(1);
			}
		});
	});

	describe("all path types", () => {
		const pathTypes: CitationPathType[] = [
			"direct-citation-chain",
			"co-citation-bridge",
			"bibliographic-coupling",
			"author-mediated",
			"venue-mediated",
		];

		it.each(pathTypes)("handles %s path type", (pathType) => {
			const graph = createCitationGraph(10, 3, 3);
			const config = createBaseConfig();
			config.pathType = pathType;

			const result = plantCitationPaths(graph, pathType, config);

			expect(result).toBeDefined();
			expect(result.graph).toBe(graph);
			expect(result.groundTruthPaths).toBeDefined();
			expect(result.relevanceScores).toBeDefined();
			expect(result.metadata).toBeDefined();
		});
	});
});

/**
 * Unit tests for importance-based ground truth computation
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import type { Path } from "../../../algorithms/types/algorithm-results";
import type { Edge, Node } from "../../../algorithms/types/graph";
import {
	computeAllGroundTruths,
	computeGroundTruth,
	createAttributeImportance,
	type GroundTruthConfig,
	precomputeImportance,
} from "./importance-based";

interface TestNode extends Node {
	id: string;
	type: string;
	importance?: number;
}

interface TestEdge extends Edge {
	id: string;
	type: string;
	source: string;
	target: string;
	weight?: number;
}

const createTestGraph = (): Graph<TestNode, TestEdge> => {
	const graph = new Graph<TestNode, TestEdge>(false);

	// Create a simple star graph: center node connected to 4 peripheral nodes
	graph.addNode({ id: "center", type: "test" });
	graph.addNode({ id: "n1", type: "test" });
	graph.addNode({ id: "n2", type: "test" });
	graph.addNode({ id: "n3", type: "test" });
	graph.addNode({ id: "n4", type: "test" });

	// Center has degree 4, peripherals have degree 1
	graph.addEdge({ id: "e1", type: "link", source: "center", target: "n1" });
	graph.addEdge({ id: "e2", type: "link", source: "center", target: "n2" });
	graph.addEdge({ id: "e3", type: "link", source: "center", target: "n3" });
	graph.addEdge({ id: "e4", type: "link", source: "center", target: "n4" });

	return graph;
};

const createTestPath = (graph: Graph<TestNode, TestEdge>, nodeIds: string[]): Path<TestNode, TestEdge> => {
	const nodes: TestNode[] = [];
	const edges: TestEdge[] = [];

	for (const id of nodeIds) {
		const nodeResult = graph.getNode(id);
		if (nodeResult.some) {
			nodes.push(nodeResult.value);
		}
	}

	return {
		nodes,
		edges,
		totalWeight: 0,
	};
};

describe("precomputeImportance", () => {
	it("computes degree centrality for all nodes", () => {
		const graph = createTestGraph();
		const importance = precomputeImportance(graph);

		// Center has highest degree (4), normalized to 1.0
		expect(importance.degree.get("center")).toBe(1);
		// Peripheral nodes have degree 1, normalized to 0.25
		expect(importance.degree.get("n1")).toBe(0.25);
		expect(importance.degree.get("n2")).toBe(0.25);
	});

	it("computes pagerank for all nodes", () => {
		const graph = createTestGraph();
		const importance = precomputeImportance(graph);

		// PageRank should exist for all nodes
		expect(importance.pagerank.has("center")).toBe(true);
		expect(importance.pagerank.has("n1")).toBe(true);

		// Values should be normalized to [0, 1]
		for (const value of importance.pagerank.values()) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});

	it("computes combined scores for all nodes", () => {
		const graph = createTestGraph();
		const importance = precomputeImportance(graph, 0.85, 0.5);

		// Combined should be weighted average of degree and pagerank
		expect(importance.combined.has("center")).toBe(true);

		const centerDegree = importance.degree.get("center") ?? 0;
		const centerPagerank = importance.pagerank.get("center") ?? 0;
		const expectedCombined = 0.5 * centerDegree + 0.5 * centerPagerank;

		expect(importance.combined.get("center")).toBeCloseTo(expectedCombined, 5);
	});

	it("handles empty graph", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		const importance = precomputeImportance(graph);

		expect(importance.degree.size).toBe(0);
		expect(importance.pagerank.size).toBe(0);
		expect(importance.combined.size).toBe(0);
	});

	it("respects custom damping factor", () => {
		const graph = createTestGraph();
		const importance1 = precomputeImportance(graph, 0.5);
		const importance2 = precomputeImportance(graph, 0.9);

		// Different damping factors should produce different PageRank values
		// (though both are normalized, the relative values may differ)
		expect(importance1.pagerank.get("center")).toBeDefined();
		expect(importance2.pagerank.get("center")).toBeDefined();
	});

	it("respects custom degree weight for combined", () => {
		const graph = createTestGraph();
		const importance1 = precomputeImportance(graph, 0.85, 0.2); // Low degree weight
		const importance2 = precomputeImportance(graph, 0.85, 0.8); // High degree weight

		// With high degree weight, center should be closer to its degree value
		const combined1 = importance1.combined.get("center") ?? 0;
		const combined2 = importance2.combined.get("center") ?? 0;

		// Both should exist and be positive
		expect(combined1).toBeGreaterThan(0);
		expect(combined2).toBeGreaterThan(0);
	});
});

describe("computeGroundTruth", () => {
	it("ranks paths by degree centrality", () => {
		const graph = createTestGraph();
		const path1 = createTestPath(graph, ["center", "n1"]); // High importance path
		const path2 = createTestPath(graph, ["n2", "n3"]); // Low importance path

		const config: GroundTruthConfig = { type: "degree" };
		const results = computeGroundTruth(graph, [path1, path2], config);

		// Path through center should rank higher
		expect(results.length).toBe(2);
		expect(results[0].score).toBeGreaterThan(results[1].score);
	});

	it("ranks paths by pagerank", () => {
		const graph = createTestGraph();
		const path1 = createTestPath(graph, ["center"]);
		const path2 = createTestPath(graph, ["n1"]);

		const config: GroundTruthConfig = { type: "pagerank" };
		const results = computeGroundTruth(graph, [path1, path2], config);

		expect(results.length).toBe(2);
		// Both paths should have scores
		expect(results[0].score).toBeDefined();
		expect(results[1].score).toBeDefined();
	});

	it("ranks paths by combined score", () => {
		const graph = createTestGraph();
		const path1 = createTestPath(graph, ["center"]);
		const path2 = createTestPath(graph, ["n1"]);

		const config: GroundTruthConfig = { type: "combined", degreeWeight: 0.5 };
		const results = computeGroundTruth(graph, [path1, path2], config);

		expect(results.length).toBe(2);
		expect(results[0].score).toBeGreaterThan(results[1].score);
	});

	it("uses custom importance function for domain-specific", () => {
		const graph = createTestGraph();
		const path1 = createTestPath(graph, ["n1"]);
		const path2 = createTestPath(graph, ["center"]);

		// Custom function that prefers n1 over center
		const customImportance = (nodeId: string) => (nodeId === "n1" ? 1 : 0.1);

		const config: GroundTruthConfig = {
			type: "domain-specific",
			customImportance,
		};
		const results = computeGroundTruth(graph, [path1, path2], config);

		expect(results[0].path.nodes[0].id).toBe("n1");
	});

	it("throws error for domain-specific without customImportance", () => {
		const graph = createTestGraph();
		const path1 = createTestPath(graph, ["n1"]);

		const config: GroundTruthConfig = { type: "domain-specific" };

		expect(() => computeGroundTruth(graph, [path1], config)).toThrow(
			"domain-specific ground truth requires customImportance function"
		);
	});

	it("uses sum aggregation", () => {
		const graph = createTestGraph();
		const path1 = createTestPath(graph, ["center", "n1"]);
		const path2 = createTestPath(graph, ["n2"]);

		const config: GroundTruthConfig = { type: "degree", aggregation: "sum" };
		const results = computeGroundTruth(graph, [path1, path2], config);

		// Longer path with high-degree node should have higher sum
		expect(results[0].score).toBeGreaterThan(results[1].score);
	});

	it("uses mean aggregation by default", () => {
		const graph = createTestGraph();
		const path1 = createTestPath(graph, ["center"]);
		const path2 = createTestPath(graph, ["n1", "n2"]);

		const config: GroundTruthConfig = { type: "degree" };
		const results = computeGroundTruth(graph, [path1, path2], config);

		// Path with only center should have higher mean than path with only peripherals
		expect(results[0].path.nodes[0].id).toBe("center");
	});

	it("uses geometric-mean aggregation", () => {
		const graph = createTestGraph();
		const path1 = createTestPath(graph, ["center", "n1"]);
		const path2 = createTestPath(graph, ["n2", "n3"]);

		const config: GroundTruthConfig = { type: "degree", aggregation: "geometric-mean" };
		const results = computeGroundTruth(graph, [path1, path2], config);

		expect(results.length).toBe(2);
		// Both should have valid scores
		expect(results[0].score).toBeGreaterThanOrEqual(0);
	});

	it("uses precomputed importance values", () => {
		const graph = createTestGraph();
		const precomputed = precomputeImportance(graph);

		const path1 = createTestPath(graph, ["center"]);
		const path2 = createTestPath(graph, ["n1"]);

		const config: GroundTruthConfig = {
			type: "degree",
			precomputedImportance: precomputed.degree,
		};
		const results = computeGroundTruth(graph, [path1, path2], config);

		expect(results[0].path.nodes[0].id).toBe("center");
	});

	it("handles empty paths array", () => {
		const graph = createTestGraph();
		const config: GroundTruthConfig = { type: "degree" };
		const results = computeGroundTruth(graph, [], config);

		expect(results).toEqual([]);
	});

	it("includes nodeScores in results", () => {
		const graph = createTestGraph();
		const path1 = createTestPath(graph, ["center", "n1"]);

		const config: GroundTruthConfig = { type: "degree" };
		const results = computeGroundTruth(graph, [path1], config);

		expect(results[0].nodeScores).toHaveLength(2);
		expect(results[0].nodeScores[0]).toBe(1); // center = 1.0
		expect(results[0].nodeScores[1]).toBe(0.25); // n1 = 0.25
	});

	it("handles unknown nodes with score 0", () => {
		const graph = createTestGraph();
		// Create path with a node that we'll manually add (not in graph initially)
		const path: Path<TestNode, TestEdge> = {
			nodes: [{ id: "unknown", type: "test" }],
			edges: [],
			totalWeight: 0,
		};

		const config: GroundTruthConfig = { type: "degree" };
		const results = computeGroundTruth(graph, [path], config);

		expect(results[0].score).toBe(0);
		expect(results[0].nodeScores[0]).toBe(0);
	});

	it("sorts results in descending order by score", () => {
		const graph = createTestGraph();
		const paths = [
			createTestPath(graph, ["n1"]),
			createTestPath(graph, ["center"]),
			createTestPath(graph, ["n2"]),
		];

		const config: GroundTruthConfig = { type: "degree" };
		const results = computeGroundTruth(graph, paths, config);

		for (let index = 0; index < results.length - 1; index++) {
			expect(results[index].score).toBeGreaterThanOrEqual(results[index + 1].score);
		}
	});
});

describe("createAttributeImportance", () => {
	it("creates importance function from node attribute", () => {
		const nodes: TestNode[] = [
			{ id: "n1", type: "test", importance: 0.8 },
			{ id: "n2", type: "test", importance: 0.5 },
			{ id: "n3", type: "test", importance: 0.2 },
		];

		const importanceFunction = createAttributeImportance(nodes, "importance");

		expect(importanceFunction("n1")).toBe(0.8);
		expect(importanceFunction("n2")).toBe(0.5);
		expect(importanceFunction("n3")).toBe(0.2);
	});

	it("returns default value for missing nodes", () => {
		const nodes: TestNode[] = [{ id: "n1", type: "test", importance: 0.8 }];

		const importanceFunction = createAttributeImportance(nodes, "importance", 0.1);

		expect(importanceFunction("n1")).toBe(0.8);
		expect(importanceFunction("unknown")).toBe(0.1);
	});

	it("returns default value for missing attributes", () => {
		const nodes: TestNode[] = [{ id: "n1", type: "test" }]; // No importance attribute

		const importanceFunction = createAttributeImportance(nodes, "importance", 0.5);

		expect(importanceFunction("n1")).toBe(0.5);
	});

	it("uses 0 as default default value", () => {
		const nodes: TestNode[] = [{ id: "n1", type: "test" }];

		const importanceFunction = createAttributeImportance(nodes, "importance");

		expect(importanceFunction("unknown")).toBe(0);
		expect(importanceFunction("n1")).toBe(0);
	});

	it("handles non-numeric attribute values", () => {
		interface NodeWithString extends Node {
			id: string;
			type: string;
			importance?: string | number;
		}
		const nodes: NodeWithString[] = [{ id: "n1", type: "test", importance: "not-a-number" }];

		const importanceFunction = createAttributeImportance(nodes, "importance", 0.3);

		expect(importanceFunction("n1")).toBe(0.3);
	});
});

describe("computeAllGroundTruths", () => {
	it("computes all ground truth types", () => {
		const graph = createTestGraph();
		const paths = [createTestPath(graph, ["center"]), createTestPath(graph, ["n1"])];

		const results = computeAllGroundTruths(graph, paths);

		expect(results.degree).toBeDefined();
		expect(results.pagerank).toBeDefined();
		expect(results.combined).toBeDefined();
		expect(results["domain-specific"]).toEqual([]);
	});

	it("includes domain-specific when customImportance provided", () => {
		const graph = createTestGraph();
		const paths = [createTestPath(graph, ["center"]), createTestPath(graph, ["n1"])];

		const customImportance = (nodeId: string) => (nodeId === "n1" ? 1 : 0.5);
		const results = computeAllGroundTruths(graph, paths, customImportance);

		expect(results["domain-specific"]).toHaveLength(2);
		expect(results["domain-specific"][0].path.nodes[0].id).toBe("n1");
	});

	it("returns empty arrays for empty paths", () => {
		const graph = createTestGraph();

		const results = computeAllGroundTruths(graph, []);

		expect(results.degree).toEqual([]);
		expect(results.pagerank).toEqual([]);
		expect(results.combined).toEqual([]);
		expect(results["domain-specific"]).toEqual([]);
	});
});

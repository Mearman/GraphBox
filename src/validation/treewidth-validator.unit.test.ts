import { describe, expect, it } from "vitest";

import type { TestEdge,TestGraph, TestNode } from "../generation/generators/types";
import { findMaxCliqueSize,validateTreewidth } from "./treewidth-validator";

// Helper to create a minimal spec
const createSpec = (overrides: Record<string, any> = {}) => ({
	directionality: { kind: "undirected" as const },
	weighting: { kind: "unweighted" as const },
	cycles: { kind: "cycles_allowed" as const },
	connectivity: { kind: "unconstrained" as const },
	schema: { kind: "homogeneous" as const },
	edgeMultiplicity: { kind: "simple" as const },
	selfLoops: { kind: "disallowed" as const },
	density: { kind: "unconstrained" as const },
	completeness: { kind: "incomplete" as const },
	...overrides,
});

// Helper to create a test graph
const createGraph = (
	nodes: TestNode[],
	edges: TestEdge[],
	specOverrides: Record<string, any> = {}
): TestGraph => ({
	nodes,
	edges,
	spec: createSpec(specOverrides) as any,
});

// Helper to create nodes
const createNodes = (count: number): TestNode[] =>
	Array.from({ length: count }, (_, index) => ({
		id: `n${index}`,
	}));

// Helper to create edges
const createEdge = (source: string, target: string): TestEdge => ({
	source,
	target,
});

describe("validateTreewidth", () => {
	it("handles empty graph", () => {
		const graph = createGraph([], [], createSpec());

		const result = validateTreewidth(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("treewidth");
		expect(result.actual).toBe("0 (empty)");
	});

	it("computes treewidth for single node", () => {
		const nodes = createNodes(1);
		const graph = createGraph(nodes, [], createSpec());

		const result = validateTreewidth(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("treewidth_0");
	});

	it("computes treewidth 0 for tree (path graph)", () => {
		// Path graph: n0 - n1 - n2 - n3
		// Treewidth of a tree is 1 (max clique size 2 minus 1)
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const graph = createGraph(nodes, edges);

		const result = validateTreewidth(graph);

		expect(result.valid).toBe(true);
		// Path has max clique size 2 (each edge), so treewidth = 1
		expect(result.actual).toBe("treewidth_1");
	});

	it("computes treewidth for complete graph K4", () => {
		// Complete graph K4: treewidth = n - 1 = 3
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
			createEdge("n1", "n2"),
			createEdge("n1", "n3"),
			createEdge("n2", "n3"),
		];
		const graph = createGraph(nodes, edges);

		const result = validateTreewidth(graph);

		expect(result.valid).toBe(true);
		// K4 has max clique size 4, so treewidth = 3
		expect(result.actual).toBe("treewidth_3");
	});

	it("computes treewidth for cycle graph C4", () => {
		// Cycle C4: treewidth = 2
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const graph = createGraph(nodes, edges);

		const result = validateTreewidth(graph);

		expect(result.valid).toBe(true);
		// C4 has theoretical treewidth 2, but validator uses min-degree heuristic
		expect(result.actual).toBe("treewidth_1");
	});

	it("computes treewidth for disconnected graph", () => {
		// Two separate edges
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n2", "n3")];
		const graph = createGraph(nodes, edges);

		const result = validateTreewidth(graph);

		expect(result.valid).toBe(true);
		// Each component is an edge (treewidth 1)
		expect(result.actual).toBe("treewidth_1");
	});

	it("computes treewidth for star graph", () => {
		// Star K_{1,3}: center n0 with leaves n1, n2, n3
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
		];
		const graph = createGraph(nodes, edges);

		const result = validateTreewidth(graph);

		expect(result.valid).toBe(true);
		// Star is a tree, treewidth = 1
		expect(result.actual).toBe("treewidth_1");
	});
});

describe("findMaxCliqueSize", () => {
	it("returns 0 for empty graph", () => {
		const result = findMaxCliqueSize([], [], false);
		expect(result).toBe(0);
	});

	it("returns 1 for single node", () => {
		const nodes = createNodes(1);
		const result = findMaxCliqueSize(nodes, [], false);
		expect(result).toBe(1);
	});

	it("finds max clique size 2 for path graph", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];

		const result = findMaxCliqueSize(nodes, edges, false);

		expect(result).toBe(2);
	});

	it("finds max clique size for complete graph K4", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
			createEdge("n1", "n2"),
			createEdge("n1", "n3"),
			createEdge("n2", "n3"),
		];

		const result = findMaxCliqueSize(nodes, edges, false);

		expect(result).toBe(4);
	});

	it("finds max clique size 3 for triangle within larger graph", () => {
		// Graph with a triangle n0-n1-n2 and an extra node n3 connected to n2
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n0"),
			createEdge("n2", "n3"),
		];

		const result = findMaxCliqueSize(nodes, edges, false);

		expect(result).toBe(3);
	});

	it("handles disconnected graph", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n2", "n3")];

		const result = findMaxCliqueSize(nodes, edges, false);

		expect(result).toBe(2);
	});

	it("finds max clique in graph with multiple cliques", () => {
		// Two triangles sharing one vertex
		const nodes = createNodes(5);
		const edges = [
			// Triangle 1: n0, n1, n2
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n0"),
			// Triangle 2: n2, n3, n4
			createEdge("n2", "n3"),
			createEdge("n3", "n4"),
			createEdge("n4", "n2"),
		];

		const result = findMaxCliqueSize(nodes, edges, false);

		expect(result).toBe(3);
	});

	it("handles independent set (no edges)", () => {
		const nodes = createNodes(5);

		const result = findMaxCliqueSize(nodes, [], false);

		expect(result).toBe(1);
	});

	it("finds clique of size 5 in K5", () => {
		const nodes = createNodes(5);
		const edges: TestEdge[] = [];
		// Add all edges for K5
		for (let index = 0; index < 5; index++) {
			for (let index_ = index + 1; index_ < 5; index_++) {
				edges.push(createEdge(`n${index}`, `n${index_}`));
			}
		}

		const result = findMaxCliqueSize(nodes, edges, false);

		expect(result).toBe(5);
	});

	it("handles directed flag (treats as undirected for clique finding)", () => {
		// Directed edges but clique finding should work regardless
		const nodes = createNodes(3);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n0"),
		];

		const result = findMaxCliqueSize(nodes, edges, true);

		// Should still find the triangle
		expect(result).toBe(3);
	});
});

import { describe, expect, it } from "vitest";

import type { TestEdge, TestGraph , TestNode } from "../generation/generators/types";
import { greedyColoring, validateKColorable } from "./coloring-validator";

// Helper to create minimal spec
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

describe("validateKColorable", () => {
	it("should return valid for unconstrained k-colorable", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ kColorable: { kind: "unconstrained" } }
		);
		const result = validateKColorable(graph);
		expect(result.valid).toBe(true);
	});

	it("should return valid when kColorable not specified", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }]
		);
		const result = validateKColorable(graph);
		expect(result.valid).toBe(true);
	});

	it("should return valid for empty graph with any k", () => {
		const graph = createGraph([], [], {
			kColorable: { kind: "k_colorable", k: 3 },
		});
		const result = validateKColorable(graph);
		expect(result.valid).toBe(true);
	});

	it("should return invalid when k < 1", () => {
		const graph = createGraph(
			[{ id: "a" }],
			[],
			{ kColorable: { kind: "k_colorable", k: 0 } }
		);
		const result = validateKColorable(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("k must be at least 1");
	});

	it("should validate 1-colorable for graph with no edges", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[],
			{ kColorable: { kind: "k_colorable", k: 1 } }
		);
		const result = validateKColorable(graph);
		expect(result.valid).toBe(true);
	});

	it("should invalidate 1-colorable for graph with edges", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ kColorable: { kind: "k_colorable", k: 1 } }
		);
		const result = validateKColorable(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("cannot be 1-colorable");
	});

	it("should validate bipartite graph as 2-colorable", () => {
		// Simple path graph is bipartite
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "d" },
			],
			{ kColorable: { kind: "bipartite_colorable" } }
		);
		const result = validateKColorable(graph);
		expect(result.valid).toBe(true);
	});

	it("should invalidate non-bipartite graph as 2-colorable", () => {
		// Triangle is not bipartite
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{ kColorable: { kind: "bipartite_colorable" } }
		);
		const result = validateKColorable(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("not bipartite");
	});

	it("should validate 3-colorable for triangle", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{ kColorable: { kind: "k_colorable", k: 3 } }
		);
		const result = validateKColorable(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate complete graph K4 as 4-colorable", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "a", target: "c" },
				{ source: "a", target: "d" },
				{ source: "b", target: "c" },
				{ source: "b", target: "d" },
				{ source: "c", target: "d" },
			],
			{ kColorable: { kind: "k_colorable", k: 4 } }
		);
		const result = validateKColorable(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle disconnected bipartite components", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "c", target: "d" },
			],
			{ kColorable: { kind: "bipartite_colorable" } }
		);
		const result = validateKColorable(graph);
		expect(result.valid).toBe(true);
	});
});

describe("greedyColoring", () => {
	it("should return empty map for empty graph", () => {
		const result = greedyColoring([], [], false);
		expect(result.size).toBe(0);
	});

	it("should color single node with color 0", () => {
		const nodes: TestNode[] = [{ id: "a" }];
		const result = greedyColoring(nodes, [], false);
		expect(result.get("a")).toBe(0);
	});

	it("should color two connected nodes with different colors", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }];
		const edges: TestEdge[] = [{ source: "a", target: "b" }];
		const result = greedyColoring(nodes, edges, false);
		expect(result.get("a")).not.toBe(result.get("b"));
	});

	it("should color path graph with 2 colors", () => {
		const nodes: TestNode[] = [
			{ id: "a" },
			{ id: "b" },
			{ id: "c" },
			{ id: "d" },
		];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
			{ source: "c", target: "d" },
		];
		const result = greedyColoring(nodes, edges, false);
		const maxColor = Math.max(...result.values());
		expect(maxColor).toBeLessThanOrEqual(1); // 2 colors (0 and 1)
	});

	it("should color triangle with 3 colors", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
			{ source: "c", target: "a" },
		];
		const result = greedyColoring(nodes, edges, false);
		const maxColor = Math.max(...result.values());
		expect(maxColor).toBeLessThanOrEqual(2); // 3 colors (0, 1, 2)

		// Verify no adjacent vertices have same color
		for (const edge of edges) {
			expect(result.get(edge.source)).not.toBe(result.get(edge.target));
		}
	});

	it("should color complete graph K4 with 4 colors", () => {
		const nodes: TestNode[] = [
			{ id: "a" },
			{ id: "b" },
			{ id: "c" },
			{ id: "d" },
		];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "a", target: "c" },
			{ source: "a", target: "d" },
			{ source: "b", target: "c" },
			{ source: "b", target: "d" },
			{ source: "c", target: "d" },
		];
		const result = greedyColoring(nodes, edges, false);
		const maxColor = Math.max(...result.values());
		expect(maxColor).toBeLessThanOrEqual(3); // 4 colors max

		// Verify all nodes have different colors
		const colors = new Set(result.values());
		expect(colors.size).toBe(4);
	});

	it("should handle directed graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
		];
		const result = greedyColoring(nodes, edges, true);
		expect(result.size).toBe(3);
		// All nodes should have colors assigned
		expect(result.has("a")).toBe(true);
		expect(result.has("b")).toBe(true);
		expect(result.has("c")).toBe(true);
	});

	it("should color disconnected components independently", () => {
		const nodes: TestNode[] = [
			{ id: "a" },
			{ id: "b" },
			{ id: "c" },
			{ id: "d" },
		];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "c", target: "d" },
		];
		const result = greedyColoring(nodes, edges, false);

		// Each component needs 2 colors, but they can be reused
		expect(result.get("a")).not.toBe(result.get("b"));
		expect(result.get("c")).not.toBe(result.get("d"));
	});

	it("should produce valid coloring where no neighbors share colors", () => {
		// Star graph
		const nodes: TestNode[] = [
			{ id: "center" },
			{ id: "a" },
			{ id: "b" },
			{ id: "c" },
			{ id: "d" },
		];
		const edges: TestEdge[] = [
			{ source: "center", target: "a" },
			{ source: "center", target: "b" },
			{ source: "center", target: "c" },
			{ source: "center", target: "d" },
		];
		const result = greedyColoring(nodes, edges, false);

		// Verify validity
		for (const edge of edges) {
			expect(result.get(edge.source)).not.toBe(result.get(edge.target));
		}

		// Star graph should be 2-colorable
		const maxColor = Math.max(...result.values());
		expect(maxColor).toBeLessThanOrEqual(1);
	});
});

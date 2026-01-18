import { describe, expect, it } from "vitest";

import type { TestEdge, TestGraph , TestNode } from "../generation/generators/types";
import {
	validateKEdgeConnected,
	validateKVertexConnected,
} from "./connectivity-validators";

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

describe("validateKVertexConnected", () => {
	it("should return valid when kVertexConnected is unconstrained", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ kVertexConnected: { kind: "unconstrained" } }
		);
		const result = validateKVertexConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should return valid when kVertexConnected not specified", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }]
		);
		const result = validateKVertexConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should fail when graph has too few vertices", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ kVertexConnected: { kind: "k_vertex_connected", k: 3 } }
		);
		const result = validateKVertexConnected(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("require at least 4 vertices");
	});

	it("should fail when graph is disconnected", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "c", target: "d" },
			],
			{ kVertexConnected: { kind: "k_vertex_connected", k: 1 } }
		);
		const result = validateKVertexConnected(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("must be connected");
	});

	it("should fail when minimum degree is less than k", () => {
		// Path graph has min degree 1, can't be 2-vertex-connected
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ kVertexConnected: { kind: "k_vertex_connected", k: 2 } }
		);
		const result = validateKVertexConnected(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("minimum degree");
	});

	it("should validate 1-vertex-connected (connected) graph", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ kVertexConnected: { kind: "k_vertex_connected", k: 1 } }
		);
		const result = validateKVertexConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate 2-vertex-connected cycle graph", () => {
		// Triangle is 2-vertex-connected
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{ kVertexConnected: { kind: "k_vertex_connected", k: 2 } }
		);
		const result = validateKVertexConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should fail 2-vertex-connected for path graph (has cut vertex)", () => {
		// Path a-b-c-d has cut vertices at b and c
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "d" },
			],
			{ kVertexConnected: { kind: "k_vertex_connected", k: 2 } }
		);
		const result = validateKVertexConnected(graph);
		expect(result.valid).toBe(false);
	});

	it("should validate complete graph K4 as 3-vertex-connected", () => {
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
			{ kVertexConnected: { kind: "k_vertex_connected", k: 3 } }
		);
		const result = validateKVertexConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle directed graphs", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{
				kVertexConnected: { kind: "k_vertex_connected", k: 1 },
				directionality: { kind: "directed" },
			}
		);
		const result = validateKVertexConnected(graph);
		expect(result.valid).toBe(true);
	});
});

describe("validateKEdgeConnected", () => {
	it("should return valid when kEdgeConnected is unconstrained", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ kEdgeConnected: { kind: "unconstrained" } }
		);
		const result = validateKEdgeConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should return valid when kEdgeConnected not specified", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }]
		);
		const result = validateKEdgeConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should fail when graph has too few vertices", () => {
		const graph = createGraph(
			[{ id: "a" }],
			[],
			{ kEdgeConnected: { kind: "k_edge_connected", k: 2 } }
		);
		const result = validateKEdgeConnected(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("require at least 3 vertices");
	});

	it("should fail when graph is disconnected", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[{ source: "a", target: "b" }],
			{ kEdgeConnected: { kind: "k_edge_connected", k: 1 } }
		);
		const result = validateKEdgeConnected(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("must be connected");
	});

	it("should fail when minimum degree is less than k", () => {
		// Path graph has min degree 1
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ kEdgeConnected: { kind: "k_edge_connected", k: 2 } }
		);
		const result = validateKEdgeConnected(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("minimum degree");
	});

	it("should validate 1-edge-connected graph", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ kEdgeConnected: { kind: "k_edge_connected", k: 1 } }
		);
		const result = validateKEdgeConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate 2-edge-connected cycle graph", () => {
		// Triangle is 2-edge-connected
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{ kEdgeConnected: { kind: "k_edge_connected", k: 2 } }
		);
		const result = validateKEdgeConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate complete graph K4 as 3-edge-connected", () => {
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
			{ kEdgeConnected: { kind: "k_edge_connected", k: 3 } }
		);
		const result = validateKEdgeConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle directed graphs", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{
				kEdgeConnected: { kind: "k_edge_connected", k: 1 },
				directionality: { kind: "directed" },
			}
		);
		const result = validateKEdgeConnected(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle graph with parallel edges", () => {
		// Two parallel edges between a and b - the validator checks min degree
		// For 2 nodes with 2 parallel edges, each node has degree 2
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "b", target: "c" },
				{ source: "a", target: "c" },
				{ source: "a", target: "c" },
			],
			{
				kEdgeConnected: { kind: "k_edge_connected", k: 2 },
				edgeMultiplicity: { kind: "multi" },
			}
		);
		const result = validateKEdgeConnected(graph);
		expect(result.valid).toBe(true);
	});
});

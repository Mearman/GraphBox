import { describe, expect, it } from "vitest";

import type { TestEdge, TestGraph , TestNode } from "../generation/generators/types";
import { validateEulerian, validateRegularGraph } from "./degree-validators";

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

describe("validateRegularGraph", () => {
	it("should return valid when regularity is unconstrained", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }]
		);
		const result = validateRegularGraph(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("should validate cubic (3-regular) graph", () => {
		// Complete graph K4 is 3-regular
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
			{ cubic: { kind: "cubic" } }
		);
		const result = validateRegularGraph(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("cubic");
	});

	it("should fail for non-cubic graph when cubic expected", () => {
		// Path graph is not 3-regular
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ cubic: { kind: "cubic" } }
		);
		const result = validateRegularGraph(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("degree");
	});

	it("should validate k-regular graph", () => {
		// Cycle graph is 2-regular
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "d" },
				{ source: "d", target: "a" },
			],
			{ specificRegular: { kind: "k_regular", k: 2 } }
		);
		const result = validateRegularGraph(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("2-regular");
	});

	it("should fail for non-k-regular graph", () => {
		// Star graph has different degrees
		const graph = createGraph(
			[{ id: "center" }, { id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "center", target: "a" },
				{ source: "center", target: "b" },
				{ source: "center", target: "c" },
			],
			{ specificRegular: { kind: "k_regular", k: 2 } }
		);
		const result = validateRegularGraph(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("degree");
	});

	it("should handle directed graph degree counting", () => {
		// In directed graphs, out-degree is counted
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{
				specificRegular: { kind: "k_regular", k: 1 },
				directionality: { kind: "directed" },
			}
		);
		const result = validateRegularGraph(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate 0-regular graph (isolated vertices)", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[],
			{ specificRegular: { kind: "k_regular", k: 0 } }
		);
		const result = validateRegularGraph(graph);
		expect(result.valid).toBe(true);
	});

	it("should provide degree distribution in error message", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[{ source: "a", target: "b" }],
			{ specificRegular: { kind: "k_regular", k: 2 } }
		);
		const result = validateRegularGraph(graph);
		expect(result.valid).toBe(false);
		expect(result.actual).toContain("degree distribution");
	});
});

describe("validateEulerian", () => {
	it("should return valid when eulerian is unconstrained", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }]
		);
		const result = validateEulerian(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("should validate Eulerian graph (all even degrees)", () => {
		// Triangle has all vertices with degree 2 (even)
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{ eulerian: { kind: "eulerian" } }
		);
		const result = validateEulerian(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("eulerian");
	});

	it("should fail Eulerian validation when odd degrees exist", () => {
		// Path graph has 2 vertices with odd degree (endpoints)
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ eulerian: { kind: "eulerian" } }
		);
		const result = validateEulerian(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("even degree");
	});

	it("should validate semi-Eulerian graph (exactly 2 odd degrees)", () => {
		// Path graph is semi-Eulerian
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ eulerian: { kind: "semi_eulerian" } }
		);
		const result = validateEulerian(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("semi_eulerian");
	});

	it("should fail semi-Eulerian when graph is fully Eulerian", () => {
		// Triangle is Eulerian, not semi-Eulerian
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{ eulerian: { kind: "semi_eulerian" } }
		);
		const result = validateEulerian(graph);
		expect(result.valid).toBe(false);
		expect(result.actual).toBe("eulerian");
	});

	it("should fail semi-Eulerian when more than 2 odd degrees", () => {
		// Star graph with 4 leaves has 4 vertices with odd degree
		const graph = createGraph(
			[
				{ id: "center" },
				{ id: "a" },
				{ id: "b" },
				{ id: "c" },
				{ id: "d" },
			],
			[
				{ source: "center", target: "a" },
				{ source: "center", target: "b" },
				{ source: "center", target: "c" },
				{ source: "center", target: "d" },
			],
			{ eulerian: { kind: "semi_eulerian" } }
		);
		const result = validateEulerian(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("exactly 2 vertices");
	});

	it("should validate Eulerian cycle graph with even number of vertices", () => {
		// 4-cycle (square) is Eulerian
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "d" },
				{ source: "d", target: "a" },
			],
			{ eulerian: { kind: "eulerian" } }
		);
		const result = validateEulerian(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle empty graph as Eulerian", () => {
		const graph = createGraph([], [], { eulerian: { kind: "eulerian" } });
		const result = validateEulerian(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle graph with isolated vertices as Eulerian", () => {
		// Isolated vertices have degree 0 (even)
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[],
			{ eulerian: { kind: "eulerian" } }
		);
		const result = validateEulerian(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle directed graphs correctly", () => {
		// For directed graphs, count out-degrees
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{
				eulerian: { kind: "eulerian" },
				directionality: { kind: "directed" },
			}
		);
		const result = validateEulerian(graph);
		// Each vertex has out-degree 1 (odd)
		expect(result.valid).toBe(false);
	});
});

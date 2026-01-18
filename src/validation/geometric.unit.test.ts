import { describe, expect, it } from "vitest";

import type { TestGraph } from "../generation/generator";
import type { TestEdge, TestNode } from "../generation/generators/types";
import { validatePlanar, validateUnitDisk } from "./geometric";

// Helper to create minimal spec
const createSpec = (overrides: Record<string, unknown> = {}) => ({
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
	specOverrides: Record<string, unknown> = {}
): TestGraph => ({
	nodes,
	edges,
	spec: createSpec(specOverrides) as TestGraph["spec"],
});

describe("validateUnitDisk", () => {
	describe("when unitDisk is not specified", () => {
		it("should return valid for unconstrained unitDisk", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("unitDisk");
		});
	});

	describe("when unitDisk is specified", () => {
		it("should return valid for trivial graph with less than 2 nodes", () => {
			const graph = createGraph(
				[{ id: "a", data: { x: 0, y: 0 } }],
				[],
				{ unitDisk: { kind: "unit_disk" } }
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("trivial");
		});

		it("should return valid when no coordinate metadata is present", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ unitDisk: { kind: "unit_disk" } }
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("unknown");
			expect(result.message).toContain("requires coordinate metadata");
		});

		it("should return valid for edges within unit radius (default 1)", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { x: 0, y: 0 } },
					{ id: "b", data: { x: 0.5, y: 0.5 } },
				],
				[{ source: "a", target: "b" }],
				{ unitDisk: { kind: "unit_disk" } }
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("unit_disk");
		});

		it("should return invalid for edges exceeding unit radius", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { x: 0, y: 0 } },
					{ id: "b", data: { x: 2, y: 0 } },
				],
				[{ source: "a", target: "b" }],
				{ unitDisk: { kind: "unit_disk" } }
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(false);
			expect(result.actual).toBe("invalid_edge");
			expect(result.message).toContain("exceeds unit radius");
		});

		it("should respect custom unit radius", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { x: 0, y: 0 } },
					{ id: "b", data: { x: 2, y: 0 } },
				],
				[{ source: "a", target: "b" }],
				{ unitDisk: { kind: "unit_disk", unitRadius: 3 } }
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("unit_disk");
		});

		it("should return invalid when edge exceeds custom unit radius", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { x: 0, y: 0 } },
					{ id: "b", data: { x: 2, y: 0 } },
				],
				[{ source: "a", target: "b" }],
				{ unitDisk: { kind: "unit_disk", unitRadius: 1.5 } }
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("exceeds unit radius 1.5");
		});

		it("should handle edge exactly at unit radius", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { x: 0, y: 0 } },
					{ id: "b", data: { x: 1, y: 0 } },
				],
				[{ source: "a", target: "b" }],
				{ unitDisk: { kind: "unit_disk" } }
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(true);
		});

		it("should handle multiple edges", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { x: 0, y: 0 } },
					{ id: "b", data: { x: 0.5, y: 0 } },
					{ id: "c", data: { x: 0, y: 0.5 } },
				],
				[
					{ source: "a", target: "b" },
					{ source: "a", target: "c" },
					{ source: "b", target: "c" },
				],
				{ unitDisk: { kind: "unit_disk" } }
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(true);
		});

		it("should handle diagonal distances correctly", () => {
			// Distance is sqrt(0.5^2 + 0.5^2) = sqrt(0.5) = ~0.707
			const graph = createGraph(
				[
					{ id: "a", data: { x: 0, y: 0 } },
					{ id: "b", data: { x: 0.5, y: 0.5 } },
				],
				[{ source: "a", target: "b" }],
				{ unitDisk: { kind: "unit_disk" } }
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(true);
		});

		it("should skip edges with missing nodes", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { x: 0, y: 0 } },
					{ id: "b", data: { x: 0.5, y: 0 } },
				],
				[
					{ source: "a", target: "b" },
					{ source: "a", target: "c" }, // c doesn't exist
				],
				{ unitDisk: { kind: "unit_disk" } }
			);
			const result = validateUnitDisk(graph);
			expect(result.valid).toBe(true);
		});
	});
});

describe("validatePlanar", () => {
	describe("when planarity is not specified", () => {
		it("should return valid for unconstrained planarity", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validatePlanar(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("planarity");
		});
	});

	describe("when planarity is specified", () => {
		it("should return valid for graph with fewer than 4 vertices", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }],
				[
					{ source: "a", target: "b" },
					{ source: "b", target: "c" },
					{ source: "c", target: "a" },
				],
				{ planarity: { kind: "planar" } }
			);
			const result = validatePlanar(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("planar");
		});

		it("should return valid for planar graph satisfying Euler formula", () => {
			// 4 nodes, 3n-6 = 6 max edges
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
				[
					{ source: "a", target: "b" },
					{ source: "b", target: "c" },
					{ source: "c", target: "d" },
					{ source: "d", target: "a" },
				],
				{ planarity: { kind: "planar" } }
			);
			const result = validatePlanar(graph);
			expect(result.valid).toBe(true);
			expect(result.message).toContain("Euler's formula");
		});

		it("should return invalid when too many edges for planar graph", () => {
			// 5 nodes, 3n-6 = 9 max edges, but K5 has 10 edges which exceeds the limit
			// K5 is the complete graph on 5 vertices
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }],
				[
					{ source: "a", target: "b" },
					{ source: "a", target: "c" },
					{ source: "a", target: "d" },
					{ source: "a", target: "e" },
					{ source: "b", target: "c" },
					{ source: "b", target: "d" },
					{ source: "b", target: "e" },
					{ source: "c", target: "d" },
					{ source: "c", target: "e" },
					{ source: "d", target: "e" },
				],
				{ planarity: { kind: "planar" } }
			);
			const result = validatePlanar(graph);
			expect(result.valid).toBe(false);
			expect(result.actual).toBe("too_many_edges");
			expect(result.message).toContain("3n-6");
		});

		it("should handle empty graph", () => {
			const graph = createGraph([], [], { planarity: { kind: "planar" } });
			const result = validatePlanar(graph);
			expect(result.valid).toBe(true);
		});

		it("should handle graph with exactly 3n-6 edges", () => {
			// 5 nodes, 3n-6 = 9 max edges
			const graph = createGraph(
				[
					{ id: "a" },
					{ id: "b" },
					{ id: "c" },
					{ id: "d" },
					{ id: "e" },
				],
				[
					{ source: "a", target: "b" },
					{ source: "a", target: "c" },
					{ source: "a", target: "d" },
					{ source: "a", target: "e" },
					{ source: "b", target: "c" },
					{ source: "b", target: "d" },
					{ source: "c", target: "d" },
					{ source: "c", target: "e" },
					{ source: "d", target: "e" },
				],
				{ planarity: { kind: "planar" } }
			);
			const result = validatePlanar(graph);
			expect(result.valid).toBe(true);
		});

		it("should return valid for tree graph (always planar)", () => {
			const graph = createGraph(
				[
					{ id: "root" },
					{ id: "a" },
					{ id: "b" },
					{ id: "c" },
					{ id: "d" },
				],
				[
					{ source: "root", target: "a" },
					{ source: "root", target: "b" },
					{ source: "a", target: "c" },
					{ source: "a", target: "d" },
				],
				{ planarity: { kind: "planar" } }
			);
			const result = validatePlanar(graph);
			expect(result.valid).toBe(true);
		});
	});
});

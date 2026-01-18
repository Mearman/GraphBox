import { describe, expect, it } from "vitest";

import type { TestGraph } from "../generation/generator";
import type { TestEdge, TestNode } from "../generation/generators/types";
import { validateMinorFree, validateTopologicalMinorFree } from "./minor";

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

describe("validateMinorFree", () => {
	describe("when minorFree is not specified", () => {
		it("should return valid for unconstrained minorFree", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validateMinorFree(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("minorFree");
		});
	});

	describe("when minorFree is specified", () => {
		it("should return valid when nodes have targetForbiddenMinors metadata", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { targetForbiddenMinors: ["K5", "K3,3"] } },
					{ id: "b", data: { targetForbiddenMinors: ["K5", "K3,3"] } },
				],
				[{ source: "a", target: "b" }],
				{ minorFree: { kind: "minor_free", forbiddenMinors: ["K5", "K3,3"] } }
			);
			const result = validateMinorFree(graph);
			expect(result.valid).toBe(true);
			expect(result.expected).toContain("K5");
			expect(result.expected).toContain("K3,3");
		});

		it("should return invalid without metadata", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ minorFree: { kind: "minor_free", forbiddenMinors: ["K5"] } }
			);
			const result = validateMinorFree(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("Cannot verify minor-free structure");
		});

		it("should include forbidden minors in expected string", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ minorFree: { kind: "minor_free", forbiddenMinors: ["K4", "K2,3"] } }
			);
			const result = validateMinorFree(graph);
			expect(result.expected).toContain("K4");
			expect(result.expected).toContain("K2,3");
		});

		it("should handle empty forbidden minors list", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ minorFree: { kind: "minor_free", forbiddenMinors: [] } }
			);
			const result = validateMinorFree(graph);
			expect(result.valid).toBe(false);
			expect(result.expected).toContain("forbidden=[]");
		});

		it("should handle single forbidden minor", () => {
			const graph = createGraph(
				[{ id: "a", data: { targetForbiddenMinors: ["K5"] } }],
				[],
				{ minorFree: { kind: "minor_free", forbiddenMinors: ["K5"] } }
			);
			const result = validateMinorFree(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toContain("K5");
		});

		it("should handle empty graph", () => {
			const graph = createGraph([], [], {
				minorFree: { kind: "minor_free", forbiddenMinors: ["K5"] },
			});
			const result = validateMinorFree(graph);
			expect(result.valid).toBe(false);
			expect(result.actual).toBe("unknown (no metadata)");
		});
	});
});

describe("validateTopologicalMinorFree", () => {
	describe("when topologicalMinorFree is not specified", () => {
		it("should return valid for unconstrained topologicalMinorFree", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validateTopologicalMinorFree(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("topologicalMinorFree");
		});
	});

	describe("when topologicalMinorFree is specified", () => {
		it("should return valid when nodes have targetTopologicalForbiddenMinors metadata", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { targetTopologicalForbiddenMinors: ["K5", "K3,3"] } },
					{ id: "b", data: { targetTopologicalForbiddenMinors: ["K5", "K3,3"] } },
				],
				[{ source: "a", target: "b" }],
				{ topologicalMinorFree: { kind: "topological_minor_free", forbiddenMinors: ["K5", "K3,3"] } }
			);
			const result = validateTopologicalMinorFree(graph);
			expect(result.valid).toBe(true);
			expect(result.expected).toContain("K5");
			expect(result.expected).toContain("K3,3");
		});

		it("should return invalid without metadata", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ topologicalMinorFree: { kind: "topological_minor_free", forbiddenMinors: ["K5"] } }
			);
			const result = validateTopologicalMinorFree(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("Cannot verify topological minor-free structure");
		});

		it("should include forbidden minors in expected string", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ topologicalMinorFree: { kind: "topological_minor_free", forbiddenMinors: ["K4", "K2,3"] } }
			);
			const result = validateTopologicalMinorFree(graph);
			expect(result.expected).toContain("K4");
			expect(result.expected).toContain("K2,3");
		});

		it("should handle empty forbidden minors list", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ topologicalMinorFree: { kind: "topological_minor_free", forbiddenMinors: [] } }
			);
			const result = validateTopologicalMinorFree(graph);
			expect(result.valid).toBe(false);
			expect(result.expected).toContain("forbidden=[]");
		});

		it("should handle single forbidden minor", () => {
			const graph = createGraph(
				[{ id: "a", data: { targetTopologicalForbiddenMinors: ["K5"] } }],
				[],
				{ topologicalMinorFree: { kind: "topological_minor_free", forbiddenMinors: ["K5"] } }
			);
			const result = validateTopologicalMinorFree(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toContain("K5");
		});

		it("should handle empty graph", () => {
			const graph = createGraph([], [], {
				topologicalMinorFree: { kind: "topological_minor_free", forbiddenMinors: ["K5"] },
			});
			const result = validateTopologicalMinorFree(graph);
			expect(result.valid).toBe(false);
			expect(result.actual).toBe("unknown (no metadata)");
		});

		it("should handle graph with only partial metadata", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { targetTopologicalForbiddenMinors: ["K5"] } },
					{ id: "b" }, // No metadata
				],
				[{ source: "a", target: "b" }],
				{ topologicalMinorFree: { kind: "topological_minor_free", forbiddenMinors: ["K5"] } }
			);
			const result = validateTopologicalMinorFree(graph);
			// Only requires some nodes to have metadata
			expect(result.valid).toBe(true);
		});
	});
});

import { describe, expect, it } from "vitest";

import type { TestGraph } from "../generation/generator";
import type { TestEdge, TestNode } from "../generation/generators/types";
import {
	validateDominationNumber,
	validateHereditaryClass,
	validateIndependenceNumber,
	validateVertexCover,
} from "./invariant";

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

describe("validateHereditaryClass", () => {
	describe("when hereditaryClass is not specified", () => {
		it("should return valid for unconstrained hereditaryClass", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validateHereditaryClass(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("hereditaryClass");
		});
	});

	describe("when hereditaryClass is specified", () => {
		it("should return valid with empty forbidden list", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ hereditaryClass: { kind: "hereditary_class", forbidden: [] } }
			);
			const result = validateHereditaryClass(graph);
			expect(result.valid).toBe(true);
		});

		it("should return valid when nodes have hereditaryClass metadata", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { hereditaryClass: true } },
					{ id: "b", data: { hereditaryClass: true } },
				],
				[{ source: "a", target: "b" }],
				{ hereditaryClass: { kind: "hereditary_class", forbidden: ["K5"] } }
			);
			const result = validateHereditaryClass(graph);
			expect(result.valid).toBe(true);
		});

		it("should return invalid without metadata when forbidden patterns specified", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ hereditaryClass: { kind: "hereditary_class", forbidden: ["K5", "K3,3"] } }
			);
			const result = validateHereditaryClass(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("forbidden patterns");
			expect(result.message).toContain("K5");
		});
	});
});

describe("validateIndependenceNumber", () => {
	describe("when independenceNumber is not specified", () => {
		it("should return valid for unconstrained independenceNumber", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validateIndependenceNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("independenceNumber");
		});
	});

	describe("when independenceNumber is specified", () => {
		it("should return valid when nodes have metadata", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { targetIndependenceNumber: 2 } },
					{ id: "b", data: { targetIndependenceNumber: 2 } },
				],
				[{ source: "a", target: "b" }],
				{ independenceNumber: { kind: "independence_number", value: 2 } }
			);
			const result = validateIndependenceNumber(graph);
			expect(result.valid).toBe(true);
		});

		it("should compute independence number for empty graph", () => {
			const graph = createGraph([], [], {
				independenceNumber: { kind: "independence_number", value: 0 },
			});
			const result = validateIndependenceNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("α=0");
		});

		it("should compute independence number for single node", () => {
			const graph = createGraph([{ id: "a" }], [], {
				independenceNumber: { kind: "independence_number", value: 1 },
			});
			const result = validateIndependenceNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("α=1");
		});

		it("should compute independence number for complete graph K3", () => {
			// In K3, alpha = 1 (only one vertex can be independent)
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }],
				[
					{ source: "a", target: "b" },
					{ source: "b", target: "c" },
					{ source: "c", target: "a" },
				],
				{ independenceNumber: { kind: "independence_number", value: 1 } }
			);
			const result = validateIndependenceNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("α=1");
		});

		it("should compute independence number for path graph P3", () => {
			// In P3 (a-b-c), alpha = 2 (a and c form independent set)
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }],
				[
					{ source: "a", target: "b" },
					{ source: "b", target: "c" },
				],
				{ independenceNumber: { kind: "independence_number", value: 2 } }
			);
			const result = validateIndependenceNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("α=2");
		});

		it("should return invalid for incorrect independence number", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }],
				[
					{ source: "a", target: "b" },
					{ source: "b", target: "c" },
				],
				{ independenceNumber: { kind: "independence_number", value: 3 } }
			);
			const result = validateIndependenceNumber(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("expected 3");
		});

		it("should compute independence number for independent set", () => {
			// No edges means alpha = n
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }],
				[],
				{ independenceNumber: { kind: "independence_number", value: 3 } }
			);
			const result = validateIndependenceNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("α=3");
		});
	});
});

describe("validateVertexCover", () => {
	describe("when vertexCover is not specified", () => {
		it("should return valid for unconstrained vertexCover", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validateVertexCover(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("vertexCover");
		});
	});

	describe("when vertexCover is specified", () => {
		it("should return valid when nodes have metadata", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { targetVertexCover: 1 } },
					{ id: "b", data: { targetVertexCover: 1 } },
				],
				[{ source: "a", target: "b" }],
				{ vertexCover: { kind: "vertex_cover", value: 1 } }
			);
			const result = validateVertexCover(graph);
			expect(result.valid).toBe(true);
		});

		it("should compute vertex cover for empty graph", () => {
			const graph = createGraph([], [], {
				vertexCover: { kind: "vertex_cover", value: 0 },
			});
			const result = validateVertexCover(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("τ=0");
		});

		it("should compute vertex cover for single edge", () => {
			// tau = n - alpha = 2 - 1 = 1
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ vertexCover: { kind: "vertex_cover", value: 1 } }
			);
			const result = validateVertexCover(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("τ=1");
		});

		it("should compute vertex cover for complete graph K3", () => {
			// K3: alpha = 1, so tau = 3 - 1 = 2
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }],
				[
					{ source: "a", target: "b" },
					{ source: "b", target: "c" },
					{ source: "c", target: "a" },
				],
				{ vertexCover: { kind: "vertex_cover", value: 2 } }
			);
			const result = validateVertexCover(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("τ=2");
		});

		it("should return invalid for incorrect vertex cover", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ vertexCover: { kind: "vertex_cover", value: 0 } }
			);
			const result = validateVertexCover(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("expected 0");
		});
	});
});

describe("validateDominationNumber", () => {
	describe("when dominationNumber is not specified", () => {
		it("should return valid for unconstrained dominationNumber", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validateDominationNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("dominationNumber");
		});
	});

	describe("when dominationNumber is specified", () => {
		it("should return valid when nodes have metadata", () => {
			const graph = createGraph(
				[
					{ id: "a", data: { targetDominationNumber: 1 } },
					{ id: "b", data: { targetDominationNumber: 1 } },
				],
				[{ source: "a", target: "b" }],
				{ dominationNumber: { kind: "domination_number", value: 1 } }
			);
			const result = validateDominationNumber(graph);
			expect(result.valid).toBe(true);
		});

		it("should compute domination number for empty graph", () => {
			const graph = createGraph([], [], {
				dominationNumber: { kind: "domination_number", value: 0 },
			});
			const result = validateDominationNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("γ=0");
		});

		it("should compute domination number for single node", () => {
			const graph = createGraph([{ id: "a" }], [], {
				dominationNumber: { kind: "domination_number", value: 1 },
			});
			const result = validateDominationNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("γ=1");
		});

		it("should compute domination number for star graph", () => {
			// Star K1,3: center dominates all, gamma = 1
			const graph = createGraph(
				[{ id: "center" }, { id: "a" }, { id: "b" }, { id: "c" }],
				[
					{ source: "center", target: "a" },
					{ source: "center", target: "b" },
					{ source: "center", target: "c" },
				],
				{ dominationNumber: { kind: "domination_number", value: 1 } }
			);
			const result = validateDominationNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("γ=1");
		});

		it("should compute domination number for path P3", () => {
			// Path a-b-c: b dominates all, gamma = 1
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }],
				[
					{ source: "a", target: "b" },
					{ source: "b", target: "c" },
				],
				{ dominationNumber: { kind: "domination_number", value: 1 } }
			);
			const result = validateDominationNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("γ=1");
		});

		it("should return invalid for incorrect domination number", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ dominationNumber: { kind: "domination_number", value: 2 } }
			);
			const result = validateDominationNumber(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("expected 2");
		});

		it("should compute domination number for isolated nodes", () => {
			// No edges means each node must be in dominating set
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }],
				[],
				{ dominationNumber: { kind: "domination_number", value: 3 } }
			);
			const result = validateDominationNumber(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("γ=3");
		});
	});
});

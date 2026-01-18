import { describe, expect, it } from "vitest";

import type { TestGraph , TestNode } from "../generation/generators/types";
import {
	validateCage,
	validateMooreGraph,
	validateRamanujan,
} from "./extremal";

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
	specOverrides: Record<string, any> = {}
): TestGraph => ({
	nodes,
	edges: [],
	spec: createSpec(specOverrides) as any,
});

describe("validateCage", () => {
	it("should return valid when cage is unconstrained", () => {
		const graph = createGraph([{ id: "a" }, { id: "b" }]);
		const result = validateCage(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("should return valid when cage kind is not cage", () => {
		const graph = createGraph([{ id: "a" }], {
			cage: { kind: "unconstrained" },
		});
		const result = validateCage(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate cage with metadata", () => {
		const graph = createGraph(
			[
				{ id: "a", data: { targetCageGirth: 5 } },
				{ id: "b" },
				{ id: "c" },
			],
			{ cage: { kind: "cage", girth: 5, degree: 3 } }
		);
		const result = validateCage(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("cage(girth=5, degree=3)");
	});

	it("should fail cage validation without metadata", () => {
		const graph = createGraph([{ id: "a" }, { id: "b" }, { id: "c" }], {
			cage: { kind: "cage", girth: 5, degree: 3 },
		});
		const result = validateCage(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("Cannot verify cage structure");
	});

	it("should handle cage with different parameters", () => {
		const graph = createGraph(
			[
				{ id: "a", data: { targetCageGirth: 6 } },
				{ id: "b" },
			],
			{ cage: { kind: "cage", girth: 6, degree: 4 } }
		);
		const result = validateCage(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("cage(girth=6, degree=4)");
	});

	it("should check all nodes for metadata", () => {
		const graph = createGraph(
			[
				{ id: "a" },
				{ id: "b" },
				{ id: "c", data: { targetCageGirth: 5 } },
			],
			{ cage: { kind: "cage", girth: 5, degree: 3 } }
		);
		const result = validateCage(graph);
		expect(result.valid).toBe(true);
	});
});

describe("validateMooreGraph", () => {
	it("should return valid when moore is unconstrained", () => {
		const graph = createGraph([{ id: "a" }, { id: "b" }]);
		const result = validateMooreGraph(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("should return valid when moore kind is not moore", () => {
		const graph = createGraph([{ id: "a" }], {
			moore: { kind: "unconstrained" },
		});
		const result = validateMooreGraph(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate Moore graph with metadata", () => {
		const graph = createGraph(
			[
				{ id: "a", data: { targetMooreDiameter: 2 } },
				{ id: "b" },
				{ id: "c" },
			],
			{ moore: { kind: "moore", diameter: 2, degree: 3 } }
		);
		const result = validateMooreGraph(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("moore(diameter=2, degree=3)");
	});

	it("should fail Moore graph validation without metadata", () => {
		const graph = createGraph([{ id: "a" }, { id: "b" }, { id: "c" }], {
			moore: { kind: "moore", diameter: 2, degree: 3 },
		});
		const result = validateMooreGraph(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("Cannot verify Moore graph structure");
	});

	it("should handle Moore graph with different parameters", () => {
		const graph = createGraph(
			[
				{ id: "a", data: { targetMooreDiameter: 3 } },
				{ id: "b" },
			],
			{ moore: { kind: "moore", diameter: 3, degree: 5 } }
		);
		const result = validateMooreGraph(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("moore(diameter=3, degree=5)");
	});

	it("should check all nodes for metadata", () => {
		const graph = createGraph(
			[
				{ id: "a" },
				{ id: "b" },
				{ id: "c", data: { targetMooreDiameter: 2 } },
			],
			{ moore: { kind: "moore", diameter: 2, degree: 3 } }
		);
		const result = validateMooreGraph(graph);
		expect(result.valid).toBe(true);
	});
});

describe("validateRamanujan", () => {
	it("should return valid when ramanujan is unconstrained", () => {
		const graph = createGraph([{ id: "a" }, { id: "b" }]);
		const result = validateRamanujan(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("should return valid when ramanujan kind is not ramanujan", () => {
		const graph = createGraph([{ id: "a" }], {
			ramanujan: { kind: "unconstrained" },
		});
		const result = validateRamanujan(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate Ramanujan graph with metadata", () => {
		const graph = createGraph(
			[
				{ id: "a", data: { targetRamanujanDegree: 3 } },
				{ id: "b" },
				{ id: "c" },
			],
			{ ramanujan: { kind: "ramanujan", degree: 3 } }
		);
		const result = validateRamanujan(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("ramanujan(degree=3)");
	});

	it("should fail Ramanujan validation without metadata", () => {
		const graph = createGraph([{ id: "a" }, { id: "b" }, { id: "c" }], {
			ramanujan: { kind: "ramanujan", degree: 3 },
		});
		const result = validateRamanujan(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("Cannot verify Ramanujan property");
	});

	it("should handle Ramanujan graph with different degree", () => {
		const graph = createGraph(
			[
				{ id: "a", data: { targetRamanujanDegree: 5 } },
				{ id: "b" },
			],
			{ ramanujan: { kind: "ramanujan", degree: 5 } }
		);
		const result = validateRamanujan(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("ramanujan(degree=5)");
	});

	it("should check all nodes for metadata", () => {
		const graph = createGraph(
			[
				{ id: "a" },
				{ id: "b" },
				{ id: "c", data: { targetRamanujanDegree: 4 } },
			],
			{ ramanujan: { kind: "ramanujan", degree: 4 } }
		);
		const result = validateRamanujan(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle empty graph", () => {
		const graph = createGraph([], {
			ramanujan: { kind: "ramanujan", degree: 3 },
		});
		const result = validateRamanujan(graph);
		expect(result.valid).toBe(false);
		expect(result.actual).toBe("unknown (no metadata)");
	});
});

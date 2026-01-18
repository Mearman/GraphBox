import { describe, expect, it } from "vitest";

import type { TestGraph } from "../generation/generator";
import type { TestEdge, TestNode } from "../generation/generators/types";
import {
	detectCycle,
	validateConnectivity,
	validateCycles,
	validateDirectionality,
	validateEdgeMultiplicity,
	validateSchema,
	validateSelfLoops,
	validateWeighting,
} from "./basic-validators";

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

describe("validateDirectionality", () => {
	it("should return valid for undirected graph", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ directionality: { kind: "undirected" } }
		);
		const result = validateDirectionality(graph);
		expect(result.valid).toBe(true);
		expect(result.property).toBe("directionality");
		expect(result.expected).toBe("undirected");
	});

	it("should return valid for directed graph", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ directionality: { kind: "directed" } }
		);
		const result = validateDirectionality(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("directed");
	});

	it("should handle empty graph", () => {
		const graph = createGraph([], [], { directionality: { kind: "undirected" } });
		const result = validateDirectionality(graph);
		expect(result.valid).toBe(true);
	});
});

describe("validateWeighting", () => {
	it("should return valid for unweighted graph with no weights", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ weighting: { kind: "unweighted" } }
		);
		const result = validateWeighting(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("unweighted");
	});

	it("should return invalid for unweighted graph with weights", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b", weight: 5 }],
			{ weighting: { kind: "unweighted" } }
		);
		const result = validateWeighting(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("should be unweighted");
	});

	it("should return valid for weighted graph with all weights", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b", weight: 5 }],
			{ weighting: { kind: "weighted_numeric" } }
		);
		const result = validateWeighting(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("weighted_numeric");
	});

	it("should return invalid for weighted graph with missing weights", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b", weight: 5 },
				{ source: "b", target: "c" },
			],
			{ weighting: { kind: "weighted_numeric" } }
		);
		const result = validateWeighting(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("should be weighted");
	});

	it("should handle empty graph", () => {
		const graph = createGraph([], [], { weighting: { kind: "unweighted" } });
		const result = validateWeighting(graph);
		expect(result.valid).toBe(true);
	});
});

describe("validateCycles", () => {
	it("should return valid for acyclic graph when acyclic expected", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ cycles: { kind: "acyclic" }, directionality: { kind: "directed" } }
		);
		const result = validateCycles(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("acyclic");
	});

	it("should return invalid for cyclic graph when acyclic expected", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{ cycles: { kind: "acyclic" }, directionality: { kind: "directed" } }
		);
		const result = validateCycles(graph);
		expect(result.valid).toBe(false);
		expect(result.actual).toBe("cycles_allowed");
	});

	it("should return valid for any graph when cycles_allowed", () => {
		const graphWithCycle = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{ cycles: { kind: "cycles_allowed" }, directionality: { kind: "directed" } }
		);
		expect(validateCycles(graphWithCycle).valid).toBe(true);

		const graphWithoutCycle = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ cycles: { kind: "cycles_allowed" }, directionality: { kind: "directed" } }
		);
		expect(validateCycles(graphWithoutCycle).valid).toBe(true);
	});

	it("should handle undirected cycles", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{ cycles: { kind: "acyclic" }, directionality: { kind: "undirected" } }
		);
		const result = validateCycles(graph);
		expect(result.valid).toBe(false);
	});

	it("should handle empty graph", () => {
		const graph = createGraph([], [], { cycles: { kind: "acyclic" } });
		const result = validateCycles(graph);
		expect(result.valid).toBe(true);
	});
});

describe("validateConnectivity", () => {
	it("should return valid for connected graph when connected expected", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ connectivity: { kind: "connected" }, directionality: { kind: "undirected" } }
		);
		const result = validateConnectivity(graph);
		expect(result.valid).toBe(true);
	});

	it("should return invalid for disconnected graph when connected expected", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "c", target: "d" },
			],
			{ connectivity: { kind: "connected" }, directionality: { kind: "undirected" } }
		);
		const result = validateConnectivity(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("disconnected");
	});

	it("should return valid for any graph when unconstrained", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "c", target: "d" },
			],
			{ connectivity: { kind: "unconstrained" } }
		);
		const result = validateConnectivity(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle single node graph", () => {
		const graph = createGraph(
			[{ id: "a" }],
			[],
			{ connectivity: { kind: "connected" } }
		);
		const result = validateConnectivity(graph);
		expect(result.valid).toBe(true);
	});
});

describe("validateSchema", () => {
	it("should return valid for homogeneous graph with same types", () => {
		const graph = createGraph(
			[{ id: "a", type: "person" }, { id: "b", type: "person" }],
			[{ source: "a", target: "b", type: "knows" }],
			{ schema: { kind: "homogeneous" } }
		);
		const result = validateSchema(graph);
		expect(result.valid).toBe(true);
	});

	it("should return valid for homogeneous graph with no types", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ schema: { kind: "homogeneous" } }
		);
		const result = validateSchema(graph);
		expect(result.valid).toBe(true);
	});

	it("should return invalid for homogeneous graph with multiple types", () => {
		const graph = createGraph(
			[{ id: "a", type: "person" }, { id: "b", type: "company" }],
			[{ source: "a", target: "b" }],
			{ schema: { kind: "homogeneous" } }
		);
		const result = validateSchema(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("node types");
	});

	it("should return valid for heterogeneous graph with multiple types", () => {
		const graph = createGraph(
			[{ id: "a", type: "person" }, { id: "b", type: "company" }],
			[{ source: "a", target: "b" }],
			{ schema: { kind: "heterogeneous" } }
		);
		const result = validateSchema(graph);
		expect(result.valid).toBe(true);
	});

	it("should return invalid for heterogeneous graph with uniform types", () => {
		const graph = createGraph(
			[{ id: "a", type: "person" }, { id: "b", type: "person" }],
			[{ source: "a", target: "b" }],
			{ schema: { kind: "heterogeneous" } }
		);
		const result = validateSchema(graph);
		expect(result.valid).toBe(false);
	});
});

describe("validateEdgeMultiplicity", () => {
	it("should return valid for simple graph with no parallel edges", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ edgeMultiplicity: { kind: "simple" } }
		);
		const result = validateEdgeMultiplicity(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("simple");
	});

	it("should return invalid for simple graph with parallel edges", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[
				{ source: "a", target: "b" },
				{ source: "a", target: "b" },
			],
			{ edgeMultiplicity: { kind: "simple" } }
		);
		const result = validateEdgeMultiplicity(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("parallel edges");
	});

	it("should return valid for multigraph with parallel edges", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[
				{ source: "a", target: "b" },
				{ source: "a", target: "b" },
			],
			{ edgeMultiplicity: { kind: "multi" } }
		);
		const result = validateEdgeMultiplicity(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("multi");
	});

	it("should handle directed graph parallel edges correctly", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "a" },
			],
			{ edgeMultiplicity: { kind: "simple" }, directionality: { kind: "directed" } }
		);
		// a->b and b->a are different edges in directed graph
		const result = validateEdgeMultiplicity(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle multigraph with insufficient nodes", () => {
		const graph = createGraph(
			[{ id: "a" }],
			[],
			{ edgeMultiplicity: { kind: "multi" } }
		);
		const result = validateEdgeMultiplicity(graph);
		// With fewer than 2 nodes, parallel edges are impossible
		expect(result.valid).toBe(true);
	});
});

describe("validateSelfLoops", () => {
	it("should return valid for allowed self-loops when present", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[
				{ source: "a", target: "a" },
				{ source: "a", target: "b" },
			],
			{ selfLoops: { kind: "allowed" } }
		);
		const result = validateSelfLoops(graph);
		expect(result.valid).toBe(true);
	});

	it("should return invalid for allowed self-loops when none present", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ selfLoops: { kind: "allowed" } }
		);
		const result = validateSelfLoops(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("should allow self-loops but has none");
	});

	it("should return valid for disallowed self-loops when none present", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }],
			{ selfLoops: { kind: "disallowed" } }
		);
		const result = validateSelfLoops(graph);
		expect(result.valid).toBe(true);
	});

	it("should return invalid for disallowed self-loops when present", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "a" }],
			{ selfLoops: { kind: "disallowed" } }
		);
		const result = validateSelfLoops(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("should not allow self-loops");
	});
});

describe("detectCycle", () => {
	it("should detect cycle in directed graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
			{ source: "c", target: "a" },
		];
		expect(detectCycle(nodes, edges, true)).toBe(true);
	});

	it("should not detect cycle in acyclic directed graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
		];
		expect(detectCycle(nodes, edges, true)).toBe(false);
	});

	it("should detect cycle in undirected graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
			{ source: "c", target: "a" },
		];
		expect(detectCycle(nodes, edges, false)).toBe(true);
	});

	it("should not detect cycle in tree (undirected)", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
		];
		expect(detectCycle(nodes, edges, false)).toBe(false);
	});

	it("should return false for graph with less than 2 nodes", () => {
		expect(detectCycle([{ id: "a" }], [], true)).toBe(false);
		expect(detectCycle([], [], true)).toBe(false);
	});

	it("should handle disconnected graph with cycle in one component", () => {
		const nodes: TestNode[] = [
			{ id: "a" },
			{ id: "b" },
			{ id: "c" },
			{ id: "d" },
			{ id: "e" },
		];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
			{ source: "c", target: "a" },
			{ source: "d", target: "e" },
		];
		expect(detectCycle(nodes, edges, true)).toBe(true);
	});
});

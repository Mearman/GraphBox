import { describe, expect, it } from "vitest";

import type { TestEdge,TestGraph, TestNode } from "../generation/generators/types";
import { validateIntegrity,validateToughness } from "./robustness";

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
const createNodes = (count: number, data?: Record<string, unknown>): TestNode[] =>
	Array.from({ length: count }, (_, index) => ({
		id: `n${index}`,
		data: data ? { ...data } : undefined,
	}));

// Helper to create edges
const createEdge = (source: string, target: string): TestEdge => ({
	source,
	target,
});

describe("validateToughness", () => {
	it("returns valid when toughness is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const graph = createGraph(nodes, edges);

		const result = validateToughness(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("toughness");
		expect(result.expected).toBe("unconstrained");
	});

	it("validates toughness with metadata", () => {
		const nodes = createNodes(4, { targetToughness: 1 });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
			createEdge("n0", "n2"),
			createEdge("n1", "n3"),
		];
		const spec = createSpec({
			toughness: { kind: "toughness", value: 1 },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateToughness(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("toughness=1");
	});

	it("computes toughness approximation for connected graph", () => {
		// Complete graph K4: all vertices have degree 3, toughness approx = 3/2 = 1.5
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
			createEdge("n1", "n2"),
			createEdge("n1", "n3"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({
			toughness: { kind: "toughness", value: 1.5 },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateToughness(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toContain("toughness");
	});

	it("computes toughness 0 for disconnected graph", () => {
		// Disconnected graph: two separate edges
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n2", "n3")];
		const spec = createSpec({
			toughness: { kind: "toughness", value: 1 },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateToughness(graph);

		// Disconnected graphs have toughness 0, so won't match target 1.0
		expect(result.actual).toContain("0");
	});

	it("handles single node graph", () => {
		const nodes = createNodes(1);
		const spec = createSpec({
			toughness: { kind: "toughness", value: 0 },
		});
		const graph = createGraph(nodes, [], spec);

		const result = validateToughness(graph);

		expect(result.actual).toContain("0");
	});

	it("handles empty graph", () => {
		const spec = createSpec({
			toughness: { kind: "toughness", value: 0 },
		});
		const graph = createGraph([], [], spec);

		const result = validateToughness(graph);

		expect(result.actual).toContain("0");
	});
});

describe("validateIntegrity", () => {
	it("returns valid when integrity is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const graph = createGraph(nodes, edges);

		const result = validateIntegrity(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("integrity");
		expect(result.expected).toBe("unconstrained");
	});

	it("validates integrity with metadata", () => {
		const nodes = createNodes(4, { targetIntegrity: 3 });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({
			integrity: { kind: "integrity", value: 3 },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateIntegrity(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("integrity=3");
	});

	it("computes integrity approximation for connected graph", () => {
		// Path graph P4: min degree is 1, so integrity approx = 1 + 1 = 2
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({
			integrity: { kind: "integrity", value: 2 },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateIntegrity(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toContain("integrity");
	});

	it("computes integrity for disconnected graph", () => {
		// Disconnected graph: two separate edges
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n2", "n3")];
		const spec = createSpec({
			integrity: { kind: "integrity", value: 4 },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateIntegrity(graph);

		// Disconnected graphs have integrity = n
		expect(result.actual).toContain("integrity");
	});

	it("handles single node graph", () => {
		const nodes = createNodes(1);
		const spec = createSpec({
			integrity: { kind: "integrity", value: 1 },
		});
		const graph = createGraph(nodes, [], spec);

		const result = validateIntegrity(graph);

		expect(result.actual).toContain("1");
	});

	it("handles empty graph", () => {
		const spec = createSpec({
			integrity: { kind: "integrity", value: 0 },
		});
		const graph = createGraph([], [], spec);

		const result = validateIntegrity(graph);

		expect(result.actual).toContain("0");
	});

	it("validates integrity within tolerance", () => {
		// Complete graph K4: all vertices have degree 3, integrity approx = 3 + 1 = 4
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
			createEdge("n1", "n2"),
			createEdge("n1", "n3"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({
			integrity: { kind: "integrity", value: 4 },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateIntegrity(graph);

		expect(result.valid).toBe(true);
	});
});

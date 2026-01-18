import { describe, expect, it } from "vitest";

import type { TestGraph } from "../generation/generator";
import type { TestEdge, TestNode } from "../generation/generators/types";
import {
	validateCircumference,
	validateDiameter,
	validateGirth,
	validateHamiltonian,
	validateRadius,
	validateTraceable,
} from "./path-cycle";

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

describe("validateHamiltonian", () => {
	it("returns valid when hamiltonian is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const graph = createGraph(nodes, edges);

		const result = validateHamiltonian(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("hamiltonian");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 3 nodes", () => {
		const nodes = createNodes(2);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ hamiltonian: { kind: "hamiltonian" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateHamiltonian(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates hamiltonian cycle from metadata", () => {
		const nodes = createNodes(4, { hamiltonianCycle: ["n0", "n1", "n2", "n3"] });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({ hamiltonian: { kind: "hamiltonian" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateHamiltonian(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("hamiltonian");
	});

	it("returns invalid when cycle metadata has wrong length", () => {
		const nodes = createNodes(4, { hamiltonianCycle: ["n0", "n1", "n2"] });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({ hamiltonian: { kind: "hamiltonian" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateHamiltonian(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("invalid_cycle");
	});

	it("returns invalid when cycle edge is missing", () => {
		const nodes = createNodes(4, { hamiltonianCycle: ["n0", "n1", "n2", "n3"] });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			// Missing edge n3 -> n0
		];
		const spec = createSpec({ hamiltonian: { kind: "hamiltonian" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateHamiltonian(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("missing_cycle_edge");
	});

	it("returns invalid when insufficient edges for hamiltonian (fallback)", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")]; // Only 2 edges, need at least 4
		const spec = createSpec({ hamiltonian: { kind: "hamiltonian" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateHamiltonian(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("insufficient_edges");
	});

	it("returns valid with sufficient edges when no metadata (fallback)", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({ hamiltonian: { kind: "hamiltonian" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateHamiltonian(graph);

		expect(result.valid).toBe(true);
		expect(result.message).toContain("skipped");
	});
});

describe("validateTraceable", () => {
	it("returns valid when traceable is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateTraceable(graph);

		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ traceable: { kind: "traceable" } });
		const graph = createGraph(nodes, [], spec);

		const result = validateTraceable(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates traceable path from metadata", () => {
		const nodes = createNodes(4, { traceablePath: ["n0", "n1", "n2", "n3"] });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ traceable: { kind: "traceable" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateTraceable(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("traceable");
	});

	it("returns invalid when path metadata has wrong length", () => {
		const nodes = createNodes(4, { traceablePath: ["n0", "n1", "n2"] });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ traceable: { kind: "traceable" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateTraceable(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("invalid_path");
	});

	it("returns invalid when path edge is missing", () => {
		const nodes = createNodes(4, { traceablePath: ["n0", "n1", "n2", "n3"] });
		const edges = [
			createEdge("n0", "n1"),
			// Missing edge n1 -> n2
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ traceable: { kind: "traceable" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateTraceable(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("missing_path_edge");
	});

	it("returns invalid when insufficient edges for traceable (fallback)", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1")]; // Only 1 edge, need at least 3
		const spec = createSpec({ traceable: { kind: "traceable" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateTraceable(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("insufficient_edges");
	});
});

describe("validateDiameter", () => {
	it("returns valid when diameter is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const graph = createGraph(nodes, edges);

		const result = validateDiameter(graph);

		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ diameter: { kind: "diameter", value: 0 } });
		const graph = createGraph(nodes, [], spec);

		const result = validateDiameter(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates diameter from metadata", () => {
		const nodes = createNodes(3, { targetDiameter: 2 });
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ diameter: { kind: "diameter", value: 2 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateDiameter(graph);

		expect(result.valid).toBe(true);
		expect(result.expected).toBe("diameter=2");
	});

	it("computes actual diameter when no metadata", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ diameter: { kind: "diameter", value: 2 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateDiameter(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("diameter=2");
	});

	it("returns invalid when computed diameter differs from target", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ diameter: { kind: "diameter", value: 1 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateDiameter(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("diameter=2");
		expect(result.expected).toBe("diameter=1");
	});
});

describe("validateRadius", () => {
	it("returns valid when radius is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const graph = createGraph(nodes, edges);

		const result = validateRadius(graph);

		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ radius: { kind: "radius", value: 0 } });
		const graph = createGraph(nodes, [], spec);

		const result = validateRadius(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates radius from metadata", () => {
		const nodes = createNodes(3, { targetRadius: 1 });
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ radius: { kind: "radius", value: 1 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateRadius(graph);

		expect(result.valid).toBe(true);
	});

	it("computes actual radius when no metadata", () => {
		// Path graph n0 - n1 - n2: eccentricity of n0=2, n1=1, n2=2, radius=1
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ radius: { kind: "radius", value: 1 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateRadius(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("radius=1");
	});

	it("returns invalid when computed radius differs from target", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ radius: { kind: "radius", value: 2 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateRadius(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("radius=1");
	});
});

describe("validateGirth", () => {
	it("returns valid when girth is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const graph = createGraph(nodes, edges);

		const result = validateGirth(graph);

		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("returns invalid for graphs with less than 3 nodes (cannot have cycles)", () => {
		const nodes = createNodes(2);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ girth: { kind: "girth", girth: 3 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateGirth(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("acyclic");
	});

	it("validates girth from metadata", () => {
		const nodes = createNodes(3, { targetGirth: 3 });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n0"),
		];
		const spec = createSpec({ girth: { kind: "girth", girth: 3 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateGirth(graph);

		expect(result.valid).toBe(true);
	});

	it("computes actual girth (triangle)", () => {
		const nodes = createNodes(3);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n0"),
		];
		const spec = createSpec({ girth: { kind: "girth", girth: 3 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateGirth(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("girth=3");
	});

	it("returns invalid for acyclic graph", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ girth: { kind: "girth", girth: 4 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateGirth(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("acyclic");
	});

	it("returns invalid when girth differs from target", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({ girth: { kind: "girth", girth: 3 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateGirth(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("girth=4");
	});
});

describe("validateCircumference", () => {
	it("returns valid when circumference is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const graph = createGraph(nodes, edges);

		const result = validateCircumference(graph);

		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("returns invalid for graphs with less than 3 nodes", () => {
		const nodes = createNodes(2);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ circumference: { kind: "circumference", value: 2 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateCircumference(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("acyclic");
	});

	it("validates circumference from metadata", () => {
		const nodes = createNodes(4, { targetCircumference: 4 });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({ circumference: { kind: "circumference", value: 4 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateCircumference(graph);

		expect(result.valid).toBe(true);
	});

	it("computes actual circumference", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({ circumference: { kind: "circumference", value: 4 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateCircumference(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("circumference=4");
	});

	it("returns invalid for acyclic graph", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ circumference: { kind: "circumference", value: 4 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateCircumference(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("acyclic");
	});

	it("returns invalid when circumference differs from target", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({ circumference: { kind: "circumference", value: 3 } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateCircumference(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("circumference=4");
	});
});

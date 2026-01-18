/**
 * Unit tests for main.ts
 */

import { describe, expect, it } from "vitest";

import {
	computeGraphSpecFromGraph,
	type InferredGraphSpec,
} from "./main";
import type { AnalyzerGraph } from "./types";
import { defaultComputePolicy } from "./types";

// ============================================================================
// Helper graphs
// ============================================================================

const emptyGraph: AnalyzerGraph = { vertices: [], edges: [] };

const singleVertex: AnalyzerGraph = {
	vertices: [{ id: "a" }],
	edges: [],
};

const simpleTriangle: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: false },
		{ id: "e3", endpoints: ["c", "a"], directed: false },
	],
};

const simpleDAG: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: true },
		{ id: "e2", endpoints: ["b", "c"], directed: true },
	],
};

const weightedGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false, weight: 5 },
	],
};

const labelledGraph: AnalyzerGraph = {
	vertices: [
		{ id: "a", label: "Node A" },
		{ id: "b", label: "Node B" },
	],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false, label: "connects" },
	],
};

const attributedGraph: AnalyzerGraph = {
	vertices: [
		{ id: "a", attrs: { type: "source", pos: { x: 0, y: 0 } } },
		{ id: "b", attrs: { type: "sink", pos: { x: 1, y: 1 } } },
	],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { cost: 10 } },
	],
};

const rootedTree: AnalyzerGraph = {
	vertices: [
		{ id: "root", attrs: { root: true } },
		{ id: "child1" },
		{ id: "child2" },
	],
	edges: [
		{ id: "e1", endpoints: ["root", "child1"], directed: false },
		{ id: "e2", endpoints: ["root", "child2"], directed: false },
	],
};

// ============================================================================
// computeGraphSpecFromGraph
// ============================================================================

describe("computeGraphSpecFromGraph", () => {
	it("computes spec for empty graph", () => {
		const spec = computeGraphSpecFromGraph(emptyGraph);

		expect(spec.vertexCardinality).toEqual({ kind: "finite", n: 0 });
		expect(spec.directionality).toEqual({ kind: "undirected" });
		expect(spec.edgeArity).toEqual({ kind: "binary" });
	});

	it("computes spec for single vertex", () => {
		const spec = computeGraphSpecFromGraph(singleVertex);

		expect(spec.vertexCardinality).toEqual({ kind: "finite", n: 1 });
		expect(spec.vertexIdentity).toEqual({ kind: "distinguishable" });
	});

	it("computes spec for simple triangle", () => {
		const spec = computeGraphSpecFromGraph(simpleTriangle);

		expect(spec.vertexCardinality).toEqual({ kind: "finite", n: 3 });
		expect(spec.directionality).toEqual({ kind: "undirected" });
		expect(spec.edgeArity).toEqual({ kind: "binary" });
		expect(spec.edgeMultiplicity).toEqual({ kind: "simple" });
		expect(spec.selfLoops).toEqual({ kind: "disallowed" });
		expect(spec.cycles).toEqual({ kind: "cycles_allowed" });
		expect(spec.connectivity).toEqual({ kind: "connected" });
		expect(spec.degreeConstraint).toEqual({ kind: "regular", degree: 2 });
	});

	it("computes spec for directed acyclic graph", () => {
		const spec = computeGraphSpecFromGraph(simpleDAG);

		expect(spec.directionality).toEqual({ kind: "directed" });
		expect(spec.cycles).toEqual({ kind: "acyclic" });
	});

	it("computes spec for weighted graph", () => {
		const spec = computeGraphSpecFromGraph(weightedGraph);

		expect(spec.weighting).toEqual({ kind: "weighted_numeric" });
		expect(spec.measureSemantics).toEqual({ kind: "metric" });
	});

	it("computes spec for labelled graph", () => {
		const spec = computeGraphSpecFromGraph(labelledGraph);

		expect(spec.vertexData).toEqual({ kind: "labelled" });
		expect(spec.edgeData).toEqual({ kind: "labelled" });
	});

	it("computes spec for attributed graph with spatial embedding", () => {
		const spec = computeGraphSpecFromGraph(attributedGraph);

		expect(spec.vertexData).toEqual({ kind: "attributed" });
		expect(spec.edgeData).toEqual({ kind: "attributed" });
		expect(spec.embedding).toEqual({ kind: "spatial_coordinates", dims: 2 });
		expect(spec.measureSemantics).toEqual({ kind: "cost" });
	});

	it("computes spec for rooted tree", () => {
		const spec = computeGraphSpecFromGraph(rootedTree);

		expect(spec.rooting).toEqual({ kind: "rooted" });
		expect(spec.cycles).toEqual({ kind: "acyclic" });
		expect(spec.connectivity).toEqual({ kind: "connected" });
	});

	it("respects custom policy", () => {
		const customPolicy = {
			...defaultComputePolicy,
			rootKey: "isRoot",
		};

		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { isRoot: true } },
				{ id: "b" },
			],
			edges: [],
		};

		const spec = computeGraphSpecFromGraph(graph, customPolicy);
		expect(spec.rooting).toEqual({ kind: "rooted" });

		// With default policy, should not find root
		const specDefault = computeGraphSpecFromGraph(graph);
		expect(specDefault.rooting).toEqual({ kind: "unrooted" });
	});

	it("includes all expected properties", () => {
		const spec = computeGraphSpecFromGraph(simpleTriangle);

		// Verify all properties exist (type-safe access)
		const expectedKeys: Array<keyof InferredGraphSpec> = [
			"vertexCardinality",
			"vertexIdentity",
			"vertexOrdering",
			"edgeArity",
			"edgeMultiplicity",
			"selfLoops",
			"directionality",
			"weighting",
			"signedness",
			"uncertainty",
			"vertexData",
			"edgeData",
			"schema",
			"connectivity",
			"cycles",
			"degreeConstraint",
			"completeness",
			"partiteness",
			"density",
			"embedding",
			"rooting",
			"temporal",
			"layering",
			"edgeOrdering",
			"ports",
			"observability",
			"operationalSemantics",
			"measureSemantics",
			"scaleFree",
			"smallWorld",
			"communityStructure",
			"hamiltonian",
			"traceable",
			"perfect",
			"split",
			"cograph",
			"threshold",
			"line",
			"clawFree",
			"cubic",
			"specificRegular",
			"stronglyRegular",
			"selfComplementary",
			"vertexTransitive",
			"completeBipartite",
		];

		for (const key of expectedKeys) {
			expect(spec[key]).toBeDefined();
			expect(spec[key]).toHaveProperty("kind");
		}
	});

	it("produces readonly spec", () => {
		const spec = computeGraphSpecFromGraph(simpleTriangle);

		// TypeScript should enforce this at compile time,
		// but we can verify the object structure
		expect(typeof spec).toBe("object");
		expect(spec.vertexCardinality.kind).toBe("finite");
	});
});

// ============================================================================
// Integration tests with complex graphs
// ============================================================================

describe("computeGraphSpecFromGraph - complex graphs", () => {
	it("handles complete graph K4", () => {
		const k4: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["a", "c"], directed: false },
				{ id: "e3", endpoints: ["a", "d"], directed: false },
				{ id: "e4", endpoints: ["b", "c"], directed: false },
				{ id: "e5", endpoints: ["b", "d"], directed: false },
				{ id: "e6", endpoints: ["c", "d"], directed: false },
			],
		};

		const spec = computeGraphSpecFromGraph(k4);

		expect(spec.completeness).toEqual({ kind: "complete" });
		expect(spec.degreeConstraint).toEqual({ kind: "regular", degree: 3 });
		expect(spec.cubic).toEqual({ kind: "cubic" });
		expect(spec.perfect).toEqual({ kind: "perfect" });
	});

	it("handles bipartite graph K2,2", () => {
		const k22: AnalyzerGraph = {
			vertices: [{ id: "a1" }, { id: "a2" }, { id: "b1" }, { id: "b2" }],
			edges: [
				{ id: "e1", endpoints: ["a1", "b1"], directed: false },
				{ id: "e2", endpoints: ["a1", "b2"], directed: false },
				{ id: "e3", endpoints: ["a2", "b1"], directed: false },
				{ id: "e4", endpoints: ["a2", "b2"], directed: false },
			],
		};

		const spec = computeGraphSpecFromGraph(k22);

		expect(spec.partiteness).toEqual({ kind: "bipartite" });
		expect(spec.completeBipartite.kind).toBe("complete_bipartite");
	});

	it("handles temporal graph", () => {
		const temporal: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { time: 1 } },
				{ id: "b", attrs: { time: 2 } },
			],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { time: 3 } },
			],
		};

		const spec = computeGraphSpecFromGraph(temporal);

		expect(spec.temporal).toEqual({ kind: "time_ordered" });
	});

	it("handles multi-layer graph", () => {
		const multiLayer: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { layer: "L1" } },
				{ id: "b", attrs: { layer: "L2" } },
			],
			edges: [],
		};

		const spec = computeGraphSpecFromGraph(multiLayer);

		expect(spec.layering).toEqual({ kind: "multi_layer" });
	});

	it("handles probabilistic graph", () => {
		const probabilistic: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, probability: 0.8 },
			],
		};

		const spec = computeGraphSpecFromGraph(probabilistic);

		expect(spec.uncertainty).toEqual({ kind: "probabilistic" });
	});

	it("handles signed graph", () => {
		const signed: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, sign: 1 },
				{ id: "e2", endpoints: ["b", "c"], directed: false, sign: -1 },
			],
		};

		const spec = computeGraphSpecFromGraph(signed);

		expect(spec.signedness).toEqual({ kind: "signed" });
	});
});

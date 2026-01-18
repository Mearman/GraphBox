/**
 * Unit tests for advanced-props.ts
 */

import { describe, expect, it } from "vitest";

import {
	computeEdgeOrdering,
	computeEmbedding,
	computeLayering,
	computeMeasureSemantics,
	computeObservability,
	computeOperationalSemantics,
	computePorts,
	computeRooting,
	computeTemporal,
} from "./advanced-props";
import type { AnalyzerGraph } from "./types";
import { defaultComputePolicy } from "./types";

// ============================================================================
// Helper: Create basic graphs for testing
// ============================================================================

const emptyGraph: AnalyzerGraph = { vertices: [], edges: [] };

const _singleVertex: AnalyzerGraph = {
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

// ============================================================================
// computeEmbedding
// ============================================================================

describe("computeEmbedding", () => {
	const policy = defaultComputePolicy;

	it("returns abstract for empty graph", () => {
		const result = computeEmbedding(emptyGraph, policy);
		expect(result).toEqual({ kind: "abstract" });
	});

	it("returns abstract when vertices have no pos attribute", () => {
		const result = computeEmbedding(simpleTriangle, policy);
		expect(result).toEqual({ kind: "abstract" });
	});

	it("returns spatial_coordinates with dims 2 for 2D positions", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { pos: { x: 0, y: 0 } } },
				{ id: "b", attrs: { pos: { x: 1, y: 0 } } },
				{ id: "c", attrs: { pos: { x: 0.5, y: 1 } } },
			],
			edges: [],
		};
		const result = computeEmbedding(graph, policy);
		expect(result).toEqual({ kind: "spatial_coordinates", dims: 2 });
	});

	it("returns spatial_coordinates with dims 3 for 3D positions", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { pos: { x: 0, y: 0, z: 0 } } },
				{ id: "b", attrs: { pos: { x: 1, y: 0, z: 1 } } },
			],
			edges: [],
		};
		const result = computeEmbedding(graph, policy);
		expect(result).toEqual({ kind: "spatial_coordinates", dims: 3 });
	});

	it("returns abstract for mixed dimensions", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { pos: { x: 0, y: 0 } } },
				{ id: "b", attrs: { pos: { x: 1, y: 0, z: 1 } } },
			],
			edges: [],
		};
		const result = computeEmbedding(graph, policy);
		expect(result).toEqual({ kind: "abstract" });
	});

	it("returns abstract when some vertices lack pos", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { pos: { x: 0, y: 0 } } },
				{ id: "b" },
			],
			edges: [],
		};
		const result = computeEmbedding(graph, policy);
		expect(result).toEqual({ kind: "abstract" });
	});

	it("returns abstract for invalid pos format", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { pos: { x: "not a number", y: 0 } } },
			],
			edges: [],
		};
		const result = computeEmbedding(graph, policy);
		expect(result).toEqual({ kind: "abstract" });
	});
});

// ============================================================================
// computeRooting
// ============================================================================

describe("computeRooting", () => {
	const policy = defaultComputePolicy;

	it("returns unrooted for empty graph", () => {
		const result = computeRooting(emptyGraph, policy);
		expect(result).toEqual({ kind: "unrooted" });
	});

	it("returns unrooted when no vertices have root attribute", () => {
		const result = computeRooting(simpleTriangle, policy);
		expect(result).toEqual({ kind: "unrooted" });
	});

	it("returns rooted when exactly one vertex is root", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { root: true } },
				{ id: "b" },
				{ id: "c" },
			],
			edges: [],
		};
		const result = computeRooting(graph, policy);
		expect(result).toEqual({ kind: "rooted" });
	});

	it("returns multi_rooted when multiple vertices are roots", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { root: true } },
				{ id: "b", attrs: { root: true } },
				{ id: "c" },
			],
			edges: [],
		};
		const result = computeRooting(graph, policy);
		expect(result).toEqual({ kind: "multi_rooted" });
	});

	it("returns unrooted when root attribute is false", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { root: false } },
			],
			edges: [],
		};
		const result = computeRooting(graph, policy);
		expect(result).toEqual({ kind: "unrooted" });
	});
});

// ============================================================================
// computeTemporal
// ============================================================================

describe("computeTemporal", () => {
	const policy = defaultComputePolicy;

	it("returns static for empty graph", () => {
		const result = computeTemporal(emptyGraph, policy);
		expect(result).toEqual({ kind: "static" });
	});

	it("returns static when no temporal attributes exist", () => {
		const result = computeTemporal(simpleTriangle, policy);
		expect(result).toEqual({ kind: "static" });
	});

	it("returns temporal_vertices when vertices have time attribute", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { time: "2024-01-01" } },
				{ id: "b" },
			],
			edges: [],
		};
		const result = computeTemporal(graph, policy);
		expect(result).toEqual({ kind: "temporal_vertices" });
	});

	it("returns temporal_edges when edges have time attribute", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { time: "2024-01-01" } },
			],
		};
		const result = computeTemporal(graph, policy);
		expect(result).toEqual({ kind: "temporal_edges" });
	});

	it("returns time_ordered when both have numeric time values", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { time: 1 } },
				{ id: "b", attrs: { time: 2 } },
			],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { time: 3 } },
			],
		};
		const result = computeTemporal(graph, policy);
		expect(result).toEqual({ kind: "time_ordered" });
	});

	it("returns temporal_vertices when vertex time is not numeric but edge time is", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { time: "not numeric" } },
			],
			edges: [
				{ id: "e1", endpoints: ["a", "a"], directed: false, attrs: { time: 1 } },
			],
		};
		const result = computeTemporal(graph, policy);
		expect(result).toEqual({ kind: "temporal_vertices" });
	});
});

// ============================================================================
// computeLayering
// ============================================================================

describe("computeLayering", () => {
	const policy = defaultComputePolicy;

	it("returns single_layer for empty graph", () => {
		const result = computeLayering(emptyGraph, policy);
		expect(result).toEqual({ kind: "single_layer" });
	});

	it("returns single_layer when no layer attributes exist", () => {
		const result = computeLayering(simpleTriangle, policy);
		expect(result).toEqual({ kind: "single_layer" });
	});

	it("returns single_layer when all elements have same layer", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { layer: "L1" } },
				{ id: "b", attrs: { layer: "L1" } },
			],
			edges: [],
		};
		const result = computeLayering(graph, policy);
		expect(result).toEqual({ kind: "single_layer" });
	});

	it("returns multi_layer when vertices have different layers", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { layer: "L1" } },
				{ id: "b", attrs: { layer: "L2" } },
			],
			edges: [],
		};
		const result = computeLayering(graph, policy);
		expect(result).toEqual({ kind: "multi_layer" });
	});

	it("returns multi_layer when edges have different layers", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { layer: 1 } },
				{ id: "e2", endpoints: ["a", "b"], directed: false, attrs: { layer: 2 } },
			],
		};
		const result = computeLayering(graph, policy);
		expect(result).toEqual({ kind: "multi_layer" });
	});

	it("supports numeric layer values", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { layer: 1 } },
				{ id: "b", attrs: { layer: 2 } },
			],
			edges: [],
		};
		const result = computeLayering(graph, policy);
		expect(result).toEqual({ kind: "multi_layer" });
	});
});

// ============================================================================
// computeEdgeOrdering
// ============================================================================

describe("computeEdgeOrdering", () => {
	const policy = defaultComputePolicy;

	it("returns ordered for empty graph", () => {
		const result = computeEdgeOrdering(emptyGraph, policy);
		expect(result).toEqual({ kind: "ordered" });
	});

	it("returns unordered when edges have no order attribute", () => {
		const result = computeEdgeOrdering(simpleTriangle, policy);
		expect(result).toEqual({ kind: "unordered" });
	});

	it("returns ordered when all edges have numeric order", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { order: 1 } },
				{ id: "e2", endpoints: ["b", "c"], directed: false, attrs: { order: 2 } },
			],
		};
		const result = computeEdgeOrdering(graph, policy);
		expect(result).toEqual({ kind: "ordered" });
	});

	it("returns unordered when some edges lack order", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { order: 1 } },
				{ id: "e2", endpoints: ["b", "c"], directed: false },
			],
		};
		const result = computeEdgeOrdering(graph, policy);
		expect(result).toEqual({ kind: "unordered" });
	});

	it("returns unordered when order is not numeric", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { order: "first" } },
			],
		};
		const result = computeEdgeOrdering(graph, policy);
		expect(result).toEqual({ kind: "unordered" });
	});
});

// ============================================================================
// computePorts
// ============================================================================

describe("computePorts", () => {
	const policy = defaultComputePolicy;

	it("returns none for empty graph", () => {
		const result = computePorts(emptyGraph, policy);
		expect(result).toEqual({ kind: "none" });
	});

	it("returns none when no vertices have port attribute", () => {
		const result = computePorts(simpleTriangle, policy);
		expect(result).toEqual({ kind: "none" });
	});

	it("returns port_labelled_vertices when any vertex has ports", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { ports: ["in", "out"] } },
				{ id: "b" },
			],
			edges: [],
		};
		const result = computePorts(graph, policy);
		expect(result).toEqual({ kind: "port_labelled_vertices" });
	});
});

// ============================================================================
// computeObservability
// ============================================================================

describe("computeObservability", () => {
	it("returns fully_specified for empty graph", () => {
		const result = computeObservability(emptyGraph);
		expect(result).toEqual({ kind: "fully_specified" });
	});

	it("returns fully_specified when no latent/observed attributes", () => {
		const result = computeObservability(simpleTriangle);
		expect(result).toEqual({ kind: "fully_specified" });
	});

	it("returns latent_or_inferred when vertex has latent=true", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { latent: true } },
				{ id: "b" },
			],
			edges: [],
		};
		const result = computeObservability(graph);
		expect(result).toEqual({ kind: "latent_or_inferred" });
	});

	it("returns latent_or_inferred when edge has latent=true", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { latent: true } },
			],
		};
		const result = computeObservability(graph);
		expect(result).toEqual({ kind: "latent_or_inferred" });
	});

	it("returns partially_observed when vertex has observed=false", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { observed: false } },
				{ id: "b" },
			],
			edges: [],
		};
		const result = computeObservability(graph);
		expect(result).toEqual({ kind: "partially_observed" });
	});

	it("returns partially_observed when edge has observed=false", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { observed: false } },
			],
		};
		const result = computeObservability(graph);
		expect(result).toEqual({ kind: "partially_observed" });
	});

	it("latent takes precedence over partially_observed", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { latent: true } },
				{ id: "b", attrs: { observed: false } },
			],
			edges: [],
		};
		const result = computeObservability(graph);
		expect(result).toEqual({ kind: "latent_or_inferred" });
	});
});

// ============================================================================
// computeOperationalSemantics
// ============================================================================

describe("computeOperationalSemantics", () => {
	it("returns structural_only for empty graph", () => {
		const result = computeOperationalSemantics(emptyGraph);
		expect(result).toEqual({ kind: "structural_only" });
	});

	it("returns structural_only when no exec/fn attributes", () => {
		const result = computeOperationalSemantics(simpleTriangle);
		expect(result).toEqual({ kind: "structural_only" });
	});

	it("returns executable when vertex has exec=true", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { exec: true } },
			],
			edges: [],
		};
		const result = computeOperationalSemantics(graph);
		expect(result).toEqual({ kind: "executable" });
	});

	it("returns executable when edge has exec=true", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { exec: true } },
			],
		};
		const result = computeOperationalSemantics(graph);
		expect(result).toEqual({ kind: "executable" });
	});

	it("returns annotated_with_functions when vertex has fn string", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { fn: "someFunction" } },
			],
			edges: [],
		};
		const result = computeOperationalSemantics(graph);
		expect(result).toEqual({ kind: "annotated_with_functions" });
	});

	it("returns annotated_with_functions when edge has fn string", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { fn: "transform" } },
			],
		};
		const result = computeOperationalSemantics(graph);
		expect(result).toEqual({ kind: "annotated_with_functions" });
	});

	it("exec takes precedence over fn", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { exec: true, fn: "someFunction" } },
			],
			edges: [],
		};
		const result = computeOperationalSemantics(graph);
		expect(result).toEqual({ kind: "executable" });
	});
});

// ============================================================================
// computeMeasureSemantics
// ============================================================================

describe("computeMeasureSemantics", () => {
	it("returns none for empty graph", () => {
		const result = computeMeasureSemantics(emptyGraph);
		expect(result).toEqual({ kind: "none" });
	});

	it("returns none when no measure attributes", () => {
		const result = computeMeasureSemantics(simpleTriangle);
		expect(result).toEqual({ kind: "none" });
	});

	it("returns cost when edge has cost attribute", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { cost: 10 } },
			],
		};
		const result = computeMeasureSemantics(graph);
		expect(result).toEqual({ kind: "cost" });
	});

	it("returns cost when vertex has cost attribute", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { cost: 5 } },
			],
			edges: [],
		};
		const result = computeMeasureSemantics(graph);
		expect(result).toEqual({ kind: "cost" });
	});

	it("returns utility when edge has utility attribute", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { utility: 0.8 } },
			],
		};
		const result = computeMeasureSemantics(graph);
		expect(result).toEqual({ kind: "utility" });
	});

	it("returns metric when edge has weight", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, weight: 5 },
			],
		};
		const result = computeMeasureSemantics(graph);
		expect(result).toEqual({ kind: "metric" });
	});

	it("returns metric when edge has weightVector", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { weightVector: [1, 2, 3] } },
			],
		};
		const result = computeMeasureSemantics(graph);
		expect(result).toEqual({ kind: "metric" });
	});

	it("cost takes precedence over utility and metric", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, weight: 5, attrs: { cost: 10, utility: 0.5 } },
			],
		};
		const result = computeMeasureSemantics(graph);
		expect(result).toEqual({ kind: "cost" });
	});

	it("utility takes precedence over metric", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, weight: 5, attrs: { utility: 0.5 } },
			],
		};
		const result = computeMeasureSemantics(graph);
		expect(result).toEqual({ kind: "utility" });
	});
});

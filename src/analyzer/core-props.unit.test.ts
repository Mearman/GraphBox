/**
 * Unit tests for core-props.ts
 */

import { describe, expect, it } from "vitest";

import {
	computeDirectionality,
	computeEdgeArity,
	computeEdgeData,
	computeEdgeMultiplicity,
	computeSchemaHomogeneity,
	computeSelfLoops,
	computeSignedness,
	computeUncertainty,
	computeVertexCardinality,
	computeVertexData,
	computeVertexIdentity,
	computeVertexOrdering,
	computeWeighting,
} from "./core-props";
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

const threeVertices: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [],
};

const simpleUndirected: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
	],
};

const simpleDirected: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: true },
	],
};

const mixedGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: true },
	],
};

const bidirectedGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: true },
		{ id: "e2", endpoints: ["b", "a"], directed: true },
	],
};

const selfLoopGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }],
	edges: [
		{ id: "e1", endpoints: ["a", "a"], directed: false },
		{ id: "e2", endpoints: ["a", "b"], directed: false },
	],
};

const multiEdgeGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["a", "b"], directed: false },
	],
};

const hyperEdgeGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b", "c"], directed: false },
	],
};

// ============================================================================
// computeVertexCardinality
// ============================================================================

describe("computeVertexCardinality", () => {
	it("returns n=0 for empty graph", () => {
		const result = computeVertexCardinality(emptyGraph);
		expect(result).toEqual({ kind: "finite", n: 0 });
	});

	it("returns n=1 for single vertex", () => {
		const result = computeVertexCardinality(singleVertex);
		expect(result).toEqual({ kind: "finite", n: 1 });
	});

	it("returns n=3 for three vertices", () => {
		const result = computeVertexCardinality(threeVertices);
		expect(result).toEqual({ kind: "finite", n: 3 });
	});
});

// ============================================================================
// computeVertexIdentity
// ============================================================================

describe("computeVertexIdentity", () => {
	it("returns distinguishable for empty graph", () => {
		const result = computeVertexIdentity(emptyGraph);
		expect(result).toEqual({ kind: "distinguishable" });
	});

	it("returns distinguishable when all IDs are unique", () => {
		const result = computeVertexIdentity(threeVertices);
		expect(result).toEqual({ kind: "distinguishable" });
	});

	it("returns indistinguishable when IDs are duplicated", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "a" }],
			edges: [],
		};
		const result = computeVertexIdentity(graph);
		expect(result).toEqual({ kind: "indistinguishable" });
	});
});

// ============================================================================
// computeVertexOrdering
// ============================================================================

describe("computeVertexOrdering", () => {
	const policy = defaultComputePolicy;

	it("returns unordered when no order attribute", () => {
		const result = computeVertexOrdering(threeVertices, policy);
		expect(result).toEqual({ kind: "unordered" });
	});

	it("returns total_order when all vertices have unique orders", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { order: 1 } },
				{ id: "b", attrs: { order: 2 } },
				{ id: "c", attrs: { order: 3 } },
			],
			edges: [],
		};
		const result = computeVertexOrdering(graph, policy);
		expect(result).toEqual({ kind: "total_order" });
	});

	it("returns partial_order when some vertices share order", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { order: 1 } },
				{ id: "b", attrs: { order: 1 } },
				{ id: "c", attrs: { order: 2 } },
			],
			edges: [],
		};
		const result = computeVertexOrdering(graph, policy);
		expect(result).toEqual({ kind: "partial_order" });
	});

	it("returns unordered when order is not numeric", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { order: "first" } },
			],
			edges: [],
		};
		const result = computeVertexOrdering(graph, policy);
		expect(result).toEqual({ kind: "unordered" });
	});
});

// ============================================================================
// computeEdgeArity
// ============================================================================

describe("computeEdgeArity", () => {
	it("returns binary for empty graph", () => {
		const result = computeEdgeArity(emptyGraph);
		expect(result).toEqual({ kind: "binary" });
	});

	it("returns binary for standard edges", () => {
		const result = computeEdgeArity(simpleUndirected);
		expect(result).toEqual({ kind: "binary" });
	});

	it("returns k_ary with k=3 for hyperedge", () => {
		const result = computeEdgeArity(hyperEdgeGraph);
		expect(result).toEqual({ kind: "k_ary", k: 3 });
	});

	it("throws for mixed arity edges", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["a", "b", "c"], directed: false },
			],
		};
		expect(() => computeEdgeArity(graph)).toThrow("Mixed edge arity");
	});
});

// ============================================================================
// computeEdgeMultiplicity
// ============================================================================

describe("computeEdgeMultiplicity", () => {
	it("returns simple for empty graph", () => {
		const result = computeEdgeMultiplicity(emptyGraph);
		expect(result).toEqual({ kind: "simple" });
	});

	it("returns simple for simple graph", () => {
		const result = computeEdgeMultiplicity(simpleUndirected);
		expect(result).toEqual({ kind: "simple" });
	});

	it("returns multi for multi-edge graph", () => {
		const result = computeEdgeMultiplicity(multiEdgeGraph);
		expect(result).toEqual({ kind: "multi" });
	});

	it("returns simple for directed edges in opposite directions", () => {
		const result = computeEdgeMultiplicity(bidirectedGraph);
		expect(result).toEqual({ kind: "simple" });
	});

	it("returns multi for duplicate directed edges", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: true },
				{ id: "e2", endpoints: ["a", "b"], directed: true },
			],
		};
		const result = computeEdgeMultiplicity(graph);
		expect(result).toEqual({ kind: "multi" });
	});
});

// ============================================================================
// computeSelfLoops
// ============================================================================

describe("computeSelfLoops", () => {
	it("returns disallowed for empty graph", () => {
		const result = computeSelfLoops(emptyGraph);
		expect(result).toEqual({ kind: "disallowed" });
	});

	it("returns disallowed when no self-loops", () => {
		const result = computeSelfLoops(simpleUndirected);
		expect(result).toEqual({ kind: "disallowed" });
	});

	it("returns allowed when self-loop exists", () => {
		const result = computeSelfLoops(selfLoopGraph);
		expect(result).toEqual({ kind: "allowed" });
	});
});

// ============================================================================
// computeDirectionality
// ============================================================================

describe("computeDirectionality", () => {
	it("returns undirected for empty graph", () => {
		const result = computeDirectionality(emptyGraph);
		expect(result).toEqual({ kind: "undirected" });
	});

	it("returns undirected for undirected edges only", () => {
		const result = computeDirectionality(simpleUndirected);
		expect(result).toEqual({ kind: "undirected" });
	});

	it("returns directed for directed edges only", () => {
		const result = computeDirectionality(simpleDirected);
		expect(result).toEqual({ kind: "directed" });
	});

	it("returns mixed for mixed edges", () => {
		const result = computeDirectionality(mixedGraph);
		expect(result).toEqual({ kind: "mixed" });
	});

	it("returns bidirected when all edges have opposite counterparts", () => {
		const result = computeDirectionality(bidirectedGraph);
		expect(result).toEqual({ kind: "bidirected" });
	});
});

// ============================================================================
// computeWeighting
// ============================================================================

describe("computeWeighting", () => {
	const policy = defaultComputePolicy;

	it("returns unweighted for empty graph", () => {
		const result = computeWeighting(emptyGraph, policy);
		expect(result).toEqual({ kind: "unweighted" });
	});

	it("returns unweighted when edges have no weights", () => {
		const result = computeWeighting(simpleUndirected, policy);
		expect(result).toEqual({ kind: "unweighted" });
	});

	it("returns weighted_numeric when all edges have numeric weights", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, weight: 5 },
			],
		};
		const result = computeWeighting(graph, policy);
		expect(result).toEqual({ kind: "weighted_numeric" });
	});

	it("returns unweighted when some edges lack weights", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, weight: 5 },
				{ id: "e2", endpoints: ["b", "c"], directed: false },
			],
		};
		const result = computeWeighting(graph, policy);
		expect(result).toEqual({ kind: "unweighted" });
	});
});

// ============================================================================
// computeSignedness
// ============================================================================

describe("computeSignedness", () => {
	it("returns unsigned for empty graph", () => {
		const result = computeSignedness(emptyGraph);
		expect(result).toEqual({ kind: "unsigned" });
	});

	it("returns unsigned when no edges have sign", () => {
		const result = computeSignedness(simpleUndirected);
		expect(result).toEqual({ kind: "unsigned" });
	});

	it("returns signed when edge has positive sign", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, sign: 1 },
			],
		};
		const result = computeSignedness(graph);
		expect(result).toEqual({ kind: "signed" });
	});

	it("returns signed when edge has negative sign", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, sign: -1 },
			],
		};
		const result = computeSignedness(graph);
		expect(result).toEqual({ kind: "signed" });
	});
});

// ============================================================================
// computeUncertainty
// ============================================================================

describe("computeUncertainty", () => {
	const policy = defaultComputePolicy;

	it("returns deterministic for empty graph", () => {
		const result = computeUncertainty(emptyGraph, policy);
		expect(result).toEqual({ kind: "deterministic" });
	});

	it("returns deterministic when no probability attributes", () => {
		const result = computeUncertainty(simpleUndirected, policy);
		expect(result).toEqual({ kind: "deterministic" });
	});

	it("returns probabilistic when edge has probability field", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, probability: 0.5 },
			],
		};
		const result = computeUncertainty(graph, policy);
		expect(result).toEqual({ kind: "probabilistic" });
	});

	it("returns probabilistic when edge has probability in attrs", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { probability: 0.8 } },
			],
		};
		const result = computeUncertainty(graph, policy);
		expect(result).toEqual({ kind: "probabilistic" });
	});
});

// ============================================================================
// computeVertexData
// ============================================================================

describe("computeVertexData", () => {
	it("returns unlabelled for empty graph", () => {
		const result = computeVertexData(emptyGraph);
		expect(result).toEqual({ kind: "unlabelled" });
	});

	it("returns unlabelled when vertices have no labels or attrs", () => {
		const result = computeVertexData(threeVertices);
		expect(result).toEqual({ kind: "unlabelled" });
	});

	it("returns labelled when vertex has label", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", label: "Node A" },
			],
			edges: [],
		};
		const result = computeVertexData(graph);
		expect(result).toEqual({ kind: "labelled" });
	});

	it("returns attributed when vertex has attrs", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { color: "red" } },
			],
			edges: [],
		};
		const result = computeVertexData(graph);
		expect(result).toEqual({ kind: "attributed" });
	});

	it("attributed takes precedence over labelled", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", label: "Node A", attrs: { color: "red" } },
			],
			edges: [],
		};
		const result = computeVertexData(graph);
		expect(result).toEqual({ kind: "attributed" });
	});
});

// ============================================================================
// computeEdgeData
// ============================================================================

describe("computeEdgeData", () => {
	it("returns unlabelled for empty graph", () => {
		const result = computeEdgeData(emptyGraph);
		expect(result).toEqual({ kind: "unlabelled" });
	});

	it("returns unlabelled when edges have no labels or attrs", () => {
		const result = computeEdgeData(simpleUndirected);
		expect(result).toEqual({ kind: "unlabelled" });
	});

	it("returns labelled when edge has label", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, label: "connects" },
			],
		};
		const result = computeEdgeData(graph);
		expect(result).toEqual({ kind: "labelled" });
	});

	it("returns attributed when edge has attrs", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { type: "friendship" } },
			],
		};
		const result = computeEdgeData(graph);
		expect(result).toEqual({ kind: "attributed" });
	});
});

// ============================================================================
// computeSchemaHomogeneity
// ============================================================================

describe("computeSchemaHomogeneity", () => {
	it("returns homogeneous for empty graph", () => {
		const result = computeSchemaHomogeneity(emptyGraph);
		expect(result).toEqual({ kind: "homogeneous" });
	});

	it("returns homogeneous when all vertices have same attr keys", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { color: "red", size: 1 } },
				{ id: "b", attrs: { color: "blue", size: 2 } },
			],
			edges: [],
		};
		const result = computeSchemaHomogeneity(graph);
		expect(result).toEqual({ kind: "homogeneous" });
	});

	it("returns heterogeneous when vertices have different attr keys", () => {
		const graph: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { color: "red" } },
				{ id: "b", attrs: { size: 2 } },
			],
			edges: [],
		};
		const result = computeSchemaHomogeneity(graph);
		expect(result).toEqual({ kind: "heterogeneous" });
	});

	it("returns heterogeneous when edges have different attr keys", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { weight: 1 } },
				{ id: "e2", endpoints: ["b", "c"], directed: false, attrs: { label: "x" } },
			],
		};
		const result = computeSchemaHomogeneity(graph);
		expect(result).toEqual({ kind: "heterogeneous" });
	});

	it("returns homogeneous when all edges have same attr keys", () => {
		const graph: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false, attrs: { weight: 1 } },
				{ id: "e2", endpoints: ["b", "c"], directed: false, attrs: { weight: 2 } },
			],
		};
		const result = computeSchemaHomogeneity(graph);
		expect(result).toEqual({ kind: "homogeneous" });
	});
});

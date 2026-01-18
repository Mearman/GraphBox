/**
 * Unit tests for structure.ts
 */

import { describe, expect, it } from "vitest";

import {
	computeCompleteness,
	computeDensity,
	computePartiteness,
} from "./structure";
import type { AnalyzerGraph } from "./types";

// ============================================================================
// Helper graphs
// ============================================================================

const emptyGraph: AnalyzerGraph = { vertices: [], edges: [] };

const singleVertex: AnalyzerGraph = {
	vertices: [{ id: "a" }],
	edges: [],
};

const twoVerticesNoEdge: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }],
	edges: [],
};

const simpleEdge: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
	],
};

const simpleTriangle: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: false },
		{ id: "e3", endpoints: ["c", "a"], directed: false },
	],
};

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

const path3: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: false },
	],
};

const k22: AnalyzerGraph = {
	vertices: [{ id: "a1" }, { id: "a2" }, { id: "b1" }, { id: "b2" }],
	edges: [
		{ id: "e1", endpoints: ["a1", "b1"], directed: false },
		{ id: "e2", endpoints: ["a1", "b2"], directed: false },
		{ id: "e3", endpoints: ["a2", "b1"], directed: false },
		{ id: "e4", endpoints: ["a2", "b2"], directed: false },
	],
};

const cycle4: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: false },
		{ id: "e3", endpoints: ["c", "d"], directed: false },
		{ id: "e4", endpoints: ["d", "a"], directed: false },
	],
};

const directedComplete: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: true },
		{ id: "e2", endpoints: ["b", "a"], directed: true },
		{ id: "e3", endpoints: ["a", "c"], directed: true },
		{ id: "e4", endpoints: ["c", "a"], directed: true },
		{ id: "e5", endpoints: ["b", "c"], directed: true },
		{ id: "e6", endpoints: ["c", "b"], directed: true },
	],
};

const mixedGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: true },
	],
};

const hyperEdgeGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b", "c"], directed: false },
	],
};

const sparseGraph: AnalyzerGraph = {
	vertices: Array.from({ length: 20 }, (_, index) => ({ id: `v${index}` })),
	edges: [
		{ id: "e1", endpoints: ["v0", "v1"], directed: false },
		{ id: "e2", endpoints: ["v2", "v3"], directed: false },
	],
};

// ============================================================================
// computeCompleteness
// ============================================================================

describe("computeCompleteness", () => {
	it("returns complete for empty graph", () => {
		const result = computeCompleteness(emptyGraph);
		expect(result).toEqual({ kind: "complete" });
	});

	it("returns complete for single vertex (vacuously true)", () => {
		const result = computeCompleteness(singleVertex);
		expect(result).toEqual({ kind: "complete" });
	});

	it("returns incomplete for two vertices with no edge", () => {
		const result = computeCompleteness(twoVerticesNoEdge);
		expect(result).toEqual({ kind: "incomplete" });
	});

	it("returns complete for two vertices with edge (K2)", () => {
		const result = computeCompleteness(simpleEdge);
		expect(result).toEqual({ kind: "complete" });
	});

	it("returns complete for triangle (K3)", () => {
		const result = computeCompleteness(simpleTriangle);
		expect(result).toEqual({ kind: "complete" });
	});

	it("returns complete for K4", () => {
		const result = computeCompleteness(k4);
		expect(result).toEqual({ kind: "complete" });
	});

	it("returns incomplete for path (missing edges)", () => {
		const result = computeCompleteness(path3);
		expect(result).toEqual({ kind: "incomplete" });
	});

	it("returns incomplete for cycle C4 (missing diagonal)", () => {
		const result = computeCompleteness(cycle4);
		expect(result).toEqual({ kind: "incomplete" });
	});

	it("returns complete for directed complete graph (bidirected)", () => {
		const result = computeCompleteness(directedComplete);
		expect(result).toEqual({ kind: "complete" });
	});

	it("returns incomplete for mixed graphs", () => {
		const result = computeCompleteness(mixedGraph);
		expect(result).toEqual({ kind: "incomplete" });
	});

	it("returns incomplete for hypergraphs", () => {
		const result = computeCompleteness(hyperEdgeGraph);
		expect(result).toEqual({ kind: "incomplete" });
	});
});

// ============================================================================
// computePartiteness
// ============================================================================

describe("computePartiteness", () => {
	it("returns bipartite for empty graph", () => {
		const result = computePartiteness(emptyGraph);
		expect(result).toEqual({ kind: "bipartite" });
	});

	it("returns bipartite for single vertex", () => {
		const result = computePartiteness(singleVertex);
		expect(result).toEqual({ kind: "bipartite" });
	});

	it("returns bipartite for simple edge", () => {
		const result = computePartiteness(simpleEdge);
		expect(result).toEqual({ kind: "bipartite" });
	});

	it("returns unrestricted for triangle (odd cycle)", () => {
		const result = computePartiteness(simpleTriangle);
		expect(result).toEqual({ kind: "unrestricted" });
	});

	it("returns bipartite for K2,2", () => {
		const result = computePartiteness(k22);
		expect(result).toEqual({ kind: "bipartite" });
	});

	it("returns bipartite for C4 (even cycle)", () => {
		const result = computePartiteness(cycle4);
		expect(result).toEqual({ kind: "bipartite" });
	});

	it("returns bipartite for path", () => {
		const result = computePartiteness(path3);
		expect(result).toEqual({ kind: "bipartite" });
	});

	it("returns unrestricted for K4 (contains triangles)", () => {
		const result = computePartiteness(k4);
		expect(result).toEqual({ kind: "unrestricted" });
	});

	it("returns unrestricted for directed graphs", () => {
		const directedPath: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: true },
				{ id: "e2", endpoints: ["b", "c"], directed: true },
			],
		};
		const result = computePartiteness(directedPath);
		expect(result).toEqual({ kind: "unrestricted" });
	});

	it("returns unrestricted for mixed graphs", () => {
		const result = computePartiteness(mixedGraph);
		expect(result).toEqual({ kind: "unrestricted" });
	});

	it("returns unrestricted for hypergraphs", () => {
		const result = computePartiteness(hyperEdgeGraph);
		expect(result).toEqual({ kind: "unrestricted" });
	});
});

// ============================================================================
// computeDensity
// ============================================================================

describe("computeDensity", () => {
	it("returns dense for empty graph", () => {
		const result = computeDensity(emptyGraph);
		expect(result).toEqual({ kind: "dense" });
	});

	it("returns dense for single vertex", () => {
		const result = computeDensity(singleVertex);
		expect(result).toEqual({ kind: "dense" });
	});

	it("returns dense for complete graph K4", () => {
		// K4: 6 edges, max = 6, density = 100%
		const result = computeDensity(k4);
		expect(result).toEqual({ kind: "dense" });
	});

	it("returns dense for triangle", () => {
		// K3: 3 edges, max = 3, density = 100%
		const result = computeDensity(simpleTriangle);
		expect(result).toEqual({ kind: "dense" });
	});

	it("returns sparse for very sparse graph", () => {
		// 20 vertices, 2 edges, max = 190, density = 1.05%
		const result = computeDensity(sparseGraph);
		expect(result).toEqual({ kind: "sparse" });
	});

	it("returns unconstrained for medium density", () => {
		// C4: 4 edges, max = 6, density = 66.7%
		const result = computeDensity(cycle4);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for path", () => {
		// Path3: 2 edges, max = 3, density = 66.7%
		const result = computeDensity(path3);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeDensity(directedComplete);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for mixed graphs", () => {
		const result = computeDensity(mixedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for hypergraphs", () => {
		const result = computeDensity(hyperEdgeGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});
});

// ============================================================================
// Edge cases and integration
// ============================================================================

describe("structure edge cases", () => {
	it("handles graph with self-loops for completeness", () => {
		const withSelfLoop: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["a", "a"], directed: false },
			],
		};
		const result = computeCompleteness(withSelfLoop);
		// Self-loops make the graph incomplete (not a simple complete graph)
		expect(result).toEqual({ kind: "incomplete" });
	});

	it("handles two vertices connected by single edge for density", () => {
		// 2 vertices, 1 edge, max = 1, density = 100%
		const result = computeDensity(simpleEdge);
		expect(result).toEqual({ kind: "dense" });
	});

	it("handles disconnected bipartite components", () => {
		const disconnectedBipartite: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["c", "d"], directed: false },
			],
		};
		const result = computePartiteness(disconnectedBipartite);
		expect(result).toEqual({ kind: "bipartite" });
	});

	it("handles K1 (single vertex) for all properties", () => {
		expect(computeCompleteness(singleVertex)).toEqual({ kind: "complete" });
		expect(computePartiteness(singleVertex)).toEqual({ kind: "bipartite" });
		expect(computeDensity(singleVertex)).toEqual({ kind: "dense" });
	});

	it("handles K2 (single edge) for all properties", () => {
		expect(computeCompleteness(simpleEdge)).toEqual({ kind: "complete" });
		expect(computePartiteness(simpleEdge)).toEqual({ kind: "bipartite" });
		expect(computeDensity(simpleEdge)).toEqual({ kind: "dense" });
	});

	it("verifies density thresholds", () => {
		// Create graph with exactly 10% density
		// For 10 vertices, max edges = 45. 10% = 4.5, so use 4 or 5 edges
		const tenPercent: AnalyzerGraph = {
			vertices: Array.from({ length: 10 }, (_, index) => ({ id: `v${index}` })),
			edges: [
				{ id: "e1", endpoints: ["v0", "v1"], directed: false },
				{ id: "e2", endpoints: ["v2", "v3"], directed: false },
				{ id: "e3", endpoints: ["v4", "v5"], directed: false },
				{ id: "e4", endpoints: ["v6", "v7"], directed: false },
			],
		};
		// 4 edges / 45 max = 8.9% < 10% -> sparse
		const result = computeDensity(tenPercent);
		expect(result).toEqual({ kind: "sparse" });
	});

	it("verifies high density threshold", () => {
		// Near-complete graph missing one edge
		const nearComplete: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			edges: [
				// K4 has 6 edges, remove one
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["a", "c"], directed: false },
				{ id: "e3", endpoints: ["a", "d"], directed: false },
				{ id: "e4", endpoints: ["b", "c"], directed: false },
				{ id: "e5", endpoints: ["b", "d"], directed: false },
				// missing c-d
			],
		};
		// 5 edges / 6 max = 83.3% < 90% -> unconstrained
		const result = computeDensity(nearComplete);
		expect(result).toEqual({ kind: "unconstrained" });
	});
});

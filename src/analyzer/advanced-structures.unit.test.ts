/**
 * Unit tests for advanced-structures.ts
 */

import { describe, expect, it } from "vitest";

import {
	computeAutoRegular,
	computeClawFree,
	computeCograph,
	computeCompleteBipartite,
	computeCubic,
	computeLine,
	computePerfect,
	computeSelfComplementary,
	computeSpecificRegular,
	computeSplit,
	computeStronglyRegular,
	computeThreshold,
	computeVertexTransitive,
} from "./advanced-structures";
import type { AnalyzerGraph } from "./types";

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

const path4: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: false },
		{ id: "e3", endpoints: ["c", "d"], directed: false },
	],
};

const star4: AnalyzerGraph = {
	vertices: [{ id: "center" }, { id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["center", "a"], directed: false },
		{ id: "e2", endpoints: ["center", "b"], directed: false },
		{ id: "e3", endpoints: ["center", "c"], directed: false },
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

const cycle4: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: false },
		{ id: "e3", endpoints: ["c", "d"], directed: false },
		{ id: "e4", endpoints: ["d", "a"], directed: false },
	],
};

const directedGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: true },
	],
};

// Complete bipartite K2,2
const k22: AnalyzerGraph = {
	vertices: [{ id: "a1" }, { id: "a2" }, { id: "b1" }, { id: "b2" }],
	edges: [
		{ id: "e1", endpoints: ["a1", "b1"], directed: false },
		{ id: "e2", endpoints: ["a1", "b2"], directed: false },
		{ id: "e3", endpoints: ["a2", "b1"], directed: false },
		{ id: "e4", endpoints: ["a2", "b2"], directed: false },
	],
};

// ============================================================================
// computePerfect
// ============================================================================

describe("computePerfect", () => {
	it("returns perfect for empty graph", () => {
		const result = computePerfect(emptyGraph);
		expect(result.kind).toBe("perfect");
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computePerfect(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns perfect for chordal graph (triangle)", () => {
		const result = computePerfect(simpleTriangle);
		expect(result).toEqual({ kind: "perfect" });
	});

	it("returns perfect for complete graph K4", () => {
		const result = computePerfect(k4);
		expect(result).toEqual({ kind: "perfect" });
	});

	it("returns perfect for C4 (bipartite graphs are perfect)", () => {
		const result = computePerfect(cycle4);
		expect(result).toEqual({ kind: "perfect" });
	});
});

// ============================================================================
// computeSplit
// ============================================================================

describe("computeSplit", () => {
	it("returns split for empty graph", () => {
		const result = computeSplit(emptyGraph);
		expect(result.kind).toBe("split");
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeSplit(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns split for complete graph (trivially split)", () => {
		const result = computeSplit(k4);
		expect(result).toEqual({ kind: "split" });
	});

	it("returns non_split for C4", () => {
		const result = computeSplit(cycle4);
		expect(result).toEqual({ kind: "non_split" });
	});
});

// ============================================================================
// computeCograph
// ============================================================================

describe("computeCograph", () => {
	it("returns cograph for empty graph", () => {
		const result = computeCograph(emptyGraph);
		expect(result.kind).toBe("cograph");
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeCograph(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns cograph for single vertex", () => {
		const result = computeCograph(singleVertex);
		expect(result).toEqual({ kind: "cograph" });
	});

	it("returns cograph for triangle (P4-free)", () => {
		const result = computeCograph(simpleTriangle);
		expect(result).toEqual({ kind: "cograph" });
	});

	it("returns cograph for K4 (P4-free)", () => {
		const result = computeCograph(k4);
		expect(result).toEqual({ kind: "cograph" });
	});

	it("returns non_cograph for P4 (contains induced P4)", () => {
		const result = computeCograph(path4);
		expect(result).toEqual({ kind: "non_cograph" });
	});
});

// ============================================================================
// computeThreshold
// ============================================================================

describe("computeThreshold", () => {
	it("returns threshold for empty graph", () => {
		const result = computeThreshold(emptyGraph);
		expect(result.kind).toBe("threshold");
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeThreshold(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns threshold for K4 (both split and cograph)", () => {
		const result = computeThreshold(k4);
		expect(result).toEqual({ kind: "threshold" });
	});

	it("returns non_threshold for P4", () => {
		const result = computeThreshold(path4);
		expect(result).toEqual({ kind: "non_threshold" });
	});
});

// ============================================================================
// computeLine
// ============================================================================

describe("computeLine", () => {
	it("returns line_graph for empty graph", () => {
		const result = computeLine(emptyGraph);
		expect(result.kind).toBe("line_graph");
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeLine(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns line_graph for triangle", () => {
		const result = computeLine(simpleTriangle);
		expect(result).toEqual({ kind: "line_graph" });
	});

	it("returns line_graph for K4", () => {
		const result = computeLine(k4);
		expect(result).toEqual({ kind: "line_graph" });
	});
});

// ============================================================================
// computeClawFree
// ============================================================================

describe("computeClawFree", () => {
	it("returns claw_free for empty graph", () => {
		const result = computeClawFree(emptyGraph);
		expect(result.kind).toBe("claw_free");
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeClawFree(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns claw_free for triangle", () => {
		const result = computeClawFree(simpleTriangle);
		expect(result).toEqual({ kind: "claw_free" });
	});

	it("returns claw_free for K4", () => {
		const result = computeClawFree(k4);
		expect(result).toEqual({ kind: "claw_free" });
	});

	it("returns has_claw for star with 3 leaves (K1,3)", () => {
		const result = computeClawFree(star4);
		expect(result).toEqual({ kind: "has_claw" });
	});
});

// ============================================================================
// computeCubic
// ============================================================================

describe("computeCubic", () => {
	it("returns non_cubic for empty graph", () => {
		const result = computeCubic(emptyGraph);
		expect(result.kind).toBe("non_cubic");
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeCubic(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns cubic for K4 (all vertices have degree 3)", () => {
		const result = computeCubic(k4);
		expect(result).toEqual({ kind: "cubic" });
	});

	it("returns non_cubic for triangle (degree 2)", () => {
		const result = computeCubic(simpleTriangle);
		expect(result).toEqual({ kind: "non_cubic" });
	});
});

// ============================================================================
// computeSpecificRegular
// ============================================================================

describe("computeSpecificRegular", () => {
	it("returns not_k_regular for empty graph", () => {
		const result = computeSpecificRegular(emptyGraph, 2);
		expect(result.kind).toBe("not_k_regular");
	});

	it("returns k_regular for triangle with k=2", () => {
		const result = computeSpecificRegular(simpleTriangle, 2);
		expect(result).toEqual({ kind: "k_regular", k: 2 });
	});

	it("returns not_k_regular for triangle with k=3", () => {
		const result = computeSpecificRegular(simpleTriangle, 3);
		expect(result).toEqual({ kind: "not_k_regular" });
	});

	it("returns k_regular for K4 with k=3", () => {
		const result = computeSpecificRegular(k4, 3);
		expect(result).toEqual({ kind: "k_regular", k: 3 });
	});

	it("returns not_k_regular for star (not regular)", () => {
		const result = computeSpecificRegular(star4, 1);
		expect(result).toEqual({ kind: "not_k_regular" });
	});
});

// ============================================================================
// computeAutoRegular
// ============================================================================

describe("computeAutoRegular", () => {
	it("returns not_k_regular for empty graph", () => {
		const result = computeAutoRegular(emptyGraph);
		expect(result.kind).toBe("not_k_regular");
	});

	it("returns k_regular with k=2 for triangle", () => {
		const result = computeAutoRegular(simpleTriangle);
		expect(result).toEqual({ kind: "k_regular", k: 2 });
	});

	it("returns k_regular with k=3 for K4", () => {
		const result = computeAutoRegular(k4);
		expect(result).toEqual({ kind: "k_regular", k: 3 });
	});

	it("returns k_regular with k=2 for C4", () => {
		const result = computeAutoRegular(cycle4);
		expect(result).toEqual({ kind: "k_regular", k: 2 });
	});

	it("returns not_k_regular for star (not regular)", () => {
		const result = computeAutoRegular(star4);
		expect(result).toEqual({ kind: "not_k_regular" });
	});
});

// ============================================================================
// computeStronglyRegular
// ============================================================================

describe("computeStronglyRegular", () => {
	it("returns not_strongly_regular for empty graph", () => {
		const result = computeStronglyRegular(emptyGraph);
		expect(result.kind).toBe("not_strongly_regular");
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeStronglyRegular(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns not_strongly_regular for non-regular graph", () => {
		const result = computeStronglyRegular(star4);
		expect(result).toEqual({ kind: "not_strongly_regular" });
	});

	it("returns strongly_regular for K4", () => {
		const result = computeStronglyRegular(k4);
		expect(result.kind).toBe("strongly_regular");
		if (result.kind === "strongly_regular") {
			expect(result.k).toBe(3);
			expect(result.lambda).toBe(2);
			expect(result.mu).toBe(-1); // no non-adjacent pairs in K4
		}
	});
});

// ============================================================================
// computeSelfComplementary
// ============================================================================

describe("computeSelfComplementary", () => {
	it("returns self_complementary for empty graph", () => {
		const result = computeSelfComplementary(emptyGraph);
		expect(result).toEqual({ kind: "self_complementary" });
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeSelfComplementary(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns not_self_complementary when n mod 4 is invalid", () => {
		// n=3 is not 0 or 1 mod 4, so not self-complementary
		const result = computeSelfComplementary(simpleTriangle);
		expect(result).toEqual({ kind: "not_self_complementary" });
	});

	it("returns self_complementary for single vertex", () => {
		// n=1, n % 4 = 1, 0 edges needed
		const result = computeSelfComplementary(singleVertex);
		expect(result).toEqual({ kind: "self_complementary" });
	});

	it("returns not_self_complementary for K4 (wrong edge count)", () => {
		// K4 has 6 edges, but self-complementary needs (4*3/2)/2 = 3 edges
		const result = computeSelfComplementary(k4);
		expect(result).toEqual({ kind: "not_self_complementary" });
	});

	it("returns self_complementary for P4 (path on 4 vertices)", () => {
		// P4 is a classic self-complementary graph
		const result = computeSelfComplementary(path4);
		expect(result).toEqual({ kind: "self_complementary" });
	});
});

// ============================================================================
// computeVertexTransitive
// ============================================================================

describe("computeVertexTransitive", () => {
	it("returns vertex_transitive for empty graph", () => {
		const result = computeVertexTransitive(emptyGraph);
		expect(result.kind).toBe("vertex_transitive");
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeVertexTransitive(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns not_vertex_transitive for non-regular graph", () => {
		const result = computeVertexTransitive(star4);
		expect(result).toEqual({ kind: "not_vertex_transitive" });
	});

	it("returns vertex_transitive for small regular graph (triangle)", () => {
		const result = computeVertexTransitive(simpleTriangle);
		expect(result).toEqual({ kind: "vertex_transitive" });
	});

	it("returns vertex_transitive for K4", () => {
		const result = computeVertexTransitive(k4);
		expect(result).toEqual({ kind: "vertex_transitive" });
	});
});

// ============================================================================
// computeCompleteBipartite
// ============================================================================

describe("computeCompleteBipartite", () => {
	it("returns complete_bipartite for empty graph", () => {
		const result = computeCompleteBipartite(emptyGraph);
		expect(result.kind).toBe("complete_bipartite");
	});

	it("returns not_complete_bipartite for triangle (not bipartite)", () => {
		const result = computeCompleteBipartite(simpleTriangle);
		expect(result).toEqual({ kind: "not_complete_bipartite" });
	});

	it("returns complete_bipartite for K2,2", () => {
		const result = computeCompleteBipartite(k22);
		expect(result.kind).toBe("complete_bipartite");
		if (result.kind === "complete_bipartite") {
			// m and n can be in either order
			expect([result.m, result.n].toSorted()).toEqual([2, 2]);
		}
	});

	it("returns complete_bipartite for C4 (is K2,2)", () => {
		const result = computeCompleteBipartite(cycle4);
		expect(result.kind).toBe("complete_bipartite");
	});

	it("returns not_complete_bipartite for path (bipartite but not complete)", () => {
		const result = computeCompleteBipartite(path4);
		expect(result).toEqual({ kind: "not_complete_bipartite" });
	});
});

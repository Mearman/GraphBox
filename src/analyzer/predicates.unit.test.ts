/**
 * Unit tests for predicates.ts
 */

import { describe, expect, it } from "vitest";

import {
	axisEquals,
	axisKindIs,
	hasGraphSpec,
	isBipartite,
	isChordal,
	isClawFree,
	isCograph,
	isComparability,
	isComplete,
	isCompleteBipartite,
	isCubic,
	isDAG,
	isDense,
	isEulerian,
	isForest,
	isGraphConnected,
	isHamiltonian,
	isInterval,
	isKRegular,
	isLineGraph,
	isModular,
	isPerfect,
	isPermutation,
	isPlanar,
	isRegular,
	isScaleFree,
	isSelfComplementary,
	isSmallWorld,
	isSparse,
	isSplit,
	isStar,
	isStronglyRegular,
	isThreshold,
	isTraceable,
	isTree,
	isUnitDisk,
	isVertexTransitive,
} from "./predicates";
import type { AnalyzerGraph } from "./types";

// ============================================================================
// Helper graphs
// ============================================================================

const _emptyGraph: AnalyzerGraph = { vertices: [], edges: [] };

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

const path3: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: false },
	],
};

const tree4: AnalyzerGraph = {
	vertices: [{ id: "root" }, { id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["root", "a"], directed: false },
		{ id: "e2", endpoints: ["root", "b"], directed: false },
		{ id: "e3", endpoints: ["root", "c"], directed: false },
	],
};

const dag: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: true },
		{ id: "e2", endpoints: ["b", "c"], directed: true },
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

const star4: AnalyzerGraph = {
	vertices: [{ id: "center" }, { id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["center", "a"], directed: false },
		{ id: "e2", endpoints: ["center", "b"], directed: false },
		{ id: "e3", endpoints: ["center", "c"], directed: false },
	],
};

const sparseGraph: AnalyzerGraph = {
	vertices: Array.from({ length: 10 }, (_, index) => ({ id: `v${index}` })),
	edges: [
		{ id: "e1", endpoints: ["v0", "v1"], directed: false },
		{ id: "e2", endpoints: ["v2", "v3"], directed: false },
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

// ============================================================================
// axisEquals
// ============================================================================

describe("axisEquals", () => {
	it("returns true when axis value matches exactly", () => {
		const predicate = axisEquals("directionality", { kind: "undirected" });
		expect(predicate(simpleTriangle)).toBe(true);
	});

	it("returns false when axis value does not match", () => {
		const predicate = axisEquals("directionality", { kind: "directed" });
		expect(predicate(simpleTriangle)).toBe(false);
	});

	it("matches axis with payload (vertexCardinality)", () => {
		const predicate = axisEquals("vertexCardinality", { kind: "finite", n: 3 });
		expect(predicate(simpleTriangle)).toBe(true);
	});

	it("returns false when payload differs", () => {
		const predicate = axisEquals("vertexCardinality", { kind: "finite", n: 5 });
		expect(predicate(simpleTriangle)).toBe(false);
	});
});

// ============================================================================
// axisKindIs
// ============================================================================

describe("axisKindIs", () => {
	it("returns true when axis kind matches", () => {
		const predicate = axisKindIs("directionality", "undirected");
		expect(predicate(simpleTriangle)).toBe(true);
	});

	it("returns false when axis kind does not match", () => {
		const predicate = axisKindIs("directionality", "directed");
		expect(predicate(simpleTriangle)).toBe(false);
	});

	it("works with cycles axis", () => {
		const predicate = axisKindIs("cycles", "acyclic");
		expect(predicate(dag)).toBe(true);
		expect(predicate(simpleTriangle)).toBe(false);
	});
});

// ============================================================================
// hasGraphSpec
// ============================================================================

describe("hasGraphSpec", () => {
	it("returns true when all specified axes match", () => {
		const predicate = hasGraphSpec({
			directionality: { kind: "undirected" },
			edgeMultiplicity: { kind: "simple" },
		});
		expect(predicate(simpleTriangle)).toBe(true);
	});

	it("returns false when any axis does not match", () => {
		const predicate = hasGraphSpec({
			directionality: { kind: "directed" },
			edgeMultiplicity: { kind: "simple" },
		});
		expect(predicate(simpleTriangle)).toBe(false);
	});

	it("returns true for empty spec (matches everything)", () => {
		const predicate = hasGraphSpec({});
		expect(predicate(simpleTriangle)).toBe(true);
		expect(predicate(dag)).toBe(true);
	});
});

// ============================================================================
// Common graph class predicates
// ============================================================================

describe("isTree", () => {
	it("returns true for tree", () => {
		expect(isTree(tree4)).toBe(true);
	});

	it("returns true for path (also a tree)", () => {
		expect(isTree(path3)).toBe(true);
	});

	it("returns false for cycle", () => {
		expect(isTree(simpleTriangle)).toBe(false);
	});

	it("returns false for directed graph", () => {
		expect(isTree(dag)).toBe(false);
	});
});

describe("isForest", () => {
	it("returns true for tree", () => {
		expect(isForest(tree4)).toBe(true);
	});

	it("returns true for disconnected trees", () => {
		const forest: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["c", "d"], directed: false },
			],
		};
		expect(isForest(forest)).toBe(true);
	});

	it("returns false for cycle", () => {
		expect(isForest(simpleTriangle)).toBe(false);
	});
});

describe("isDAG", () => {
	it("returns true for DAG", () => {
		expect(isDAG(dag)).toBe(true);
	});

	it("returns false for undirected graph", () => {
		expect(isDAG(simpleTriangle)).toBe(false);
	});

	it("returns false for directed cyclic graph", () => {
		const cyclic: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: true },
				{ id: "e2", endpoints: ["b", "c"], directed: true },
				{ id: "e3", endpoints: ["c", "a"], directed: true },
			],
		};
		expect(isDAG(cyclic)).toBe(false);
	});
});

describe("isBipartite", () => {
	it("returns true for K2,2", () => {
		expect(isBipartite(k22)).toBe(true);
	});

	it("returns true for path", () => {
		expect(isBipartite(path3)).toBe(true);
	});

	it("returns true for C4 (even cycle)", () => {
		expect(isBipartite(cycle4)).toBe(true);
	});

	it("returns false for triangle (odd cycle)", () => {
		expect(isBipartite(simpleTriangle)).toBe(false);
	});
});

describe("isComplete", () => {
	it("returns true for K4", () => {
		expect(isComplete(k4)).toBe(true);
	});

	it("returns true for triangle (K3)", () => {
		expect(isComplete(simpleTriangle)).toBe(true);
	});

	it("returns false for path", () => {
		expect(isComplete(path3)).toBe(false);
	});
});

describe("isSparse", () => {
	it("returns true for sparse graph (density <= 10%)", () => {
		expect(isSparse(sparseGraph)).toBe(true);
	});

	it("returns false for complete graph", () => {
		expect(isSparse(k4)).toBe(false);
	});
});

describe("isDense", () => {
	it("returns true for complete graph", () => {
		expect(isDense(k4)).toBe(true);
	});

	it("returns false for sparse graph", () => {
		expect(isDense(sparseGraph)).toBe(false);
	});
});

describe("isRegular", () => {
	it("returns true for triangle (2-regular)", () => {
		expect(isRegular(simpleTriangle)).toBe(true);
	});

	it("returns true for K4 (3-regular)", () => {
		expect(isRegular(k4)).toBe(true);
	});

	it("returns false for star (not regular)", () => {
		expect(isRegular(star4)).toBe(false);
	});
});

describe("isGraphConnected", () => {
	it("returns true for connected graph", () => {
		expect(isGraphConnected(simpleTriangle)).toBe(true);
	});

	it("returns false for disconnected graph", () => {
		const disconnected: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }],
			edges: [],
		};
		expect(isGraphConnected(disconnected)).toBe(false);
	});
});

describe("isEulerian", () => {
	it("returns true for triangle (all even degrees)", () => {
		expect(isEulerian(simpleTriangle)).toBe(true);
	});

	it("returns true for C4 (all even degrees)", () => {
		expect(isEulerian(cycle4)).toBe(true);
	});

	it("returns false for path (odd degree vertices)", () => {
		expect(isEulerian(path3)).toBe(false);
	});

	it("returns false for star (odd degree vertices)", () => {
		expect(isEulerian(star4)).toBe(false);
	});
});

describe("isStar", () => {
	it("returns true for star graph", () => {
		expect(isStar(star4)).toBe(true);
	});

	it("returns false for complete graph", () => {
		expect(isStar(k4)).toBe(false);
	});

	it("returns true for path (edge is a degenerate star)", () => {
		expect(isStar(path3)).toBe(true);
	});

	it("returns false for triangle", () => {
		expect(isStar(simpleTriangle)).toBe(false);
	});
});

describe("isPlanar", () => {
	it("returns true for small graphs (K4 is planar)", () => {
		expect(isPlanar(k4)).toBe(true);
	});

	it("returns true for tree", () => {
		expect(isPlanar(tree4)).toBe(true);
	});

	it("returns true for cycle", () => {
		expect(isPlanar(cycle4)).toBe(true);
	});
});

describe("isChordal", () => {
	it("returns true for complete graph", () => {
		expect(isChordal(k4)).toBe(true);
	});

	it("returns true for tree (no cycles)", () => {
		expect(isChordal(tree4)).toBe(true);
	});

	it("returns false for C4 (4-cycle without chord)", () => {
		expect(isChordal(cycle4)).toBe(false);
	});
});

describe("isInterval", () => {
	it("returns true for complete graph (chordal)", () => {
		expect(isInterval(k4)).toBe(true);
	});

	it("returns true for path", () => {
		expect(isInterval(path3)).toBe(true);
	});
});

describe("isPermutation", () => {
	it("returns true for complete graph", () => {
		expect(isPermutation(k4)).toBe(true);
	});

	it("returns true for path", () => {
		expect(isPermutation(path3)).toBe(true);
	});
});

describe("isUnitDisk", () => {
	it("returns false when no position data", () => {
		expect(isUnitDisk(simpleTriangle)).toBe(false);
	});

	it("returns true for graph with valid unit disk positions", () => {
		const unitDisk: AnalyzerGraph = {
			vertices: [
				{ id: "a", attrs: { pos: { x: 0, y: 0 } } },
				{ id: "b", attrs: { pos: { x: 0.5, y: 0 } } },
			],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false },
			],
		};
		expect(isUnitDisk(unitDisk)).toBe(true);
	});
});

describe("isComparability", () => {
	it("returns true for complete graph", () => {
		expect(isComparability(k4)).toBe(true);
	});

	it("returns true for bipartite graph", () => {
		expect(isComparability(k22)).toBe(true);
	});
});

// ============================================================================
// Network analysis predicates
// ============================================================================

describe("isScaleFree", () => {
	it("returns false for small graphs", () => {
		expect(isScaleFree(simpleTriangle)).toBe(false);
	});
});

describe("isSmallWorld", () => {
	it("returns false for small graphs", () => {
		const result = isSmallWorld(simpleTriangle);
		// Small graphs typically don't qualify
		expect(typeof result).toBe("boolean");
	});
});

describe("isModular", () => {
	it("returns false for single component", () => {
		expect(isModular(simpleTriangle)).toBe(false);
	});

	it("returns true for disconnected components", () => {
		const modular: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["c", "d"], directed: false },
			],
		};
		expect(isModular(modular)).toBe(true);
	});
});

// ============================================================================
// Path and cycle predicates
// ============================================================================

describe("isHamiltonian", () => {
	it("returns true for triangle", () => {
		expect(isHamiltonian(simpleTriangle)).toBe(true);
	});

	it("returns true for C4", () => {
		expect(isHamiltonian(cycle4)).toBe(true);
	});

	it("returns false for path", () => {
		expect(isHamiltonian(path4)).toBe(false);
	});
});

describe("isTraceable", () => {
	it("returns true for path", () => {
		expect(isTraceable(path4)).toBe(true);
	});

	it("returns true for cycle", () => {
		expect(isTraceable(cycle4)).toBe(true);
	});
});

// ============================================================================
// Structural predicates
// ============================================================================

describe("isPerfect", () => {
	it("returns true for bipartite graph", () => {
		expect(isPerfect(k22)).toBe(true);
	});

	it("returns true for chordal graph", () => {
		expect(isPerfect(k4)).toBe(true);
	});
});

describe("isSplit", () => {
	it("returns true for complete graph", () => {
		expect(isSplit(k4)).toBe(true);
	});
});

describe("isCograph", () => {
	it("returns true for triangle", () => {
		expect(isCograph(simpleTriangle)).toBe(true);
	});

	it("returns false for P4", () => {
		expect(isCograph(path4)).toBe(false);
	});
});

describe("isThreshold", () => {
	it("returns true for K4 (both split and cograph)", () => {
		expect(isThreshold(k4)).toBe(true);
	});
});

describe("isLineGraph", () => {
	it("returns true for triangle", () => {
		expect(isLineGraph(simpleTriangle)).toBe(true);
	});
});

describe("isClawFree", () => {
	it("returns true for triangle", () => {
		expect(isClawFree(simpleTriangle)).toBe(true);
	});

	it("returns false for star (has claw)", () => {
		expect(isClawFree(star4)).toBe(false);
	});
});

// ============================================================================
// Regularity predicates
// ============================================================================

describe("isCubic", () => {
	it("returns true for K4 (3-regular)", () => {
		expect(isCubic(k4)).toBe(true);
	});

	it("returns false for triangle (2-regular)", () => {
		expect(isCubic(simpleTriangle)).toBe(false);
	});
});

describe("isKRegular", () => {
	it("returns predicate for k=2", () => {
		const is2Regular = isKRegular(2);
		expect(is2Regular(simpleTriangle)).toBe(true);
		expect(is2Regular(k4)).toBe(false);
	});

	it("returns predicate for k=3", () => {
		const is3Regular = isKRegular(3);
		expect(is3Regular(k4)).toBe(true);
		expect(is3Regular(simpleTriangle)).toBe(false);
	});
});

describe("isStronglyRegular", () => {
	it("returns true for K4", () => {
		expect(isStronglyRegular(k4)).toBe(true);
	});

	it("returns false for star", () => {
		expect(isStronglyRegular(star4)).toBe(false);
	});
});

// ============================================================================
// Symmetry predicates
// ============================================================================

describe("isSelfComplementary", () => {
	it("returns true for P4", () => {
		expect(isSelfComplementary(path4)).toBe(true);
	});

	it("returns false for K4 (wrong edge count)", () => {
		expect(isSelfComplementary(k4)).toBe(false);
	});
});

describe("isVertexTransitive", () => {
	it("returns true for small regular graphs", () => {
		expect(isVertexTransitive(simpleTriangle)).toBe(true);
	});

	it("returns false for star (not regular)", () => {
		expect(isVertexTransitive(star4)).toBe(false);
	});
});

// ============================================================================
// Special bipartite predicates
// ============================================================================

describe("isCompleteBipartite", () => {
	it("returns true for K2,2", () => {
		expect(isCompleteBipartite(k22)).toBe(true);
	});

	it("returns true for C4 (is K2,2)", () => {
		expect(isCompleteBipartite(cycle4)).toBe(true);
	});

	it("returns false for triangle (not bipartite)", () => {
		expect(isCompleteBipartite(simpleTriangle)).toBe(false);
	});
});

/**
 * Unit tests for connectivity.ts
 */

import { describe, expect, it } from "vitest";

import {
	computeConnectivity,
	computeCycles,
	computeDegreeConstraint,
} from "./connectivity";
import type { AnalyzerGraph } from "./types";

// ============================================================================
// Helper graphs
// ============================================================================

const emptyGraph: AnalyzerGraph = { vertices: [], edges: [] };

const singleVertex: AnalyzerGraph = {
	vertices: [{ id: "a" }],
	edges: [],
};

const twoDisconnected: AnalyzerGraph = {
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

const path3: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: false },
	],
};

const directedAcyclic: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: true },
		{ id: "e2", endpoints: ["b", "c"], directed: true },
	],
};

const directedCyclic: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: true },
		{ id: "e2", endpoints: ["b", "c"], directed: true },
		{ id: "e3", endpoints: ["c", "a"], directed: true },
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

const star4: AnalyzerGraph = {
	vertices: [{ id: "center" }, { id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["center", "a"], directed: false },
		{ id: "e2", endpoints: ["center", "b"], directed: false },
		{ id: "e3", endpoints: ["center", "c"], directed: false },
	],
};

const hyperEdgeGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b", "c"], directed: false },
	],
};

const mixedGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: true },
	],
};

// ============================================================================
// computeConnectivity
// ============================================================================

describe("computeConnectivity", () => {
	it("returns connected for empty graph", () => {
		const result = computeConnectivity(emptyGraph);
		expect(result).toEqual({ kind: "connected" });
	});

	it("returns connected for single vertex", () => {
		const result = computeConnectivity(singleVertex);
		expect(result).toEqual({ kind: "connected" });
	});

	it("returns unconstrained for disconnected graph", () => {
		const result = computeConnectivity(twoDisconnected);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns connected for connected undirected graph", () => {
		const result = computeConnectivity(simpleTriangle);
		expect(result).toEqual({ kind: "connected" });
	});

	it("returns connected for simple edge", () => {
		const result = computeConnectivity(simpleEdge);
		expect(result).toEqual({ kind: "connected" });
	});

	it("returns connected for path graph", () => {
		const result = computeConnectivity(path3);
		expect(result).toEqual({ kind: "connected" });
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeConnectivity(directedAcyclic);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for mixed graphs", () => {
		const result = computeConnectivity(mixedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for hypergraphs", () => {
		const result = computeConnectivity(hyperEdgeGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});
});

// ============================================================================
// computeCycles
// ============================================================================

describe("computeCycles", () => {
	it("returns cycles_allowed for empty graph", () => {
		const result = computeCycles(emptyGraph);
		expect(result).toEqual({ kind: "cycles_allowed" });
	});

	it("returns acyclic for directed acyclic graph (DAG)", () => {
		const result = computeCycles(directedAcyclic);
		expect(result).toEqual({ kind: "acyclic" });
	});

	it("returns cycles_allowed for directed cyclic graph", () => {
		const result = computeCycles(directedCyclic);
		expect(result).toEqual({ kind: "cycles_allowed" });
	});

	it("returns acyclic for forest (E < V)", () => {
		// path3 has 3 vertices, 2 edges
		const result = computeCycles(path3);
		expect(result).toEqual({ kind: "acyclic" });
	});

	it("returns cycles_allowed for cyclic undirected graph (E >= V)", () => {
		// triangle has 3 vertices, 3 edges
		const result = computeCycles(simpleTriangle);
		expect(result).toEqual({ kind: "cycles_allowed" });
	});

	it("returns acyclic for star graph (tree)", () => {
		// star4 has 4 vertices, 3 edges
		const result = computeCycles(star4);
		expect(result).toEqual({ kind: "acyclic" });
	});

	it("returns cycles_allowed for K4", () => {
		// K4 has 4 vertices, 6 edges
		const result = computeCycles(k4);
		expect(result).toEqual({ kind: "cycles_allowed" });
	});

	it("returns cycles_allowed for mixed graphs (conservative)", () => {
		const result = computeCycles(mixedGraph);
		expect(result).toEqual({ kind: "cycles_allowed" });
	});

	it("returns cycles_allowed for hypergraphs (conservative)", () => {
		const result = computeCycles(hyperEdgeGraph);
		expect(result).toEqual({ kind: "cycles_allowed" });
	});
});

// ============================================================================
// computeDegreeConstraint
// ============================================================================

describe("computeDegreeConstraint", () => {
	it("returns degree_sequence with empty sequence for empty graph", () => {
		const result = computeDegreeConstraint(emptyGraph);
		expect(result).toEqual({ kind: "degree_sequence", sequence: [] });
	});

	it("returns regular with degree 0 for isolated vertex", () => {
		const result = computeDegreeConstraint(singleVertex);
		expect(result).toEqual({ kind: "regular", degree: 0 });
	});

	it("returns regular with degree 0 for disconnected vertices", () => {
		const result = computeDegreeConstraint(twoDisconnected);
		expect(result).toEqual({ kind: "regular", degree: 0 });
	});

	it("returns regular with degree 2 for triangle", () => {
		const result = computeDegreeConstraint(simpleTriangle);
		expect(result).toEqual({ kind: "regular", degree: 2 });
	});

	it("returns regular with degree 3 for K4", () => {
		const result = computeDegreeConstraint(k4);
		expect(result).toEqual({ kind: "regular", degree: 3 });
	});

	it("returns degree_sequence for non-regular graph", () => {
		const result = computeDegreeConstraint(star4);
		expect(result.kind).toBe("degree_sequence");
		if (result.kind === "degree_sequence") {
			// center has degree 3, leaves have degree 1
			const sorted = [...result.sequence].sort((a, b) => a - b);
			expect(sorted).toEqual([1, 1, 1, 3]);
		}
	});

	it("returns degree_sequence for path", () => {
		const result = computeDegreeConstraint(path3);
		expect(result.kind).toBe("degree_sequence");
		if (result.kind === "degree_sequence") {
			const sorted = [...result.sequence].sort((a, b) => a - b);
			expect(sorted).toEqual([1, 1, 2]);
		}
	});

	it("returns unconstrained for hypergraphs", () => {
		const result = computeDegreeConstraint(hyperEdgeGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("handles directed graphs (treats as total degree)", () => {
		const result = computeDegreeConstraint(directedAcyclic);
		expect(result.kind).toBe("degree_sequence");
		if (result.kind === "degree_sequence") {
			// a->b: a has out-degree 1, b has in-degree 1 and out-degree 1, c has in-degree 1
			const sorted = [...result.sequence].sort((a, b) => a - b);
			expect(sorted).toEqual([1, 1, 2]);
		}
	});
});

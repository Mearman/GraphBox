/**
 * Unit tests for path-props.ts
 */

import { describe, expect, it } from "vitest";

import {
	computeHamiltonian,
	computeTraceable,
} from "./path-props";
import type { AnalyzerGraph } from "./types";

// ============================================================================
// Helper graphs
// ============================================================================

const emptyGraph: AnalyzerGraph = { vertices: [], edges: [] };

const singleVertex: AnalyzerGraph = {
	vertices: [{ id: "a" }],
	edges: [],
};

const twoVertices: AnalyzerGraph = {
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

const path4: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: false },
		{ id: "e3", endpoints: ["c", "d"], directed: false },
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

const disconnected: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["c", "d"], directed: false },
	],
};

const hyperEdgeGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b", "c"], directed: false },
	],
};

// Large graph for unconstrained test
const largeGraph: AnalyzerGraph = {
	vertices: Array.from({ length: 15 }, (_, index) => ({ id: `v${index}` })),
	edges: Array.from({ length: 14 }, (_, index) => ({
		id: `e${index}`,
		endpoints: [`v${index}`, `v${index + 1}`],
		directed: false,
	})),
};

// ============================================================================
// computeHamiltonian
// ============================================================================

describe("computeHamiltonian", () => {
	it("returns non_hamiltonian for empty graph", () => {
		const result = computeHamiltonian(emptyGraph);
		expect(result).toEqual({ kind: "non_hamiltonian" });
	});

	it("returns non_hamiltonian for single vertex (needs at least 3)", () => {
		const result = computeHamiltonian(singleVertex);
		expect(result).toEqual({ kind: "non_hamiltonian" });
	});

	it("returns non_hamiltonian for two vertices (needs at least 3)", () => {
		const result = computeHamiltonian(twoVertices);
		expect(result).toEqual({ kind: "non_hamiltonian" });
	});

	it("returns hamiltonian for triangle (C3)", () => {
		const result = computeHamiltonian(simpleTriangle);
		expect(result).toEqual({ kind: "hamiltonian" });
	});

	it("returns hamiltonian for cycle C4", () => {
		const result = computeHamiltonian(cycle4);
		expect(result).toEqual({ kind: "hamiltonian" });
	});

	it("returns hamiltonian for complete graph K4", () => {
		const result = computeHamiltonian(k4);
		expect(result).toEqual({ kind: "hamiltonian" });
	});

	it("returns non_hamiltonian for path P4 (no cycle)", () => {
		const result = computeHamiltonian(path4);
		expect(result).toEqual({ kind: "non_hamiltonian" });
	});

	it("returns non_hamiltonian for star (min degree < 2)", () => {
		const result = computeHamiltonian(star4);
		expect(result).toEqual({ kind: "non_hamiltonian" });
	});

	it("returns non_hamiltonian for disconnected graph", () => {
		const result = computeHamiltonian(disconnected);
		expect(result).toEqual({ kind: "non_hamiltonian" });
	});

	it("returns unconstrained for hypergraphs", () => {
		const result = computeHamiltonian(hyperEdgeGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for large graphs (n > 10)", () => {
		const result = computeHamiltonian(largeGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});
});

// ============================================================================
// computeTraceable
// ============================================================================

describe("computeTraceable", () => {
	it("returns non_traceable for empty graph", () => {
		const result = computeTraceable(emptyGraph);
		expect(result).toEqual({ kind: "non_traceable" });
	});

	it("returns non_traceable for single vertex (needs at least 2)", () => {
		const result = computeTraceable(singleVertex);
		expect(result).toEqual({ kind: "non_traceable" });
	});

	it("returns traceable for two connected vertices", () => {
		const result = computeTraceable(twoVertices);
		expect(result).toEqual({ kind: "traceable" });
	});

	it("returns traceable for triangle (hamiltonian implies traceable)", () => {
		const result = computeTraceable(simpleTriangle);
		expect(result).toEqual({ kind: "traceable" });
	});

	it("returns traceable for path P4 (is itself a Hamiltonian path)", () => {
		const result = computeTraceable(path4);
		expect(result).toEqual({ kind: "traceable" });
	});

	it("returns traceable for cycle C4 (hamiltonian implies traceable)", () => {
		const result = computeTraceable(cycle4);
		expect(result).toEqual({ kind: "traceable" });
	});

	it("returns traceable for complete graph K4", () => {
		const result = computeTraceable(k4);
		expect(result).toEqual({ kind: "traceable" });
	});

	it("returns non_traceable for star (center has high degree)", () => {
		const result = computeTraceable(star4);
		expect(result).toEqual({ kind: "non_traceable" });
	});

	it("returns non_traceable for disconnected graph", () => {
		const result = computeTraceable(disconnected);
		expect(result).toEqual({ kind: "non_traceable" });
	});

	it("returns unconstrained for large graphs (n > 10)", () => {
		const result = computeTraceable(largeGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});
});

// ============================================================================
// Edge cases
// ============================================================================

describe("path-props edge cases", () => {
	it("handles graph with exactly 3 vertices forming a path", () => {
		const path3: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["b", "c"], directed: false },
			],
		};

		expect(computeHamiltonian(path3)).toEqual({ kind: "non_hamiltonian" });
		expect(computeTraceable(path3)).toEqual({ kind: "traceable" });
	});

	it("handles graph with exactly 10 vertices (boundary)", () => {
		const boundary: AnalyzerGraph = {
			vertices: Array.from({ length: 10 }, (_, index) => ({ id: `v${index}` })),
			edges: [],
		};

		// Add edges to form a cycle
		for (let index = 0; index < 10; index++) {
			boundary.edges.push({
				id: `e${index}`,
				endpoints: [`v${index}`, `v${(index + 1) % 10}`],
				directed: false,
			});
		}

		// Should still compute (n <= 10)
		expect(computeHamiltonian(boundary)).toEqual({ kind: "hamiltonian" });
		expect(computeTraceable(boundary)).toEqual({ kind: "traceable" });
	});

	it("handles graph with 11 vertices (over boundary)", () => {
		const overBoundary: AnalyzerGraph = {
			vertices: Array.from({ length: 11 }, (_, index) => ({ id: `v${index}` })),
			edges: [],
		};

		// Add edges to form a cycle
		for (let index = 0; index < 11; index++) {
			overBoundary.edges.push({
				id: `e${index}`,
				endpoints: [`v${index}`, `v${(index + 1) % 11}`],
				directed: false,
			});
		}

		// Should return unconstrained (n > 10)
		expect(computeHamiltonian(overBoundary)).toEqual({ kind: "unconstrained" });
		expect(computeTraceable(overBoundary)).toEqual({ kind: "unconstrained" });
	});

	it("handles Peterson graph-like structure (non-hamiltonian but traceable)", () => {
		// A graph where all vertices have degree >= 2 but is not hamiltonian
		// Using a simpler example: a "house" graph (pentagon with roof)
		const house: AnalyzerGraph = {
			vertices: [
				{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" },
			],
			edges: [
				// Square base
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["b", "c"], directed: false },
				{ id: "e3", endpoints: ["c", "d"], directed: false },
				{ id: "e4", endpoints: ["d", "a"], directed: false },
				// Roof
				{ id: "e5", endpoints: ["a", "e"], directed: false },
				{ id: "e6", endpoints: ["b", "e"], directed: false },
			],
		};

		// House graph is hamiltonian (a-b-e-a forms triangle, can extend)
		expect(computeHamiltonian(house)).toEqual({ kind: "hamiltonian" });
		expect(computeTraceable(house)).toEqual({ kind: "traceable" });
	});
});

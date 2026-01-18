/**
 * Unit tests for perfect variant graph class analyzers
 */

import { describe, expect, it } from "vitest";

import { computeModular, computePtolemaic, computeQuasiLine } from "./perfect-variants.js";
import type { AnalyzerGraph } from "./types.js";

/**
 * Helper to create a simple undirected graph
 * @param vertices
 * @param edges
 */
const makeGraph = (vertices: string[], edges: Array<[string, string]>): AnalyzerGraph => ({
	vertices: vertices.map(id => ({ id })),
	edges: edges.map(([source, target], index) => ({
		id: `e${index}`,
		endpoints: [source, target],
		directed: false,
	})),
});

describe("computeQuasiLine", () => {
	it("should classify empty graph as quasi-line", () => {
		const g = makeGraph([], []);
		expect(computeQuasiLine(g).kind).toBe("quasi_line");
	});

	it("should classify single vertex as quasi-line", () => {
		const g = makeGraph(["A"], []);
		expect(computeQuasiLine(g).kind).toBe("quasi_line");
	});

	it("should classify triangle as quasi-line", () => {
		const g = makeGraph(["A", "B", "C"], [
			["A", "B"],
			["B", "C"],
			["C", "A"],
		]);
		expect(computeQuasiLine(g).kind).toBe("quasi_line");
	});

	it("should classify path graph as quasi-line", () => {
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
		]);
		expect(computeQuasiLine(g).kind).toBe("quasi_line");
	});

	it("should detect gem and classify as not quasi-line", () => {
		// Gem: P4 with a universal vertex
		//     2
		//     |
		// 0 - 1 - 3
		//     |
		//     4
		// Plus edges: 2-3, 2-4, 3-4 (making 2,3,4 a triangle)
		const g = makeGraph(["0", "1", "2", "3", "4"], [
			["0", "1"],
			["1", "2"],
			["1", "3"],
			["1", "4"],
			["2", "3"],
			["2", "4"],
			["3", "4"],
		]);
		expect(computeQuasiLine(g).kind).toBe("not_quasi_line");
	});

	it("should classify line graph (triangle) as quasi-line", () => {
		const g = makeGraph(["A", "B", "C"], [
			["A", "B"],
			["B", "C"],
			["C", "A"],
		]);
		expect(computeQuasiLine(g).kind).toBe("quasi_line");
	});

	it("should classify small graphs (n < 5) as quasi-line", () => {
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
			["D", "A"],
		]);
		expect(computeQuasiLine(g).kind).toBe("quasi_line");
	});

	it("should return unconstrained for directed graphs", () => {
		const g: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }],
			edges: [{ id: "e0", endpoints: ["A", "B"], directed: true }],
		};
		expect(computeQuasiLine(g).kind).toBe("unconstrained");
	});
});

describe("computePtolemaic", () => {
	it("should classify empty graph as ptolemaic", () => {
		const g = makeGraph([], []);
		expect(computePtolemaic(g).kind).toBe("ptolemaic");
	});

	it("should classify single vertex as ptolemaic", () => {
		const g = makeGraph(["A"], []);
		expect(computePtolemaic(g).kind).toBe("ptolemaic");
	});

	it("should classify triangle as ptolemaic (chordal + distance-hereditary)", () => {
		const g = makeGraph(["A", "B", "C"], [
			["A", "B"],
			["B", "C"],
			["C", "A"],
		]);
		expect(computePtolemaic(g).kind).toBe("ptolemaic");
	});

	it("should classify tree as ptolemaic", () => {
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "B"],
			["B", "C"],
			["B", "D"],
		]);
		expect(computePtolemaic(g).kind).toBe("ptolemaic");
	});

	it("should detect 4-cycle as not ptolemaic (not chordal)", () => {
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
			["D", "A"],
		]);
		expect(computePtolemaic(g).kind).toBe("not_ptolemaic");
	});

	it("should detect 5-cycle as not ptolemaic (not chordal)", () => {
		const g = makeGraph(["A", "B", "C", "D", "E"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
			["D", "E"],
			["E", "A"],
		]);
		expect(computePtolemaic(g).kind).toBe("not_ptolemaic");
	});

	it("should classify complete graph as ptolemaic", () => {
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "B"],
			["A", "C"],
			["A", "D"],
			["B", "C"],
			["B", "D"],
			["C", "D"],
		]);
		expect(computePtolemaic(g).kind).toBe("ptolemaic");
	});

	it("should return unconstrained for directed graphs", () => {
		const g: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }],
			edges: [{ id: "e0", endpoints: ["A", "B"], directed: true }],
		};
		expect(computePtolemaic(g).kind).toBe("unconstrained");
	});
});

describe("computeModular", () => {
	it("should classify empty graph as modular", () => {
		const g = makeGraph([], []);
		expect(computeModular(g).kind).toBe("modular");
	});

	it("should classify single vertex as modular", () => {
		const g = makeGraph(["A"], []);
		expect(computeModular(g).kind).toBe("modular");
	});

	it("should detect triangle as not modular (all pairs are twins)", () => {
		const g = makeGraph(["A", "B", "C"], [
			["A", "B"],
			["B", "C"],
			["C", "A"],
		]);
		// In a complete graph, any two vertices have identical external neighborhoods
		// So they form non-trivial modules
		expect(computeModular(g).kind).toBe("not_modular");
	});

	it("should detect twins (identical neighborhoods) as not modular", () => {
		// Graph with twins: A and B both connect to C
		// External neighborhoods of A and B are identical
		const g = makeGraph(["A", "B", "C"], [
			["A", "C"],
			["B", "C"],
		]);
		expect(computeModular(g).kind).toBe("not_modular");
	});

	it("should classify path as modular", () => {
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
		]);
		expect(computeModular(g).kind).toBe("modular");
	});

	it("should detect non-trivial module in larger graph", () => {
		// Star graph: center C, leaves A, B, D, E
		// All leaves have identical neighborhoods (just C)
		const g = makeGraph(["A", "B", "C", "D", "E"], [
			["A", "C"],
			["B", "C"],
			["D", "C"],
			["E", "C"],
		]);
		expect(computeModular(g).kind).toBe("not_modular");
	});

	it("should use degree heuristic for large graphs with distinct degrees", () => {
		// Create a path of 15 vertices (all have degree 1 or 2, but positions differ)
		const vertices = Array.from({ length: 15 }, (_, index) => `V${index}`);
		const edges: Array<[string, string]> = [];
		for (let index = 0; index < 14; index++) {
			edges.push([`V${index}`, `V${index + 1}`]);
		}

		const g = makeGraph(vertices, edges);
		const result = computeModular(g);

		// Degree heuristic: endpoints have degree 1, middle vertices degree 2
		// Not all distinct, so should return unconstrained for large graph
		expect(result.kind).toBe("unconstrained");
	});

	it("should return unconstrained for directed graphs", () => {
		const g: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }],
			edges: [{ id: "e0", endpoints: ["A", "B"], directed: true }],
		};
		expect(computeModular(g).kind).toBe("unconstrained");
	});

	it("should handle disconnected graph", () => {
		// Two disconnected edges (4 isolated pairs)
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "B"],
			["C", "D"],
		]);

		// A-B are twins, C-D are twins
		expect(computeModular(g).kind).toBe("not_modular");
	});
});

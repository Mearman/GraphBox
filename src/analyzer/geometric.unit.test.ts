/**
 * Unit tests for geometric graph class analyzers
 */

import { describe, expect, it } from "vitest";

import { computePlanar } from "./geometric.js";
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

describe("computePlanar", () => {
	it("should classify empty graph as planar", () => {
		const g = makeGraph([], []);
		expect(computePlanar(g).kind).toBe("planar");
	});

	it("should classify single vertex as planar", () => {
		const g = makeGraph(["A"], []);
		expect(computePlanar(g).kind).toBe("planar");
	});

	it("should classify two vertices as planar", () => {
		const g = makeGraph(["A", "B"], [["A", "B"]]);
		expect(computePlanar(g).kind).toBe("planar");
	});

	it("should classify triangle as planar", () => {
		const g = makeGraph(["A", "B", "C"], [
			["A", "B"],
			["B", "C"],
			["C", "A"],
		]);
		expect(computePlanar(g).kind).toBe("planar");
	});

	it("should classify K4 as planar", () => {
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "B"],
			["A", "C"],
			["A", "D"],
			["B", "C"],
			["B", "D"],
			["C", "D"],
		]);
		expect(computePlanar(g).kind).toBe("planar");
	});

	it("should classify tree as planar", () => {
		const g = makeGraph(["A", "B", "C", "D", "E"], [
			["A", "B"],
			["A", "C"],
			["B", "D"],
			["B", "E"],
		]);
		expect(computePlanar(g).kind).toBe("planar");
	});

	it("should detect K5 as nonplanar", () => {
		const g = makeGraph(["A", "B", "C", "D", "E"], [
			["A", "B"],
			["A", "C"],
			["A", "D"],
			["A", "E"],
			["B", "C"],
			["B", "D"],
			["B", "E"],
			["C", "D"],
			["C", "E"],
			["D", "E"],
		]);
		expect(computePlanar(g).kind).toBe("nonplanar");
	});

	it("should detect K3,3 as nonplanar", () => {
		// Complete bipartite graph K3,3
		// Partition 1: A, B, C
		// Partition 2: D, E, F
		const g = makeGraph(["A", "B", "C", "D", "E", "F"], [
			["A", "D"],
			["A", "E"],
			["A", "F"],
			["B", "D"],
			["B", "E"],
			["B", "F"],
			["C", "D"],
			["C", "E"],
			["C", "F"],
		]);
		expect(computePlanar(g).kind).toBe("nonplanar");
	});

	it("should use edge count heuristic to detect nonplanar graphs", () => {
		// Graph with 6 vertices and m > 3n - 6 = 12 edges
		// Create a graph with 13 edges (exceeds planar bound)
		const vertices = ["A", "B", "C", "D", "E", "F"];
		const edges: Array<[string, string]> = [
			// Make it dense enough to exceed 3n-6
			["A", "B"],
			["A", "C"],
			["A", "D"],
			["A", "E"],
			["A", "F"],
			["B", "C"],
			["B", "D"],
			["B", "E"],
			["B", "F"],
			["C", "D"],
			["C", "E"],
			["C", "F"],
			["D", "E"], // 13th edge, exceeds limit
		];

		const g = makeGraph(vertices, edges);
		expect(computePlanar(g).kind).toBe("nonplanar");
	});

	it("should classify path graph as planar", () => {
		const g = makeGraph(["A", "B", "C", "D", "E"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
			["D", "E"],
		]);
		expect(computePlanar(g).kind).toBe("planar");
	});

	it("should classify cycle as planar", () => {
		const g = makeGraph(["A", "B", "C", "D", "E"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
			["D", "E"],
			["E", "A"],
		]);
		expect(computePlanar(g).kind).toBe("planar");
	});

	it("should use sparse heuristic for large graphs within edge bound", () => {
		// Create a graph with 15 vertices and edges within the sparse bound
		// The sparse heuristic (m <= 2.5n - 5) should classify this as planar
		const vertices = Array.from({ length: 15 }, (_, index) => `V${index}`);
		const edges: Array<[string, string]> = [];

		// Create a tree (n-1 edges, definitely planar)
		for (let index = 0; index < 14; index++) {
			edges.push([`V${index}`, `V${index + 1}`]);
		}

		const g = makeGraph(vertices, edges);
		expect(computePlanar(g).kind).toBe("planar");
	});

	it("should return unconstrained for directed graphs", () => {
		const g: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }],
			edges: [{ id: "e0", endpoints: ["A", "B"], directed: true }],
		};
		expect(computePlanar(g).kind).toBe("unconstrained");
	});

	it("should ignore self-loops in edge count", () => {
		const g: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }, { id: "C" }],
			edges: [
				{ id: "e0", endpoints: ["A", "B"], directed: false },
				{ id: "e1", endpoints: ["A", "A"], directed: false }, // Self-loop
				{ id: "e2", endpoints: ["B", "C"], directed: false },
			],
		};
		// Should be planar (only 2 non-loop edges)
		expect(computePlanar(g).kind).toBe("planar");
	});
});

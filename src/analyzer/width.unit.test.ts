/**
 * Unit tests for width graph class analyzers
 */

import { describe, expect, it } from "vitest";

import type { AnalyzerGraph } from "./types.js";
import { computeCliquewidth,computePathwidth } from "./width.js";

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

describe("computePathwidth", () => {
	it("should classify empty graph as bounded", () => {
		const g = makeGraph([], []);
		expect(computePathwidth(g).kind).toBe("pathwidth_bounded");
	});

	it("should classify single vertex as bounded", () => {
		const g = makeGraph(["A"], []);
		expect(computePathwidth(g).kind).toBe("pathwidth_bounded");
	});

	it("should classify tree as bounded (pathwidth 1)", () => {
		const g = makeGraph(["A", "B", "C", "D", "E"], [
			["A", "B"],
			["A", "C"],
			["B", "D"],
			["B", "E"],
		]);
		expect(computePathwidth(g).kind).toBe("pathwidth_bounded");
	});

	it("should classify path graph as bounded", () => {
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
		]);
		expect(computePathwidth(g).kind).toBe("pathwidth_bounded");
	});

	it("should classify sparse graph as bounded", () => {
		const g = makeGraph(["A", "B", "C", "D", "E"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
			["D", "E"],
			["A", "C"],
		]);
		// 5 edges < 2*5 = 10, so bounded
		expect(computePathwidth(g).kind).toBe("pathwidth_bounded");
	});

	it("should classify dense graph as unconstrained", () => {
		// Complete graph K5 has 10 edges
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
		// 10 edges = 2*5, meets threshold for unconstrained
		expect(computePathwidth(g).kind).toBe("unconstrained");
	});

	it("should return unconstrained for directed graphs", () => {
		const g: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }],
			edges: [{ id: "e0", endpoints: ["A", "B"], directed: true }],
		};
		expect(computePathwidth(g).kind).toBe("unconstrained");
	});
});

describe("computeCliquewidth", () => {
	it("should classify empty graph as bounded", () => {
		const g = makeGraph([], []);
		expect(computeCliquewidth(g).kind).toBe("cliquewidth_bounded");
	});

	it("should classify single vertex as bounded", () => {
		const g = makeGraph(["A"], []);
		expect(computeCliquewidth(g).kind).toBe("cliquewidth_bounded");
	});

	it("should classify cograph as bounded (clique-width ≤ 2)", () => {
		// Small graph that is a cograph (P4-free)
		// Triangle is a cograph
		const g = makeGraph(["A", "B", "C"], [
			["A", "B"],
			["B", "C"],
			["C", "A"],
		]);
		expect(computeCliquewidth(g).kind).toBe("cliquewidth_bounded");
	});

	it("should classify tree as bounded (clique-width ≤ 3)", () => {
		const g = makeGraph(["A", "B", "C", "D", "E"], [
			["A", "B"],
			["A", "C"],
			["B", "D"],
			["B", "E"],
		]);
		expect(computeCliquewidth(g).kind).toBe("cliquewidth_bounded");
	});

	it("should classify bipartite graph as bounded (clique-width ≤ 4)", () => {
		// K2,2 bipartite graph
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "C"],
			["A", "D"],
			["B", "C"],
			["B", "D"],
		]);
		expect(computeCliquewidth(g).kind).toBe("cliquewidth_bounded");
	});

	it("should classify complete bipartite K3,3 as bounded", () => {
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
		expect(computeCliquewidth(g).kind).toBe("cliquewidth_bounded");
	});

	it("should classify path graph as cograph (P4-free for n<=3)", () => {
		const g = makeGraph(["A", "B", "C"], [
			["A", "B"],
			["B", "C"],
		]);
		expect(computeCliquewidth(g).kind).toBe("cliquewidth_bounded");
	});

	it("should detect P4 and classify as non-cograph but bipartite", () => {
		// P4: A-B-C-D (path of length 4)
		// This is bipartite, so still bounded
		const g = makeGraph(["A", "B", "C", "D"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
		]);
		expect(computeCliquewidth(g).kind).toBe("cliquewidth_bounded");
	});

	it("should classify cycle C5 as unconstrained (not cograph, not tree, not bipartite)", () => {
		const g = makeGraph(["A", "B", "C", "D", "E"], [
			["A", "B"],
			["B", "C"],
			["C", "D"],
			["D", "E"],
			["E", "A"],
		]);
		// C5 has odd cycle, so not bipartite
		// Not a tree (has cycle)
		// Not a cograph (contains P4)
		expect(computeCliquewidth(g).kind).toBe("unconstrained");
	});

	it("should return unconstrained for directed graphs", () => {
		const g: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }],
			edges: [{ id: "e0", endpoints: ["A", "B"], directed: true }],
		};
		expect(computeCliquewidth(g).kind).toBe("unconstrained");
	});
});

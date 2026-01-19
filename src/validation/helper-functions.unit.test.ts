import { describe, expect, it } from "vitest";

import type { TestEdge, TestNode } from "../generation/generators/types";
import {
	buildAdjacencyList,
	checkBipartiteWithBFS,
	checkTransitiveOrientation,
	computeAlgebraicConnectivityBounds,
	computeSpectralRadiusApproximation,
	findComponentsForDensity,
	findInducedCycles,
	getCombinations,
	hasChord,
	hasInducedP4,
	isConnected,
} from "./helper-functions";

describe("buildAdjacencyList", () => {
	it("should build adjacency list for undirected graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
		];
		const adj = buildAdjacencyList(nodes, edges, false);
		expect(adj.get("a")).toEqual(["b"]);
		// Order depends on implementation - check contains both
		expect(adj.get("b")?.toSorted()).toEqual(["a", "c"]);
		expect(adj.get("c")).toEqual(["b"]);
	});

	it("should build adjacency list for directed graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
		];
		const adj = buildAdjacencyList(nodes, edges, true);
		expect(adj.get("a")).toEqual(["b"]);
		expect(adj.get("b")).toEqual(["c"]);
		expect(adj.get("c")).toEqual([]);
	});

	it("should handle empty graph", () => {
		const adj = buildAdjacencyList([], [], false);
		expect(adj.size).toBe(0);
	});

	it("should handle isolated nodes", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }];
		const adj = buildAdjacencyList(nodes, [], false);
		expect(adj.get("a")).toEqual([]);
		expect(adj.get("b")).toEqual([]);
	});
});

describe("isConnected", () => {
	it("should return true for connected undirected graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
		];
		expect(isConnected(nodes, edges, false)).toBe(true);
	});

	it("should return false for disconnected undirected graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "c", target: "d" },
		];
		expect(isConnected(nodes, edges, false)).toBe(false);
	});

	it("should return true for empty graph", () => {
		expect(isConnected([], [], false)).toBe(true);
	});

	it("should return true for single node graph", () => {
		const nodes: TestNode[] = [{ id: "a" }];
		expect(isConnected(nodes, [], false)).toBe(true);
	});

	it("should handle directed graph connectivity", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
		];
		// In directed mode, only forward edges are considered
		expect(isConnected(nodes, edges, true)).toBe(true);
	});
});

describe("findComponentsForDensity", () => {
	it("should find single component in connected graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
		];
		const components = findComponentsForDensity(nodes, edges, false);
		expect(components.length).toBe(1);
		const sortedComponent = [...components[0]].toSorted();
		expect(sortedComponent).toEqual(["a", "b", "c"]);
	});

	it("should find multiple components in disconnected graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "c", target: "d" },
		];
		const components = findComponentsForDensity(nodes, edges, false);
		expect(components.length).toBe(2);
	});

	it("should handle isolated nodes as separate components", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [{ source: "a", target: "b" }];
		const components = findComponentsForDensity(nodes, edges, false);
		expect(components.length).toBe(2);
	});

	it("should return empty array for empty graph", () => {
		const components = findComponentsForDensity([], [], false);
		expect(components.length).toBe(0);
	});
});

describe("checkBipartiteWithBFS", () => {
	it("should return true for bipartite graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "a", target: "d" },
			{ source: "c", target: "b" },
			{ source: "c", target: "d" },
		];
		expect(checkBipartiteWithBFS(nodes, edges, false)).toBe(true);
	});

	it("should return false for non-bipartite graph (odd cycle)", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
			{ source: "c", target: "a" },
		];
		expect(checkBipartiteWithBFS(nodes, edges, false)).toBe(false);
	});

	it("should return true for empty graph", () => {
		expect(checkBipartiteWithBFS([], [], false)).toBe(true);
	});

	it("should return true for single node", () => {
		const nodes: TestNode[] = [{ id: "a" }];
		expect(checkBipartiteWithBFS(nodes, [], false)).toBe(true);
	});

	it("should return true for even cycle", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
			{ source: "c", target: "d" },
			{ source: "d", target: "a" },
		];
		expect(checkBipartiteWithBFS(nodes, edges, false)).toBe(true);
	});

	it("should handle disconnected graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "c", target: "d" },
		];
		expect(checkBipartiteWithBFS(nodes, edges, false)).toBe(true);
	});

	it("should detect non-bipartite in disconnected graph with odd cycle", () => {
		const nodes: TestNode[] = [
			{ id: "a" },
			{ id: "b" },
			{ id: "c" },
			{ id: "d" },
			{ id: "e" },
		];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
			{ source: "c", target: "a" }, // odd cycle
			{ source: "d", target: "e" },
		];
		expect(checkBipartiteWithBFS(nodes, edges, false)).toBe(false);
	});
});

describe("getCombinations", () => {
	it("should return all k-combinations", () => {
		const array = [1, 2, 3];
		const combs = getCombinations(array, 2);
		expect(combs).toEqual([[1, 2], [1, 3], [2, 3]]);
	});

	it("should return empty array for k > array length", () => {
		const array = [1, 2];
		expect(getCombinations(array, 3)).toEqual([]);
	});

	it("should return single empty array for k = 0", () => {
		const array = [1, 2, 3];
		expect(getCombinations(array, 0)).toEqual([[]]);
	});

	it("should return array of single elements for k = 1", () => {
		const array = [1, 2, 3];
		expect(getCombinations(array, 1)).toEqual([[1], [2], [3]]);
	});

	it("should return entire array for k = array length", () => {
		const array = [1, 2, 3];
		expect(getCombinations(array, 3)).toEqual([[1, 2, 3]]);
	});
});

describe("hasInducedP4", () => {
	it("should detect induced P4", () => {
		const adjacency = new Map<string, Set<string>>([
			["a", new Set(["b"])],
			["b", new Set(["a", "c"])],
			["c", new Set(["b", "d"])],
			["d", new Set(["c"])],
		]);
		expect(hasInducedP4(["a", "b", "c", "d"], adjacency, false)).toBe(true);
	});

	it("should return false when no P4 exists", () => {
		// Complete graph on 4 vertices - no induced P4
		const adjacency = new Map<string, Set<string>>([
			["a", new Set(["b", "c", "d"])],
			["b", new Set(["a", "c", "d"])],
			["c", new Set(["a", "b", "d"])],
			["d", new Set(["a", "b", "c"])],
		]);
		expect(hasInducedP4(["a", "b", "c", "d"], adjacency, false)).toBe(false);
	});

	it("should return false for star graph", () => {
		const adjacency = new Map<string, Set<string>>([
			["center", new Set(["a", "b", "c"])],
			["a", new Set(["center"])],
			["b", new Set(["center"])],
			["c", new Set(["center"])],
		]);
		expect(hasInducedP4(["center", "a", "b", "c"], adjacency, false)).toBe(false);
	});
});

describe("findInducedCycles", () => {
	it("should find triangle (3-cycle)", () => {
		const adjacency = new Map<string, Set<string>>([
			["a", new Set(["b", "c"])],
			["b", new Set(["a", "c"])],
			["c", new Set(["a", "b"])],
		]);
		const cycles = findInducedCycles(["a", "b", "c"], adjacency, 3, false);
		expect(cycles.length).toBeGreaterThan(0);
	});

	it("should return empty for length < 3", () => {
		const adjacency = new Map<string, Set<string>>([
			["a", new Set(["b"])],
			["b", new Set(["a"])],
		]);
		expect(findInducedCycles(["a", "b"], adjacency, 2, false)).toEqual([]);
	});

	it("should return empty when cycle length exceeds vertices", () => {
		const adjacency = new Map<string, Set<string>>([
			["a", new Set(["b"])],
			["b", new Set(["a"])],
		]);
		expect(findInducedCycles(["a", "b"], adjacency, 5, false)).toEqual([]);
	});

	it("should not find triangle in square graph", () => {
		// A 4-cycle (square) has no triangles
		const adjacency = new Map<string, Set<string>>([
			["a", new Set(["b", "d"])],
			["b", new Set(["a", "c"])],
			["c", new Set(["b", "d"])],
			["d", new Set(["c", "a"])],
		]);
		// Looking for 3-cycles (triangles) in a square should find none
		const cycles = findInducedCycles(["a", "b", "c", "d"], adjacency, 3, false);
		expect(cycles).toEqual([]);
	});
});

describe("hasChord", () => {
	it("should return false for simple cycle without chords", () => {
		const adjacency = new Map<string, Set<string>>([
			["a", new Set(["b", "d"])],
			["b", new Set(["a", "c"])],
			["c", new Set(["b", "d"])],
			["d", new Set(["c", "a"])],
		]);
		expect(hasChord(["a", "b", "c", "d"], adjacency, false)).toBe(false);
	});

	it("should return true for cycle with chord", () => {
		const adjacency = new Map<string, Set<string>>([
			["a", new Set(["b", "c", "d"])], // a-c is a chord
			["b", new Set(["a", "c"])],
			["c", new Set(["a", "b", "d"])],
			["d", new Set(["c", "a"])],
		]);
		expect(hasChord(["a", "b", "c", "d"], adjacency, false)).toBe(true);
	});

	it("should handle triangle (no possible chord)", () => {
		const adjacency = new Map<string, Set<string>>([
			["a", new Set(["b", "c"])],
			["b", new Set(["a", "c"])],
			["c", new Set(["a", "b"])],
		]);
		// In a triangle, all edges are cycle edges, no chord possible
		expect(hasChord(["a", "b", "c"], adjacency, false)).toBe(false);
	});
});

describe("checkTransitiveOrientation", () => {
	it("should return true for DAG", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
		];
		expect(checkTransitiveOrientation(nodes, edges, true)).toBe(true);
	});

	it("should return false for graph with cycle", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const edges: TestEdge[] = [
			{ source: "a", target: "b" },
			{ source: "b", target: "c" },
			{ source: "c", target: "a" },
		];
		expect(checkTransitiveOrientation(nodes, edges, true)).toBe(false);
	});

	it("should return true for empty graph", () => {
		expect(checkTransitiveOrientation([], [], true)).toBe(true);
	});

	it("should return true for single node", () => {
		const nodes: TestNode[] = [{ id: "a" }];
		expect(checkTransitiveOrientation(nodes, [], true)).toBe(true);
	});
});

describe("computeSpectralRadiusApproximation", () => {
	it("should return 0 for empty graph", () => {
		const adjacency = new Map<string, string[]>();
		expect(computeSpectralRadiusApproximation([], adjacency)).toBe(0);
	});

	it("should compute spectral radius for simple graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const adjacency = new Map<string, string[]>([
			["a", ["b", "c"]],
			["b", ["a", "c"]],
			["c", ["a", "b"]],
		]);
		const radius = computeSpectralRadiusApproximation(nodes, adjacency);
		// For complete graph K3, spectral radius is 2
		expect(radius).toBeCloseTo(2, 0);
	});

	it("should handle isolated node", () => {
		const nodes: TestNode[] = [{ id: "a" }];
		const adjacency = new Map<string, string[]>([["a", []]]);
		expect(computeSpectralRadiusApproximation(nodes, adjacency)).toBe(0);
	});
});

describe("computeAlgebraicConnectivityBounds", () => {
	it("should return 0 for empty graph", () => {
		const adjacency = new Map<string, string[]>();
		expect(computeAlgebraicConnectivityBounds([], adjacency)).toBe(0);
	});

	it("should return 0 for single node", () => {
		const nodes: TestNode[] = [{ id: "a" }];
		const adjacency = new Map<string, string[]>([["a", []]]);
		expect(computeAlgebraicConnectivityBounds(nodes, adjacency)).toBe(0);
	});

	it("should return 0 for disconnected graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }];
		const adjacency = new Map<string, string[]>([
			["a", []],
			["b", []],
		]);
		expect(computeAlgebraicConnectivityBounds(nodes, adjacency)).toBe(0);
	});

	it("should return positive value for connected graph", () => {
		const nodes: TestNode[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const adjacency = new Map<string, string[]>([
			["a", ["b"]],
			["b", ["a", "c"]],
			["c", ["b"]],
		]);
		const connectivity = computeAlgebraicConnectivityBounds(nodes, adjacency);
		expect(connectivity).toBeGreaterThan(0);
	});
});

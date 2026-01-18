import { describe, expect, it } from "vitest";

import type { GraphGenerationConfig } from "../generator";
import type { GraphSpec } from "../spec";
import type { TestEdge, TestNode } from "./types";
import { SeededRandom } from "./types";
import {
	addEdge,
	addWeights,
	detectCycleInGraph,
	findComponents,
	hasEdge,
	shuffleArray,
} from "./validation-helpers";

// Helper to create a basic graph spec
const createSpec = (overrides: Partial<GraphSpec> = {}): GraphSpec => ({
	directionality: { kind: "undirected" },
	connectivity: { kind: "connected" },
	cycles: { kind: "cycles_allowed" },
	density: { kind: "moderate" },
	edgeMultiplicity: { kind: "simple" },
	selfLoops: { kind: "disallowed" },
	completeness: { kind: "incomplete" },
	weighting: { kind: "unweighted" },
	schema: { kind: "homogeneous" },
	...overrides,
});

// Helper to create config
const createConfig = (overrides: Partial<GraphGenerationConfig> = {}): GraphGenerationConfig => ({
	nodeCount: 10,
	seed: 42,
	...overrides,
});

// Helper to create nodes
const createNodes = (count: number): TestNode[] =>
	Array.from({ length: count }, (_, index) => ({ id: `N${index}` }));

// Helper to create edges
const createEdges = (pairs: [number, number][]): TestEdge[] =>
	pairs.map(([s, t]) => ({ source: `N${s}`, target: `N${t}` }));

describe("validation-helpers", () => {
	describe("addWeights", () => {
		it("should add weights to all edges", () => {
			const edges: TestEdge[] = [
				{ source: "A", target: "B" },
				{ source: "B", target: "C" },
				{ source: "C", target: "D" },
			];
			const config = createConfig({ weightRange: { min: 1, max: 100 } });
			const rng = new SeededRandom(42);

			addWeights(edges, config, rng);

			for (const edge of edges) {
				expect(edge.weight).toBeDefined();
				expect(edge.weight).toBeGreaterThanOrEqual(1);
				expect(edge.weight).toBeLessThanOrEqual(100);
			}
		});

		it("should use default range when not specified", () => {
			const edges: TestEdge[] = [
				{ source: "A", target: "B" },
			];
			const config = createConfig();
			const rng = new SeededRandom(42);

			addWeights(edges, config, rng);

			expect(edges[0].weight).toBeDefined();
			expect(edges[0].weight).toBeGreaterThanOrEqual(1);
			expect(edges[0].weight).toBeLessThanOrEqual(100);
		});

		it("should handle empty edges array", () => {
			const edges: TestEdge[] = [];
			const config = createConfig({ weightRange: { min: 1, max: 10 } });
			const rng = new SeededRandom(42);

			addWeights(edges, config, rng);

			expect(edges.length).toBe(0);
		});

		it("should respect custom weight range", () => {
			const edges: TestEdge[] = [
				{ source: "A", target: "B" },
				{ source: "B", target: "C" },
			];
			const config = createConfig({ weightRange: { min: 50, max: 60 } });
			const rng = new SeededRandom(42);

			addWeights(edges, config, rng);

			for (const edge of edges) {
				expect(edge.weight).toBeGreaterThanOrEqual(50);
				expect(edge.weight).toBeLessThanOrEqual(60);
			}
		});
	});

	describe("detectCycleInGraph", () => {
		it("should detect cycle in cyclic graph", () => {
			const nodes = createNodes(4);
			const edges = createEdges([[0, 1], [1, 2], [2, 3], [3, 0]]);

			const hasCycle = detectCycleInGraph(nodes, edges, false);

			expect(hasCycle).toBe(true);
		});

		it("should not detect cycle in acyclic graph", () => {
			const nodes = createNodes(4);
			const edges = createEdges([[0, 1], [1, 2], [2, 3]]);

			const hasCycle = detectCycleInGraph(nodes, edges, true);

			expect(hasCycle).toBe(false);
		});

		it("should detect cycle in directed graph", () => {
			const nodes = createNodes(3);
			const edges = createEdges([[0, 1], [1, 2], [2, 0]]);

			const hasCycle = detectCycleInGraph(nodes, edges, true);

			expect(hasCycle).toBe(true);
		});

		it("should handle empty graph", () => {
			const nodes: TestNode[] = [];
			const edges: TestEdge[] = [];

			const hasCycle = detectCycleInGraph(nodes, edges, false);

			expect(hasCycle).toBe(false);
		});

		it("should handle single node", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];

			const hasCycle = detectCycleInGraph(nodes, edges, false);

			expect(hasCycle).toBe(false);
		});

		it("should handle disconnected components", () => {
			const nodes = createNodes(6);
			// Two separate cycles: 0-1-2-0 and 3-4-5-3
			const edges = createEdges([[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3]]);

			const hasCycle = detectCycleInGraph(nodes, edges, false);

			expect(hasCycle).toBe(true);
		});
	});

	describe("findComponents", () => {
		it("should find single component in connected graph", () => {
			const nodes = createNodes(4);
			const edges = createEdges([[0, 1], [1, 2], [2, 3]]);

			const components = findComponents(nodes, edges, false);

			expect(components.length).toBe(1);
			expect(components[0].length).toBe(4);
		});

		it("should find multiple components in disconnected graph", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [2, 3], [4, 5]]);

			const components = findComponents(nodes, edges, false);

			expect(components.length).toBe(3);
		});

		it("should handle isolated nodes", () => {
			const nodes = createNodes(5);
			const edges = createEdges([[0, 1]]); // Only 0-1 connected

			const components = findComponents(nodes, edges, false);

			expect(components.length).toBe(4); // {0,1}, {2}, {3}, {4}
		});

		it("should handle empty graph", () => {
			const nodes: TestNode[] = [];
			const edges: TestEdge[] = [];

			const components = findComponents(nodes, edges, false);

			expect(components.length).toBe(0);
		});

		it("should handle directed graph", () => {
			const nodes = createNodes(4);
			const edges = createEdges([[0, 1], [2, 3]]); // Directed: 0->1, 2->3

			const components = findComponents(nodes, edges, true);

			// In directed mode, forward edges connect nodes into weakly connected components
			// 0->1 forms one component, 2->3 forms another
			expect(components.length).toBe(2);
		});
	});

	describe("addEdge", () => {
		it("should add basic edge", () => {
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			addEdge(edges, "A", "B", spec, rng);

			expect(edges.length).toBe(1);
			expect(edges[0].source).toBe("A");
			expect(edges[0].target).toBe("B");
		});

		it("should add edge type for heterogeneous schema", () => {
			const edges: TestEdge[] = [];
			const spec = createSpec({ schema: { kind: "heterogeneous" } });
			const rng = new SeededRandom(42);

			addEdge(edges, "A", "B", spec, rng);

			expect(edges[0].type).toBeDefined();
			expect(["type_a", "type_b", "type_c"]).toContain(edges[0].type);
		});

		it("should not add type for homogeneous schema", () => {
			const edges: TestEdge[] = [];
			const spec = createSpec({ schema: { kind: "homogeneous" } });
			const rng = new SeededRandom(42);

			addEdge(edges, "A", "B", spec, rng);

			expect(edges[0].type).toBeUndefined();
		});

		it("should accumulate multiple edges", () => {
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			addEdge(edges, "A", "B", spec, rng);
			addEdge(edges, "B", "C", spec, rng);
			addEdge(edges, "C", "D", spec, rng);

			expect(edges.length).toBe(3);
		});
	});

	describe("shuffleArray", () => {
		it("should shuffle array in place", () => {
			const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const original = [...array];
			const rng = new SeededRandom(42);

			shuffleArray(array, rng);

			// Should be same length
			expect(array.length).toBe(original.length);
			// Should contain same elements
			const sortedArray = [...array].sort((a, b) => a - b);
			expect(sortedArray).toEqual(original);
		});

		it("should be deterministic with same seed", () => {
			const array1 = [1, 2, 3, 4, 5];
			const array2 = [1, 2, 3, 4, 5];

			shuffleArray(array1, new SeededRandom(42));
			shuffleArray(array2, new SeededRandom(42));

			expect(array1).toEqual(array2);
		});

		it("should produce different results with different seeds", () => {
			const array1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const array2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

			shuffleArray(array1, new SeededRandom(42));
			shuffleArray(array2, new SeededRandom(999));

			// Very unlikely to be equal after shuffle with different seeds
			expect(array1).not.toEqual(array2);
		});

		it("should handle empty array", () => {
			const array: number[] = [];
			const rng = new SeededRandom(42);

			shuffleArray(array, rng);

			expect(array.length).toBe(0);
		});

		it("should handle single element array", () => {
			const array = [1];
			const rng = new SeededRandom(42);

			shuffleArray(array, rng);

			expect(array).toEqual([1]);
		});
	});

	describe("hasEdge", () => {
		it("should return true for existing edge (forward)", () => {
			const edges: TestEdge[] = [
				{ source: "A", target: "B" },
			];

			expect(hasEdge(edges, "A", "B")).toBe(true);
		});

		it("should return true for existing edge (reverse)", () => {
			const edges: TestEdge[] = [
				{ source: "A", target: "B" },
			];

			expect(hasEdge(edges, "B", "A")).toBe(true);
		});

		it("should return false for non-existing edge", () => {
			const edges: TestEdge[] = [
				{ source: "A", target: "B" },
			];

			expect(hasEdge(edges, "A", "C")).toBe(false);
		});

		it("should return false for empty edge list", () => {
			const edges: TestEdge[] = [];

			expect(hasEdge(edges, "A", "B")).toBe(false);
		});

		it("should handle multiple edges", () => {
			const edges: TestEdge[] = [
				{ source: "A", target: "B" },
				{ source: "C", target: "D" },
				{ source: "E", target: "F" },
			];

			expect(hasEdge(edges, "C", "D")).toBe(true);
			expect(hasEdge(edges, "D", "C")).toBe(true);
			expect(hasEdge(edges, "A", "D")).toBe(false);
			expect(hasEdge(edges, "E", "F")).toBe(true);
			expect(hasEdge(edges, "A", "F")).toBe(false);
		});

		it("should handle self-loops", () => {
			const edges: TestEdge[] = [
				{ source: "A", target: "A" },
			];

			expect(hasEdge(edges, "A", "A")).toBe(true);
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical weights with same seed", () => {
			const edges1: TestEdge[] = [{ source: "A", target: "B" }];
			const edges2: TestEdge[] = [{ source: "A", target: "B" }];
			const config = createConfig({ weightRange: { min: 1, max: 100 } });

			addWeights(edges1, config, new SeededRandom(42));
			addWeights(edges2, config, new SeededRandom(42));

			expect(edges1[0].weight).toBe(edges2[0].weight);
		});
	});
});

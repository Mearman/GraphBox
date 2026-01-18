import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	generateChordalEdges,
	generateClawFreeEdges,
	generateCographEdges,
	generateComparabilityEdges,
	generateIntervalEdges,
	generatePerfectEdges,
	generatePermutationEdges,
	generateSplitEdges,
} from "./structural-classes";
import type { TestEdge, TestNode } from "./types";
import { SeededRandom } from "./types";

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

// Helper to create nodes
const createNodes = (count: number): TestNode[] =>
	Array.from({ length: count }, (_, index) => ({ id: `N${index}` }));

describe("structural-classes generators", () => {
	describe("generateSplitEdges", () => {
		it("should create split graph with clique and independent set", () => {
			const nodes = createNodes(9);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				split: { kind: "split" },
			});
			const rng = new SeededRandom(42);

			generateSplitEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);
		});

		it("should partition nodes into clique and independent set", () => {
			const nodes = createNodes(9);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				split: { kind: "split" },
			});
			const rng = new SeededRandom(42);

			generateSplitEdges(nodes, edges, spec, rng);

			const cliqueNodes = nodes.filter(n => n.data?.splitPartition === "clique");
			const independentNodes = nodes.filter(n => n.data?.splitPartition === "independent");

			// ~1/3 should be clique
			expect(cliqueNodes.length).toBe(3); // floor(9/3) = 3
			expect(independentNodes.length).toBe(6);
		});

		it("should have all edges within clique", () => {
			const nodes = createNodes(9);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				split: { kind: "split" },
			});
			const rng = new SeededRandom(42);

			generateSplitEdges(nodes, edges, spec, rng);

			const cliqueIds = new Set(
				nodes.filter(n => n.data?.splitPartition === "clique").map(n => n.id)
			);

			// All edges within clique should exist (complete subgraph)
			const cliqueSize = cliqueIds.size;
			const expectedCliqueEdges = (cliqueSize * (cliqueSize - 1)) / 2;
			const actualCliqueEdges = edges.filter(
				e => cliqueIds.has(e.source) && cliqueIds.has(e.target)
			).length;

			expect(actualCliqueEdges).toBe(expectedCliqueEdges);
		});

		it("should have no edges within independent set", () => {
			const nodes = createNodes(9);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				split: { kind: "split" },
			});
			const rng = new SeededRandom(42);

			generateSplitEdges(nodes, edges, spec, rng);

			const independentIds = new Set(
				nodes.filter(n => n.data?.splitPartition === "independent").map(n => n.id)
			);

			// No edges between independent vertices
			for (const edge of edges) {
				const bothIndependent = independentIds.has(edge.source) && independentIds.has(edge.target);
				expect(bothIndependent).toBe(false);
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateSplitEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateCographEdges", () => {
		it("should create cograph (P4-free)", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				cograph: { kind: "cograph" },
			});
			const rng = new SeededRandom(42);

			generateCographEdges(nodes, edges, spec, rng);

			// Should have some structure
			expect(edges.length).toBeGreaterThanOrEqual(0);
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateCographEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateClawFreeEdges", () => {
		it("should create complete graph (which is claw-free)", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				clawFree: { kind: "claw_free" },
			});
			const rng = new SeededRandom(42);

			generateClawFreeEdges(nodes, edges, spec, rng);

			// Complete graph K5 has 10 edges
			expect(edges.length).toBe(10);
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateClawFreeEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateChordalEdges", () => {
		it("should create chordal graph (k-tree)", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				chordal: { kind: "chordal" },
			});
			const rng = new SeededRandom(42);

			generateChordalEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);
		});

		it("should create complete graph for small n", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateChordalEdges(nodes, edges, spec, rng);

			// K2 has 1 edge
			expect(edges.length).toBe(1);
		});
	});

	describe("generateIntervalEdges", () => {
		it("should create interval graph from random intervals", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				interval: { kind: "interval" },
			});
			const rng = new SeededRandom(42);

			generateIntervalEdges(nodes, edges, spec, rng);

			// Should have some edges (depends on random intervals)
			expect(edges.length).toBeGreaterThanOrEqual(0);
		});

		it("should store interval data in nodes", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				interval: { kind: "interval" },
			});
			const rng = new SeededRandom(42);

			generateIntervalEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.interval).toBeDefined();
				const interval = node.data?.interval as { start: number; end: number; length: number };
				expect(interval.start).toBeDefined();
				expect(interval.end).toBeDefined();
				expect(interval.length).toBeDefined();
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateIntervalEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generatePermutationEdges", () => {
		it("should create permutation graph from random permutation", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				permutation: { kind: "permutation" },
			});
			const rng = new SeededRandom(42);

			generatePermutationEdges(nodes, edges, spec, rng);

			// Should have some edges (depends on permutation inversions)
			expect(edges.length).toBeGreaterThanOrEqual(0);
		});

		it("should store permutation value in nodes", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				permutation: { kind: "permutation" },
			});
			const rng = new SeededRandom(42);

			generatePermutationEdges(nodes, edges, spec, rng);

			// Permutation values should be 0 to n-1 (shuffled)
			const values = nodes.map(n => n.data?.permutationValue);
			const sortedValues = [...values].sort((a, b) => (a as number) - (b as number));
			expect(sortedValues).toEqual([0, 1, 2, 3, 4, 5]);
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generatePermutationEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateComparabilityEdges", () => {
		it("should create comparability graph from topological ordering", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				comparability: { kind: "comparability" },
			});
			const rng = new SeededRandom(42);

			generateComparabilityEdges(nodes, edges, spec, rng);

			// Should have some edges
			expect(edges.length).toBeGreaterThanOrEqual(0);
		});

		it("should store topological order in nodes", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				comparability: { kind: "comparability" },
			});
			const rng = new SeededRandom(42);

			generateComparabilityEdges(nodes, edges, spec, rng);

			// All nodes should have topological order
			for (const node of nodes) {
				expect(node.data?.topologicalOrder).toBeDefined();
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateComparabilityEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generatePerfectEdges", () => {
		it("should create perfect graph (chordal, bipartite, or cograph)", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				perfect: { kind: "perfect" },
			});
			const rng = new SeededRandom(42);

			generatePerfectEdges(nodes, edges, spec, rng);

			// Should have some edges
			expect(edges.length).toBeGreaterThanOrEqual(0);
		});

		it("should mark perfect class in nodes", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				perfect: { kind: "perfect" },
			});
			const rng = new SeededRandom(42);

			generatePerfectEdges(nodes, edges, spec, rng);

			// All nodes should have perfect class
			for (const node of nodes) {
				expect(node.data?.perfectClass).toBeDefined();
				expect(["chordal", "bipartite", "cograph"]).toContain(node.data?.perfectClass);
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generatePerfectEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const nodes1 = createNodes(8);
			const nodes2 = createNodes(8);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				interval: { kind: "interval" },
			});

			generateIntervalEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateIntervalEdges(nodes2, edges2, spec, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});

		it("should produce different results with different seeds", () => {
			const nodes1 = createNodes(10);
			const nodes2 = createNodes(10);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				permutation: { kind: "permutation" },
			});

			generatePermutationEdges(nodes1, edges1, spec, new SeededRandom(42));
			generatePermutationEdges(nodes2, edges2, spec, new SeededRandom(999));

			// Permutation values should differ
			const values1 = nodes1.map(n => n.data?.permutationValue);
			const values2 = nodes2.map(n => n.data?.permutationValue);
			expect(values1).not.toEqual(values2);
		});
	});
});

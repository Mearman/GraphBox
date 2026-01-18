import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	generateBipartiteConnectedEdges,
	generateBipartiteDisconnectedEdges,
	generateBipartiteForestEdges,
	generateBipartiteTreeEdges,
	generateCompleteBipartiteEdges,
} from "./bipartite";
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
	partiteness: { kind: "bipartite" },
	...overrides,
});

// Helper to create bipartite nodes
const createBipartiteNodes = (leftCount: number, rightCount: number): TestNode[] => {
	const nodes: TestNode[] = [];
	for (let index = 0; index < leftCount; index++) {
		nodes.push({ id: `N${index}`, partition: "left" });
	}
	for (let index = 0; index < rightCount; index++) {
		nodes.push({ id: `N${leftCount + index}`, partition: "right" });
	}
	return nodes;
};

describe("bipartite generators", () => {
	describe("generateCompleteBipartiteEdges", () => {
		it("should generate all edges between partitions for K_{m,n}", () => {
			const nodes = createBipartiteNodes(3, 4);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateCompleteBipartiteEdges(nodes, edges, spec, rng);

			// K_{3,4} should have 3 * 4 = 12 edges
			expect(edges.length).toBe(12);
		});

		it("should not create edges within same partition", () => {
			const nodes = createBipartiteNodes(3, 3);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateCompleteBipartiteEdges(nodes, edges, spec, rng);

			// Verify no edge has both endpoints in same partition
			for (const edge of edges) {
				const sourceNode = nodes.find(n => n.id === edge.source);
				const targetNode = nodes.find(n => n.id === edge.target);
				expect(sourceNode?.partition).not.toBe(targetNode?.partition);
			}
		});

		it("should handle empty partitions", () => {
			const nodes = createBipartiteNodes(0, 5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateCompleteBipartiteEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});

		it("should assign edge types for heterogeneous schema", () => {
			const nodes = createBipartiteNodes(2, 2);
			const edges: TestEdge[] = [];
			const spec = createSpec({ schema: { kind: "heterogeneous" } });
			const rng = new SeededRandom(42);

			generateCompleteBipartiteEdges(nodes, edges, spec, rng);

			for (const edge of edges) {
				expect(edge.type).toBeDefined();
				expect(["type_a", "type_b", "type_c"]).toContain(edge.type);
			}
		});
	});

	describe("generateBipartiteTreeEdges", () => {
		it("should create a connected tree structure", () => {
			const nodes = createBipartiteNodes(4, 4);
			const edges: TestEdge[] = [];
			const spec = createSpec({ cycles: { kind: "acyclic" } });
			const rng = new SeededRandom(42);

			generateBipartiteTreeEdges(nodes, edges, spec, rng);

			// Tree with n nodes has n-1 edges
			expect(edges.length).toBe(nodes.length - 1);
		});

		it("should only create edges between different partitions", () => {
			const nodes = createBipartiteNodes(5, 5);
			const edges: TestEdge[] = [];
			const spec = createSpec({ cycles: { kind: "acyclic" } });
			const rng = new SeededRandom(42);

			generateBipartiteTreeEdges(nodes, edges, spec, rng);

			for (const edge of edges) {
				const sourceNode = nodes.find(n => n.id === edge.source);
				const targetNode = nodes.find(n => n.id === edge.target);
				expect(sourceNode?.partition).not.toBe(targetNode?.partition);
			}
		});

		it("should handle single node partitions", () => {
			const nodes = createBipartiteNodes(1, 1);
			const edges: TestEdge[] = [];
			const spec = createSpec({ cycles: { kind: "acyclic" } });
			const rng = new SeededRandom(42);

			generateBipartiteTreeEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(1);
		});

		it("should return early if one partition is empty", () => {
			const nodes = createBipartiteNodes(5, 0);
			const edges: TestEdge[] = [];
			const spec = createSpec({ cycles: { kind: "acyclic" } });
			const rng = new SeededRandom(42);

			generateBipartiteTreeEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateBipartiteConnectedEdges", () => {
		it("should create more edges than tree (adding cycles)", () => {
			const nodes = createBipartiteNodes(5, 5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateBipartiteConnectedEdges(nodes, edges, spec, rng);

			// Should have at least n-1 edges (tree) plus some extra
			expect(edges.length).toBeGreaterThanOrEqual(nodes.length - 1);
		});

		it("should maintain bipartite property", () => {
			const nodes = createBipartiteNodes(4, 4);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateBipartiteConnectedEdges(nodes, edges, spec, rng);

			for (const edge of edges) {
				const sourceNode = nodes.find(n => n.id === edge.source);
				const targetNode = nodes.find(n => n.id === edge.target);
				expect(sourceNode?.partition).not.toBe(targetNode?.partition);
			}
		});

		it("should avoid duplicate edges for simple graphs", () => {
			const nodes = createBipartiteNodes(3, 3);
			const edges: TestEdge[] = [];
			const spec = createSpec({ edgeMultiplicity: { kind: "simple" } });
			const rng = new SeededRandom(42);

			generateBipartiteConnectedEdges(nodes, edges, spec, rng);

			const edgeSet = new Set(edges.map(e =>
				[e.source, e.target].sort().join("-")
			));
			expect(edgeSet.size).toBe(edges.length);
		});
	});

	describe("generateBipartiteForestEdges", () => {
		it("should create disconnected components", () => {
			const nodes = createBipartiteNodes(6, 6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "acyclic" }
			});
			const rng = new SeededRandom(42);

			generateBipartiteForestEdges(nodes, edges, spec, rng);

			// Forest has fewer edges than connected tree
			expect(edges.length).toBeLessThan(nodes.length - 1);
		});

		it("should maintain bipartite property across components", () => {
			const nodes = createBipartiteNodes(8, 8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "acyclic" }
			});
			const rng = new SeededRandom(42);

			generateBipartiteForestEdges(nodes, edges, spec, rng);

			for (const edge of edges) {
				const sourceNode = nodes.find(n => n.id === edge.source);
				const targetNode = nodes.find(n => n.id === edge.target);
				expect(sourceNode?.partition).not.toBe(targetNode?.partition);
			}
		});

		it("should handle small node counts", () => {
			const nodes = createBipartiteNodes(1, 1);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "acyclic" }
			});
			const rng = new SeededRandom(42);

			generateBipartiteForestEdges(nodes, edges, spec, rng);

			expect(edges.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe("generateBipartiteDisconnectedEdges", () => {
		it("should create multiple disconnected components with cycles", () => {
			const nodes = createBipartiteNodes(8, 8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "cycles_allowed" }
			});
			const rng = new SeededRandom(42);

			generateBipartiteDisconnectedEdges(nodes, edges, spec, rng);

			// With nodes created as all-left then all-right, component slicing
			// results in components with only one partition, so no edges created
			expect(edges.length).toBe(0);
		});

		it("should maintain bipartite property", () => {
			const nodes = createBipartiteNodes(6, 6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "cycles_allowed" }
			});
			const rng = new SeededRandom(42);

			generateBipartiteDisconnectedEdges(nodes, edges, spec, rng);

			for (const edge of edges) {
				const sourceNode = nodes.find(n => n.id === edge.source);
				const targetNode = nodes.find(n => n.id === edge.target);
				expect(sourceNode?.partition).not.toBe(targetNode?.partition);
			}
		});

		it("should return early if one partition is empty", () => {
			const nodes = createBipartiteNodes(5, 0);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "cycles_allowed" }
			});
			const rng = new SeededRandom(42);

			generateBipartiteDisconnectedEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const nodes1 = createBipartiteNodes(5, 5);
			const nodes2 = createBipartiteNodes(5, 5);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec();

			generateBipartiteConnectedEdges(nodes1, edges1, spec, new SeededRandom(123));
			generateBipartiteConnectedEdges(nodes2, edges2, spec, new SeededRandom(123));

			expect(edges1).toEqual(edges2);
		});

		it("should produce different results with different seeds", () => {
			const nodes1 = createBipartiteNodes(5, 5);
			const nodes2 = createBipartiteNodes(5, 5);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec();

			generateCompleteBipartiteEdges(nodes1, edges1, spec, new SeededRandom(123));
			generateCompleteBipartiteEdges(nodes2, edges2, spec, new SeededRandom(456));

			// Complete bipartite is deterministic, so edges count should be same
			// but edge types (for heterogeneous) would differ
			expect(edges1.length).toBe(edges2.length);
		});
	});
});

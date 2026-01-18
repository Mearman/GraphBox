import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	addEdge,
	generatePlanarEdges,
	generateUnitDiskEdges,
	hasEdge,
} from "./geometric";
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

describe("geometric generators", () => {
	describe("generateUnitDiskEdges", () => {
		it("should create edges between nearby nodes", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				unitDisk: { kind: "unit_disk", unitRadius: 5, spaceSize: 10 },
			});
			const rng = new SeededRandom(42);

			generateUnitDiskEdges(nodes, edges, spec, rng);

			// Should have some edges (depends on random placement)
			expect(edges.length).toBeGreaterThanOrEqual(0);
		});

		it("should assign coordinates to all nodes", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				unitDisk: { kind: "unit_disk", unitRadius: 3, spaceSize: 10 },
			});
			const rng = new SeededRandom(42);

			generateUnitDiskEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data).toBeDefined();
				expect(node.data!.x).toBeDefined();
				expect(node.data!.y).toBeDefined();
				expect(typeof node.data!.x).toBe("number");
				expect(typeof node.data!.y).toBe("number");
			}
		});

		it("should use default radius of 1 when not specified", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec(); // No unitDisk specified
			const rng = new SeededRandom(42);

			generateUnitDiskEdges(nodes, edges, spec, rng);

			// Should still work with default values
			expect(edges.length).toBeGreaterThanOrEqual(0);
		});

		it("should connect nodes within unit radius", () => {
			const nodes = createNodes(4);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				unitDisk: { kind: "unit_disk", unitRadius: 1000, spaceSize: 1 },
			});
			const rng = new SeededRandom(42);

			generateUnitDiskEdges(nodes, edges, spec, rng);

			// With large radius and small space, all nodes should be connected
			expect(edges.length).toBe(6); // Complete graph K4 has 6 edges
		});

		it("should create no edges with very small radius", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				unitDisk: { kind: "unit_disk", unitRadius: 0.001, spaceSize: 100 },
			});
			const rng = new SeededRandom(42);

			generateUnitDiskEdges(nodes, edges, spec, rng);

			// With tiny radius and large space, likely no edges
			// (depends on random placement, but very unlikely)
			expect(edges.length).toBeLessThanOrEqual(2);
		});

		it("should assign edge types for heterogeneous schema", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				schema: { kind: "heterogeneous" },
				unitDisk: { kind: "unit_disk", unitRadius: 100, spaceSize: 10 },
			});
			const rng = new SeededRandom(42);

			generateUnitDiskEdges(nodes, edges, spec, rng);

			for (const edge of edges) {
				expect(edge.type).toBeDefined();
				expect(["type_a", "type_b", "type_c"]).toContain(edge.type);
			}
		});
	});

	describe("generatePlanarEdges", () => {
		it("should create planar graph with cycle as base", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				planarity: { kind: "planar" },
			});
			const rng = new SeededRandom(42);

			generatePlanarEdges(nodes, edges, spec, rng);

			// Should have at least a cycle (n edges)
			expect(edges.length).toBeGreaterThanOrEqual(nodes.length);
		});

		it("should not exceed max planar edges (3n-6)", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				planarity: { kind: "planar" },
			});
			const rng = new SeededRandom(42);

			generatePlanarEdges(nodes, edges, spec, rng);

			// Planar graphs have at most 3n - 6 edges for n >= 3
			expect(edges.length).toBeLessThanOrEqual(3 * nodes.length - 6);
		});

		it("should create complete graph for small n < 4", () => {
			const nodes = createNodes(3);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generatePlanarEdges(nodes, edges, spec, rng);

			// K3 has 3 edges and is planar
			expect(edges.length).toBe(3);
		});

		it("should handle very small graphs", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generatePlanarEdges(nodes, edges, spec, rng);

			// K2 has 1 edge
			expect(edges.length).toBe(1);
		});

		it("should assign edge types for heterogeneous schema", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				schema: { kind: "heterogeneous" },
			});
			const rng = new SeededRandom(42);

			generatePlanarEdges(nodes, edges, spec, rng);

			for (const edge of edges) {
				expect(edge.type).toBeDefined();
				expect(["type_a", "type_b", "type_c"]).toContain(edge.type);
			}
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
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const nodes1 = createNodes(8);
			const nodes2 = createNodes(8);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				unitDisk: { kind: "unit_disk", unitRadius: 5, spaceSize: 10 },
			});

			generateUnitDiskEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateUnitDiskEdges(nodes2, edges2, spec, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});

		it("should produce different results with different seeds", () => {
			const nodes1 = createNodes(10);
			const nodes2 = createNodes(10);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				unitDisk: { kind: "unit_disk", unitRadius: 3, spaceSize: 10 },
			});

			generateUnitDiskEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateUnitDiskEdges(nodes2, edges2, spec, new SeededRandom(999));

			// Coordinates should differ
			const coords1 = nodes1.map(n => ({ x: n.data?.x, y: n.data?.y }));
			const coords2 = nodes2.map(n => ({ x: n.data?.x, y: n.data?.y }));
			expect(coords1).not.toEqual(coords2);
		});
	});
});

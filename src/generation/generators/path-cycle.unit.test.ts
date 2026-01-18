import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	generateCircumferenceEdges,
	generateDiameterEdges,
	generateGirthEdges,
	generateHamiltonianEdges,
	generateRadiusEdges,
	generateTraceableEdges,
} from "./path-cycle";
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

describe("path-cycle generators", () => {
	describe("generateHamiltonianEdges", () => {
		it("should create Hamiltonian cycle through all vertices", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				hamiltonian: { kind: "hamiltonian" },
			});
			const rng = new SeededRandom(42);

			generateHamiltonianEdges(nodes, edges, spec, rng);

			// Should have at least n edges for the cycle
			expect(edges.length).toBeGreaterThanOrEqual(nodes.length);
		});

		it("should store Hamiltonian cycle in node data", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				hamiltonian: { kind: "hamiltonian" },
			});
			const rng = new SeededRandom(42);

			generateHamiltonianEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.hamiltonianPosition).toBeDefined();
				expect(node.data?.hamiltonianCycle).toBeDefined();
				expect(node.data?.hamiltonianCycle).toHaveLength(nodes.length);
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateHamiltonianEdges(nodes, edges, spec, rng);

			// Small graphs return early
			expect(edges.length).toBe(0);
		});

		it("should add extra edges (chords)", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateHamiltonianEdges(nodes, edges, spec, rng);

			// Should have cycle (n) + extra edges
			expect(edges.length).toBeGreaterThan(nodes.length);
		});
	});

	describe("generateTraceableEdges", () => {
		it("should create Hamiltonian path (not cycle)", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				traceable: { kind: "traceable" },
			});
			const rng = new SeededRandom(42);

			generateTraceableEdges(nodes, edges, spec, rng);

			// Should have at least n-1 edges for the path
			expect(edges.length).toBeGreaterThanOrEqual(nodes.length - 1);
		});

		it("should store traceable path in node data", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				traceable: { kind: "traceable" },
			});
			const rng = new SeededRandom(42);

			generateTraceableEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.traceablePosition).toBeDefined();
				expect(node.data?.traceablePath).toBeDefined();
				expect(node.data?.traceablePath).toHaveLength(nodes.length);
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateTraceableEdges(nodes, edges, spec, rng);

			// Small graphs return early
			expect(edges.length).toBe(0);
		});
	});

	describe("generateDiameterEdges", () => {
		it("should create complete graph for diameter 1", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				diameter: { kind: "diameter", value: 1 },
			});
			const rng = new SeededRandom(42);

			generateDiameterEdges(nodes, edges, spec, rng);

			// Complete graph K5 has 10 edges
			expect(edges.length).toBe(10);
		});

		it("should create path for diameter n-1", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				diameter: { kind: "diameter", value: 4 },
			});
			const rng = new SeededRandom(42);

			generateDiameterEdges(nodes, edges, spec, rng);

			// Path P5 has 4 edges
			expect(edges.length).toBe(4);
		});

		it("should store target diameter in node data", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				diameter: { kind: "diameter", value: 3 },
			});
			const rng = new SeededRandom(42);

			generateDiameterEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetDiameter).toBe(3);
			}
		});

		it("should throw if diameter spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateDiameterEdges(nodes, edges, spec, rng);
			}).toThrow("Diameter graph requires diameter spec");
		});

		it("should add shortcut edges for intermediate diameters", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				diameter: { kind: "diameter", value: 5 },
			});
			const rng = new SeededRandom(42);

			generateDiameterEdges(nodes, edges, spec, rng);

			// Should have more than path (9 edges) due to shortcuts
			expect(edges.length).toBeGreaterThanOrEqual(9);
		});
	});

	describe("generateRadiusEdges", () => {
		it("should create star for radius 1", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				radius: { kind: "radius", value: 1 },
			});
			const rng = new SeededRandom(42);

			generateRadiusEdges(nodes, edges, spec, rng);

			// Star has n-1 edges
			expect(edges.length).toBe(5);
		});

		it("should create path-based structure for larger radius", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				radius: { kind: "radius", value: 3 },
			});
			const rng = new SeededRandom(42);

			generateRadiusEdges(nodes, edges, spec, rng);

			// Should have path edges (n-1) possibly with shortcuts
			expect(edges.length).toBeGreaterThanOrEqual(7);
		});

		it("should store target radius in node data", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				radius: { kind: "radius", value: 2 },
			});
			const rng = new SeededRandom(42);

			generateRadiusEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetRadius).toBe(2);
			}
		});

		it("should throw if radius spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateRadiusEdges(nodes, edges, spec, rng);
			}).toThrow("Radius graph requires radius spec");
		});
	});

	describe("generateGirthEdges", () => {
		it("should create cycle of specified girth", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				girth: { kind: "girth", girth: 4 },
			});
			const rng = new SeededRandom(42);

			generateGirthEdges(nodes, edges, spec, rng);

			// Should have at least girth edges for the cycle
			expect(edges.length).toBeGreaterThanOrEqual(4);
		});

		it("should attach remaining nodes as tree branches", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				girth: { kind: "girth", girth: 5 },
			});
			const rng = new SeededRandom(42);

			generateGirthEdges(nodes, edges, spec, rng);

			// Cycle (5) + tree branches (5)
			expect(edges.length).toBe(10);
		});

		it("should store target girth in node data", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				girth: { kind: "girth", girth: 3 },
			});
			const rng = new SeededRandom(42);

			generateGirthEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetGirth).toBe(3);
			}
		});

		it("should throw if girth spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateGirthEdges(nodes, edges, spec, rng);
			}).toThrow("Girth graph requires girth spec");
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				girth: { kind: "girth", girth: 3 },
			});
			const rng = new SeededRandom(42);

			generateGirthEdges(nodes, edges, spec, rng);

			// Small graphs return early
			expect(edges.length).toBe(0);
		});
	});

	describe("generateCircumferenceEdges", () => {
		it("should create cycle of specified circumference", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				circumference: { kind: "circumference", value: 6 },
			});
			const rng = new SeededRandom(42);

			generateCircumferenceEdges(nodes, edges, spec, rng);

			// Should have at least circumference edges for the cycle
			expect(edges.length).toBeGreaterThanOrEqual(6);
		});

		it("should store target circumference in node data", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				circumference: { kind: "circumference", value: 4 },
			});
			const rng = new SeededRandom(42);

			generateCircumferenceEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetCircumference).toBe(4);
			}
		});

		it("should throw if circumference spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateCircumferenceEdges(nodes, edges, spec, rng);
			}).toThrow("Circumference graph requires circumference spec");
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				circumference: { kind: "circumference", value: 5 },
			});
			const rng = new SeededRandom(42);

			generateCircumferenceEdges(nodes, edges, spec, rng);

			// Small graphs return early
			expect(edges.length).toBe(0);
		});

		it("should add chords for larger cycles", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				circumference: { kind: "circumference", value: 8 },
			});
			const rng = new SeededRandom(42);

			generateCircumferenceEdges(nodes, edges, spec, rng);

			// Cycle (8) + tree branches (2) + chords
			expect(edges.length).toBeGreaterThanOrEqual(10);
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const nodes1 = createNodes(8);
			const nodes2 = createNodes(8);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				hamiltonian: { kind: "hamiltonian" },
			});

			generateHamiltonianEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateHamiltonianEdges(nodes2, edges2, spec, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});
	});
});

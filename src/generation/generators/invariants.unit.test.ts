import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	generateDominationNumberEdges,
	generateHereditaryClassEdges,
	generateIndependenceNumberEdges,
	generateVertexCoverEdges,
} from "./invariants";
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

describe("invariants generators", () => {
	describe("generateHereditaryClassEdges", () => {
		it("should create graph with forbidden subgraph metadata", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				hereditaryClass: { kind: "hereditary_class", forbidden: ["K4", "C5"] },
				density: { kind: "moderate" },
			});
			const rng = new SeededRandom(42);

			generateHereditaryClassEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);

			// Should store metadata
			for (const node of nodes) {
				expect(node.data?.forbiddenSubgraphs).toEqual(["K4", "C5"]);
				expect(node.data?.hereditaryClass).toBe(true);
			}
		});

		it("should throw if hereditary_class spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec(); // No hereditaryClass
			const rng = new SeededRandom(42);

			expect(() => {
				generateHereditaryClassEdges(nodes, edges, spec, rng);
			}).toThrow("Hereditary class graph requires hereditary_class spec");
		});

		it("should respect density specification", () => {
			const nodes = createNodes(10);
			const sparseEdges: TestEdge[] = [];
			const denseEdges: TestEdge[] = [];
			const sparseSpec = createSpec({
				hereditaryClass: { kind: "hereditary_class", forbidden: ["K5"] },
				density: { kind: "sparse" },
			});
			const denseSpec = createSpec({
				hereditaryClass: { kind: "hereditary_class", forbidden: ["K5"] },
				density: { kind: "dense" },
			});

			generateHereditaryClassEdges([...nodes], sparseEdges, sparseSpec, new SeededRandom(42));
			generateHereditaryClassEdges([...nodes], denseEdges, denseSpec, new SeededRandom(42));

			expect(denseEdges.length).toBeGreaterThan(sparseEdges.length);
		});
	});

	describe("generateIndependenceNumberEdges", () => {
		it("should create graph with specified independence number", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				independenceNumber: { kind: "independence_number", value: 3 },
			});
			const rng = new SeededRandom(42);

			generateIndependenceNumberEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);

			// Should store target independence number
			for (const node of nodes) {
				expect(node.data?.targetIndependenceNumber).toBe(3);
			}
		});

		it("should mark independent set vertices", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				independenceNumber: { kind: "independence_number", value: 2 },
			});
			const rng = new SeededRandom(42);

			generateIndependenceNumberEdges(nodes, edges, spec, rng);

			// Exactly 2 nodes should be in independent set
			const independentCount = nodes.filter(n => n.data?.independentSet === true).length;
			expect(independentCount).toBe(2);
		});

		it("should not create edges within independent set", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				independenceNumber: { kind: "independence_number", value: 3 },
			});
			const rng = new SeededRandom(42);

			generateIndependenceNumberEdges(nodes, edges, spec, rng);

			// Get independent set node IDs
			const independentIds = new Set(
				nodes.filter(n => n.data?.independentSet).map(n => n.id)
			);

			// No edge should connect two independent nodes
			for (const edge of edges) {
				const bothIndependent = independentIds.has(edge.source) && independentIds.has(edge.target);
				expect(bothIndependent).toBe(false);
			}
		});

		it("should throw if independence number exceeds node count", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				independenceNumber: { kind: "independence_number", value: 10 },
			});
			const rng = new SeededRandom(42);

			expect(() => {
				generateIndependenceNumberEdges(nodes, edges, spec, rng);
			}).toThrow("Independence number 10 cannot exceed node count 5");
		});

		it("should throw if independence_number spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateIndependenceNumberEdges(nodes, edges, spec, rng);
			}).toThrow("Independence number graph requires independence_number spec");
		});
	});

	describe("generateVertexCoverEdges", () => {
		it("should create graph with specified vertex cover number", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				vertexCover: { kind: "vertex_cover", value: 5 },
			});
			const rng = new SeededRandom(42);

			generateVertexCoverEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);

			// Should store target vertex cover
			for (const node of nodes) {
				expect(node.data?.targetVertexCover).toBe(5);
			}
		});

		it("should mark vertex cover vertices", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				vertexCover: { kind: "vertex_cover", value: 4 },
			});
			const rng = new SeededRandom(42);

			generateVertexCoverEdges(nodes, edges, spec, rng);

			// Exactly 4 nodes should be in vertex cover
			const coverCount = nodes.filter(n => n.data?.vertexCover === true).length;
			expect(coverCount).toBe(4);
		});

		it("should ensure all edges are covered", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				vertexCover: { kind: "vertex_cover", value: 3 },
			});
			const rng = new SeededRandom(42);

			generateVertexCoverEdges(nodes, edges, spec, rng);

			// Get vertex cover node IDs
			const coverIds = new Set(
				nodes.filter(n => n.data?.vertexCover).map(n => n.id)
			);

			// Every edge should have at least one endpoint in cover
			for (const edge of edges) {
				const covered = coverIds.has(edge.source) || coverIds.has(edge.target);
				expect(covered).toBe(true);
			}
		});

		it("should throw if vertex cover number exceeds node count", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				vertexCover: { kind: "vertex_cover", value: 10 },
			});
			const rng = new SeededRandom(42);

			expect(() => {
				generateVertexCoverEdges(nodes, edges, spec, rng);
			}).toThrow("Vertex cover number 10 cannot exceed node count 5");
		});

		it("should throw if vertex_cover spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateVertexCoverEdges(nodes, edges, spec, rng);
			}).toThrow("Vertex cover graph requires vertex_cover spec");
		});
	});

	describe("generateDominationNumberEdges", () => {
		it("should create graph with specified domination number", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				dominationNumber: { kind: "domination_number", value: 2 },
			});
			const rng = new SeededRandom(42);

			generateDominationNumberEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);

			// Should store target domination number
			for (const node of nodes) {
				expect(node.data?.targetDominationNumber).toBe(2);
			}
		});

		it("should mark dominating set vertices", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				dominationNumber: { kind: "domination_number", value: 2 },
			});
			const rng = new SeededRandom(42);

			generateDominationNumberEdges(nodes, edges, spec, rng);

			// Exactly 2 nodes should be in dominating set
			const dominatingCount = nodes.filter(n => n.data?.dominatingSet === true).length;
			expect(dominatingCount).toBe(2);
		});

		it("should connect dominating vertices to non-dominating", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				dominationNumber: { kind: "domination_number", value: 2 },
			});
			const rng = new SeededRandom(42);

			generateDominationNumberEdges(nodes, edges, spec, rng);

			// Every edge should have at least one dominating endpoint
			const dominatingIds = new Set(
				nodes.filter(n => n.data?.dominatingSet).map(n => n.id)
			);

			for (const edge of edges) {
				const hasDominating = dominatingIds.has(edge.source) || dominatingIds.has(edge.target);
				expect(hasDominating).toBe(true);
			}
		});

		it("should throw if domination number exceeds node count", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				dominationNumber: { kind: "domination_number", value: 10 },
			});
			const rng = new SeededRandom(42);

			expect(() => {
				generateDominationNumberEdges(nodes, edges, spec, rng);
			}).toThrow("Domination number 10 cannot exceed node count 5");
		});

		it("should throw if domination_number spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateDominationNumberEdges(nodes, edges, spec, rng);
			}).toThrow("Domination number graph requires domination_number spec");
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const nodes1 = createNodes(8);
			const nodes2 = createNodes(8);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				independenceNumber: { kind: "independence_number", value: 3 },
			});

			generateIndependenceNumberEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateIndependenceNumberEdges(nodes2, edges2, spec, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});
	});
});

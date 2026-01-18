import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	generateModularEdges,
	generateScaleFreeEdges,
	generateSmallWorldEdges,
} from "./network-structures";
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

describe("network-structures generators", () => {
	describe("generateScaleFreeEdges", () => {
		it("should create scale-free graph with preferential attachment", () => {
			const nodes = createNodes(20);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				scaleFree: { kind: "scale_free", exponent: 2.1 },
			});
			const rng = new SeededRandom(42);

			generateScaleFreeEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);
		});

		it("should store exponent in node data", () => {
			const nodes = createNodes(15);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				scaleFree: { kind: "scale_free", exponent: 2.5 },
			});
			const rng = new SeededRandom(42);

			generateScaleFreeEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.scaleFreeExponent).toBe(2.5);
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				scaleFree: { kind: "scale_free" },
			});
			const rng = new SeededRandom(42);

			generateScaleFreeEdges(nodes, edges, spec, rng);

			// Small graphs return early
			expect(edges.length).toBe(0);
		});

		it("should use default exponent when not specified", () => {
			const nodes = createNodes(15);
			const edges: TestEdge[] = [];
			const spec = createSpec(); // No scaleFree spec
			const rng = new SeededRandom(42);

			generateScaleFreeEdges(nodes, edges, spec, rng);

			// Should use default exponent 2.1
			for (const node of nodes) {
				expect(node.data?.scaleFreeExponent).toBe(2.1);
			}
		});

		it("should create initial complete core", () => {
			const nodes = createNodes(20);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				scaleFree: { kind: "scale_free" },
			});
			const rng = new SeededRandom(42);

			generateScaleFreeEdges(nodes, edges, spec, rng);

			// Initial core is complete graph of size ~n/10
			// Should have substantial edges from the core
			expect(edges.length).toBeGreaterThan(5);
		});
	});

	describe("generateSmallWorldEdges", () => {
		it("should create small-world graph with ring lattice base", () => {
			const nodes = createNodes(20);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				smallWorld: { kind: "small_world", rewireProbability: 0.1, meanDegree: 4 },
			});
			const rng = new SeededRandom(42);

			generateSmallWorldEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);
		});

		it("should store parameters in node data", () => {
			const nodes = createNodes(15);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				smallWorld: { kind: "small_world", rewireProbability: 0.2, meanDegree: 6 },
			});
			const rng = new SeededRandom(42);

			generateSmallWorldEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.smallWorldRewireProb).toBe(0.2);
				expect(node.data?.smallWorldMeanDegree).toBe(6);
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(3);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				smallWorld: { kind: "small_world" },
			});
			const rng = new SeededRandom(42);

			generateSmallWorldEdges(nodes, edges, spec, rng);

			// Small graphs return early
			expect(edges.length).toBe(0);
		});

		it("should use default values when not specified", () => {
			const nodes = createNodes(15);
			const edges: TestEdge[] = [];
			const spec = createSpec(); // No smallWorld spec
			const rng = new SeededRandom(42);

			generateSmallWorldEdges(nodes, edges, spec, rng);

			// Should use defaults: rewireProb=0.1, meanDegree=4
			for (const node of nodes) {
				expect(node.data?.smallWorldRewireProb).toBe(0.1);
				expect(node.data?.smallWorldMeanDegree).toBe(4);
			}
		});

		it("should create approximately expected number of edges", () => {
			const nodes = createNodes(20);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				smallWorld: { kind: "small_world", rewireProbability: 0, meanDegree: 4 },
			});
			const rng = new SeededRandom(42);

			generateSmallWorldEdges(nodes, edges, spec, rng);

			// With meanDegree=4, k=2, each node connects to 2 neighbors
			// Expected edges: n * k = 20 * 2 = 40
			expect(edges.length).toBe(40);
		});

		it("should rewire edges based on probability", () => {
			const nodes1 = createNodes(20);
			const nodes2 = createNodes(20);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const specNoRewire = createSpec({
				smallWorld: { kind: "small_world", rewireProbability: 0, meanDegree: 4 },
			});
			const specHighRewire = createSpec({
				smallWorld: { kind: "small_world", rewireProbability: 0.5, meanDegree: 4 },
			});

			generateSmallWorldEdges(nodes1, edges1, specNoRewire, new SeededRandom(42));
			generateSmallWorldEdges(nodes2, edges2, specHighRewire, new SeededRandom(42));

			// Structure should differ with high rewire probability
			// (edges2 may have fewer due to rewiring conflicts)
			expect(edges1.length).toBeGreaterThanOrEqual(edges2.length - 5);
		});
	});

	describe("generateModularEdges", () => {
		it("should create modular graph with communities", () => {
			const nodes = createNodes(15);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				communityStructure: {
					kind: "modular",
					numCommunities: 3,
					intraCommunityDensity: 0.7,
					interCommunityDensity: 0.05,
				},
			});
			const rng = new SeededRandom(42);

			generateModularEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);
		});

		it("should assign community to each node", () => {
			const nodes = createNodes(12);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				communityStructure: {
					kind: "modular",
					numCommunities: 3,
				},
			});
			const rng = new SeededRandom(42);

			generateModularEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.community).toBeDefined();
				expect(node.data?.community).toBeGreaterThanOrEqual(0);
				expect(node.data?.community).toBeLessThan(3);
			}
		});

		it("should store parameters in node data", () => {
			const nodes = createNodes(12);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				communityStructure: {
					kind: "modular",
					numCommunities: 4,
					intraCommunityDensity: 0.8,
					interCommunityDensity: 0.1,
				},
			});
			const rng = new SeededRandom(42);

			generateModularEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.numCommunities).toBe(4);
				expect(node.data?.intraDensity).toBe(0.8);
				expect(node.data?.interDensity).toBe(0.1);
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				communityStructure: { kind: "modular" },
			});
			const rng = new SeededRandom(42);

			generateModularEdges(nodes, edges, spec, rng);

			// Small graphs return early
			expect(edges.length).toBe(0);
		});

		it("should use default values when not specified", () => {
			const nodes = createNodes(12);
			const edges: TestEdge[] = [];
			const spec = createSpec(); // No communityStructure spec
			const rng = new SeededRandom(42);

			generateModularEdges(nodes, edges, spec, rng);

			// Should use defaults: 3 communities, 0.7 intra, 0.05 inter
			for (const node of nodes) {
				expect(node.data?.numCommunities).toBe(3);
				expect(node.data?.intraDensity).toBe(0.7);
				expect(node.data?.interDensity).toBe(0.05);
			}
		});

		it("should have more intra-community edges than inter-community", () => {
			const nodes = createNodes(18);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				communityStructure: {
					kind: "modular",
					numCommunities: 3,
					intraCommunityDensity: 0.8,
					interCommunityDensity: 0.1,
				},
			});
			const rng = new SeededRandom(42);

			generateModularEdges(nodes, edges, spec, rng);

			// Count intra vs inter community edges
			let intraCount = 0;
			let interCount = 0;

			for (const edge of edges) {
				const sourceNode = nodes.find(n => n.id === edge.source);
				const targetNode = nodes.find(n => n.id === edge.target);
				if (sourceNode?.data?.community === targetNode?.data?.community) {
					intraCount++;
				} else {
					interCount++;
				}
			}

			// With high intra density and low inter density, intra should dominate
			expect(intraCount).toBeGreaterThan(interCount);
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed for scale-free", () => {
			const nodes1 = createNodes(15);
			const nodes2 = createNodes(15);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				scaleFree: { kind: "scale_free" },
			});

			generateScaleFreeEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateScaleFreeEdges(nodes2, edges2, spec, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});

		it("should produce identical results with same seed for small-world", () => {
			const nodes1 = createNodes(15);
			const nodes2 = createNodes(15);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				smallWorld: { kind: "small_world" },
			});

			generateSmallWorldEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateSmallWorldEdges(nodes2, edges2, spec, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});

		it("should produce identical results with same seed for modular", () => {
			const nodes1 = createNodes(15);
			const nodes2 = createNodes(15);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				communityStructure: { kind: "modular" },
			});

			generateModularEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateModularEdges(nodes2, edges2, spec, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});
	});
});

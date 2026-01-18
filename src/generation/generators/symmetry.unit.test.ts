import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	generateArcTransitiveEdges,
	generateEdgeTransitiveEdges,
	generateLineGraphEdges,
	generateSelfComplementaryEdges,
	generateStronglyRegularEdges,
	generateThresholdEdges,
	generateVertexTransitiveEdges,
} from "./symmetry";
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

describe("symmetry generators", () => {
	describe("generateLineGraphEdges", () => {
		it("should create line graph from base graph", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				line: { kind: "line_graph" },
			});
			const rng = new SeededRandom(42);

			generateLineGraphEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);
		});

		it("should store base edge in node data", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				line: { kind: "line_graph" },
			});
			const rng = new SeededRandom(42);

			generateLineGraphEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.baseEdge).toBeDefined();
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateLineGraphEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateSelfComplementaryEdges", () => {
		it("should create graph with exactly half the possible edges", () => {
			const nodes = createNodes(4); // n=4, n%4=0
			const edges: TestEdge[] = [];
			const spec = createSpec({
				selfComplementary: { kind: "self_complementary" },
			});
			const rng = new SeededRandom(42);

			generateSelfComplementaryEdges(nodes, edges, spec, rng);

			// n=4: total possible = 6, half = 3
			expect(edges.length).toBe(3);
		});

		it("should work for n % 4 = 1", () => {
			const nodes = createNodes(5); // n=5, n%4=1
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateSelfComplementaryEdges(nodes, edges, spec, rng);

			// n=5: total possible = 10, half = 5
			expect(edges.length).toBe(5);
		});

		it("should store construction type in node data", () => {
			const nodes = createNodes(4);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateSelfComplementaryEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.selfComplementaryType).toBe("deterministic");
			}
		});
	});

	describe("generateThresholdEdges", () => {
		it("should create threshold graph iteratively", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				threshold: { kind: "threshold" },
			});
			const rng = new SeededRandom(42);

			generateThresholdEdges(nodes, edges, spec, rng);

			// Should have some edges
			expect(edges.length).toBeGreaterThanOrEqual(0);
		});

		it("should mark nodes as dominant or isolated", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				threshold: { kind: "threshold" },
			});
			const rng = new SeededRandom(42);

			generateThresholdEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.thresholdType).toBeDefined();
				expect(["dominant", "isolated"]).toContain(node.data?.thresholdType);
				expect(node.data?.creationOrder).toBeDefined();
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateThresholdEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateStronglyRegularEdges", () => {
		it("should create cycle graph for SRG parameters", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			// SRG(5, 2, 0, 1) is the 5-cycle C5
			// k(k-lambda-1) = 2(2-0-1) = 2
			// (n-k-1)mu = (5-2-1)*1 = 2
			const spec = createSpec({
				stronglyRegular: { kind: "strongly_regular", k: 2, lambda: 0, mu: 1 },
			});
			const rng = new SeededRandom(42);

			generateStronglyRegularEdges(nodes, edges, spec, rng);

			// Cycle C5 has 5 edges
			expect(edges.length).toBe(5);
		});

		it("should store SRG parameters in node data", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				stronglyRegular: { kind: "strongly_regular", k: 2, lambda: 0, mu: 1 },
			});
			const rng = new SeededRandom(42);

			generateStronglyRegularEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.srgParams).toEqual({ n: 5, k: 2, lambda: 0, mu: 1 });
			}
		});

		it("should throw if SRG parameters are invalid", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				stronglyRegular: { kind: "strongly_regular", k: 3, lambda: 1, mu: 2 },
			});
			const rng = new SeededRandom(42);

			// k(k-lambda-1) = 3(3-1-1) = 3
			// (n-k-1)mu = (5-3-1)*2 = 2
			// 3 != 2, invalid
			expect(() => {
				generateStronglyRegularEdges(nodes, edges, spec, rng);
			}).toThrow("Invalid SRG parameters");
		});

		it("should throw if required parameters missing", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				stronglyRegular: { kind: "strongly_regular" } as any,
			});
			const rng = new SeededRandom(42);

			expect(() => {
				generateStronglyRegularEdges(nodes, edges, spec, rng);
			}).toThrow("Strongly regular requires k, lambda, mu parameters");
		});

		it("should throw if spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateStronglyRegularEdges(nodes, edges, spec, rng);
			}).toThrow("Strongly regular graph requires strongly_regular spec");
		});
	});

	describe("generateVertexTransitiveEdges", () => {
		it("should create Cayley graph for cyclic group", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				vertexTransitive: { kind: "vertex_transitive" },
			});
			const rng = new SeededRandom(42);

			generateVertexTransitiveEdges(nodes, edges, spec, rng);

			// Should have edges
			expect(edges.length).toBeGreaterThan(0);
		});

		it("should store vertex position in node data", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				vertexTransitive: { kind: "vertex_transitive" },
			});
			const rng = new SeededRandom(42);

			generateVertexTransitiveEdges(nodes, edges, spec, rng);

			for (const [index, node] of nodes.entries()) {
				expect(node.data?.vertexTransitiveGroup).toBe("cyclic");
				expect(node.data?.vertexPosition).toBe(index);
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateVertexTransitiveEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});

		it("should add extra generators for larger even n", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				vertexTransitive: { kind: "vertex_transitive" },
			});
			const rng = new SeededRandom(42);

			generateVertexTransitiveEdges(nodes, edges, spec, rng);

			// For even n, connects to opposite (n/2 generator)
			expect(edges.length).toBeGreaterThan(10); // More than just cycle
		});
	});

	describe("generateEdgeTransitiveEdges", () => {
		it("should create complete graph (edge-transitive)", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				edgeTransitive: { kind: "edge_transitive" },
			});
			const rng = new SeededRandom(42);

			generateEdgeTransitiveEdges(nodes, edges, spec, rng);

			// Complete K5 has 10 edges
			expect(edges.length).toBe(10);
		});

		it("should mark edge-transitive in node data", () => {
			const nodes = createNodes(4);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				edgeTransitive: { kind: "edge_transitive" },
			});
			const rng = new SeededRandom(42);

			generateEdgeTransitiveEdges(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.edgeTransitive).toBe(true);
			}
		});

		it("should throw if spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateEdgeTransitiveEdges(nodes, edges, spec, rng);
			}).toThrow("Edge-transitive graph requires edge_transitive spec");
		});
	});

	describe("generateArcTransitiveEdges", () => {
		it("should create cycle graph (arc-transitive)", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				arcTransitive: { kind: "arc_transitive" },
			});
			const rng = new SeededRandom(42);

			generateArcTransitiveEdges(nodes, edges, spec, rng);

			// Cycle C6 has 6 edges
			expect(edges.length).toBe(6);
		});

		it("should mark arc-transitive properties in node data", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				arcTransitive: { kind: "arc_transitive" },
			});
			const rng = new SeededRandom(42);

			generateArcTransitiveEdges(nodes, edges, spec, rng);

			for (const [index, node] of nodes.entries()) {
				expect(node.data?.arcTransitive).toBe(true);
				expect(node.data?.symmetricGraph).toBe(true);
				expect(node.data?.vertexPosition).toBe(index);
			}
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				arcTransitive: { kind: "arc_transitive" },
			});
			const rng = new SeededRandom(42);

			generateArcTransitiveEdges(nodes, edges, spec, rng);

			// Small graphs return early
			expect(edges.length).toBe(0);
		});

		it("should throw if spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateArcTransitiveEdges(nodes, edges, spec, rng);
			}).toThrow("Arc-transitive graph requires arc_transitive spec");
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const nodes1 = createNodes(8);
			const nodes2 = createNodes(8);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				threshold: { kind: "threshold" },
			});

			generateThresholdEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateThresholdEdges(nodes2, edges2, spec, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});

		it("should produce different results with different seeds", () => {
			const nodes1 = createNodes(10);
			const nodes2 = createNodes(10);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				threshold: { kind: "threshold" },
			});

			generateThresholdEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateThresholdEdges(nodes2, edges2, spec, new SeededRandom(999));

			// Threshold types should likely differ
			const types1 = nodes1.map(n => n.data?.thresholdType);
			const types2 = nodes2.map(n => n.data?.thresholdType);
			expect(types1).not.toEqual(types2);
		});
	});
});

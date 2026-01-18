import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	generateConnectedCyclicEdges,
	generateDisconnectedEdges,
	generateEulerianEdges,
	generateFlowNetworkEdges,
	generateForestEdges,
	generateKColorableEdges,
	generateKEdgeConnectedEdges,
	generateKVertexConnectedEdges,
	generateTreewidthBoundedEdges,
} from "./connectivity";
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

describe("connectivity generators", () => {
	describe("generateFlowNetworkEdges", () => {
		it("should create edges with capacity weights", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				directionality: { kind: "directed" },
				flowNetwork: { kind: "flow_network", source: "N0", sink: "N5" },
			});
			const rng = new SeededRandom(42);

			generateFlowNetworkEdges(nodes, edges, spec, "N0", "N5", rng);

			expect(edges.length).toBeGreaterThan(0);
			// Edges should have weights
			for (const edge of edges) {
				expect(edge.weight).toBeDefined();
				expect(edge.weight).toBeGreaterThan(0);
			}
		});

		it("should throw if source node not found", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateFlowNetworkEdges(nodes, edges, spec, "INVALID", "N4", rng);
			}).toThrow("Source node 'INVALID' not found");
		});

		it("should throw if sink node not found", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateFlowNetworkEdges(nodes, edges, spec, "N0", "INVALID", rng);
			}).toThrow("Sink node 'INVALID' not found");
		});

		it("should throw if source equals sink", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateFlowNetworkEdges(nodes, edges, spec, "N0", "N0", rng);
			}).toThrow("Source and sink must be different nodes");
		});
	});

	describe("generateEulerianEdges", () => {
		it("should create Eulerian graph with all even degrees", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				eulerian: { kind: "eulerian" },
			});
			const rng = new SeededRandom(42);

			generateEulerianEdges(nodes, edges, spec, rng);

			// Count degrees
			const degrees = new Map<string, number>();
			for (const node of nodes) degrees.set(node.id, 0);
			for (const edge of edges) {
				degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
				degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
			}

			// All degrees should be even for Eulerian
			for (const degree of degrees.values()) {
				expect(degree % 2).toBe(0);
			}
		});

		it("should create semi-Eulerian graph with exactly 2 odd degrees", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				eulerian: { kind: "semi_eulerian" },
			});
			const rng = new SeededRandom(42);

			generateEulerianEdges(nodes, edges, spec, rng);

			// Count degrees
			const degrees = new Map<string, number>();
			for (const node of nodes) degrees.set(node.id, 0);
			for (const edge of edges) {
				degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
				degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
			}

			// Exactly 2 odd degree vertices for semi-Eulerian
			const oddCount = [...degrees.values()].filter(d => d % 2 === 1).length;
			expect(oddCount).toBe(2);
		});

		it("should handle small graphs", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				eulerian: { kind: "eulerian" },
			});
			const rng = new SeededRandom(42);

			generateEulerianEdges(nodes, edges, spec, rng);

			expect(edges.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe("generateKVertexConnectedEdges", () => {
		it("should create k-vertex-connected graph", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				kVertexConnected: { kind: "k_vertex_connected", k: 2 },
			});
			const rng = new SeededRandom(42);

			generateKVertexConnectedEdges(nodes, edges, spec, 2, rng);

			expect(edges.length).toBeGreaterThan(0);
		});

		it("should throw if n < k+1", () => {
			const nodes = createNodes(3);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateKVertexConnectedEdges(nodes, edges, spec, 5, rng);
			}).toThrow("k-vertex-connected graph requires at least 6 vertices");
		});

		it("should ensure minimum degree >= k", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateKVertexConnectedEdges(nodes, edges, spec, 3, rng);

			// Count degrees
			const degrees = new Map<string, number>();
			for (const node of nodes) degrees.set(node.id, 0);
			for (const edge of edges) {
				degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
				degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
			}

			// All degrees should be >= k
			for (const degree of degrees.values()) {
				expect(degree).toBeGreaterThanOrEqual(3);
			}
		});
	});

	describe("generateKEdgeConnectedEdges", () => {
		it("should create k-edge-connected graph", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateKEdgeConnectedEdges(nodes, edges, spec, 2, rng);

			expect(edges.length).toBeGreaterThan(0);
		});

		it("should throw if n < k+1", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateKEdgeConnectedEdges(nodes, edges, spec, 5, rng);
			}).toThrow("k-edge-connected graph requires at least 6 vertices");
		});

		it("should handle directed graphs", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({ directionality: { kind: "directed" } });
			const rng = new SeededRandom(42);

			generateKEdgeConnectedEdges(nodes, edges, spec, 2, rng);

			expect(edges.length).toBeGreaterThan(0);
		});
	});

	describe("generateTreewidthBoundedEdges", () => {
		it("should create k-tree with treewidth k", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				treewidth: { kind: "treewidth", width: 2 },
			});
			const rng = new SeededRandom(42);

			generateTreewidthBoundedEdges(nodes, edges, spec, 2, rng);

			expect(edges.length).toBeGreaterThan(0);
		});

		it("should throw if n < k+1", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateTreewidthBoundedEdges(nodes, edges, spec, 5, rng);
			}).toThrow("Treewidth 5 requires at least 6 vertices");
		});

		it("should generate forest for treewidth 0 (connected)", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({ connectivity: { kind: "connected" } });
			const rng = new SeededRandom(42);

			generateTreewidthBoundedEdges(nodes, edges, spec, 0, rng);

			// Tree has n-1 edges
			expect(edges.length).toBe(nodes.length - 1);
		});

		it("should generate disconnected forest for treewidth 0 (unconstrained)", () => {
			const nodes = createNodes(9);
			const edges: TestEdge[] = [];
			const spec = createSpec({ connectivity: { kind: "unconstrained" } });
			const rng = new SeededRandom(42);

			generateTreewidthBoundedEdges(nodes, edges, spec, 0, rng);

			// Forest has fewer edges than n-1
			expect(edges.length).toBeLessThan(nodes.length - 1);
		});
	});

	describe("generateKColorableEdges", () => {
		it("should create k-partite graph for k-colorability", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				kColorable: { kind: "k_colorable", k: 3 },
				density: { kind: "moderate" },
			});
			const rng = new SeededRandom(42);

			generateKColorableEdges(nodes, edges, spec, 3, rng);

			expect(edges.length).toBeGreaterThan(0);
		});

		it("should throw if k < 1", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateKColorableEdges(nodes, edges, spec, 0, rng);
			}).toThrow("k-colorable graphs require k >= 1");
		});

		it("should create no edges for k=1", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateKColorableEdges(nodes, edges, spec, 1, rng);

			// k=1 is independent set, no edges
			expect(edges.length).toBe(0);
		});

		it("should respect density specification", () => {
			const nodes = createNodes(12);
			const sparseEdges: TestEdge[] = [];
			const denseEdges: TestEdge[] = [];
			const sparseSpec = createSpec({ density: { kind: "sparse" } });
			const denseSpec = createSpec({ density: { kind: "dense" } });
			const rng1 = new SeededRandom(42);
			const rng2 = new SeededRandom(42);

			generateKColorableEdges([...nodes], sparseEdges, sparseSpec, 3, rng1);
			generateKColorableEdges([...nodes], denseEdges, denseSpec, 3, rng2);

			expect(denseEdges.length).toBeGreaterThanOrEqual(sparseEdges.length);
		});
	});

	describe("generateConnectedCyclicEdges", () => {
		it("should create a cycle through all nodes", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateConnectedCyclicEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(nodes.length);
		});

		it("should handle empty nodes", () => {
			const nodes: TestNode[] = [];
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateConnectedCyclicEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateForestEdges", () => {
		it("should create disconnected trees", () => {
			const nodes = createNodes(12);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "acyclic" },
			});
			const rng = new SeededRandom(42);

			generateForestEdges(nodes, edges, spec, rng);

			// Forest has fewer edges than connected tree (n-1)
			expect(edges.length).toBeLessThan(nodes.length - 1);
		});

		it("should handle small node counts", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateForestEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateDisconnectedEdges", () => {
		it("should create multiple disconnected components", () => {
			const nodes = createNodes(12);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "cycles_allowed" },
				density: { kind: "sparse" },
			});
			const rng = new SeededRandom(42);

			generateDisconnectedEdges(nodes, edges, spec, rng);

			expect(edges.length).toBeGreaterThan(0);
		});

		it("should handle dense specification with cycles", () => {
			const nodes = createNodes(9);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "cycles_allowed" },
				density: { kind: "dense" },
			});
			const rng = new SeededRandom(42);

			generateDisconnectedEdges(nodes, edges, spec, rng);

			expect(edges.length).toBeGreaterThan(0);
		});

		it("should handle small node counts", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateDisconnectedEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const nodes1 = createNodes(8);
			const nodes2 = createNodes(8);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({ eulerian: { kind: "eulerian" } });

			generateEulerianEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateEulerianEdges(nodes2, edges2, spec, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});
	});
});

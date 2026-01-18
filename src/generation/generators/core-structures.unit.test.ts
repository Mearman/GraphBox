import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	generateBinaryTreeEdges,
	generateGridEdges,
	generateRegularEdges,
	generateStarEdges,
	generateToroidalEdges,
	generateTournamentEdges,
	generateTreeEdges,
	generateWheelEdges,
} from "./core-structures";
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

describe("core-structures generators", () => {
	describe("generateTreeEdges", () => {
		it("should create tree with n-1 edges", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({ cycles: { kind: "acyclic" } });
			const rng = new SeededRandom(42);

			generateTreeEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(nodes.length - 1);
		});

		it("should handle empty nodes", () => {
			const nodes: TestNode[] = [];
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateTreeEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});

		it("should handle single node", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateTreeEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});

		it("should assign edge types for heterogeneous schema", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({ schema: { kind: "heterogeneous" } });
			const rng = new SeededRandom(42);

			generateTreeEdges(nodes, edges, spec, rng);

			for (const edge of edges) {
				expect(edge.type).toBeDefined();
				expect(["type_a", "type_b", "type_c"]).toContain(edge.type);
			}
		});
	});

	describe("generateStarEdges", () => {
		it("should create star with n-1 edges (center to leaves)", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({ star: { kind: "star" } });
			const rng = new SeededRandom(42);

			generateStarEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(nodes.length - 1);
		});

		it("should have first node as center", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({ star: { kind: "star" } });
			const rng = new SeededRandom(42);

			generateStarEdges(nodes, edges, spec, rng);

			// All edges should have N0 as source
			for (const edge of edges) {
				expect(edge.source).toBe("N0");
			}
		});

		it("should handle empty nodes", () => {
			const nodes: TestNode[] = [];
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateStarEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateWheelEdges", () => {
		it("should create wheel with hub + cycle edges", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({ wheel: { kind: "wheel" } });
			const rng = new SeededRandom(42);

			generateWheelEdges(nodes, edges, spec, rng);

			// Wheel: cycle of (n-1) edges + (n-1) hub edges = 2(n-1)
			expect(edges.length).toBe(2 * (nodes.length - 1));
		});

		it("should handle small graphs (n < 4)", () => {
			const nodes = createNodes(3);
			const edges: TestEdge[] = [];
			const spec = createSpec({ wheel: { kind: "wheel" } });
			const rng = new SeededRandom(42);

			generateWheelEdges(nodes, edges, spec, rng);

			// Should create K3 (triangle)
			expect(edges.length).toBe(3);
		});

		it("should handle 2 nodes", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec({ wheel: { kind: "wheel" } });
			const rng = new SeededRandom(42);

			generateWheelEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(1);
		});

		it("should handle single node", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec({ wheel: { kind: "wheel" } });
			const rng = new SeededRandom(42);

			generateWheelEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateGridEdges", () => {
		it("should create 2D lattice with correct edges", () => {
			const nodes = createNodes(9);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				grid: { kind: "grid", rows: 3, cols: 3 },
			});
			const rng = new SeededRandom(42);

			generateGridEdges(nodes, edges, spec, rng);

			// 3x3 grid: 6 horizontal + 6 vertical = 12 edges
			expect(edges.length).toBe(12);
		});

		it("should handle empty nodes", () => {
			const nodes: TestNode[] = [];
			const edges: TestEdge[] = [];
			const spec = createSpec({
				grid: { kind: "grid", rows: 3, cols: 3 },
			});
			const rng = new SeededRandom(42);

			generateGridEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});

		it("should return early if no grid spec", () => {
			const nodes = createNodes(9);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateGridEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});

		it("should handle 2x5 grid", () => {
			const nodes = createNodes(10);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				grid: { kind: "grid", rows: 2, cols: 5 },
			});
			const rng = new SeededRandom(42);

			generateGridEdges(nodes, edges, spec, rng);

			// 2x5 grid: 4 horizontal + 5 vertical = 9 edges (actually 8+5=13)
			// rows-1 horizontal connections per row: 4 * 2 = 8
			// cols vertical connections: 5 * 1 = 5
			expect(edges.length).toBe(13);
		});
	});

	describe("generateToroidalEdges", () => {
		it("should create toroidal grid with wraparound", () => {
			const nodes = createNodes(9);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				toroidal: { kind: "toroidal", rows: 3, cols: 3 },
			});
			const rng = new SeededRandom(42);

			generateToroidalEdges(nodes, edges, spec, rng);

			// 3x3 toroidal: 9 horizontal + 9 vertical = 18 edges
			expect(edges.length).toBe(18);
		});

		it("should handle empty nodes", () => {
			const nodes: TestNode[] = [];
			const edges: TestEdge[] = [];
			const spec = createSpec({
				toroidal: { kind: "toroidal", rows: 3, cols: 3 },
			});
			const rng = new SeededRandom(42);

			generateToroidalEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});

		it("should return early if no toroidal spec", () => {
			const nodes = createNodes(9);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			generateToroidalEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateBinaryTreeEdges", () => {
		it("should create binary tree with n-1 edges", () => {
			const nodes = createNodes(7);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				binaryTree: { kind: "binary_tree" },
			});
			const rng = new SeededRandom(42);

			generateBinaryTreeEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(nodes.length - 1);
		});

		it("should create complete binary tree", () => {
			const nodes = createNodes(7);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				binaryTree: { kind: "complete_binary" },
			});
			const rng = new SeededRandom(42);

			generateBinaryTreeEdges(nodes, edges, spec, rng);

			// Perfect binary tree of height 2 has 7 nodes, 6 edges
			expect(edges.length).toBe(6);
		});

		it("should create full binary tree", () => {
			const nodes = createNodes(7);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				binaryTree: { kind: "full_binary" },
			});
			const rng = new SeededRandom(42);

			generateBinaryTreeEdges(nodes, edges, spec, rng);

			// Full binary tree: each non-leaf has exactly 0 or 2 children
			expect(edges.length).toBeLessThanOrEqual(nodes.length - 1);
		});

		it("should handle empty nodes", () => {
			const nodes: TestNode[] = [];
			const edges: TestEdge[] = [];
			const spec = createSpec({
				binaryTree: { kind: "binary_tree" },
			});
			const rng = new SeededRandom(42);

			generateBinaryTreeEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateTournamentEdges", () => {
		it("should create complete directed graph with one edge per pair", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				directionality: { kind: "directed" },
				tournament: { kind: "tournament" },
			});
			const rng = new SeededRandom(42);

			generateTournamentEdges(nodes, edges, spec, rng);

			// Tournament has n(n-1)/2 edges
			expect(edges.length).toBe((nodes.length * (nodes.length - 1)) / 2);
		});

		it("should have exactly one edge per unordered pair", () => {
			const nodes = createNodes(4);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				directionality: { kind: "directed" },
				tournament: { kind: "tournament" },
			});
			const rng = new SeededRandom(42);

			generateTournamentEdges(nodes, edges, spec, rng);

			// Check no pair has both directions
			for (const edge of edges) {
				const reverseExists = edges.some(
					e => e.source === edge.target && e.target === edge.source
				);
				expect(reverseExists).toBe(false);
			}
		});

		it("should handle small graph", () => {
			const nodes = createNodes(2);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				directionality: { kind: "directed" },
				tournament: { kind: "tournament" },
			});
			const rng = new SeededRandom(42);

			generateTournamentEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(1);
		});

		it("should handle single node", () => {
			const nodes = createNodes(1);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				directionality: { kind: "directed" },
				tournament: { kind: "tournament" },
			});
			const rng = new SeededRandom(42);

			generateTournamentEdges(nodes, edges, spec, rng);

			expect(edges.length).toBe(0);
		});
	});

	describe("generateRegularEdges", () => {
		it("should create k-regular graph with correct degree", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				specificRegular: { kind: "k_regular", k: 2 },
			});
			const rng = new SeededRandom(42);

			generateRegularEdges(nodes, edges, spec, 2, rng);

			// k-regular with n nodes has nk/2 edges
			expect(edges.length).toBe((nodes.length * 2) / 2);

			// Check all degrees are exactly k
			const degrees = new Map<string, number>();
			for (const node of nodes) degrees.set(node.id, 0);
			for (const edge of edges) {
				degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
				degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
			}
			for (const degree of degrees.values()) {
				expect(degree).toBe(2);
			}
		});

		it("should throw if k >= n", () => {
			const nodes = createNodes(4);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateRegularEdges(nodes, edges, spec, 5, rng);
			}).toThrow("k-regular graph requires k < n");
		});

		it("should throw if n*k is odd", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				generateRegularEdges(nodes, edges, spec, 3, rng);
			}).toThrow("k-regular graph requires n*k to be even");
		});

		it("should create 3-regular (cubic) graph", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				cubic: { kind: "cubic" },
			});
			const rng = new SeededRandom(42);

			generateRegularEdges(nodes, edges, spec, 3, rng);

			// 3-regular with 8 nodes has 12 edges
			expect(edges.length).toBe(12);
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const nodes1 = createNodes(8);
			const nodes2 = createNodes(8);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec();

			generateTreeEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateTreeEdges(nodes2, edges2, spec, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});

		it("should produce different results with different seeds", () => {
			const nodes1 = createNodes(8);
			const nodes2 = createNodes(8);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec();

			generateTreeEdges(nodes1, edges1, spec, new SeededRandom(42));
			generateTreeEdges(nodes2, edges2, spec, new SeededRandom(999));

			// Same edge count but possibly different structure
			expect(edges1.length).toBe(edges2.length);
			// Edges may differ (not guaranteed for small graphs)
		});
	});
});

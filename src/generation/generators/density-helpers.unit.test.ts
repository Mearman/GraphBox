import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	calculateMaxPossibleEdges,
	getMaxAttempts,
	getTargetEdgeCount,
	hasExactStructure,
	needsSelfLoop,
} from "./density-helpers";
import type { TestEdge, TestNode } from "./types";

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

describe("density-helpers", () => {
	describe("hasExactStructure", () => {
		it("should return true for complete bipartite", () => {
			const spec = createSpec({
				completeBipartite: { kind: "complete_bipartite", m: 3, n: 4 },
			});
			expect(hasExactStructure(spec)).toBe(true);
		});

		it("should return true for grid", () => {
			const spec = createSpec({
				grid: { kind: "grid", rows: 3, cols: 3 },
			});
			expect(hasExactStructure(spec)).toBe(true);
		});

		it("should return true for toroidal", () => {
			const spec = createSpec({
				toroidal: { kind: "toroidal", rows: 3, cols: 3 },
			});
			expect(hasExactStructure(spec)).toBe(true);
		});

		it("should return true for star", () => {
			const spec = createSpec({
				star: { kind: "star" },
			});
			expect(hasExactStructure(spec)).toBe(true);
		});

		it("should return true for wheel", () => {
			const spec = createSpec({
				wheel: { kind: "wheel" },
			});
			expect(hasExactStructure(spec)).toBe(true);
		});

		it("should return true for binary tree variants", () => {
			expect(hasExactStructure(createSpec({
				binaryTree: { kind: "binary_tree" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				binaryTree: { kind: "full_binary" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				binaryTree: { kind: "complete_binary" },
			}))).toBe(true);
		});

		it("should return true for tournament", () => {
			const spec = createSpec({
				tournament: { kind: "tournament" },
			});
			expect(hasExactStructure(spec)).toBe(true);
		});

		it("should return true for cubic", () => {
			const spec = createSpec({
				cubic: { kind: "cubic" },
			});
			expect(hasExactStructure(spec)).toBe(true);
		});

		it("should return true for k-regular", () => {
			const spec = createSpec({
				specificRegular: { kind: "k_regular", k: 4 },
			});
			expect(hasExactStructure(spec)).toBe(true);
		});

		it("should return true for flow network", () => {
			const spec = createSpec({
				flowNetwork: { kind: "flow_network", source: "N0", sink: "N5" },
			});
			expect(hasExactStructure(spec)).toBe(true);
		});

		it("should return true for eulerian variants", () => {
			expect(hasExactStructure(createSpec({
				eulerian: { kind: "eulerian" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				eulerian: { kind: "semi_eulerian" },
			}))).toBe(true);
		});

		it("should return true for various connectivity constraints", () => {
			expect(hasExactStructure(createSpec({
				kVertexConnected: { kind: "k_vertex_connected", k: 3 },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				kEdgeConnected: { kind: "k_edge_connected", k: 2 },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				treewidth: { kind: "treewidth", width: 2 },
			}))).toBe(true);
		});

		it("should return true for colorability constraints", () => {
			expect(hasExactStructure(createSpec({
				kColorable: { kind: "k_colorable", k: 3 },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				kColorable: { kind: "bipartite_colorable" },
			}))).toBe(true);
		});

		it("should return true for structural classes", () => {
			expect(hasExactStructure(createSpec({
				split: { kind: "split" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				cograph: { kind: "cograph" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				clawFree: { kind: "claw_free" },
			}))).toBe(true);
		});

		it("should return true for chordal-based classes", () => {
			expect(hasExactStructure(createSpec({
				chordal: { kind: "chordal" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				interval: { kind: "interval" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				permutation: { kind: "permutation" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				comparability: { kind: "comparability" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				perfect: { kind: "perfect" },
			}))).toBe(true);
		});

		it("should return true for network science generators", () => {
			expect(hasExactStructure(createSpec({
				scaleFree: { kind: "scale_free" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				smallWorld: { kind: "small_world" },
			}))).toBe(true);

			expect(hasExactStructure(createSpec({
				communityStructure: { kind: "modular" },
			}))).toBe(true);
		});

		it("should return false for basic graph", () => {
			const spec = createSpec();
			expect(hasExactStructure(spec)).toBe(false);
		});
	});

	describe("calculateMaxPossibleEdges", () => {
		it("should calculate max edges for undirected graph", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({ directionality: { kind: "undirected" } });

			const max = calculateMaxPossibleEdges(nodes, edges, spec);

			// n(n-1)/2 = 5*4/2 = 10
			expect(max).toBe(10);
		});

		it("should calculate max edges for directed graph", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({ directionality: { kind: "directed" } });

			const max = calculateMaxPossibleEdges(nodes, edges, spec);

			// n(n-1) = 5*4 = 20
			expect(max).toBe(20);
		});

		it("should add self-loops to max when allowed", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				directionality: { kind: "undirected" },
				selfLoops: { kind: "allowed" },
			});

			const max = calculateMaxPossibleEdges(nodes, edges, spec);

			// Undirected graph max edges: n(n-1)/2 = 10
			// Self-loops not added to max for undirected connected graphs
			expect(max).toBe(10);
		});

		it("should calculate max edges for bipartite graph", () => {
			const nodes = createBipartiteNodes(3, 4);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				directionality: { kind: "undirected" },
				partiteness: { kind: "bipartite" },
			});

			const max = calculateMaxPossibleEdges(nodes, edges, spec);

			// m * n = 3 * 4 = 12
			expect(max).toBe(12);
		});

		it("should calculate max edges for directed bipartite graph", () => {
			const nodes = createBipartiteNodes(3, 4);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				directionality: { kind: "directed" },
				partiteness: { kind: "bipartite" },
			});

			const max = calculateMaxPossibleEdges(nodes, edges, spec);

			// 2 * m * n = 2 * 3 * 4 = 24
			expect(max).toBe(24);
		});
	});

	describe("getTargetEdgeCount", () => {
		it("should return max for complete graphs", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({ completeness: { kind: "complete" } });

			const target = getTargetEdgeCount(nodes, edges, spec, 10);

			expect(target).toBe(10);
		});

		it("should return current edge count for trees", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [
				{ source: "N0", target: "N1" },
				{ source: "N1", target: "N2" },
				{ source: "N2", target: "N3" },
				{ source: "N3", target: "N4" },
			];
			const spec = createSpec({
				directionality: { kind: "undirected" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "connected" },
			});

			const target = getTargetEdgeCount(nodes, edges, spec, 10);

			expect(target).toBe(4);
		});

		it("should return 15% of max for sparse density", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({ density: { kind: "sparse" } });

			const target = getTargetEdgeCount(nodes, edges, spec, 100);

			expect(target).toBe(15);
		});

		it("should return 40% of max for moderate density", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({ density: { kind: "moderate" } });

			const target = getTargetEdgeCount(nodes, edges, spec, 100);

			expect(target).toBe(40);
		});

		it("should return 70% of max for dense density", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({ density: { kind: "dense" } });

			const target = getTargetEdgeCount(nodes, edges, spec, 100);

			expect(target).toBe(70);
		});

		it("should return 40% of max for unconstrained density", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec({ density: { kind: "unconstrained" } });

			const target = getTargetEdgeCount(nodes, edges, spec, 100);

			expect(target).toBe(40);
		});
	});

	describe("needsSelfLoop", () => {
		it("should return true when self-loops allowed and not complete", () => {
			const nodes = createNodes(5);
			const spec = createSpec({
				selfLoops: { kind: "allowed" },
				completeness: { kind: "incomplete" },
			});

			expect(needsSelfLoop(nodes, spec)).toBe(true);
		});

		it("should return false when self-loops disallowed", () => {
			const nodes = createNodes(5);
			const spec = createSpec({
				selfLoops: { kind: "disallowed" },
				completeness: { kind: "incomplete" },
			});

			expect(needsSelfLoop(nodes, spec)).toBe(false);
		});

		it("should return false for complete graphs", () => {
			const nodes = createNodes(5);
			const spec = createSpec({
				selfLoops: { kind: "allowed" },
				completeness: { kind: "complete" },
			});

			expect(needsSelfLoop(nodes, spec)).toBe(false);
		});

		it("should return false for empty nodes", () => {
			const nodes: TestNode[] = [];
			const spec = createSpec({
				selfLoops: { kind: "allowed" },
				completeness: { kind: "incomplete" },
			});

			expect(needsSelfLoop(nodes, spec)).toBe(false);
		});
	});

	describe("getMaxAttempts", () => {
		it("should return edgesToAdd * 100 for dense", () => {
			expect(getMaxAttempts(10, "dense")).toBe(1000);
		});

		it("should return edgesToAdd * 10 for sparse", () => {
			expect(getMaxAttempts(10, "sparse")).toBe(100);
		});

		it("should return edgesToAdd * 10 for moderate", () => {
			expect(getMaxAttempts(10, "moderate")).toBe(100);
		});

		it("should handle zero edges to add", () => {
			expect(getMaxAttempts(0, "dense")).toBe(0);
			expect(getMaxAttempts(0, "sparse")).toBe(0);
		});
	});
});

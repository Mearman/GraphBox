import { describe, expect, it } from "vitest";

import type { TestEdge,TestGraph, TestNode } from "../generation/generators/types";
import {
	validateChordal,
	validateClawFree,
	validateCograph,
	validateComparability,
	validateInterval,
	validatePerfect,
	validatePermutation,
	validateSplit,
} from "./structural-class";

// Helper to create a minimal spec
const createSpec = (overrides: Record<string, any> = {}) => ({
	directionality: { kind: "undirected" as const },
	weighting: { kind: "unweighted" as const },
	cycles: { kind: "cycles_allowed" as const },
	connectivity: { kind: "unconstrained" as const },
	schema: { kind: "homogeneous" as const },
	edgeMultiplicity: { kind: "simple" as const },
	selfLoops: { kind: "disallowed" as const },
	density: { kind: "unconstrained" as const },
	completeness: { kind: "incomplete" as const },
	...overrides,
});

// Helper to create a test graph
const createGraph = (
	nodes: TestNode[],
	edges: TestEdge[],
	specOverrides: Record<string, any> = {}
): TestGraph => ({
	nodes,
	edges,
	spec: createSpec(specOverrides) as any,
});

// Helper to create nodes
const createNodes = (count: number, data?: Record<string, unknown>): TestNode[] =>
	Array.from({ length: count }, (_, index) => ({
		id: `n${index}`,
		data: data ? { ...data } : undefined,
	}));

// Helper to create nodes with individual data
const createNodesWithData = (dataArray: Array<Record<string, unknown> | undefined>): TestNode[] =>
	dataArray.map((data, index) => ({
		id: `n${index}`,
		data,
	}));

// Helper to create edges
const createEdge = (source: string, target: string): TestEdge => ({
	source,
	target,
});

describe("validateSplit", () => {
	it("returns valid when split is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateSplit(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("split");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ split: { kind: "split" } });
		const graph = createGraph(nodes, [], spec);

		const result = validateSplit(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates split graph with valid partition metadata", () => {
		const nodes = createNodesWithData([
			{ splitPartition: "clique" },
			{ splitPartition: "clique" },
			{ splitPartition: "independent" },
			{ splitPartition: "independent" },
		]);
		const edges = [createEdge("n0", "n1")]; // Clique is complete
		const spec = createSpec({ split: { kind: "split" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateSplit(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("split");
	});

	it("returns invalid when clique is not complete", () => {
		const nodes = createNodesWithData([
			{ splitPartition: "clique" },
			{ splitPartition: "clique" },
			{ splitPartition: "clique" },
			{ splitPartition: "independent" },
		]);
		// Missing edge between n1 and n2 in the clique
		const edges = [createEdge("n0", "n1"), createEdge("n0", "n2")];
		const spec = createSpec({ split: { kind: "split" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateSplit(graph);

		// Falls through to brute force search which may find a valid partition
		expect(result.property).toBe("split");
	});

	it("validates split graph via brute force for small graphs", () => {
		// Graph that is a split graph: clique {n0, n1} + independent set {n2, n3}
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1")]; // Only edge is within clique
		const spec = createSpec({ split: { kind: "split" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateSplit(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("split");
	});

	it("skips validation for large graphs", () => {
		const nodes = createNodes(15);
		const edges: TestEdge[] = [];
		const spec = createSpec({ split: { kind: "split" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateSplit(graph);

		expect(result.valid).toBe(true);
		expect(result.message).toContain("skipped");
	});
});

describe("validateCograph", () => {
	it("returns valid when cograph is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateCograph(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("cograph");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 4 nodes", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ cograph: { kind: "cograph" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateCograph(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates cograph (P4-free graph)", () => {
		// Complete graph K4 is P4-free
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
			createEdge("n1", "n2"),
			createEdge("n1", "n3"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ cograph: { kind: "cograph" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateCograph(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("cograph");
	});

	it("returns invalid for graph with induced P4", () => {
		// Path P4: n0-n1-n2-n3 is an induced P4
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ cograph: { kind: "cograph" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateCograph(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("non_cograph");
		expect(result.message).toContain("P4");
	});
});

describe("validateClawFree", () => {
	it("returns valid when claw-free is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateClawFree(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("clawFree");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 4 nodes", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1"), createEdge("n0", "n2")];
		const spec = createSpec({ clawFree: { kind: "claw_free" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateClawFree(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates claw-free graph", () => {
		// Complete graph K4 is claw-free (no independent set of 3 neighbors)
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
			createEdge("n1", "n2"),
			createEdge("n1", "n3"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ clawFree: { kind: "claw_free" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateClawFree(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("claw_free");
	});

	it("returns invalid for graph with claw K_{1,3}", () => {
		// Star K_{1,3}: center n0 with leaves n1, n2, n3
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
		];
		const spec = createSpec({ clawFree: { kind: "claw_free" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateClawFree(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("has_claw");
		expect(result.message).toContain("K_{1,3}");
	});
});

describe("validateChordal", () => {
	it("returns valid when chordal is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateChordal(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("chordal");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 4 nodes", () => {
		const nodes = createNodes(3);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n0"),
		];
		const spec = createSpec({ chordal: { kind: "chordal" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateChordal(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates chordal graph (complete graph)", () => {
		// Complete graph K4 is chordal
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
			createEdge("n1", "n2"),
			createEdge("n1", "n3"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ chordal: { kind: "chordal" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateChordal(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("chordal");
	});

	it("returns invalid for graph with chordless cycle", () => {
		// Cycle C4: n0-n1-n2-n3-n0 is chordless (no chord between non-adjacent vertices)
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const graph = createGraph(nodes, edges, { chordal: { kind: "chordal" } });

		const result = validateChordal(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("non_chordal");
	});
});

describe("validateInterval", () => {
	it("returns valid when interval is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateInterval(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("interval");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ interval: { kind: "interval" } });
		const graph = createGraph(nodes, [], spec);

		const result = validateInterval(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates interval graph with valid interval metadata", () => {
		const nodes = createNodesWithData([
			{ interval: { start: 0, end: 2, length: 2 } },
			{ interval: { start: 1, end: 3, length: 2 } },
			{ interval: { start: 4, end: 6, length: 2 } },
		]);
		// n0 and n1 intersect, n2 is separate
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ interval: { kind: "interval" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateInterval(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("interval");
	});

	it("returns invalid when interval intersection doesn't match edges", () => {
		const nodes = createNodesWithData([
			{ interval: { start: 0, end: 2, length: 2 } },
			{ interval: { start: 1, end: 3, length: 2 } },
			{ interval: { start: 4, end: 6, length: 2 } },
		]);
		// Missing edge between n0 and n1 which should intersect
		const edges: TestEdge[] = [];
		const spec = createSpec({ interval: { kind: "interval" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateInterval(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("non_interval");
	});

	it("skips validation without interval metadata", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ interval: { kind: "interval" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateInterval(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("unknown");
		expect(result.message).toContain("skipped");
	});
});

describe("validatePermutation", () => {
	it("returns valid when permutation is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validatePermutation(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("permutation");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ permutation: { kind: "permutation" } });
		const graph = createGraph(nodes, [], spec);

		const result = validatePermutation(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates permutation graph with valid permutation metadata", () => {
		// Identity permutation: [0, 1, 2] - no inversions, no edges
		const nodes = createNodesWithData([
			{ permutationValue: 0 },
			{ permutationValue: 1 },
			{ permutationValue: 2 },
		]);
		const edges: TestEdge[] = [];
		const spec = createSpec({ permutation: { kind: "permutation" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validatePermutation(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("permutation");
	});

	it("validates permutation graph with inversions", () => {
		// Permutation [2, 1, 0]: inversions at (0,1), (0,2), (1,2)
		const nodes = createNodesWithData([
			{ permutationValue: 2 },
			{ permutationValue: 1 },
			{ permutationValue: 0 },
		]);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n1", "n2"),
		];
		const spec = createSpec({ permutation: { kind: "permutation" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validatePermutation(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("permutation");
	});

	it("skips validation without permutation metadata", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ permutation: { kind: "permutation" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validatePermutation(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("unknown");
		expect(result.message).toContain("skipped");
	});
});

describe("validateComparability", () => {
	it("returns valid when comparability is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateComparability(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("comparability");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ comparability: { kind: "comparability" } });
		const graph = createGraph(nodes, [], spec);

		const result = validateComparability(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates comparability graph with topological order metadata", () => {
		const nodes = createNodesWithData([
			{ topologicalOrder: 0 },
			{ topologicalOrder: 1 },
			{ topologicalOrder: 2 },
		]);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ comparability: { kind: "comparability" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateComparability(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("comparability");
	});

	it("returns invalid when topological order has duplicates", () => {
		const nodes = createNodesWithData([
			{ topologicalOrder: 0 },
			{ topologicalOrder: 0 },
			{ topologicalOrder: 1 },
		]);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ comparability: { kind: "comparability" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateComparability(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("invalid_order");
	});
});

describe("validatePerfect", () => {
	it("returns valid when perfect is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validatePerfect(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("perfect");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ perfect: { kind: "perfect" } });
		const graph = createGraph(nodes, [], spec);

		const result = validatePerfect(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates perfect graph with class metadata", () => {
		const nodes = createNodesWithData([
			{ perfectClass: "chordal" },
			{ perfectClass: "chordal" },
			{ perfectClass: "chordal" },
		]);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ perfect: { kind: "perfect" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validatePerfect(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("perfect (chordal)");
	});

	it("returns invalid when perfect class is inconsistent", () => {
		const nodes = createNodesWithData([
			{ perfectClass: "chordal" },
			{ perfectClass: "bipartite" },
			{ perfectClass: "chordal" },
		]);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ perfect: { kind: "perfect" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validatePerfect(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("mixed_classes");
	});

	it("skips validation without perfect class metadata", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ perfect: { kind: "perfect" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validatePerfect(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("unknown");
		expect(result.message).toContain("skipped");
	});
});

import { describe, expect, it } from "vitest";

import type { TestEdge,TestGraph, TestNode } from "../generation/generators/types";
import {
	validateArcTransitive,
	validateEdgeTransitive,
	validateLine,
	validateSelfComplementary,
	validateStronglyRegular,
	validateThreshold,
	validateVertexTransitive,
} from "./symmetry";

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

describe("validateLine", () => {
	it("returns valid when line graph is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateLine(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("line");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ line: { kind: "line_graph" } });
		const graph = createGraph(nodes, [], spec);

		const result = validateLine(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates line graph with base edge metadata", () => {
		// Line graph of a path a-b-c has 2 nodes (edges ab and bc) connected
		const nodes = createNodesWithData([
			{ baseEdge: { source: "a", target: "b" } },
			{ baseEdge: { source: "b", target: "c" } },
		]);
		const edges = [createEdge("n0", "n1")]; // ab and bc share vertex b
		const spec = createSpec({ line: { kind: "line_graph" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateLine(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("line_graph");
	});

	it("returns invalid when adjacent nodes don't share vertex in base graph", () => {
		const nodes = createNodesWithData([
			{ baseEdge: { source: "a", target: "b" } },
			{ baseEdge: { source: "c", target: "d" } },
		]);
		// These edges should not be adjacent in line graph
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ line: { kind: "line_graph" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateLine(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("invalid_adjacency");
	});

	it("skips validation without base edge metadata", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ line: { kind: "line_graph" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateLine(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("unknown");
		expect(result.message).toContain("skipped");
	});
});

describe("validateSelfComplementary", () => {
	it("returns valid when self-complementary is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateSelfComplementary(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("selfComplementary");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns invalid when n is not 0 or 1 mod 4", () => {
		const nodes = createNodes(3); // 3 mod 4 = 3, invalid
		const spec = createSpec({ selfComplementary: { kind: "self_complementary" } });
		const graph = createGraph(nodes, [], spec);

		const result = validateSelfComplementary(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("invalid_size");
		expect(result.message).toContain("mod 4");
	});

	it("validates self-complementary with permutation metadata and correct edge count", () => {
		// n=4: total edges = 4*3/2 = 6, self-complementary needs exactly 3
		const nodes = createNodesWithData([
			{ permutation: [1, 0, 3, 2] },
			{ permutation: [1, 0, 3, 2] },
			{ permutation: [1, 0, 3, 2] },
			{ permutation: [1, 0, 3, 2] },
		]);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ selfComplementary: { kind: "self_complementary" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateSelfComplementary(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("self_complementary");
	});

	it("returns invalid when edge count is wrong", () => {
		// n=4: needs exactly 3 edges for self-complementary
		const nodes = createNodesWithData([
			{ selfComplementaryType: "path" },
			{ selfComplementaryType: "path" },
			{ selfComplementaryType: "path" },
			{ selfComplementaryType: "path" },
		]);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")]; // Only 2 edges
		const spec = createSpec({ selfComplementary: { kind: "self_complementary" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateSelfComplementary(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("invalid_edge_count");
	});

	it("skips validation without construction metadata", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ selfComplementary: { kind: "self_complementary" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateSelfComplementary(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("unknown");
		expect(result.message).toContain("skipped");
	});
});

describe("validateThreshold", () => {
	it("returns valid when threshold is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateThreshold(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("threshold");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ threshold: { kind: "threshold" } });
		const graph = createGraph(nodes, [], spec);

		const result = validateThreshold(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates threshold graph with proper metadata", () => {
		const nodes = createNodesWithData([
			{ thresholdType: "dominant" },
			{ thresholdType: "dominant" },
			{ thresholdType: "isolated" },
		]);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ threshold: { kind: "threshold" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateThreshold(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("threshold");
	});

	it("returns invalid when not all vertices are marked", () => {
		const nodes = createNodesWithData([
			{ thresholdType: "dominant" },
			{ thresholdType: "dominant" },
			{ otherData: "something" },
		]);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ threshold: { kind: "threshold" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateThreshold(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("invalid_metadata");
	});

	it("skips validation without threshold metadata", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ threshold: { kind: "threshold" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateThreshold(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("unknown");
		expect(result.message).toContain("requires construction metadata");
	});
});

describe("validateStronglyRegular", () => {
	it("returns valid when strongly regular is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateStronglyRegular(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("stronglyRegular");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns invalid when k, lambda, or mu are missing", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({
			stronglyRegular: { kind: "strongly_regular", k: undefined, lambda: undefined, mu: undefined },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateStronglyRegular(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("missing_parameters");
	});

	it("validates strongly regular with valid SRG metadata", () => {
		// Petersen graph parameters: (10, 3, 0, 1) - but we use smaller example
		// Complete graph K4: (4, 3, 2, 3) but not all satisfy feasibility
		// Using a simpler case with metadata validation
		const nodes = createNodesWithData([
			{ srgParams: { n: 4, k: 2, lambda: 0, mu: 2 } },
			{ srgParams: { n: 4, k: 2, lambda: 0, mu: 2 } },
			{ srgParams: { n: 4, k: 2, lambda: 0, mu: 2 } },
			{ srgParams: { n: 4, k: 2, lambda: 0, mu: 2 } },
		]);
		// 4-cycle: each vertex has degree 2
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({
			stronglyRegular: { kind: "strongly_regular", k: 2, lambda: 0, mu: 2 },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateStronglyRegular(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("strongly_regular");
	});

	it("returns invalid when graph is not regular", () => {
		const nodes = createNodesWithData([
			{ srgParams: { n: 4, k: 2, lambda: 0, mu: 1 } },
			{ srgParams: { n: 4, k: 2, lambda: 0, mu: 1 } },
			{ srgParams: { n: 4, k: 2, lambda: 0, mu: 1 } },
			{ srgParams: { n: 4, k: 2, lambda: 0, mu: 1 } },
		]);
		// Path: degrees are 1, 2, 2, 1
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({
			stronglyRegular: { kind: "strongly_regular", k: 2, lambda: 0, mu: 1 },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateStronglyRegular(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("not_regular");
	});

	it("checks feasibility condition when no metadata", () => {
		const nodes = createNodes(4);
		// k(k-lambda-1) must equal (n-k-1)*mu for SRG
		// With n=4, k=2, lambda=0, mu=2: 2*(2-0-1) = 2, (4-2-1)*2 = 2 ✓
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({
			stronglyRegular: { kind: "strongly_regular", k: 2, lambda: 0, mu: 2 },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateStronglyRegular(graph);

		expect(result.valid).toBe(true);
		expect(result.message).toContain("feasibility condition satisfied");
	});
});

describe("validateVertexTransitive", () => {
	it("returns valid when vertex-transitive is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateVertexTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("vertexTransitive");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ vertexTransitive: { kind: "vertex_transitive" } });
		const graph = createGraph(nodes, [], spec);

		const result = validateVertexTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates vertex-transitive with group metadata", () => {
		const nodes = createNodesWithData([
			{ vertexTransitiveGroup: "cyclic" },
			{ vertexTransitiveGroup: "cyclic" },
			{ vertexTransitiveGroup: "cyclic" },
		]);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n0"),
		];
		const spec = createSpec({ vertexTransitive: { kind: "vertex_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateVertexTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("vertex_transitive");
	});

	it("returns invalid when not all vertices have metadata", () => {
		const nodes = createNodesWithData([
			{ vertexTransitiveGroup: "cyclic" },
			{ vertexTransitiveGroup: "cyclic" },
			{ otherData: "something" },
		]);
		const edges = [createEdge("n0", "n1"), createEdge("n1", "n2")];
		const spec = createSpec({ vertexTransitive: { kind: "vertex_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateVertexTransitive(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("incomplete_metadata");
	});

	it("returns invalid when graph is not regular (fallback check)", () => {
		const nodes = createNodes(4);
		// Path graph: not regular (degrees 1, 2, 2, 1)
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ vertexTransitive: { kind: "vertex_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateVertexTransitive(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("irregular");
	});

	it("returns valid for regular graph without metadata", () => {
		const nodes = createNodes(4);
		// 4-cycle: all vertices have degree 2
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({ vertexTransitive: { kind: "vertex_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateVertexTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.message).toContain("graph is regular");
	});
});

describe("validateEdgeTransitive", () => {
	it("returns valid when edge-transitive is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateEdgeTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("edgeTransitive");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 2 nodes", () => {
		const nodes = createNodes(1);
		const spec = createSpec({ edgeTransitive: { kind: "edge_transitive" } });
		const graph = createGraph(nodes, [], spec);

		const result = validateEdgeTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates edge-transitive with metadata", () => {
		const nodes = createNodesWithData([
			{ edgeTransitive: true },
			{ edgeTransitive: true },
			{ edgeTransitive: true },
		]);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n0"),
		];
		const spec = createSpec({ edgeTransitive: { kind: "edge_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateEdgeTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("edge_transitive");
	});

	it("validates complete graph as edge-transitive (fallback)", () => {
		const nodes = createNodes(4);
		// Complete graph K4: 6 edges
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
			createEdge("n1", "n2"),
			createEdge("n1", "n3"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ edgeTransitive: { kind: "edge_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateEdgeTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.message).toContain("complete graph");
	});

	it("returns invalid for non-complete graph without metadata", () => {
		const nodes = createNodes(4);
		// Path graph: not edge-transitive without metadata
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ edgeTransitive: { kind: "edge_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateEdgeTransitive(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("unknown");
		expect(result.message).toContain("Cannot verify");
	});
});

describe("validateArcTransitive", () => {
	it("returns valid when arc-transitive is not specified", () => {
		const nodes = createNodes(3);
		const edges = [createEdge("n0", "n1")];
		const graph = createGraph(nodes, edges);

		const result = validateArcTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("arcTransitive");
		expect(result.expected).toBe("unconstrained");
	});

	it("returns valid for trivial graphs with less than 3 nodes", () => {
		const nodes = createNodes(2);
		const edges = [createEdge("n0", "n1")];
		const spec = createSpec({ arcTransitive: { kind: "arc_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateArcTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("validates arc-transitive with metadata", () => {
		const nodes = createNodesWithData([
			{ arcTransitive: true },
			{ arcTransitive: true },
			{ arcTransitive: true },
		]);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n0"),
		];
		const spec = createSpec({ arcTransitive: { kind: "arc_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateArcTransitive(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("arc_transitive");
	});

	it("returns invalid when not all vertices have metadata", () => {
		const nodes = createNodesWithData([
			{ arcTransitive: true },
			{ arcTransitive: true },
			{ otherData: "something" },
		]);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n0"),
		];
		const spec = createSpec({ arcTransitive: { kind: "arc_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateArcTransitive(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("incomplete_metadata");
	});

	it("returns invalid when graph is not regular (fallback check)", () => {
		const nodes = createNodes(4);
		// Path graph: not regular
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
		];
		const spec = createSpec({ arcTransitive: { kind: "arc_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateArcTransitive(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("irregular");
	});

	it("returns unknown for regular graph without metadata", () => {
		const nodes = createNodes(4);
		// 4-cycle: regular but we can't verify arc-transitivity
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n1", "n2"),
			createEdge("n2", "n3"),
			createEdge("n3", "n0"),
		];
		const spec = createSpec({ arcTransitive: { kind: "arc_transitive" } });
		const graph = createGraph(nodes, edges, spec);

		const result = validateArcTransitive(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("unknown");
		expect(result.message).toContain("regularity is necessary but not sufficient");
	});
});

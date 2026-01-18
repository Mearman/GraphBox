/**
 * Unit tests for test graph types.
 */

import { describe, expect, it } from "vitest";

import type { TestEdge, TestGraph, TestNode } from "./test";

describe("test graph types", () => {
	describe("TestNode", () => {
		it("should create a test node with id", () => {
			const node: TestNode = { id: "node1" };
			expect(node.id).toBe("node1");
		});

		it("should allow any string id", () => {
			const nodes: TestNode[] = [
				{ id: "a" },
				{ id: "123" },
				{ id: "node-with-dashes" },
				{ id: "node_with_underscores" },
			];
			expect(nodes).toHaveLength(4);
			expect(nodes[0].id).toBe("a");
			expect(nodes[1].id).toBe("123");
			expect(nodes[2].id).toBe("node-with-dashes");
			expect(nodes[3].id).toBe("node_with_underscores");
		});
	});

	describe("TestEdge", () => {
		it("should create a test edge with source and target", () => {
			const edge: TestEdge = { source: "a", target: "b" };
			expect(edge.source).toBe("a");
			expect(edge.target).toBe("b");
		});

		it("should allow optional type", () => {
			const edgeWithType: TestEdge = {
				source: "a",
				target: "b",
				type: "connects",
			};
			expect(edgeWithType.type).toBe("connects");
		});

		it("should allow edge without type", () => {
			const edgeWithoutType: TestEdge = { source: "a", target: "b" };
			expect(edgeWithoutType.type).toBeUndefined();
		});

		it("should allow self-loop edges", () => {
			const selfLoop: TestEdge = { source: "a", target: "a" };
			expect(selfLoop.source).toBe("a");
			expect(selfLoop.target).toBe("a");
		});
	});

	describe("TestGraph", () => {
		it("should create a directed test graph", () => {
			const graph: TestGraph = {
				nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
				edges: [
					{ source: "a", target: "b" },
					{ source: "b", target: "c" },
				],
				spec: {
					directionality: { kind: "directed" },
				},
			};
			expect(graph.nodes).toHaveLength(3);
			expect(graph.edges).toHaveLength(2);
			expect(graph.spec.directionality.kind).toBe("directed");
		});

		it("should create an undirected test graph", () => {
			const graph: TestGraph = {
				nodes: [{ id: "x" }, { id: "y" }],
				edges: [{ source: "x", target: "y" }],
				spec: {
					directionality: { kind: "undirected" },
				},
			};
			expect(graph.nodes).toHaveLength(2);
			expect(graph.edges).toHaveLength(1);
			expect(graph.spec.directionality.kind).toBe("undirected");
		});

		it("should allow empty graph", () => {
			const emptyGraph: TestGraph = {
				nodes: [],
				edges: [],
				spec: {
					directionality: { kind: "undirected" },
				},
			};
			expect(emptyGraph.nodes).toHaveLength(0);
			expect(emptyGraph.edges).toHaveLength(0);
		});

		it("should allow graph with nodes but no edges", () => {
			const isolatedNodes: TestGraph = {
				nodes: [{ id: "1" }, { id: "2" }, { id: "3" }],
				edges: [],
				spec: {
					directionality: { kind: "directed" },
				},
			};
			expect(isolatedNodes.nodes).toHaveLength(3);
			expect(isolatedNodes.edges).toHaveLength(0);
		});
	});

	describe("common graph structures", () => {
		it("should represent a path graph P3", () => {
			const pathGraph: TestGraph = {
				nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
				edges: [
					{ source: "a", target: "b" },
					{ source: "b", target: "c" },
				],
				spec: {
					directionality: { kind: "undirected" },
				},
			};
			expect(pathGraph.nodes).toHaveLength(3);
			expect(pathGraph.edges).toHaveLength(2);
		});

		it("should represent a cycle graph C4", () => {
			const cycleGraph: TestGraph = {
				nodes: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }],
				edges: [
					{ source: "1", target: "2" },
					{ source: "2", target: "3" },
					{ source: "3", target: "4" },
					{ source: "4", target: "1" },
				],
				spec: {
					directionality: { kind: "undirected" },
				},
			};
			expect(cycleGraph.nodes).toHaveLength(4);
			expect(cycleGraph.edges).toHaveLength(4);
		});

		it("should represent a complete graph K3", () => {
			const completeGraph: TestGraph = {
				nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
				edges: [
					{ source: "a", target: "b" },
					{ source: "a", target: "c" },
					{ source: "b", target: "c" },
				],
				spec: {
					directionality: { kind: "undirected" },
				},
			};
			expect(completeGraph.nodes).toHaveLength(3);
			// K3 has 3 edges: n*(n-1)/2 = 3*2/2 = 3
			expect(completeGraph.edges).toHaveLength(3);
		});

		it("should represent a star graph S4 (K1,4)", () => {
			const starGraph: TestGraph = {
				nodes: [
					{ id: "center" },
					{ id: "leaf1" },
					{ id: "leaf2" },
					{ id: "leaf3" },
					{ id: "leaf4" },
				],
				edges: [
					{ source: "center", target: "leaf1" },
					{ source: "center", target: "leaf2" },
					{ source: "center", target: "leaf3" },
					{ source: "center", target: "leaf4" },
				],
				spec: {
					directionality: { kind: "undirected" },
				},
			};
			expect(starGraph.nodes).toHaveLength(5);
			expect(starGraph.edges).toHaveLength(4);
		});

		it("should represent a directed acyclic graph (DAG)", () => {
			const dag: TestGraph = {
				nodes: [{ id: "root" }, { id: "left" }, { id: "right" }, { id: "sink" }],
				edges: [
					{ source: "root", target: "left" },
					{ source: "root", target: "right" },
					{ source: "left", target: "sink" },
					{ source: "right", target: "sink" },
				],
				spec: {
					directionality: { kind: "directed" },
				},
			};
			expect(dag.nodes).toHaveLength(4);
			expect(dag.edges).toHaveLength(4);
			expect(dag.spec.directionality.kind).toBe("directed");
		});
	});

	describe("typed edges", () => {
		it("should represent a labeled graph", () => {
			const labeledGraph: TestGraph = {
				nodes: [{ id: "person1" }, { id: "person2" }, { id: "city1" }],
				edges: [
					{ source: "person1", target: "person2", type: "knows" },
					{ source: "person1", target: "city1", type: "lives_in" },
				],
				spec: {
					directionality: { kind: "directed" },
				},
			};
			expect(labeledGraph.edges[0].type).toBe("knows");
			expect(labeledGraph.edges[1].type).toBe("lives_in");
		});

		it("should represent a graph with mixed typed and untyped edges", () => {
			const mixedGraph: TestGraph = {
				nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
				edges: [
					{ source: "a", target: "b", type: "strong" },
					{ source: "b", target: "c" }, // No type
				],
				spec: {
					directionality: { kind: "undirected" },
				},
			};
			expect(mixedGraph.edges[0].type).toBe("strong");
			expect(mixedGraph.edges[1].type).toBeUndefined();
		});
	});
});

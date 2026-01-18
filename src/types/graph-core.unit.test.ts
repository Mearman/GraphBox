/**
 * Unit tests for core graph types and type guards
 */

import { describe, expect, it } from "vitest";

import { makeGraphSpec } from "../generation/spec.js";
import type {
	CoreGraph,
	DocumentedGraph,
	GraphEdge,
	GraphMeta,
	GraphNode,
	SpecifiedGraph,
} from "./graph-core.js";
import {
	isCoreGraph,
	isDocumentedGraph,
	isSpecifiedGraph,
} from "./graph-core.js";

describe("GraphNode", () => {
	it("should allow minimal node with only id", () => {
		const node: GraphNode = { id: "A" };
		expect(node.id).toBe("A");
	});

	it("should allow node with all standard properties", () => {
		const node: GraphNode = {
			id: "A",
			label: "Node A",
			type: "person",
			partition: "left",
		};
		expect(node.id).toBe("A");
		expect(node.label).toBe("Node A");
		expect(node.type).toBe("person");
		expect(node.partition).toBe("left");
	});

	it("should allow extensible custom attributes", () => {
		const node: GraphNode = {
			id: "A",
			customProp: "custom value",
			metadata: { nested: true },
		};
		expect(node.customProp).toBe("custom value");
		expect(node.metadata).toEqual({ nested: true });
	});
});

describe("GraphEdge", () => {
	it("should allow minimal edge with source and target", () => {
		const edge: GraphEdge = { source: "A", target: "B" };
		expect(edge.source).toBe("A");
		expect(edge.target).toBe("B");
	});

	it("should allow edge with all standard properties", () => {
		const edge: GraphEdge = {
			source: "A",
			target: "B",
			directed: true,
			weight: 1.5,
			type: "follows",
		};
		expect(edge.source).toBe("A");
		expect(edge.target).toBe("B");
		expect(edge.directed).toBe(true);
		expect(edge.weight).toBe(1.5);
		expect(edge.type).toBe("follows");
	});

	it("should allow extensible custom attributes", () => {
		const edge: GraphEdge = {
			source: "A",
			target: "B",
			timestamp: "2024-01-01",
			properties: { confidence: 0.9 },
		};
		expect(edge.timestamp).toBe("2024-01-01");
		expect(edge.properties).toEqual({ confidence: 0.9 });
	});
});

describe("CoreGraph", () => {
	it("should represent an empty graph", () => {
		const graph: CoreGraph = {
			nodes: [],
			edges: [],
		};
		expect(graph.nodes).toHaveLength(0);
		expect(graph.edges).toHaveLength(0);
	});

	it("should represent an undirected graph", () => {
		const graph: CoreGraph = {
			nodes: [{ id: "A" }, { id: "B" }],
			edges: [{ source: "A", target: "B" }],
			directed: false,
		};
		expect(graph.directed).toBe(false);
		expect(graph.nodes).toHaveLength(2);
		expect(graph.edges).toHaveLength(1);
	});

	it("should represent a directed graph", () => {
		const graph: CoreGraph = {
			nodes: [{ id: "A" }, { id: "B" }],
			edges: [{ source: "A", target: "B" }],
			directed: true,
		};
		expect(graph.directed).toBe(true);
	});

	it("should allow mixed directionality with per-edge overrides", () => {
		const graph: CoreGraph = {
			nodes: [{ id: "A" }, { id: "B" }, { id: "C" }],
			edges: [
				{ source: "A", target: "B", directed: false },
				{ source: "B", target: "C", directed: true },
			],
			directed: true, // Default is directed
		};
		expect(graph.edges[0].directed).toBe(false);
		expect(graph.edges[1].directed).toBe(true);
	});
});

describe("SpecifiedGraph", () => {
	it("should extend CoreGraph with a GraphSpec", () => {
		const spec = makeGraphSpec({
			directionality: { kind: "directed" },
		});
		const graph: SpecifiedGraph = {
			nodes: [{ id: "A" }],
			edges: [],
			directed: true,
			spec,
		};
		expect(graph.spec).toBe(spec);
		expect(graph.spec.directionality.kind).toBe("directed");
	});
});

describe("DocumentedGraph", () => {
	it("should extend CoreGraph with metadata", () => {
		const meta: GraphMeta = {
			title: "Test Graph",
			description: "A test graph for unit testing",
			creator: "GraphBox",
			date: "2024-01-01",
		};
		const graph: DocumentedGraph = {
			nodes: [{ id: "A" }],
			edges: [],
			directed: false,
			meta,
		};
		expect(graph.meta.title).toBe("Test Graph");
		expect(graph.meta.creator).toBe("GraphBox");
	});

	it("should allow extensible metadata", () => {
		const meta: GraphMeta = {
			title: "Test",
			customField: "custom value",
		};
		const graph: DocumentedGraph = {
			nodes: [],
			edges: [],
			meta,
		};
		expect(graph.meta.customField).toBe("custom value");
	});
});

describe("isCoreGraph", () => {
	it("should return true for valid CoreGraph", () => {
		const graph: CoreGraph = {
			nodes: [{ id: "A" }],
			edges: [],
		};
		expect(isCoreGraph(graph)).toBe(true);
	});

	it("should return true for CoreGraph with directed property", () => {
		const graph: CoreGraph = {
			nodes: [],
			edges: [],
			directed: true,
		};
		expect(isCoreGraph(graph)).toBe(true);
	});

	it("should return false for null", () => {
		expect(isCoreGraph(null)).toBe(false);
	});

	it("should return false for undefined", () => {
		expect(isCoreGraph()).toBe(false);
	});

	it("should return false for non-object", () => {
		expect(isCoreGraph("not a graph")).toBe(false);
		expect(isCoreGraph(42)).toBe(false);
		expect(isCoreGraph(true)).toBe(false);
	});

	it("should return false for object missing nodes", () => {
		expect(isCoreGraph({ edges: [] })).toBe(false);
	});

	it("should return false for object missing edges", () => {
		expect(isCoreGraph({ nodes: [] })).toBe(false);
	});

	it("should return false for object with non-array nodes", () => {
		expect(isCoreGraph({ nodes: "not array", edges: [] })).toBe(false);
	});

	it("should return false for object with non-array edges", () => {
		expect(isCoreGraph({ nodes: [], edges: "not array" })).toBe(false);
	});

	it("should return false for object with non-boolean directed", () => {
		expect(isCoreGraph({ nodes: [], edges: [], directed: "true" })).toBe(
			false
		);
	});
});

describe("isSpecifiedGraph", () => {
	it("should return true for valid SpecifiedGraph", () => {
		const spec = makeGraphSpec({});
		const graph: SpecifiedGraph = {
			nodes: [],
			edges: [],
			spec,
		};
		expect(isSpecifiedGraph(graph)).toBe(true);
	});

	it("should return false for CoreGraph without spec", () => {
		const graph: CoreGraph = {
			nodes: [],
			edges: [],
		};
		expect(isSpecifiedGraph(graph)).toBe(false);
	});

	it("should return false for invalid CoreGraph", () => {
		expect(isSpecifiedGraph(null)).toBe(false);
		expect(isSpecifiedGraph({ spec: {} })).toBe(false);
	});

	it("should return false for graph with null spec", () => {
		expect(isSpecifiedGraph({ nodes: [], edges: [], spec: null })).toBe(false);
	});

	it("should return false for graph with non-object spec", () => {
		expect(isSpecifiedGraph({ nodes: [], edges: [], spec: "not object" })).toBe(
			false
		);
	});
});

describe("isDocumentedGraph", () => {
	it("should return true for valid DocumentedGraph", () => {
		const meta: GraphMeta = { title: "Test" };
		const graph: DocumentedGraph = {
			nodes: [],
			edges: [],
			meta,
		};
		expect(isDocumentedGraph(graph)).toBe(true);
	});

	it("should return false for CoreGraph without meta", () => {
		const graph: CoreGraph = {
			nodes: [],
			edges: [],
		};
		expect(isDocumentedGraph(graph)).toBe(false);
	});

	it("should return false for invalid CoreGraph", () => {
		expect(isDocumentedGraph(null)).toBe(false);
		expect(isDocumentedGraph({ meta: {} })).toBe(false);
	});

	it("should return false for graph with null meta", () => {
		expect(isDocumentedGraph({ nodes: [], edges: [], meta: null })).toBe(
			false
		);
	});

	it("should return false for graph with non-object meta", () => {
		expect(
			isDocumentedGraph({ nodes: [], edges: [], meta: "not object" })
		).toBe(false);
	});
});

/**
 * Unit tests for graph type converters
 */

import { describe, expect, it } from "vitest";

import type { GraphJson } from "../formats/gml/types";
import { makeGraphSpec } from "../generation/spec";
import {
	analyzerGraphToJson,
	graphJsonToAnalyzer,
	graphJsonToTest,
	testGraphToJson,
} from "./graph-converter";

describe("graphJsonToAnalyzer", () => {
	it("should convert basic GraphJson to AnalyzerGraph", () => {
		const graphJson: GraphJson = {
			meta: {
				name: "Test",
				description: "Test graph",
				source: "test",
				url: "",
				citation: { authors: [], title: "Test", year: 2024 },
				retrieved: "2024-01-01",
				directed: false,
			},
			nodes: [
				{ id: "1", label: "Node 1" },
				{ id: "2", label: "Node 2" },
			],
			edges: [{ source: "1", target: "2" }],
		};

		const analyzer = graphJsonToAnalyzer(graphJson);

		expect(analyzer.vertices).toHaveLength(2);
		expect(analyzer.vertices[0].id).toBe("1");
		expect(analyzer.vertices[0].label).toBe("Node 1");
		expect(analyzer.edges).toHaveLength(1);
		expect(analyzer.edges[0].endpoints).toEqual(["1", "2"]);
		expect(analyzer.edges[0].directed).toBe(false);
	});

	it("should preserve node attributes", () => {
		const graphJson: GraphJson = {
			meta: {
				name: "Test",
				description: "Test",
				source: "test",
				url: "",
				citation: { authors: [], title: "Test", year: 2024 },
				retrieved: "2024-01-01",
				directed: false,
			},
			nodes: [{ id: "1", custom: "value", count: 42 }],
			edges: [],
		};

		const analyzer = graphJsonToAnalyzer(graphJson);

		expect(analyzer.vertices[0].attrs).toEqual({ custom: "value", count: 42 });
	});

	it("should preserve edge attributes", () => {
		const graphJson: GraphJson = {
			meta: {
				name: "Test",
				description: "Test",
				source: "test",
				url: "",
				citation: { authors: [], title: "Test", year: 2024 },
				retrieved: "2024-01-01",
				directed: false,
			},
			nodes: [{ id: "1" }, { id: "2" }],
			edges: [{ source: "1", target: "2", weight: 0.5, custom: "value" }],
		};

		const analyzer = graphJsonToAnalyzer(graphJson);

		expect(analyzer.edges[0].weight).toBe(0.5);
		expect(analyzer.edges[0].attrs).toEqual({ custom: "value" });
	});

	it("should use per-edge directed flag when present", () => {
		const graphJson: GraphJson = {
			meta: {
				name: "Test",
				description: "Test",
				source: "test",
				url: "",
				citation: { authors: [], title: "Test", year: 2024 },
				retrieved: "2024-01-01",
				directed: false,
			},
			nodes: [{ id: "1" }, { id: "2" }],
			edges: [{ source: "1", target: "2", directed: true }],
		};

		const analyzer = graphJsonToAnalyzer(graphJson);

		expect(analyzer.edges[0].directed).toBe(true);
	});
});

describe("graphJsonToTest", () => {
	const spec = makeGraphSpec({
		directionality: { kind: "undirected" },
		connectivity: { kind: "connected" },
	});

	it("should convert basic GraphJson to TestGraph", () => {
		const graphJson: GraphJson = {
			meta: {
				name: "Test",
				description: "Test",
				source: "test",
				url: "",
				citation: { authors: [], title: "Test", year: 2024 },
				retrieved: "2024-01-01",
				directed: false,
			},
			nodes: [{ id: "1" }, { id: "2" }],
			edges: [{ source: "1", target: "2" }],
		};

		const testGraph = graphJsonToTest(graphJson, spec);

		expect(testGraph.nodes).toHaveLength(2);
		expect(testGraph.nodes[0].id).toBe("1");
		expect(testGraph.edges).toHaveLength(1);
		expect(testGraph.edges[0].source).toBe("1");
		expect(testGraph.spec).toBe(spec);
	});

	it("should preserve node type and partition", () => {
		const graphJson: GraphJson = {
			meta: {
				name: "Test",
				description: "Test",
				source: "test",
				url: "",
				citation: { authors: [], title: "Test", year: 2024 },
				retrieved: "2024-01-01",
				directed: false,
			},
			nodes: [
				{ id: "1", type: "person", partition: "left" as const },
				{ id: "2", type: "organization", partition: "right" as const },
			],
			edges: [],
		};

		const testGraph = graphJsonToTest(graphJson, spec);

		expect(testGraph.nodes[0].type).toBe("person");
		expect(testGraph.nodes[0].partition).toBe("left");
		expect(testGraph.nodes[1].type).toBe("organization");
		expect(testGraph.nodes[1].partition).toBe("right");
	});

	it("should preserve edge weight and type", () => {
		const graphJson: GraphJson = {
			meta: {
				name: "Test",
				description: "Test",
				source: "test",
				url: "",
				citation: { authors: [], title: "Test", year: 2024 },
				retrieved: "2024-01-01",
				directed: false,
			},
			nodes: [{ id: "1" }, { id: "2" }],
			edges: [{ source: "1", target: "2", weight: 0.5, type: "friendship" }],
		};

		const testGraph = graphJsonToTest(graphJson, spec);

		expect(testGraph.edges[0].weight).toBe(0.5);
		expect(testGraph.edges[0].type).toBe("friendship");
	});
});

describe("testGraphToJson", () => {
	it("should convert TestGraph to GraphJson", () => {
		const testGraph = {
			nodes: [{ id: "1" }, { id: "2" }],
			edges: [{ source: "1", target: "2" }],
			spec: makeGraphSpec({ directionality: { kind: "undirected" } }),
		};

		const json = testGraphToJson(testGraph);

		expect(json.nodes).toHaveLength(2);
		expect(json.edges).toHaveLength(1);
		expect(json.meta.directed).toBe(false);
	});

	it("should preserve node type, partition, and data", () => {
		const testGraph = {
			nodes: [
				{ id: "1", type: "person", partition: "left" as const, data: { age: 30 } },
			],
			edges: [],
			spec: makeGraphSpec({ directionality: { kind: "undirected" } }),
		};

		const json = testGraphToJson(testGraph);

		expect(json.nodes[0].type).toBe("person");
		expect(json.nodes[0].partition).toBe("left");
		expect(json.nodes[0].age).toBe(30);
	});

	it("should preserve edge weight and type", () => {
		const testGraph = {
			nodes: [{ id: "1" }, { id: "2" }],
			edges: [{ source: "1", target: "2", weight: 0.5, type: "friendship" }],
			spec: makeGraphSpec({ directionality: { kind: "undirected" } }),
		};

		const json = testGraphToJson(testGraph);

		expect(json.edges[0].weight).toBe(0.5);
		expect(json.edges[0].type).toBe("friendship");
	});

	it("should use metadata overrides", () => {
		const testGraph = {
			nodes: [],
			edges: [],
			spec: makeGraphSpec({ directionality: { kind: "directed" } }),
		};

		const json = testGraphToJson(testGraph, {
			name: "Custom Name",
			description: "Custom Description",
		});

		expect(json.meta.name).toBe("Custom Name");
		expect(json.meta.description).toBe("Custom Description");
		expect(json.meta.directed).toBe(true);
	});
});

describe("analyzerGraphToJson", () => {
	it("should convert AnalyzerGraph to GraphJson", () => {
		const analyzer = {
			vertices: [
				{ id: "1", label: "Node 1" },
				{ id: "2", label: "Node 2" },
			],
			edges: [
				{
					id: "e1",
					endpoints: ["1", "2"] as const,
					directed: false,
				},
			],
		};

		const json = analyzerGraphToJson(analyzer, false);

		expect(json.nodes).toHaveLength(2);
		expect(json.nodes[0].label).toBe("Node 1");
		expect(json.edges).toHaveLength(1);
		expect(json.edges[0].source).toBe("1");
		expect(json.edges[0].target).toBe("2");
	});

	it("should preserve vertex and edge attributes", () => {
		const analyzer = {
			vertices: [{ id: "1", attrs: { custom: "value" } }],
			edges: [
				{
					id: "e1",
					endpoints: ["1", "1"] as const,
					directed: false,
					weight: 0.5,
					attrs: { type: "self-loop" },
				},
			],
		};

		const json = analyzerGraphToJson(analyzer, false);

		expect(json.nodes[0].custom).toBe("value");
		expect(json.edges[0].weight).toBe(0.5);
		expect(json.edges[0].type).toBe("self-loop");
	});

	it("should throw for hyperedges", () => {
		const analyzer = {
			vertices: [{ id: "1" }, { id: "2" }, { id: "3" }],
			edges: [
				{
					id: "e1",
					endpoints: ["1", "2", "3"] as readonly string[],
					directed: false,
				},
			],
		};

		expect(() => analyzerGraphToJson(analyzer, false)).toThrow(
			"Cannot convert hyperedge (3 endpoints) to GraphJson"
		);
	});
});

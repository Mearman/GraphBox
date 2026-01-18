/**
 * Unit tests for graph type adapters
 */

import { describe, expect, it, vi } from "vitest";

import type { AnalyzerGraph } from "../analyzer/types.js";
import type { GraphJson } from "../formats/gml/types.js";
import type { TestGraph } from "../generation/generators/types.js";
import { makeGraphSpec } from "../generation/spec.js";
import type { CoreGraph, DocumentedGraph } from "../types/graph-core.js";
import {
	fromAnalyzerGraph,
	fromDocumentedGraph,
	fromGraphJson,
	fromSpecifiedGraph,
	fromTestGraph,
	toAnalyzerGraph,
	toCoreGraph,
	toDocumentedGraph,
	toGraphJson,
	toSpecifiedGraph,
	toTestGraph,
} from "./graph-adapters.js";

describe("toAnalyzerGraph", () => {
	it("should convert simple CoreGraph to AnalyzerGraph", () => {
		const core: CoreGraph = {
			nodes: [
				{ id: "A", label: "Node A" },
				{ id: "B", label: "Node B" },
			],
			edges: [{ source: "A", target: "B" }],
			directed: false,
		};

		const analyzer = toAnalyzerGraph(core);

		expect(analyzer.vertices).toHaveLength(2);
		expect(analyzer.vertices[0].id).toBe("A");
		expect(analyzer.vertices[0].label).toBe("Node A");
		expect(analyzer.edges).toHaveLength(1);
		expect(analyzer.edges[0].endpoints).toEqual(["A", "B"]);
		expect(analyzer.edges[0].directed).toBe(false);
	});

	it("should handle directed graphs", () => {
		const core: CoreGraph = {
			nodes: [{ id: "A" }, { id: "B" }],
			edges: [{ source: "A", target: "B" }],
			directed: true,
		};

		const analyzer = toAnalyzerGraph(core);

		expect(analyzer.edges[0].directed).toBe(true);
	});

	it("should preserve edge weights", () => {
		const core: CoreGraph = {
			nodes: [{ id: "A" }, { id: "B" }],
			edges: [{ source: "A", target: "B", weight: 2.5 }],
		};

		const analyzer = toAnalyzerGraph(core);

		expect(analyzer.edges[0].weight).toBe(2.5);
	});

	it("should handle per-edge directionality overrides", () => {
		const core: CoreGraph = {
			nodes: [{ id: "A" }, { id: "B" }, { id: "C" }],
			edges: [
				{ source: "A", target: "B", directed: true },
				{ source: "B", target: "C", directed: false },
			],
			directed: true,
		};

		const analyzer = toAnalyzerGraph(core);

		expect(analyzer.edges[0].directed).toBe(true);
		expect(analyzer.edges[1].directed).toBe(false);
	});

	it("should preserve custom node attributes", () => {
		const core: CoreGraph = {
			nodes: [{ id: "A", customAttr: "value", nested: { key: 1 } }],
			edges: [],
		};

		const analyzer = toAnalyzerGraph(core);

		expect(analyzer.vertices[0].attrs).toEqual({
			customAttr: "value",
			nested: { key: 1 },
		});
	});

	it("should preserve custom edge attributes", () => {
		const core: CoreGraph = {
			nodes: [{ id: "A" }, { id: "B" }],
			edges: [{ source: "A", target: "B", customProp: 42 }],
		};

		const analyzer = toAnalyzerGraph(core);

		expect(analyzer.edges[0].attrs).toEqual({ customProp: 42 });
	});

	it("should map edge type to label", () => {
		const core: CoreGraph = {
			nodes: [{ id: "A" }, { id: "B" }],
			edges: [{ source: "A", target: "B", type: "follows" }],
		};

		const analyzer = toAnalyzerGraph(core);

		expect(analyzer.edges[0].label).toBe("follows");
	});
});

describe("fromAnalyzerGraph", () => {
	it("should convert simple AnalyzerGraph to CoreGraph", () => {
		const analyzer: AnalyzerGraph = {
			vertices: [
				{ id: "A", label: "Node A" },
				{ id: "B", label: "Node B" },
			],
			edges: [
				{
					id: "e0",
					endpoints: ["A", "B"],
					directed: false,
				},
			],
		};

		const core = fromAnalyzerGraph(analyzer);

		expect(core.nodes).toHaveLength(2);
		expect(core.nodes[0].id).toBe("A");
		expect(core.nodes[0].label).toBe("Node A");
		expect(core.edges).toHaveLength(1);
		expect(core.edges[0].source).toBe("A");
		expect(core.edges[0].target).toBe("B");
		expect(core.directed).toBe(false);
	});

	it("should infer directionality from majority", () => {
		const analyzer: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }, { id: "C" }],
			edges: [
				{ id: "e0", endpoints: ["A", "B"], directed: true },
				{ id: "e1", endpoints: ["B", "C"], directed: true },
				{ id: "e2", endpoints: ["C", "A"], directed: false },
			],
		};

		const core = fromAnalyzerGraph(analyzer);

		// Majority (2/3) are directed
		expect(core.directed).toBe(true);
	});

	it("should preserve edge weights", () => {
		const analyzer: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }],
			edges: [
				{
					id: "e0",
					endpoints: ["A", "B"],
					directed: false,
					weight: 3.14,
				},
			],
		};

		const core = fromAnalyzerGraph(analyzer);

		expect(core.edges[0].weight).toBe(3.14);
	});

	it("should skip hyperedges and warn", () => {
		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const analyzer: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }, { id: "C" }],
			edges: [
				{ id: "e0", endpoints: ["A", "B"], directed: false },
				{ id: "e1", endpoints: ["A", "B", "C"], directed: false }, // Hyperedge
			],
		};

		const core = fromAnalyzerGraph(analyzer);

		expect(core.edges).toHaveLength(1); // Hyperedge dropped
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Hyperedge with 3 endpoints dropped")
		);

		consoleWarnSpy.mockRestore();
	});

	it("should preserve custom vertex attributes", () => {
		const analyzer: AnalyzerGraph = {
			vertices: [
				{ id: "A", attrs: { custom: "value", count: 5 } },
			],
			edges: [],
		};

		const core = fromAnalyzerGraph(analyzer);

		expect(core.nodes[0]).toMatchObject({
			id: "A",
			custom: "value",
			count: 5,
		});
	});

	it("should preserve custom edge attributes", () => {
		const analyzer: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }],
			edges: [
				{
					id: "e0",
					endpoints: ["A", "B"],
					directed: false,
					attrs: { color: "red", strength: 0.8 },
				},
			],
		};

		const core = fromAnalyzerGraph(analyzer);

		expect(core.edges[0]).toMatchObject({
			source: "A",
			target: "B",
			color: "red",
			strength: 0.8,
		});
	});

	it("should map edge label to type", () => {
		const analyzer: AnalyzerGraph = {
			vertices: [{ id: "A" }, { id: "B" }],
			edges: [
				{
					id: "e0",
					endpoints: ["A", "B"],
					directed: false,
					label: "friendship",
				},
			],
		};

		const core = fromAnalyzerGraph(analyzer);

		expect(core.edges[0].type).toBe("friendship");
	});
});

describe("toTestGraph / fromTestGraph", () => {
	it("should convert CoreGraph to TestGraph with spec", () => {
		const core: CoreGraph = {
			nodes: [{ id: "A" }, { id: "B" }],
			edges: [{ source: "A", target: "B" }],
			directed: true,
		};

		const spec = makeGraphSpec({ directionality: { kind: "directed" } });
		const test = toTestGraph(core, spec);

		expect(test.nodes).toHaveLength(2);
		expect(test.edges).toHaveLength(1);
		expect(test.spec).toBe(spec);
	});

	it("should preserve partition information", () => {
		const core: CoreGraph = {
			nodes: [
				{ id: "A", partition: "left" },
				{ id: "B", partition: "right" },
			],
			edges: [],
		};

		const spec = makeGraphSpec({});
		const test = toTestGraph(core, spec);

		expect(test.nodes[0].partition).toBe("left");
		expect(test.nodes[1].partition).toBe("right");
	});

	it("should convert TestGraph back to CoreGraph", () => {
		const spec = makeGraphSpec({ directionality: { kind: "undirected" } });
		const test: TestGraph = {
			nodes: [{ id: "A" }, { id: "B" }],
			edges: [{ source: "A", target: "B", weight: 1.5 }],
			spec,
		};

		const core = fromTestGraph(test);

		expect(core.nodes).toHaveLength(2);
		expect(core.edges).toHaveLength(1);
		expect(core.edges[0].weight).toBe(1.5);
		expect(core.directed).toBe(false);
	});

	it("should handle default directionality in spec", () => {
		const spec = makeGraphSpec({});
		// Default spec has undirected directionality
		const test: TestGraph = {
			nodes: [{ id: "A" }],
			edges: [],
			spec,
		};

		const core = fromTestGraph(test);

		// Default spec is undirected
		expect(core.directed).toBe(false);
	});
});

describe("toSpecifiedGraph / fromSpecifiedGraph", () => {
	it("should wrap CoreGraph with spec", () => {
		const core: CoreGraph = {
			nodes: [{ id: "A" }],
			edges: [],
		};
		const spec = makeGraphSpec({});

		const specified = toSpecifiedGraph(core, spec);

		expect(specified.nodes).toBe(core.nodes);
		expect(specified.edges).toBe(core.edges);
		expect(specified.spec).toBe(spec);
	});

	it("should unwrap SpecifiedGraph to CoreGraph", () => {
		const spec = makeGraphSpec({});
		const specified = toSpecifiedGraph(
			{ nodes: [{ id: "A" }], edges: [] },
			spec
		);

		const core = fromSpecifiedGraph(specified);

		expect(core.nodes).toHaveLength(1);
		expect("spec" in core).toBe(false);
	});
});

describe("toDocumentedGraph / fromDocumentedGraph", () => {
	it("should wrap CoreGraph with metadata", () => {
		const core: CoreGraph = {
			nodes: [{ id: "A" }],
			edges: [],
		};
		const meta = { title: "Test Graph", description: "A test" };

		const documented = toDocumentedGraph(core, meta);

		expect(documented.nodes).toBe(core.nodes);
		expect(documented.meta.title).toBe("Test Graph");
	});

	it("should unwrap DocumentedGraph to CoreGraph", () => {
		const meta = { title: "Test" };
		const documented = toDocumentedGraph(
			{ nodes: [{ id: "A" }], edges: [] },
			meta
		);

		const core = fromDocumentedGraph(documented);

		expect(core.nodes).toHaveLength(1);
		expect("meta" in core).toBe(false);
	});
});

describe("fromGraphJson / toGraphJson", () => {
	it("should convert GraphJson to DocumentedGraph", () => {
		const json: GraphJson = {
			meta: {
				name: "Test Network",
				description: "A test network",
				source: "http://example.com",
				url: "http://example.com/data.gml",
				citation: {
					authors: ["Doe, J."],
					title: "Test Paper",
					year: 2024,
				},
				retrieved: "2024-01-01",
				directed: true,
			},
			nodes: [
				{ id: "A", label: "Node A" },
				{ id: "B", label: "Node B" },
			],
			edges: [{ source: "A", target: "B", weight: 1 }],
		};

		const document = fromGraphJson(json);

		expect(document.nodes).toHaveLength(2);
		expect(document.edges).toHaveLength(1);
		expect(document.directed).toBe(true);
		expect(document.meta.title).toBe("Test Network");
		expect(document.meta.description).toBe("A test network");
	});

	it("should convert DocumentedGraph to GraphJson", () => {
		const document: DocumentedGraph = {
			nodes: [{ id: "A" }, { id: "B" }],
			edges: [{ source: "A", target: "B" }],
			directed: false,
			meta: {
				title: "My Graph",
				description: "Test graph",
				source: "http://example.com",
				date: "2024-01-01",
			},
		};

		const json = toGraphJson(document);

		expect(json.meta.name).toBe("My Graph");
		expect(json.meta.description).toBe("Test graph");
		expect(json.meta.directed).toBe(false);
		expect(json.nodes).toHaveLength(2);
	});

	it("should handle missing metadata fields gracefully", () => {
		const document: DocumentedGraph = {
			nodes: [],
			edges: [],
			meta: {},
		};

		const json = toGraphJson(document);

		expect(json.meta.name).toBe("Untitled Graph");
		expect(json.meta.description).toBe("");
	});

	it("should preserve custom node/edge attributes", () => {
		const json: GraphJson = {
			meta: {
				name: "Test",
				description: "",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
				directed: false,
			},
			nodes: [{ id: "A", customProp: "value" }],
			edges: [{ source: "A", target: "A", edgeProp: 42 }],
		};

		const document = fromGraphJson(json);

		expect(document.nodes[0].customProp).toBe("value");
		expect(document.edges[0].edgeProp).toBe(42);
	});
});

describe("toCoreGraph (universal converter)", () => {
	it("should handle CoreGraph directly", () => {
		const core: CoreGraph = {
			nodes: [{ id: "A" }],
			edges: [],
		};

		const result = toCoreGraph(core);

		expect(result.nodes).toHaveLength(1);
		expect(result.edges).toHaveLength(0);
	});

	it("should convert AnalyzerGraph", () => {
		const analyzer: AnalyzerGraph = {
			vertices: [{ id: "A" }],
			edges: [],
		};

		const result = toCoreGraph(analyzer);

		expect(result.nodes).toHaveLength(1);
	});

	it("should convert TestGraph", () => {
		const spec = makeGraphSpec({});
		const test: TestGraph = {
			nodes: [{ id: "A" }],
			edges: [],
			spec,
		};

		const result = toCoreGraph(test);

		expect(result.nodes).toHaveLength(1);
		expect("spec" in result).toBe(false);
	});

	it("should convert GraphJson", () => {
		const json: GraphJson = {
			meta: {
				name: "Test",
				description: "",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
				directed: false,
			},
			nodes: [{ id: "A" }],
			edges: [],
		};

		const result = toCoreGraph(json);

		expect(result.nodes).toHaveLength(1);
		expect("meta" in result).toBe(false);
	});

	it("should strip spec from SpecifiedGraph", () => {
		const spec = makeGraphSpec({});
		const specified = toSpecifiedGraph({ nodes: [], edges: [] }, spec);

		const result = toCoreGraph(specified);

		expect("spec" in result).toBe(false);
	});

	it("should strip meta from DocumentedGraph", () => {
		const documented = toDocumentedGraph({ nodes: [], edges: [] }, { title: "Test" });

		const result = toCoreGraph(documented);

		expect("meta" in result).toBe(false);
	});

	it("should throw on unknown graph type", () => {
		const unknown = { foo: "bar" };

		expect(() => toCoreGraph(unknown as unknown as CoreGraph)).toThrow("Unknown graph type");
	});
});

describe("roundtrip conversions", () => {
	it("should preserve data through CoreGraph -> AnalyzerGraph -> CoreGraph", () => {
		const original: CoreGraph = {
			nodes: [
				{ id: "A", label: "Node A" },
				{ id: "B", label: "Node B" },
			],
			edges: [{ source: "A", target: "B", weight: 2.5 }],
			directed: true,
		};

		const analyzer = toAnalyzerGraph(original);
		const roundtrip = fromAnalyzerGraph(analyzer);

		expect(roundtrip.nodes).toHaveLength(2);
		expect(roundtrip.edges).toHaveLength(1);
		expect(roundtrip.edges[0].weight).toBe(2.5);
		expect(roundtrip.directed).toBe(true);
	});

	it("should preserve data through CoreGraph -> TestGraph -> CoreGraph", () => {
		const original: CoreGraph = {
			nodes: [{ id: "A", partition: "left" }],
			edges: [],
			directed: false,
		};

		const spec = makeGraphSpec({ directionality: { kind: "undirected" } });
		const test = toTestGraph(original, spec);
		const roundtrip = fromTestGraph(test);

		expect(roundtrip.nodes[0].partition).toBe("left");
		expect(roundtrip.directed).toBe(false);
	});

	it("should preserve data through DocumentedGraph -> GraphJson -> DocumentedGraph", () => {
		const original: DocumentedGraph = {
			nodes: [{ id: "A" }],
			edges: [],
			directed: true,
			meta: {
				title: "Test",
				description: "A test graph",
			},
		};

		const json = toGraphJson(original);
		const roundtrip = fromGraphJson(json);

		expect(roundtrip.meta.title).toBe("Test");
		expect(roundtrip.directed).toBe(true);
	});
});

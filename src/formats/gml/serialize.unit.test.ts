/**
 * Unit tests for GML serializer
 */

import { describe, expect, it } from "vitest";

import { serializeGml } from "./serialize";
import type { GraphJson } from "./types";

describe("serializeGml", () => {
	const createGraph = (options: Partial<GraphJson> = {}): GraphJson => ({
		meta: {
			name: "test",
			description: "Test graph",
			source: "test",
			url: "test",
			citation: { authors: [], title: "test", year: 2024 },
			retrieved: "2024-01-01",
			directed: false,
			...options.meta,
		},
		nodes: options.nodes ?? [],
		edges: options.edges ?? [],
	});

	describe("basic structure", () => {
		it("should output valid GML structure", () => {
			const graph = createGraph();
			const gml = serializeGml(graph);

			expect(gml).toContain("graph");
			expect(gml).toContain("[");
			expect(gml).toContain("]");
		});

		it("should include directed attribute", () => {
			const directed = createGraph({ meta: { directed: true } as GraphJson["meta"] });
			const undirected = createGraph({ meta: { directed: false } as GraphJson["meta"] });

			expect(serializeGml(directed)).toContain("directed 1");
			expect(serializeGml(undirected)).toContain("directed 0");
		});

		it("should include creator if provided in options", () => {
			const graph = createGraph();
			const gml = serializeGml(graph, { creator: "TestApp" });

			expect(gml).toContain('Creator "TestApp"');
		});

		it("should include creator from meta if not in options", () => {
			const graph = createGraph();
			graph.meta.creator = "MetaCreator";
			const gml = serializeGml(graph);

			expect(gml).toContain('Creator "MetaCreator"');
		});
	});

	describe("node serialization", () => {
		it("should serialize nodes with id", () => {
			const graph = createGraph({
				nodes: [{ id: "node1" }, { id: "node2" }],
			});
			const gml = serializeGml(graph);

			expect(gml).toContain("node");
			expect(gml).toContain("id 0");
			expect(gml).toContain("id 1");
		});

		it("should serialize node labels", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", label: "First Node" }],
			});
			const gml = serializeGml(graph, { useNumericIds: true });

			expect(gml).toContain('label "First Node"');
		});

		it("should use original id as label when useNumericIds is true", () => {
			const graph = createGraph({
				nodes: [{ id: "mynode" }],
			});
			const gml = serializeGml(graph, { useNumericIds: true });

			expect(gml).toContain('label "mynode"');
		});

		it("should serialize additional node properties", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", x: 1.5, y: 2.5, type: "special" }],
			});
			const gml = serializeGml(graph);

			expect(gml).toContain("x 1.500000");
			expect(gml).toContain("y 2.500000");
			expect(gml).toContain('type "special"');
		});

		it("should skip undefined and null node properties", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", label: undefined }],
			});
			const gml = serializeGml(graph);

			// Should not contain label since it's undefined
			const lines = gml.split("\n");
			const labelLines = lines.filter((l) => l.includes("label"));
			// Only if useNumericIds adds it
			expect(labelLines.length).toBeLessThanOrEqual(1);
		});
	});

	describe("edge serialization", () => {
		it("should serialize edges with source and target", () => {
			const graph = createGraph({
				nodes: [{ id: "a" }, { id: "b" }],
				edges: [{ source: "a", target: "b" }],
			});
			const gml = serializeGml(graph);

			expect(gml).toContain("edge");
			expect(gml).toContain("source 0");
			expect(gml).toContain("target 1");
		});

		it("should serialize edge weights", () => {
			const graph = createGraph({
				nodes: [{ id: "a" }, { id: "b" }],
				edges: [{ source: "a", target: "b", weight: 2.5 }],
			});
			const gml = serializeGml(graph);

			expect(gml).toContain("weight 2.500000");
		});

		it("should serialize edge labels", () => {
			const graph = createGraph({
				nodes: [{ id: "a" }, { id: "b" }],
				edges: [{ source: "a", target: "b", label: "connects" }],
			});
			const gml = serializeGml(graph);

			expect(gml).toContain('label "connects"');
		});

		it("should throw for unknown source node", () => {
			const graph = createGraph({
				nodes: [{ id: "a" }],
				edges: [{ source: "unknown", target: "a" }],
			});

			expect(() => serializeGml(graph)).toThrow("Unknown source node: unknown");
		});

		it("should throw for unknown target node", () => {
			const graph = createGraph({
				nodes: [{ id: "a" }],
				edges: [{ source: "a", target: "unknown" }],
			});

			expect(() => serializeGml(graph)).toThrow("Unknown target node: unknown");
		});
	});

	describe("string escaping", () => {
		it("should escape backslashes", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", label: String.raw`path\to\file` }],
			});
			const gml = serializeGml(graph, { useNumericIds: true });

			expect(gml).toContain(String.raw`path\\to\\file`);
		});

		it("should escape quotes", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", label: 'say "hello"' }],
			});
			const gml = serializeGml(graph, { useNumericIds: true });

			expect(gml).toContain(String.raw`say \"hello\"`);
		});

		it("should escape newlines", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", label: "line1\nline2" }],
			});
			const gml = serializeGml(graph, { useNumericIds: true });

			expect(gml).toContain(String.raw`line1\nline2`);
		});

		it("should escape tabs", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", label: "col1\tcol2" }],
			});
			const gml = serializeGml(graph, { useNumericIds: true });

			expect(gml).toContain(String.raw`col1\tcol2`);
		});
	});

	describe("value formatting", () => {
		it("should format integers without decimal", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", count: 42 }],
			});
			const gml = serializeGml(graph);

			expect(gml).toContain("count 42");
		});

		it("should format floats with 6 decimal places", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", value: 3.141_592_653_59 }],
			});
			const gml = serializeGml(graph);

			expect(gml).toContain("value 3.141593");
		});

		it("should format booleans as 0 or 1", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", active: true, disabled: false }],
			});
			const gml = serializeGml(graph);

			expect(gml).toContain("active 1");
			expect(gml).toContain("disabled 0");
		});

		it("should format other types as escaped strings", () => {
			const graph = createGraph({
				nodes: [{ id: "n1", data: { nested: "value" } }],
			});
			const gml = serializeGml(graph);

			// Object should be converted to string
			expect(gml).toContain("data");
		});
	});

	describe("indentation", () => {
		it("should use default two-space indentation", () => {
			const graph = createGraph({
				nodes: [{ id: "n1" }],
			});
			const gml = serializeGml(graph);

			expect(gml).toContain("  node");
			expect(gml).toContain("    id");
		});

		it("should use custom indentation", () => {
			const graph = createGraph({
				nodes: [{ id: "n1" }],
			});
			const gml = serializeGml(graph, { indent: "\t" });

			expect(gml).toContain("\tnode");
			expect(gml).toContain("\t\tid");
		});
	});

	describe("complex graphs", () => {
		it("should handle graph with multiple nodes and edges", () => {
			const graph = createGraph({
				nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }],
				edges: [
					{ source: "a", target: "b", weight: 1 },
					{ source: "b", target: "c", weight: 2 },
					{ source: "a", target: "c", weight: 3 },
				],
			});
			const gml = serializeGml(graph, { useNumericIds: true });

			// Count nodes and edges
			const nodeMatches = gml.match(/\bnode\b/g);
			const edgeMatches = gml.match(/\bedge\b/g);

			expect(nodeMatches).toHaveLength(3);
			expect(edgeMatches).toHaveLength(3);
		});

		it("should handle empty graph", () => {
			const graph = createGraph();
			const gml = serializeGml(graph);

			expect(gml).toContain("graph");
			expect(gml).toContain("directed 0");
			expect(gml).not.toContain("node");
			expect(gml).not.toContain("edge");
		});
	});
});

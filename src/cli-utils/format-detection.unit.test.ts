/**
 * Unit tests for format detection
 */

import { describe, expect, it } from "vitest";

import {
	detectFormat,
	detectFormatFromContent,
	detectFormatFromExtension,
} from "./format-detection";

describe("detectFormatFromExtension", () => {
	it("should detect JSON from .json extension", () => {
		expect(detectFormatFromExtension("graph.json")).toBe("json");
		expect(detectFormatFromExtension("/path/to/graph.json")).toBe("json");
	});

	it("should detect GML from .gml extension", () => {
		expect(detectFormatFromExtension("graph.gml")).toBe("gml");
		expect(detectFormatFromExtension("/path/to/graph.gml")).toBe("gml");
	});

	it("should detect Pajek from .net extension", () => {
		expect(detectFormatFromExtension("graph.net")).toBe("pajek");
		expect(detectFormatFromExtension("/path/to/graph.net")).toBe("pajek");
	});

	it("should detect SNAP from .edges extension", () => {
		expect(detectFormatFromExtension("graph.edges")).toBe("snap");
		expect(detectFormatFromExtension("/path/to/graph.edges")).toBe("snap");
	});

	it("should detect SNAP from .txt extension", () => {
		expect(detectFormatFromExtension("graph.txt")).toBe("snap");
		expect(detectFormatFromExtension("/path/to/graph.txt")).toBe("snap");
	});

	it("should detect UCINET from .dl extension", () => {
		expect(detectFormatFromExtension("graph.dl")).toBe("ucinet");
		expect(detectFormatFromExtension("/path/to/graph.dl")).toBe("ucinet");
	});

	it("should be case-insensitive", () => {
		expect(detectFormatFromExtension("graph.JSON")).toBe("json");
		expect(detectFormatFromExtension("graph.GML")).toBe("gml");
		expect(detectFormatFromExtension("graph.NET")).toBe("pajek");
	});

	it("should return null for unknown extensions", () => {
		expect(detectFormatFromExtension("graph.xyz")).toBeNull();
		expect(detectFormatFromExtension("graph")).toBeNull();
	});
});

describe("detectFormatFromContent", () => {
	it("should detect JSON from content", () => {
		const jsonContent = '{"meta": {}, "nodes": [], "edges": []}';
		expect(detectFormatFromContent(jsonContent)).toBe("json");
	});

	it("should detect JSON array", () => {
		const jsonContent = '[{"id": 1}, {"id": 2}]';
		expect(detectFormatFromContent(jsonContent)).toBe("json");
	});

	it("should detect GML from graph keyword", () => {
		const gmlContent = `graph [
  directed 0
  node [ id 1 ]
]`;
		expect(detectFormatFromContent(gmlContent)).toBe("gml");
	});

	it("should detect GML from Creator comment", () => {
		const gmlContent = `Creator "test"
graph [
  node [ id 1 ]
]`;
		expect(detectFormatFromContent(gmlContent)).toBe("gml");
	});

	it("should detect Pajek from *Vertices", () => {
		const pajekContent = `*Vertices 5
1 "Node1"
2 "Node2"`;
		expect(detectFormatFromContent(pajekContent)).toBe("pajek");
	});

	it("should detect Pajek case-insensitively", () => {
		const pajekContent = `*vertices 5
1 "Node1"`;
		expect(detectFormatFromContent(pajekContent)).toBe("pajek");
	});

	it("should detect UCINET from dl keyword", () => {
		const ucinetContent = `dl n=5
format=edgelist1
data:
1 2
2 3`;
		expect(detectFormatFromContent(ucinetContent)).toBe("ucinet");
	});

	it("should detect SNAP from edge list", () => {
		const snapContent = `# Comment line
1 2
2 3
3 4
4 5`;
		expect(detectFormatFromContent(snapContent)).toBe("snap");
	});

	it("should detect SNAP without comments", () => {
		const snapContent = `1 2
2 3
3 4`;
		expect(detectFormatFromContent(snapContent)).toBe("snap");
	});

	it("should return null for unrecognizable content", () => {
		const unknownContent = "This is not a graph file";
		expect(detectFormatFromContent(unknownContent)).toBeNull();
	});

	it("should handle empty content", () => {
		expect(detectFormatFromContent("")).toBeNull();
	});

	it("should handle whitespace", () => {
		const whitespaceContent = "   \n\n  \n";
		expect(detectFormatFromContent(whitespaceContent)).toBeNull();
	});
});

describe("detectFormat", () => {
	it("should prefer extension over content", () => {
		const jsonContent = '{"nodes": []}';
		expect(detectFormat("graph.gml", jsonContent)).toBe("gml");
	});

	it("should fall back to content if extension unknown", () => {
		const jsonContent = '{"nodes": []}';
		expect(detectFormat("graph.xyz", jsonContent)).toBe("json");
	});

	it("should work with extension only", () => {
		expect(detectFormat("graph.json")).toBe("json");
	});

	it("should return null if both fail", () => {
		expect(detectFormat("graph.xyz", "unknown content")).toBeNull();
	});

	it("should return null if no content and unknown extension", () => {
		expect(detectFormat("graph.xyz")).toBeNull();
	});
});

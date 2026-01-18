/**
 * Unit tests for Pajek .net format parser
 */

import { describe, expect, it } from "vitest";

import { pajekToJson, parsePajek } from "./parse";

describe("parsePajek", () => {
	describe("basic parsing", () => {
		it("should parse empty content", () => {
			const result = parsePajek("");

			expect(result.vertices).toHaveLength(0);
			expect(result.edges).toHaveLength(0);
			expect(result.arcs).toHaveLength(0);
			expect(result.vertexCount).toBe(0);
		});

		it("should parse vertex count from header", () => {
			const content = "*Vertices 5";
			const result = parsePajek(content);

			expect(result.vertexCount).toBe(5);
		});

		it("should parse vertices with IDs only", () => {
			const content = `*Vertices 3
1
2
3`;
			const result = parsePajek(content);

			expect(result.vertices).toHaveLength(3);
			expect(result.vertices[0].id).toBe(1);
			expect(result.vertices[1].id).toBe(2);
			expect(result.vertices[2].id).toBe(3);
		});

		it("should parse vertices with labels", () => {
			const content = `*Vertices 2
1 "Node A"
2 "Node B"`;
			const result = parsePajek(content);

			expect(result.vertices).toHaveLength(2);
			expect(result.vertices[0].label).toBe("Node A");
			expect(result.vertices[1].label).toBe("Node B");
		});

		it("should parse vertices with coordinates", () => {
			const content = `*Vertices 2
1 "A" 0.5 0.3
2 "B" 0.7 0.8 0.2`;
			const result = parsePajek(content);

			expect(result.vertices[0].x).toBeCloseTo(0.5);
			expect(result.vertices[0].y).toBeCloseTo(0.3);
			expect(result.vertices[0].z).toBeUndefined();
			expect(result.vertices[1].x).toBeCloseTo(0.7);
			expect(result.vertices[1].y).toBeCloseTo(0.8);
			expect(result.vertices[1].z).toBeCloseTo(0.2);
		});
	});

	describe("edge parsing", () => {
		it("should parse undirected edges", () => {
			const content = `*Vertices 3
*Edges
1 2
2 3`;
			const result = parsePajek(content);

			expect(result.edges).toHaveLength(2);
			expect(result.edges[0]).toEqual({ source: 1, target: 2 });
			expect(result.edges[1]).toEqual({ source: 2, target: 3 });
			expect(result.directed).toBe(false);
		});

		it("should parse directed arcs", () => {
			const content = `*Vertices 3
*Arcs
1 2
2 3`;
			const result = parsePajek(content);

			expect(result.arcs).toHaveLength(2);
			expect(result.arcs[0]).toEqual({ source: 1, target: 2 });
			expect(result.arcs[1]).toEqual({ source: 2, target: 3 });
			expect(result.directed).toBe(true);
		});

		it("should parse weighted edges", () => {
			const content = `*Vertices 2
*Edges
1 2 0.5`;
			const result = parsePajek(content);

			expect(result.edges[0].weight).toBeCloseTo(0.5);
		});

		it("should parse weighted arcs", () => {
			const content = `*Vertices 2
*Arcs
1 2 1.5`;
			const result = parsePajek(content);

			expect(result.arcs[0].weight).toBeCloseTo(1.5);
		});
	});

	describe("comment handling", () => {
		it("should skip comment lines starting with %", () => {
			const content = `% This is a comment
*Vertices 2
1 "A"
% Another comment
2 "B"
*Edges
1 2`;
			const result = parsePajek(content);

			expect(result.vertices).toHaveLength(2);
			expect(result.edges).toHaveLength(1);
		});

		it("should skip empty lines", () => {
			const content = `*Vertices 2

1 "A"

2 "B"

*Edges
1 2`;
			const result = parsePajek(content);

			expect(result.vertices).toHaveLength(2);
			expect(result.edges).toHaveLength(1);
		});
	});

	describe("section handling", () => {
		it("should handle *edgeslist section", () => {
			const content = `*Vertices 3
*Edgeslist
1 2
2 3`;
			const result = parsePajek(content);

			expect(result.edges).toHaveLength(2);
		});

		it("should handle *arcslist section", () => {
			const content = `*Vertices 3
*Arcslist
1 2
2 3`;
			const result = parsePajek(content);

			expect(result.arcs).toHaveLength(2);
		});

		it("should handle mixed edges and arcs", () => {
			const content = `*Vertices 3
*Edges
1 2
*Arcs
2 3`;
			const result = parsePajek(content);

			expect(result.edges).toHaveLength(1);
			expect(result.arcs).toHaveLength(1);
			// Directed if only arcs or mix - checking the logic
			expect(result.directed).toBe(false); // Has both edges and arcs
		});

		it("should ignore unknown sections", () => {
			const content = `*Vertices 2
1 "A"
2 "B"
*Partition
1 1
*Edges
1 2`;
			const result = parsePajek(content);

			expect(result.vertices).toHaveLength(2);
			expect(result.edges).toHaveLength(1);
		});
	});

	describe("case insensitivity", () => {
		it("should parse section headers case-insensitively", () => {
			const content = `*VERTICES 2
1 "A"
2 "B"
*EDGES
1 2`;
			const result = parsePajek(content);

			expect(result.vertices).toHaveLength(2);
			expect(result.edges).toHaveLength(1);
		});
	});

	describe("line ending handling", () => {
		it("should handle Windows line endings (CRLF)", () => {
			const content = "*Vertices 2\r\n1 \"A\"\r\n2 \"B\"\r\n*Edges\r\n1 2";
			const result = parsePajek(content);

			expect(result.vertices).toHaveLength(2);
			expect(result.edges).toHaveLength(1);
		});
	});
});

describe("pajekToJson", () => {
	const baseMeta = {
		name: "test",
		description: "Test graph",
		source: "test",
		url: "test",
		citation: { authors: [], title: "test", year: 2024 },
		retrieved: "2024-01-01",
	};

	it("should convert simple graph to JSON", () => {
		const document = parsePajek(`*Vertices 2
1 "A"
2 "B"
*Edges
1 2`);
		const json = pajekToJson(document, { meta: baseMeta });

		expect(json.nodes).toHaveLength(2);
		expect(json.edges).toHaveLength(1);
		expect(json.meta.directed).toBe(false);
	});

	it("should preserve node labels", () => {
		const document = parsePajek(`*Vertices 2
1 "Node A"
2 "Node B"`);
		const json = pajekToJson(document, { meta: baseMeta });

		expect(json.nodes[0].label).toBe("Node A");
		expect(json.nodes[1].label).toBe("Node B");
	});

	it("should preserve node coordinates", () => {
		const document = parsePajek(`*Vertices 1
1 "A" 0.5 0.3 0.1`);
		const json = pajekToJson(document, { meta: baseMeta });

		expect(json.nodes[0].x).toBeCloseTo(0.5);
		expect(json.nodes[0].y).toBeCloseTo(0.3);
		expect(json.nodes[0].z).toBeCloseTo(0.1);
	});

	it("should respect directed option override", () => {
		const document = parsePajek(`*Vertices 2
*Edges
1 2`);
		const json = pajekToJson(document, { meta: baseMeta, directed: true });

		expect(json.meta.directed).toBe(true);
	});

	it("should infer directed from arcs", () => {
		const document = parsePajek(`*Vertices 2
*Arcs
1 2`);
		const json = pajekToJson(document, { meta: baseMeta });

		expect(json.meta.directed).toBe(true);
	});

	it("should create nodes for referenced vertices not in vertex list", () => {
		const document = parsePajek(`*Vertices 3
*Edges
1 2
2 3`);
		const json = pajekToJson(document, { meta: baseMeta });

		// Vertices 1, 2, 3 should be created even without explicit vertex lines
		expect(json.nodes).toHaveLength(3);
	});

	it("should preserve edge weights", () => {
		const document = parsePajek(`*Vertices 2
*Edges
1 2 0.75`);
		const json = pajekToJson(document, { meta: baseMeta });

		expect(json.edges[0].weight).toBeCloseTo(0.75);
	});

	it("should sort nodes by numeric ID", () => {
		const document = parsePajek(`*Vertices 3
3 "C"
1 "A"
2 "B"`);
		const json = pajekToJson(document, { meta: baseMeta });

		expect(json.nodes[0].id).toBe("1");
		expect(json.nodes[1].id).toBe("2");
		expect(json.nodes[2].id).toBe("3");
	});

	it("should convert edge source/target to string IDs", () => {
		const document = parsePajek(`*Vertices 2
*Edges
1 2`);
		const json = pajekToJson(document, { meta: baseMeta });

		expect(json.edges[0].source).toBe("1");
		expect(json.edges[0].target).toBe("2");
	});

	it("should create implicit vertices from vertexCount", () => {
		const document = parsePajek(`*Vertices 5
*Edges
1 2`);
		const json = pajekToJson(document, { meta: baseMeta });

		// Should have 5 nodes even though only 2 are referenced in edges
		expect(json.nodes).toHaveLength(5);
	});
});

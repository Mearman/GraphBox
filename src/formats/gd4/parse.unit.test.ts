import { describe, expect, it } from "vitest";

import { gd4ToJson, parseGd4 } from "./parse";

describe("parseGd4", () => {
	describe("basic parsing", () => {
		it("should parse the GD 2004 sample1 format", () => {
			const content = `10
873.0 207.0
593.0 237.0
686.0 273.0
842.0 766.0
48.0 472.0
690.0 999.0
228.0 786.0
678.0 710.0
767.0 164.0
791.0 160.0
0 4
0 5
3 6
2 7
5 7
6 7
5 8
1 9
6 9`;

			const doc = parseGd4(content);
			expect(doc.nodeCount).toBe(10);
			expect(doc.nodes).toHaveLength(10);
			expect(doc.edges).toHaveLength(9);

			// Check first node coordinates
			expect(doc.nodes[0]).toEqual({ index: 0, x: 873, y: 207 });
			expect(doc.nodes[9]).toEqual({ index: 9, x: 791, y: 160 });

			// Check edges (0-indexed)
			expect(doc.edges[0]).toEqual({ source: 0, target: 4 });
			expect(doc.edges[8]).toEqual({ source: 6, target: 9 });
		});

		it("should skip comment lines", () => {
			const content = `# Comment line
4
# Next N pairs are X,Y
0.0 0.0  # Node 0
0.0 5.0  # Node 1
5.0 5.0  # Node 2
5.0 0.0  # Node 3
# Edges
0 1
0 2
0 3`;

			const doc = parseGd4(content);
			expect(doc.nodeCount).toBe(4);
			expect(doc.nodes).toHaveLength(4);
			expect(doc.edges).toHaveLength(3);
		});

		it("should handle empty content", () => {
			const doc = parseGd4("");
			expect(doc.nodeCount).toBe(0);
			expect(doc.nodes).toHaveLength(0);
			expect(doc.edges).toHaveLength(0);
		});

		it("should handle Windows line endings", () => {
			const content = "3\r\n0.0 0.0\r\n1.0 1.0\r\n2.0 2.0\r\n0 1\r\n1 2\r\n";
			const doc = parseGd4(content);
			expect(doc.nodeCount).toBe(3);
			expect(doc.nodes).toHaveLength(3);
			expect(doc.edges).toHaveLength(2);
		});
	});
});

describe("gd4ToJson", () => {
	it("should convert GD4 document to JSON format", () => {
		const content = `4
0.0 0.0
0.0 5.0
5.0 5.0
5.0 0.0
0 1
0 2
1 3`;

		const doc = parseGd4(content);
		const json = gd4ToJson(doc, {
			meta: {
				name: "Test Graph",
				description: "A test graph",
				source: "test",
				url: "http://example.com",
				citation: { authors: ["Test"], title: "Test", year: 2024, type: "other" },
				retrieved: "2024-01-01",
			},
		});

		expect(json.meta.directed).toBe(false);
		expect(json.nodes).toHaveLength(4);
		expect(json.edges).toHaveLength(3);

		// Nodes should be 0-indexed string IDs with coordinates
		expect(json.nodes[0]).toEqual({ id: "0", x: 0, y: 0 });
		expect(json.nodes[3]).toEqual({ id: "3", x: 5, y: 0 });

		// Edges should use string IDs
		expect(json.edges[0]).toEqual({ source: "0", target: "1" });
	});

	it("should always mark graphs as undirected", () => {
		const doc = parseGd4("2\n0.0 0.0\n1.0 1.0\n0 1");
		const json = gd4ToJson(doc, {
			meta: {
				name: "Test",
				description: "Test",
				source: "test",
				url: "http://example.com",
				citation: { authors: ["Test"], title: "Test", year: 2024, type: "other" },
				retrieved: "2024-01-01",
			},
		});
		expect(json.meta.directed).toBe(false);
	});
});

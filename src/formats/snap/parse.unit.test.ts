/**
 * Unit tests for SNAP edge list parser
 */

import { describe, expect, it } from "vitest";

import { parseSnap, snapToJson } from "./parse";

describe("parseSnap", () => {
	describe("basic parsing", () => {
		it("should parse simple edge list", () => {
			const content = "1 2\n2 3\n3 1";
			const result = parseSnap(content);

			expect(result.edges).toHaveLength(3);
			expect(result.edges[0]).toEqual(["1", "2"]);
			expect(result.edges[1]).toEqual(["2", "3"]);
			expect(result.edges[2]).toEqual(["3", "1"]);
		});

		it("should handle tab-separated edges", () => {
			const content = "1\t2\n2\t3";
			const result = parseSnap(content);

			expect(result.edges).toHaveLength(2);
			expect(result.edges[0]).toEqual(["1", "2"]);
		});

		it("should handle multiple spaces between IDs", () => {
			const content = "1    2\n2     3";
			const result = parseSnap(content);

			expect(result.edges).toHaveLength(2);
		});

		it("should skip empty lines", () => {
			const content = "1 2\n\n\n2 3";
			const result = parseSnap(content);

			expect(result.edges).toHaveLength(2);
		});
	});

	describe("comment handling", () => {
		it("should skip comment lines", () => {
			const content = "# This is a comment\n1 2\n# Another comment\n2 3";
			const result = parseSnap(content);

			expect(result.edges).toHaveLength(2);
		});

		it("should store comments in metadata", () => {
			const content = "# Comment 1\n# Comment 2\n1 2";
			const result = parseSnap(content);

			expect(result.meta.comments).toHaveLength(2);
			expect(result.meta.comments).toContain("# Comment 1");
			expect(result.meta.comments).toContain("# Comment 2");
		});
	});

	describe("metadata extraction", () => {
		it("should extract node count from comments", () => {
			// Parser looks for pattern like "100 nodes" not "Nodes: 100"
			const content = "# 100 nodes\n1 2";
			const result = parseSnap(content);

			expect(result.meta.nodes).toBe(100);
		});

		it("should extract edge count from comments", () => {
			const content = "# 500 edges\n1 2";
			const result = parseSnap(content);

			expect(result.meta.edges).toBe(500);
		});

		it("should detect directed graph from comments", () => {
			const content = "# Directed graph\n1 2";
			const result = parseSnap(content);

			expect(result.meta.directed).toBe(true);
		});

		it("should detect undirected graph from comments", () => {
			const content = "# Undirected graph\n1 2";
			const result = parseSnap(content);

			expect(result.meta.directed).toBe(false);
		});

		it("should handle typical SNAP header format", () => {
			// Parser looks for patterns like "1000 nodes" and "5000 edges"
			const content = `# Directed graph
# 1000 nodes 5000 edges
# FromNodeId	ToNodeId
1	2
2	3`;
			const result = parseSnap(content);

			expect(result.meta.directed).toBe(true);
			expect(result.meta.nodes).toBe(1000);
			expect(result.meta.edges).toBe(5000);
			expect(result.edges).toHaveLength(2);
		});
	});

	describe("edge cases", () => {
		it("should handle empty content", () => {
			const result = parseSnap("");

			expect(result.edges).toHaveLength(0);
			expect(result.meta.comments).toHaveLength(0);
		});

		it("should handle content with only comments", () => {
			const content = "# Comment 1\n# Comment 2";
			const result = parseSnap(content);

			expect(result.edges).toHaveLength(0);
			expect(result.meta.comments).toHaveLength(2);
		});

		it("should handle non-numeric node IDs", () => {
			const content = "nodeA nodeB\nnodeB nodeC";
			const result = parseSnap(content);

			expect(result.edges).toHaveLength(2);
			expect(result.edges[0]).toEqual(["nodeA", "nodeB"]);
		});
	});
});

describe("snapToJson", () => {
	it("should convert SNAP document to JSON format", () => {
		const document = parseSnap("1 2\n2 3");
		const json = snapToJson(document, {
			meta: {
				name: "test",
				description: "Test graph",
				source: "test",
				url: "test",
				citation: { authors: [], title: "test", year: 2024 },
				retrieved: "2024-01-01",
			},
		});

		expect(json.nodes).toHaveLength(3);
		expect(json.edges).toHaveLength(2);
		expect(json.meta.name).toBe("test");
	});

	it("should respect directed option", () => {
		const document = parseSnap("1 2");
		const json = snapToJson(document, {
			meta: {
				name: "test",
				description: "",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
			},
			directed: true,
		});

		expect(json.meta.directed).toBe(true);
	});

	it("should infer directed from document metadata", () => {
		const document = parseSnap("# Directed graph\n1 2");
		const json = snapToJson(document, {
			meta: {
				name: "test",
				description: "",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
			},
		});

		expect(json.meta.directed).toBe(true);
	});

	it("should default to undirected", () => {
		const document = parseSnap("1 2");
		const json = snapToJson(document, {
			meta: {
				name: "test",
				description: "",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
			},
		});

		expect(json.meta.directed).toBe(false);
	});

	it("should sort numeric node IDs numerically", () => {
		const document = parseSnap("10 2\n2 1");
		const json = snapToJson(document, {
			meta: {
				name: "test",
				description: "",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
			},
		});

		const nodeIds = json.nodes.map((n) => n.id);
		expect(nodeIds).toEqual(["1", "2", "10"]);
	});
});

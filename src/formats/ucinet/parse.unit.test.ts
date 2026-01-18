/**
 * Unit tests for UCINet DL format parser
 */

import { describe, expect, it } from "vitest";

import { dlToJson, parseDl } from "./parse";

describe("parseDl", () => {
	describe("header parsing", () => {
		it("should parse basic DL header with n parameter", () => {
			const content = "dl n=5\ndata:\n0 1 0 0 0";
			const result = parseDl(content);

			expect(result.n).toBe(5);
		});

		it("should parse header with multiple parameters", () => {
			const content = "dl n=3 nm=2 format=fullmatrix\ndata:";
			const result = parseDl(content);

			expect(result.n).toBe(3);
			expect(result.nm).toBe(2);
			expect(result.format).toBe("fullmatrix");
		});

		it("should parse nr and nc parameters", () => {
			const content = "dl nr=3 nc=4\ndata:";
			const result = parseDl(content);

			expect(result.nr).toBe(3);
			expect(result.nc).toBe(4);
		});

		it("should default format to fullmatrix", () => {
			const content = "dl n=3\ndata:";
			const result = parseDl(content);

			expect(result.format).toBe("fullmatrix");
		});
	});

	describe("format parsing", () => {
		it("should parse format on separate line", () => {
			const content = "dl n=3\nformat = edgelist1\ndata:";
			const result = parseDl(content);

			expect(result.format).toBe("edgelist1");
		});

		it("should parse format with colon syntax", () => {
			const content = "dl n=3\nformat: edgelist2\ndata:";
			const result = parseDl(content);

			expect(result.format).toBe("edgelist2");
		});
	});

	describe("label parsing", () => {
		it("should parse simple labels", () => {
			const content = `dl n=3
labels:
Alice Bob Carol
data:`;
			const result = parseDl(content);

			expect(result.labels).toEqual(["Alice", "Bob", "Carol"]);
		});

		it("should parse quoted labels", () => {
			const content = `dl n=2
labels: "John Doe" "Jane Doe"
data:`;
			const result = parseDl(content);

			expect(result.labels).toEqual(["John Doe", "Jane Doe"]);
		});

		it("should parse comma-separated labels", () => {
			const content = `dl n=3
labels:
A, B, C
data:`;
			const result = parseDl(content);

			expect(result.labels).toEqual(["A", "B", "C"]);
		});

		it("should parse row labels", () => {
			const content = `dl n=2
row labels:
Row1
Row2
data:`;
			const result = parseDl(content);

			expect(result.rowLabels).toEqual(["Row1", "Row2"]);
		});

		it("should parse column labels", () => {
			const content = `dl n=2
col labels:
Col1
Col2
data:`;
			const result = parseDl(content);

			expect(result.colLabels).toEqual(["Col1", "Col2"]);
		});

		it("should parse matrix labels", () => {
			const content = `dl n=2 nm=2
matrix labels:
friendship advice
data:`;
			const result = parseDl(content);

			expect(result.matrixLabels).toEqual(["friendship", "advice"]);
		});
	});

	describe("fullmatrix format", () => {
		it("should parse simple fullmatrix", () => {
			const content = `dl n=3
data:
0 1 0
1 0 1
0 1 0`;
			const result = parseDl(content);

			expect(result.edges.length).toBeGreaterThan(0);
			// Non-zero entries become edges
			const edge = result.edges.find((e) => e.source === 0 && e.target === 1);
			expect(edge).toBeDefined();
		});

		it("should parse fullmatrix with diagonal absent", () => {
			const content = `dl n=3
diagonal absent
data:
1 0
0 1
1 0`;
			const result = parseDl(content);

			expect(result.diagonal).toBe(false);
		});

		it("should handle weighted fullmatrix", () => {
			const content = `dl n=2
data:
0 2.5
3.0 0`;
			const result = parseDl(content);

			const edge = result.edges.find((e) => e.source === 0 && e.target === 1);
			expect(edge?.weight).toBe(2.5);
		});
	});

	describe("edgelist1 format", () => {
		it("should parse edgelist1 (1-indexed)", () => {
			const content = `dl n=3 format=edgelist1
data:
1 2
2 3
1 3`;
			const result = parseDl(content);

			expect(result.edges).toHaveLength(3);
			// IDs should be converted to 0-indexed
			expect(result.edges[0]).toEqual({ source: 0, target: 1, weight: 1 });
		});

		it("should parse edgelist1 with weights", () => {
			const content = `dl n=3 format=edgelist1
data:
1 2 0.5
2 3 1.5`;
			const result = parseDl(content);

			expect(result.edges[0].weight).toBe(0.5);
			expect(result.edges[1].weight).toBe(1.5);
		});
	});

	describe("edgelist2 format", () => {
		it("should parse edgelist2 (0-indexed)", () => {
			const content = `dl n=3 format=edgelist2
data:
0 1
1 2`;
			const result = parseDl(content);

			expect(result.edges).toHaveLength(2);
			expect(result.edges[0]).toEqual({ source: 0, target: 1, weight: 1 });
		});
	});

	describe("nodelist1 format", () => {
		it("should parse nodelist1 format", () => {
			const content = `dl n=4 format=nodelist1
data:
1 2 3
2 3 4`;
			const result = parseDl(content);

			// Node 1 connects to 2 and 3
			expect(result.edges.some((e) => e.source === 0 && e.target === 1)).toBe(true);
			expect(result.edges.some((e) => e.source === 0 && e.target === 2)).toBe(true);
		});
	});

	describe("nodelist2 format", () => {
		it("should parse nodelist2 format (0-indexed)", () => {
			const content = `dl n=4 format=nodelist2
data:
0 1 2
1 2 3`;
			const result = parseDl(content);

			expect(result.edges.some((e) => e.source === 0 && e.target === 1)).toBe(true);
			expect(result.edges.some((e) => e.source === 0 && e.target === 2)).toBe(true);
		});
	});

	describe("comment handling", () => {
		it("should skip lines starting with !", () => {
			const content = `dl n=2
! This is a comment
labels:
A B
! Another comment
data:
0 1
1 0`;
			const result = parseDl(content);

			expect(result.labels).toEqual(["A", "B"]);
			expect(result.edges.length).toBeGreaterThan(0);
		});
	});

	describe("data on same line", () => {
		it("should handle data starting on same line as data:", () => {
			const content = `dl n=2
data: 0 1 1 0`;
			const result = parseDl(content);

			expect(result.edges.length).toBeGreaterThan(0);
		});

		it("should handle labels on same line as labels:", () => {
			const content = `dl n=2
labels: A B
data:
0 1
1 0`;
			const result = parseDl(content);

			expect(result.labels).toEqual(["A", "B"]);
		});
	});
});

describe("dlToJson", () => {
	const baseMeta = {
		name: "test",
		description: "Test graph",
		source: "test",
		url: "test",
		citation: { authors: [], title: "test", year: 2024 },
		retrieved: "2024-01-01",
	};

	it("should convert simple DL to JSON", () => {
		const document = parseDl(`dl n=3
data:
0 1 0
1 0 1
0 1 0`);
		const json = dlToJson(document, { meta: baseMeta });

		expect(json.nodes).toHaveLength(3);
		expect(json.edges.length).toBeGreaterThan(0);
	});

	it("should apply labels to nodes", () => {
		const document = parseDl(`dl n=2
labels: Alice Bob
data:
0 1
1 0`);
		const json = dlToJson(document, { meta: baseMeta });

		expect(json.nodes[0].label).toBe("Alice");
		expect(json.nodes[1].label).toBe("Bob");
	});

	it("should apply row labels to nodes", () => {
		const document = parseDl(`dl n=2
row labels: Row1 Row2
data:
0 1
1 0`);
		const json = dlToJson(document, { meta: baseMeta });

		expect(json.nodes[0].label).toBe("Row1");
		expect(json.nodes[1].label).toBe("Row2");
	});

	it("should default to directed graph", () => {
		const document = parseDl(`dl n=2
data:
0 1
0 0`);
		const json = dlToJson(document, { meta: baseMeta });

		expect(json.meta.directed).toBe(true);
	});

	it("should respect directed option override", () => {
		const document = parseDl(`dl n=2
data:
0 1
1 0`);
		const json = dlToJson(document, { meta: baseMeta, directed: false });

		expect(json.meta.directed).toBe(false);
	});

	it("should preserve edge weights", () => {
		const document = parseDl(`dl n=2
data:
0 2.5
0 0`);
		const json = dlToJson(document, { meta: baseMeta });

		const weightedEdge = json.edges.find((e) => e.weight !== undefined);
		expect(weightedEdge?.weight).toBe(2.5);
	});

	it("should add relation from matrix labels when nm > 1", () => {
		const document = parseDl(`dl n=2 nm=2
matrix labels: friendship advice
data:
0 1
1 0
0 0
1 0`);
		const json = dlToJson(document, { meta: baseMeta });

		// Edges from matrices with nm > 1 should have relation label
		const edgeWithRelation = json.edges.find((e) => e.relation !== undefined);
		expect(edgeWithRelation?.relation).toBeDefined();
	});

	it("should use 0-indexed string IDs for nodes", () => {
		const document = parseDl(`dl n=3
data:
0 1 0
0 0 1
0 0 0`);
		const json = dlToJson(document, { meta: baseMeta });

		expect(json.nodes[0].id).toBe("0");
		expect(json.nodes[1].id).toBe("1");
		expect(json.nodes[2].id).toBe("2");
	});

	it("should not include weight=1 in edges", () => {
		const document = parseDl(`dl n=2 format=edgelist1
data:
1 2`);
		const json = dlToJson(document, { meta: baseMeta });

		// Default weight of 1 should not be included
		expect(json.edges[0].weight).toBeUndefined();
	});
});

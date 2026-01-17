/**
 * Unit tests for edge list loader
 */

import { describe, expect, it } from "vitest";

import { loadEdgeList, loadGraph, loadGraphFromUrl, loadTriples } from "./edge-list-loader";

describe("loadEdgeList", () => {
	describe("basic parsing", () => {
		it("should parse simple edge list with whitespace delimiter", () => {
			const content = "1 2\n2 3\n3 1";
			const result = loadEdgeList(content);

			expect(result.nodeCount).toBe(3);
			expect(result.edgeCount).toBe(3);
			expect(result.warnings).toHaveLength(0);
		});

		it("should parse edge list with tab delimiter", () => {
			const content = "a\tb\nb\tc\nc\ta";
			const result = loadEdgeList(content, { delimiter: /\t/ });

			expect(result.nodeCount).toBe(3);
			expect(result.edgeCount).toBe(3);
		});

		it("should parse edge list with comma delimiter", () => {
			const content = "node1,node2\nnode2,node3";
			const result = loadEdgeList(content, { delimiter: /,/ });

			expect(result.nodeCount).toBe(3);
			expect(result.edgeCount).toBe(2);
		});

		it("should handle multiple whitespace between fields", () => {
			const content = "1    2\n2     3";
			const result = loadEdgeList(content);

			expect(result.nodeCount).toBe(3);
			expect(result.edgeCount).toBe(2);
		});
	});

	describe("directed/undirected", () => {
		it("should create undirected graph by default", () => {
			const content = "1 2";
			const result = loadEdgeList(content);

			expect(result.graph.isDirected()).toBe(false);
		});

		it("should create directed graph when specified", () => {
			const content = "1 2";
			const result = loadEdgeList(content, { directed: true });

			expect(result.graph.isDirected()).toBe(true);
		});
	});

	describe("comment handling", () => {
		it("should skip comment lines by default", () => {
			const content = "# This is a comment\n1 2\n# Another comment\n2 3";
			const result = loadEdgeList(content);

			expect(result.nodeCount).toBe(3);
			expect(result.edgeCount).toBe(2);
		});

		it("should include comment lines when skipComments is false", () => {
			const content = "# 1 2\n2 3";
			const result = loadEdgeList(content, { skipComments: false });

			// "#" and "1" become source and target node IDs (along with 2, 3)
			expect(result.nodeCount).toBe(4);
		});
	});

	describe("header lines", () => {
		it("should skip header lines when specified", () => {
			const content = "source target\nfrom to\n1 2\n2 3";
			const result = loadEdgeList(content, { headerLines: 2 });

			expect(result.nodeCount).toBe(3);
			expect(result.edgeCount).toBe(2);
		});

		it("should not skip any lines by default", () => {
			const content = "header1 header2\n1 2";
			const result = loadEdgeList(content);

			// "header1" and "header2" become node IDs
			expect(result.nodeCount).toBe(4);
			expect(result.edgeCount).toBe(2);
		});
	});

	describe("weighted edges", () => {
		it("should parse edge weights when weightColumn specified", () => {
			const content = "1 2 0.5\n2 3 1.5";
			const result = loadEdgeList(content, { weightColumn: 2 });

			expect(result.edgeCount).toBe(2);
			const edges = result.graph.getAllEdges();
			expect(edges[0].weight).toBe(0.5);
			expect(edges[1].weight).toBe(1.5);
		});

		it("should handle invalid weights with warning", () => {
			const content = "1 2 invalid";
			const result = loadEdgeList(content, { weightColumn: 2 });

			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings[0]).toContain("invalid weight");
		});

		it("should handle missing weight column gracefully", () => {
			const content = "1 2";
			const result = loadEdgeList(content, { weightColumn: 2 });

			expect(result.edgeCount).toBe(1);
			const edges = result.graph.getAllEdges();
			expect(edges[0].weight).toBeUndefined();
		});
	});

	describe("custom columns", () => {
		it("should use custom source and target columns", () => {
			const content = "extra1 nodeA nodeB extra2";
			const result = loadEdgeList(content, { sourceColumn: 1, targetColumn: 2 });

			expect(result.nodeCount).toBe(2);
			const nodes = result.graph.getAllNodes();
			const nodeIds = nodes.map((n) => n.id);
			expect(nodeIds).toContain("nodeA");
			expect(nodeIds).toContain("nodeB");
		});
	});

	describe("custom node type", () => {
		it("should use custom node type", () => {
			const content = "1 2";
			const result = loadEdgeList(content, { nodeType: "Paper" });

			const nodes = result.graph.getAllNodes();
			expect(nodes[0].type).toBe("Paper");
		});
	});

	describe("empty and malformed input", () => {
		it("should handle empty content", () => {
			const result = loadEdgeList("");

			expect(result.nodeCount).toBe(0);
			expect(result.edgeCount).toBe(0);
		});

		it("should handle content with only comments", () => {
			const content = "# comment 1\n# comment 2";
			const result = loadEdgeList(content);

			expect(result.nodeCount).toBe(0);
			expect(result.edgeCount).toBe(0);
		});

		it("should handle content with only empty lines", () => {
			const content = "\n\n\n";
			const result = loadEdgeList(content);

			expect(result.nodeCount).toBe(0);
			expect(result.edgeCount).toBe(0);
		});

		it("should warn about lines with insufficient fields", () => {
			const content = "1\n2 3";
			const result = loadEdgeList(content);

			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings[0]).toContain("insufficient fields");
		});
	});

	describe("result metadata", () => {
		it("should return correct nodeTypes", () => {
			const content = "1 2";
			const result = loadEdgeList(content, { nodeType: "Author" });

			expect(result.nodeTypes.has("Author")).toBe(true);
		});

		it("should return edge type as 'edge'", () => {
			const content = "1 2";
			const result = loadEdgeList(content);

			expect(result.edgeTypes.has("edge")).toBe(true);
		});
	});
});

describe("loadTriples", () => {
	describe("basic parsing", () => {
		it("should parse basic triples", () => {
			const content = "Alice\tknows\tBob\nBob\tworks_at\tAcme";
			const result = loadTriples(content);

			expect(result.nodeCount).toBe(3);
			expect(result.edgeCount).toBe(2);
		});

		it("should create directed graph", () => {
			const content = "A\trel\tB";
			const result = loadTriples(content);

			expect(result.graph.isDirected()).toBe(true);
		});

		it("should track relation types", () => {
			const content = "A\tknows\tB\nB\tlikes\tC";
			const result = loadTriples(content);

			expect(result.edgeTypes.has("knows")).toBe(true);
			expect(result.edgeTypes.has("likes")).toBe(true);
		});
	});

	describe("custom configuration", () => {
		it("should use custom delimiter", () => {
			const content = "A,knows,B";
			const result = loadTriples(content, { delimiter: /,/ });

			expect(result.nodeCount).toBe(2);
			expect(result.edgeCount).toBe(1);
		});

		it("should use custom column indices", () => {
			const content = "0\tA\tknows\tB\t1";
			const result = loadTriples(content, {
				headColumn: 1,
				relationColumn: 2,
				tailColumn: 3,
			});

			expect(result.nodeCount).toBe(2);
			const edges = result.graph.getAllEdges();
			expect(edges[0].relation).toBe("knows");
		});
	});

	describe("error handling", () => {
		it("should warn about lines with insufficient fields", () => {
			const content = "A\tB\nC\trel\tD";
			const result = loadTriples(content);

			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings[0]).toContain("insufficient fields");
		});
	});
});

describe("loadGraph", () => {
	describe("format hints", () => {
		it("should use edge-list hint", () => {
			const content = "1 2\n2 3";
			const result = loadGraph(content, "edge-list");

			expect(result.nodeCount).toBe(3);
			expect(result.edgeCount).toBe(2);
		});

		it("should use triples hint", () => {
			// Triples loader uses tab delimiter by default
			const content = "A\tknows\tB";
			const result = loadGraph(content, "triples");

			expect(result.nodeCount).toBe(2);
			expect(result.edgeTypes.has("knows")).toBe(true);
		});

		it("should use weighted-edge-list hint", () => {
			const content = "1 2 0.5";
			const result = loadGraph(content, "weighted-edge-list");

			const edges = result.graph.getAllEdges();
			expect(edges[0].weight).toBe(0.5);
		});
	});

	describe("auto-detection", () => {
		it("should detect triples format when middle field is non-numeric", () => {
			const content = "Alice knows Bob";
			const result = loadGraph(content);

			expect(result.edgeTypes.has("knows")).toBe(true);
		});

		it("should detect edge list when content has two columns", () => {
			const content = "1 2\n2 3";
			const result = loadGraph(content);

			expect(result.nodeCount).toBe(3);
			expect(result.edgeCount).toBe(2);
		});

		it("should handle empty content", () => {
			const result = loadGraph("");

			expect(result.nodeCount).toBe(0);
			expect(result.warnings).toContain("Empty file or only comments");
		});

		it("should handle content with only comments", () => {
			const content = "# comment only";
			const result = loadGraph(content);

			expect(result.nodeCount).toBe(0);
			expect(result.warnings).toContain("Empty file or only comments");
		});
	});
});

describe("loadGraphFromUrl", () => {
	it("should be a function", () => {
		expect(typeof loadGraphFromUrl).toBe("function");
	});

	// Network-dependent tests would require mocking fetch
	// These integration tests are skipped but the function signature is verified
});

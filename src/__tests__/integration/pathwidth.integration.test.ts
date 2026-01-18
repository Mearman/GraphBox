/**
 * Integration tests for pathwidth-bounded graphs.
 *
 * Tests the complete pipeline: spec → generation → analysis → validation
 * for pathwidth graph property.
 */

import { describe, expect, it } from "vitest";

import { computePathwidth } from "../../analyzer/width";
import { generateGraph } from "../../generation/generator";
import { makeGraphSpec } from "../../generation/spec";
import type { GraphSpec } from "../../generation/spec";
import { toAnalyzerGraph, toCoreGraph } from "../../utils/graph-adapters";
import { validatePathwidth } from "../../validation/width";

describe("Pathwidth Graph Integration", () => {
	describe("Generation and Analysis Round-trip", () => {
		const testSizes = [4, 8, 12, 20];

		for (const nodeCount of testSizes) {
			it(`should generate and correctly analyze pathwidth-bounded graph with ${nodeCount} nodes`, () => {
				// Create spec for pathwidth-bounded graph
				const spec: GraphSpec = {
					...makeGraphSpec({}),
					pathwidth: { kind: "pathwidth_bounded" },
					directionality: { kind: "undirected" },
				};

				// Generate graph
				const graph = generateGraph(spec, { nodeCount, seed: 42 });

				// Verify node count
				expect(graph.nodes).toHaveLength(nodeCount);

				// Analyze graph
				const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
				const analyzed = computePathwidth(analyzerGraph);

				// Should be classified as pathwidth-bounded
				expect(analyzed.kind).toBe("pathwidth_bounded");
			});
		}

		it("should generate pathwidth-bounded graphs deterministically", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				pathwidth: { kind: "pathwidth_bounded" },
				directionality: { kind: "undirected" },
			};

			// Generate two graphs with same seed
			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 654 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 654 });

			// Should have identical structure
			expect(graph1.nodes.length).toBe(graph2.nodes.length);
			expect(graph1.edges.length).toBe(graph2.edges.length);

			// Edges should match (after sorting)
			const edges1 = graph1.edges
				.map((e) => `${e.source}-${e.target}`)
				.sort();
			const edges2 = graph2.edges
				.map((e) => `${e.source}-${e.target}`)
				.sort();
			expect(edges1).toEqual(edges2);
		});

		it("should generate trees with pathwidth 1", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				pathwidth: { kind: "pathwidth_bounded" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "connected" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify tree structure
			const n = graph.nodes.length;
			const m = graph.edges.length;
			expect(m).toBe(n - 1);

			// Analyze pathwidth
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computePathwidth(analyzerGraph);
			expect(analyzed.kind).toBe("pathwidth_bounded");
		});
	});

	describe("Validation", () => {
		it("should validate correctly generated pathwidth-bounded graphs", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				pathwidth: { kind: "pathwidth_bounded" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const result = validatePathwidth(graph);

			expect(result.valid).toBe(true);
			expect(result.actual).toBe("pathwidth_bounded");
		});

		it("should handle unconstrained pathwidth property", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				pathwidth: { kind: "unconstrained" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const result = validatePathwidth(graph);

			// Unconstrained graphs always pass validation
			expect(result.valid).toBe(true);
		});
	});

	describe("Property Combinations", () => {
		it("should generate pathwidth-bounded + connected graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				pathwidth: { kind: "pathwidth_bounded" },
				connectivity: { kind: "connected" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify pathwidth property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computePathwidth(analyzerGraph);
			expect(analyzed.kind).toBe("pathwidth_bounded");

			// Validate
			const result = validatePathwidth(graph);
			expect(result.valid).toBe(true);
		});

		it("should generate pathwidth-bounded + planar graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				pathwidth: { kind: "pathwidth_bounded" },
				planar: { kind: "planar" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify pathwidth property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computePathwidth(analyzerGraph);
			expect(analyzed.kind).toBe("pathwidth_bounded");

			// Validate
			const result = validatePathwidth(graph);
			expect(result.valid).toBe(true);
		});
	});
});

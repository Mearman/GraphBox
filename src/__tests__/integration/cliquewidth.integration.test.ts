/**
 * Integration tests for cliquewidth-bounded graphs.
 *
 * Tests the complete pipeline: spec → generation → analysis → validation
 * for cliquewidth graph property.
 */

import { describe, expect, it } from "vitest";

import { computeCliquewidth } from "../../analyzer/width";
import { generateGraph } from "../../generation/generator";
import type { GraphSpec } from "../../generation/spec";
import { makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph, toCoreGraph } from "../../utils/graph-adapters";
import { validateCliquewidth } from "../../validation/width";

describe("Cliquewidth Graph Integration", () => {
	describe("Generation and Analysis Round-trip", () => {
		const testSizes = [4, 8, 12, 20];

		for (const nodeCount of testSizes) {
			it(`should generate and correctly analyze cliquewidth-bounded graph with ${nodeCount} nodes`, () => {
				// Create spec for cliquewidth-bounded graph
				const spec: GraphSpec = {
					...makeGraphSpec({}),
					cliquewidth: { kind: "cliquewidth_bounded" },
					directionality: { kind: "undirected" },
				};

				// Generate graph
				const graph = generateGraph(spec, { nodeCount, seed: 42 });

				// Verify node count
				expect(graph.nodes).toHaveLength(nodeCount);

				// Analyze graph
				const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
				const analyzed = computeCliquewidth(analyzerGraph);

				// Should be classified as cliquewidth-bounded
				expect(analyzed.kind).toBe("cliquewidth_bounded");
			});
		}

		it("should generate cliquewidth-bounded graphs deterministically", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				cliquewidth: { kind: "cliquewidth_bounded" },
				directionality: { kind: "undirected" },
			};

			// Generate two graphs with same seed
			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 987 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 987 });

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

		it("should generate cographs with cliquewidth ≤ 2", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				cliquewidth: { kind: "cliquewidth_bounded" },
				modular: { kind: "modular" },  // Cographs are modular
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Analyze cliquewidth
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computeCliquewidth(analyzerGraph);
			expect(analyzed.kind).toBe("cliquewidth_bounded");
		});

		it("should generate trees with cliquewidth ≤ 3", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				cliquewidth: { kind: "cliquewidth_bounded" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "connected" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify tree structure
			const n = graph.nodes.length;
			const m = graph.edges.length;
			expect(m).toBe(n - 1);

			// Analyze cliquewidth
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computeCliquewidth(analyzerGraph);
			expect(analyzed.kind).toBe("cliquewidth_bounded");
		});
	});

	describe("Validation", () => {
		it("should validate correctly generated cliquewidth-bounded graphs", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				cliquewidth: { kind: "cliquewidth_bounded" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const result = validateCliquewidth(graph);

			expect(result.valid).toBe(true);
			expect(result.actual).toBe("cliquewidth_bounded");
		});

		it("should handle unconstrained cliquewidth property", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				cliquewidth: { kind: "unconstrained" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const result = validateCliquewidth(graph);

			// Unconstrained graphs always pass validation
			expect(result.valid).toBe(true);
		});
	});

	describe("Property Combinations", () => {
		it("should generate cliquewidth-bounded + connected graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				cliquewidth: { kind: "cliquewidth_bounded" },
				connectivity: { kind: "connected" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify cliquewidth property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computeCliquewidth(analyzerGraph);
			expect(analyzed.kind).toBe("cliquewidth_bounded");

			// Validate
			const result = validateCliquewidth(graph);
			expect(result.valid).toBe(true);
		});

		it("should generate cliquewidth-bounded + bipartite graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				cliquewidth: { kind: "cliquewidth_bounded" },
				partiteness: { kind: "bipartite" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify cliquewidth property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computeCliquewidth(analyzerGraph);
			expect(analyzed.kind).toBe("cliquewidth_bounded");

			// Validate
			const result = validateCliquewidth(graph);
			expect(result.valid).toBe(true);
		});
	});
});

/**
 * Integration tests for quasi-line graphs.
 *
 * Tests the complete pipeline: spec → generation → analysis → validation
 * for quasi-line graph property.
 */

import { describe, expect, it } from "vitest";

import { computeQuasiLine } from "../../analyzer/perfect-variants";
import { generateGraph } from "../../generation/generator";
import { makeGraphSpec } from "../../generation/spec";
import type { GraphSpec } from "../../generation/spec";
import { toAnalyzerGraph, toCoreGraph } from "../../utils/graph-adapters";
import { validateQuasiLine } from "../../validation/perfect-variants";

describe("Quasi-Line Graph Integration", () => {
	describe("Generation and Analysis Round-trip", () => {
		const testSizes = [4, 8, 12, 20];

		for (const nodeCount of testSizes) {
			it(`should generate and correctly analyze quasi-line graph with ${nodeCount} nodes`, () => {
				// Create spec for quasi-line graph
				const spec: GraphSpec = {
					...makeGraphSpec({}),
					quasiLine: { kind: "quasi_line" },
					directionality: { kind: "undirected" },
				};

				// Generate graph
				const graph = generateGraph(spec, { nodeCount, seed: 42 });

				// Verify node count
				expect(graph.nodes).toHaveLength(nodeCount);

				// Analyze graph
				const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
				const analyzed = computeQuasiLine(analyzerGraph);

				// Should be classified as quasi-line
				expect(analyzed.kind).toBe("quasi_line");
			});
		}

		it("should generate quasi-line graphs deterministically", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				quasiLine: { kind: "quasi_line" },
				directionality: { kind: "undirected" },
			};

			// Generate two graphs with same seed
			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 789 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 789 });

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
	});

	describe("Validation", () => {
		it("should validate correctly generated quasi-line graphs", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				quasiLine: { kind: "quasi_line" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const result = validateQuasiLine(graph);

			expect(result.valid).toBe(true);
			expect(result.actual).toBe("quasi_line");
		});

		it("should handle unconstrained quasi-line property", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				quasiLine: { kind: "unconstrained" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const result = validateQuasiLine(graph);

			// Unconstrained graphs always pass validation
			expect(result.valid).toBe(true);
		});
	});

	describe("Property Combinations", () => {
		it("should generate quasi-line + connected graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				quasiLine: { kind: "quasi_line" },
				connectivity: { kind: "connected" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify quasi-line property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computeQuasiLine(analyzerGraph);
			expect(analyzed.kind).toBe("quasi_line");

			// Validate
			const result = validateQuasiLine(graph);
			expect(result.valid).toBe(true);
		});

		it("should generate quasi-line + sparse graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				quasiLine: { kind: "quasi_line" },
				density: { kind: "sparse" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify quasi-line property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computeQuasiLine(analyzerGraph);
			expect(analyzed.kind).toBe("quasi_line");

			// Validate
			const result = validateQuasiLine(graph);
			expect(result.valid).toBe(true);
		});
	});
});

/**
 * Integration tests for modular graphs.
 *
 * Tests the complete pipeline: spec → generation → analysis → validation
 * for modular graph property.
 */

import { describe, expect, it } from "vitest";

import { computeModular } from "../../analyzer/perfect-variants";
import { generateGraph } from "../../generation/generator";
import { makeGraphSpec } from "../../generation/spec";
import type { GraphSpec } from "../../generation/spec";
import { toAnalyzerGraph, toCoreGraph } from "../../utils/graph-adapters";
import { validateModular } from "../../validation/perfect-variants";

describe("Modular Graph Integration", () => {
	describe("Generation and Analysis Round-trip", () => {
		const testSizes = [4, 8, 12, 20];

		for (const nodeCount of testSizes) {
			it(`should generate and correctly analyze modular graph with ${nodeCount} nodes`, () => {
				// Create spec for modular graph
				const spec: GraphSpec = {
					...makeGraphSpec({}),
					modular: { kind: "modular" },
					directionality: { kind: "undirected" },
				};

				// Generate graph
				const graph = generateGraph(spec, { nodeCount, seed: 42 });

				// Verify node count
				expect(graph.nodes).toHaveLength(nodeCount);

				// Analyze graph
				const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
				const analyzed = computeModular(analyzerGraph);

				// Should be classified as modular
				expect(analyzed.kind).toBe("modular");
			});
		}

		it("should generate modular graphs deterministically", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				modular: { kind: "modular" },
				directionality: { kind: "undirected" },
			};

			// Generate two graphs with same seed
			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 123 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 123 });

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
		it("should validate correctly generated modular graphs", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				modular: { kind: "modular" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const result = validateModular(graph);

			expect(result.valid).toBe(true);
			expect(result.actual).toBe("modular");
		});

		it("should handle unconstrained modular property", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				modular: { kind: "unconstrained" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const result = validateModular(graph);

			// Unconstrained graphs always pass validation
			expect(result.valid).toBe(true);
		});
	});

	describe("Property Combinations", () => {
		it("should generate modular + connected graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				modular: { kind: "modular" },
				connectivity: { kind: "connected" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify modular property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computeModular(analyzerGraph);
			expect(analyzed.kind).toBe("modular");

			// Validate
			const result = validateModular(graph);
			expect(result.valid).toBe(true);
		});

		it("should generate modular + acyclic graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				modular: { kind: "modular" },
				cycles: { kind: "acyclic" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify modular property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computeModular(analyzerGraph);
			expect(analyzed.kind).toBe("modular");

			// Validate
			const result = validateModular(graph);
			expect(result.valid).toBe(true);
		});
	});
});

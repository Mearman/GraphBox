/**
 * Integration tests for ptolemaic graphs.
 *
 * Tests the complete pipeline: spec → generation → analysis → validation
 * for ptolemaic graph property.
 */

import { describe, expect, it } from "vitest";

import { computePtolemaic } from "../../analyzer/perfect-variants";
import { generateGraph } from "../../generation/generator";
import { makeGraphSpec } from "../../generation/spec";
import type { GraphSpec } from "../../generation/spec";
import { toAnalyzerGraph, toCoreGraph } from "../../utils/graph-adapters";
import { validatePtolemaic } from "../../validation/perfect-variants";

describe("Ptolemaic Graph Integration", () => {
	describe("Generation and Analysis Round-trip", () => {
		const testSizes = [4, 8, 12, 20];

		for (const nodeCount of testSizes) {
			it(`should generate and correctly analyze ptolemaic graph with ${nodeCount} nodes`, () => {
				// Create spec for ptolemaic graph
				const spec: GraphSpec = {
					...makeGraphSpec({}),
					ptolemaic: { kind: "ptolemaic" },
					directionality: { kind: "undirected" },
				};

				// Generate graph
				const graph = generateGraph(spec, { nodeCount, seed: 42 });

				// Verify node count
				expect(graph.nodes).toHaveLength(nodeCount);

				// Analyze graph
				const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
				const analyzed = computePtolemaic(analyzerGraph);

				// Should be classified as ptolemaic
				expect(analyzed.kind).toBe("ptolemaic");
			});
		}

		it("should generate ptolemaic graphs deterministically", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				ptolemaic: { kind: "ptolemaic" },
				directionality: { kind: "undirected" },
			};

			// Generate two graphs with same seed
			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 456 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 456 });

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
		it("should validate correctly generated ptolemaic graphs", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				ptolemaic: { kind: "ptolemaic" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const result = validatePtolemaic(graph);

			expect(result.valid).toBe(true);
			expect(result.actual).toBe("ptolemaic");
		});

		it("should handle unconstrained ptolemaic property", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				ptolemaic: { kind: "unconstrained" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const result = validatePtolemaic(graph);

			// Unconstrained graphs always pass validation
			expect(result.valid).toBe(true);
		});
	});

	describe("Property Combinations", () => {
		it("should generate ptolemaic + connected graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				ptolemaic: { kind: "ptolemaic" },
				connectivity: { kind: "connected" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify ptolemaic property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computePtolemaic(analyzerGraph);
			expect(analyzed.kind).toBe("ptolemaic");

			// Validate
			const result = validatePtolemaic(graph);
			expect(result.valid).toBe(true);
		});

		it("should generate ptolemaic + acyclic graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				ptolemaic: { kind: "ptolemaic" },
				cycles: { kind: "acyclic" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify ptolemaic property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computePtolemaic(analyzerGraph);
			expect(analyzed.kind).toBe("ptolemaic");

			// Validate
			const result = validatePtolemaic(graph);
			expect(result.valid).toBe(true);
		});
	});
});

/**
 * Integration tests for planar graphs.
 *
 * Tests the complete pipeline: spec → generation → analysis → validation
 * for planar graph property.
 */

import { describe, expect, it } from "vitest";

import { computePlanar } from "../../analyzer/geometric";
import { generateGraph } from "../../generation/generator";
import type { GraphSpec } from "../../generation/spec";
import { makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph, toCoreGraph } from "../../utils/graph-adapters";

describe("Planar Graph Integration", () => {
	describe("Generation and Analysis Round-trip", () => {
		const testSizes = [4, 8, 12, 20];

		for (const nodeCount of testSizes) {
			it(`should generate and correctly analyze planar graph with ${nodeCount} nodes`, () => {
				// Create spec for planar graph
				const spec: GraphSpec = {
					...makeGraphSpec({}),
					planar: { kind: "planar" },
					directionality: { kind: "undirected" },
				};

				// Generate graph
				const graph = generateGraph(spec, { nodeCount, seed: 42 });

				// Verify node count
				expect(graph.nodes).toHaveLength(nodeCount);

				// Analyze graph
				const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
				const analyzed = computePlanar(analyzerGraph);

				// Should be classified as planar
				expect(analyzed.kind).toBe("planar");
			});
		}

		it("should generate planar graphs deterministically", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				planar: { kind: "planar" },
				directionality: { kind: "undirected" },
			};

			// Generate two graphs with same seed
			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 321 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 321 });

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

		it("should generate planar graphs with edge count ≤ 3n-6", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				planar: { kind: "planar" },
				directionality: { kind: "undirected" },
			};

			for (const n of [5, 10, 15, 20]) {
				const graph = generateGraph(spec, { nodeCount: n, seed: 42 });
				const m = graph.edges.length;

				// For connected planar graphs: m ≤ 3n - 6 (when n ≥ 3)
				if (n >= 3) {
					expect(m).toBeLessThanOrEqual(3 * n - 6);
				}
			}
		});
	});

	describe("Property Combinations", () => {
		it("should generate planar + connected graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				planar: { kind: "planar" },
				connectivity: { kind: "connected" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify planar property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computePlanar(analyzerGraph);
			expect(analyzed.kind).toBe("planar");

			// Verify edge count constraint
			const n = graph.nodes.length;
			const m = graph.edges.length;
			if (n >= 3) {
				expect(m).toBeLessThanOrEqual(3 * n - 6);
			}
		});

		it("should generate planar + acyclic graph (tree)", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				planar: { kind: "planar" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "connected" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Verify planar property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computePlanar(analyzerGraph);
			expect(analyzed.kind).toBe("planar");

			// Trees are always planar
			const n = graph.nodes.length;
			const m = graph.edges.length;
			expect(m).toBe(n - 1); // Tree property
		});

		it("should generate planar + sparse graph", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({}),
				planar: { kind: "planar" },
				density: { kind: "sparse" },
				directionality: { kind: "undirected" },
			};

			const graph = generateGraph(spec, { nodeCount: 15, seed: 42 });

			// Verify planar property
			const analyzerGraph = toAnalyzerGraph(toCoreGraph(graph));
			const analyzed = computePlanar(analyzerGraph);
			expect(analyzed.kind).toBe("planar");
		});
	});
});

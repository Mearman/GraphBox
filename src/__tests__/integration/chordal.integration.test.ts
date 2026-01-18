/**
 * Integration tests for Chordal graph class
 *
 * Chordal: every cycle of length >= 4 has a chord (edge between non-adjacent vertices).
 * Equivalent: has a perfect elimination ordering.
 * Examples: trees, complete graphs, interval graphs.
 */

import { describe, expect, it } from "vitest";

import { isChordal } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { type GraphSpec,makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

describe("Chordal Graph Class", () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify a chordal graph correctly", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				chordal: { kind: "chordal" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isChordal(analyzerGraph)).toBe(true);
		});

		it("should classify chordal graphs of various sizes", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				chordal: { kind: "chordal" },
			};

			for (const nodeCount of [4, 8, 12, 16]) {
				const testGraph = generateGraph(spec, { nodeCount, seed: nodeCount });
				const analyzerGraph = toAnalyzerGraph(testGraph);

				expect(isChordal(analyzerGraph)).toBe(true);
			}
		});
	});

	describe("trees are chordal", () => {
		it("should classify trees as chordal (trees have no cycles)", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "connected" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// Trees are trivially chordal (no cycles at all)
			expect(isChordal(analyzerGraph)).toBe(true);
		});
	});

	describe("complete graphs are chordal", () => {
		it("should classify complete graphs as chordal", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				completeness: { kind: "complete" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 6, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// Complete graphs are chordal (every possible chord exists)
			expect(isChordal(analyzerGraph)).toBe(true);
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical chordal graphs with same seed", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				chordal: { kind: "chordal" },
			};

			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
		});
	});
});

/**
 * Integration tests for Perfect graph class
 *
 * Perfect: ω(H) = χ(H) for all induced subgraphs H (clique number = chromatic number).
 * Examples: chordal, bipartite, cograph.
 */

import { describe, expect, it } from "vitest";

import { isPerfect } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { type GraphSpec,makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

describe("Perfect Graph Class", () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify a perfect graph correctly", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				perfect: { kind: "perfect" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isPerfect(analyzerGraph)).toBe(true);
		});

		it("should classify perfect graphs of various sizes", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				perfect: { kind: "perfect" },
			};

			for (const nodeCount of [4, 8, 12, 16]) {
				const testGraph = generateGraph(spec, { nodeCount, seed: nodeCount });
				const analyzerGraph = toAnalyzerGraph(testGraph);

				expect(isPerfect(analyzerGraph)).toBe(true);
			}
		});
	});

	describe("perfect graph subclasses", () => {
		it("should classify chordal graphs as perfect", () => {
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

			// Chordal graphs are perfect (Strong Perfect Graph Theorem)
			expect(isPerfect(analyzerGraph)).toBe(true);
		});

		it("should classify bipartite graphs as perfect", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				partiteness: { kind: "bipartite" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// Bipartite graphs are perfect
			expect(isPerfect(analyzerGraph)).toBe(true);
		});

		it("should classify cographs as perfect", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				cograph: { kind: "cograph" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// Cographs are perfect
			expect(isPerfect(analyzerGraph)).toBe(true);
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical perfect graphs with same seed", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				perfect: { kind: "perfect" },
			};

			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
		});
	});
});

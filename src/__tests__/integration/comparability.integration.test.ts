/**
 * Integration tests for Comparability graph class
 *
 * Comparability: edges can be transitively oriented (partial order).
 * Equivalent: intersection graph of a family of sets ordered by inclusion.
 */

import { describe, expect, it } from "vitest";

import { isComparability } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { type GraphSpec,makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

describe("Comparability Graph Class", () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify a comparability graph correctly", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				comparability: { kind: "comparability" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isComparability(analyzerGraph)).toBe(true);
		});

		it("should classify comparability graphs of various sizes", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				comparability: { kind: "comparability" },
			};

			for (const nodeCount of [4, 8, 12, 16]) {
				const testGraph = generateGraph(spec, { nodeCount, seed: nodeCount });
				const analyzerGraph = toAnalyzerGraph(testGraph);

				expect(isComparability(analyzerGraph)).toBe(true);
			}
		});
	});

	describe("complete graphs are comparability", () => {
		it("should classify complete graphs as comparability graphs", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				completeness: { kind: "complete" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 6, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// Complete graphs are comparability (totally ordered)
			expect(isComparability(analyzerGraph)).toBe(true);
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical comparability graphs with same seed", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				comparability: { kind: "comparability" },
			};

			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
		});
	});
});

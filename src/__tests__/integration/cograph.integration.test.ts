/**
 * Integration tests for Cograph graph class
 *
 * Cograph: P4-free graph (contains no induced path on 4 vertices).
 * Can be constructed recursively using disjoint union and complement operations.
 */

import { describe, expect, it } from "vitest";

import { isCograph } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { type GraphSpec,makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

describe("Cograph Graph Class", () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify a cograph correctly", () => {
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

			expect(isCograph(analyzerGraph)).toBe(true);
		});

		it("should classify cographs of various sizes", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				cograph: { kind: "cograph" },
			};

			for (const nodeCount of [4, 8, 12, 16]) {
				const testGraph = generateGraph(spec, { nodeCount, seed: nodeCount });
				const analyzerGraph = toAnalyzerGraph(testGraph);

				expect(isCograph(analyzerGraph)).toBe(true);
			}
		});
	});

	describe("complete graphs are cographs", () => {
		it("should classify complete graphs as cographs", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				completeness: { kind: "complete" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 6, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// Complete graphs are cographs (no P4 possible)
			expect(isCograph(analyzerGraph)).toBe(true);
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical cographs with same seed", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				cograph: { kind: "cograph" },
			};

			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
		});
	});
});

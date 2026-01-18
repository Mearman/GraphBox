/**
 * Integration tests for Planar graph class
 *
 * Planar: can be drawn in the plane without edge crossings.
 * Equivalent: does not contain K5 or K3,3 as a minor (Kuratowski's theorem).
 */

import { describe, expect, it } from "vitest";

import { isPlanar } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { type GraphSpec,makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

describe("Planar Graph Class", () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify a planar graph correctly", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				planarity: { kind: "planar" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isPlanar(analyzerGraph)).toBe(true);
		});

		it("should classify planar graphs of various sizes", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				planarity: { kind: "planar" },
			};

			for (const nodeCount of [4, 8, 12, 16]) {
				const testGraph = generateGraph(spec, { nodeCount, seed: nodeCount });
				const analyzerGraph = toAnalyzerGraph(testGraph);

				expect(isPlanar(analyzerGraph)).toBe(true);
			}
		});
	});

	describe("small graphs are planar", () => {
		it("should classify K4 as planar", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				completeness: { kind: "complete" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 4, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// K4 is planar
			expect(isPlanar(analyzerGraph)).toBe(true);
		});

		it("should classify trees as planar", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "connected" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// Trees are planar
			expect(isPlanar(analyzerGraph)).toBe(true);
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical planar graphs with same seed", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				planarity: { kind: "planar" },
			};

			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
		});
	});
});

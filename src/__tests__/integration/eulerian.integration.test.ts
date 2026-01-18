/**
 * Integration tests for Eulerian graph class
 *
 * Eulerian: has a circuit that visits every edge exactly once.
 * Equivalent: connected graph where all vertices have even degree.
 * Semi-Eulerian: has a trail (not circuit) visiting every edge exactly once.
 */

import { describe, expect, it } from "vitest";

import { isEulerian } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { type GraphSpec,makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

describe("Eulerian Graph Class", () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify an Eulerian graph correctly", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				eulerian: { kind: "eulerian" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 8, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isEulerian(analyzerGraph)).toBe(true);
		});

		it("should classify Eulerian graphs of various sizes", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				eulerian: { kind: "eulerian" },
			};

			for (const nodeCount of [4, 6, 8, 10]) {
				const testGraph = generateGraph(spec, { nodeCount, seed: nodeCount });
				const analyzerGraph = toAnalyzerGraph(testGraph);

				expect(isEulerian(analyzerGraph)).toBe(true);
			}
		});
	});

	describe("2-regular graphs are Eulerian", () => {
		it("should classify 2-regular graphs as Eulerian", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				specificRegular: { kind: "k_regular", k: 2 },
			};

			const testGraph = generateGraph(spec, { nodeCount: 8, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// 2-regular graphs have all vertices with even degree
			expect(isEulerian(analyzerGraph)).toBe(true);
		});
	});

	describe("complete graphs with odd vertex count are Eulerian", () => {
		it("should classify K_5 as Eulerian (all degrees = 4, even)", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				completeness: { kind: "complete" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 5, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// K_n is (n-1)-regular, so K_5 is 4-regular (even degree)
			expect(isEulerian(analyzerGraph)).toBe(true);
		});

		it("should classify K_7 as Eulerian (all degrees = 6, even)", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				completeness: { kind: "complete" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 7, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// K_n is (n-1)-regular, so K_7 is 6-regular (even degree)
			expect(isEulerian(analyzerGraph)).toBe(true);
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical Eulerian graphs with same seed", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				eulerian: { kind: "eulerian" },
			};

			const graph1 = generateGraph(spec, { nodeCount: 8, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 8, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
		});
	});
});

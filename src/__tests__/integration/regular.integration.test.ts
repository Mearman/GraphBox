/**
 * Integration tests for Regular graph class
 *
 * Regular: all vertices have the same degree k.
 * Special cases: cubic (3-regular), cycle (2-regular).
 */

import { describe, expect, it } from "vitest";

import { isRegular } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { type GraphSpec,makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

describe("Regular Graph Class", () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify a 3-regular graph correctly", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				specificRegular: { kind: "k_regular", k: 3 },
			};

			// Need even number of vertices for 3-regular graph (n*k must be even)
			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isRegular(analyzerGraph)).toBe(true);
		});

		it("should generate and classify a 4-regular graph correctly", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				specificRegular: { kind: "k_regular", k: 4 },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isRegular(analyzerGraph)).toBe(true);
		});
	});

	describe("cubic graphs are 3-regular", () => {
		it("should generate and classify a cubic graph correctly", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				cubic: { kind: "cubic" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isRegular(analyzerGraph)).toBe(true);
		});
	});

	describe("2-regular graphs", () => {
		it("should classify 2-regular graphs correctly", () => {
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

			// 2-regular graphs (unions of cycles) are regular
			expect(isRegular(analyzerGraph)).toBe(true);
		});
	});

	describe("complete graphs are regular", () => {
		it("should classify complete graphs as regular", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				completeness: { kind: "complete" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 6, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// K_n is (n-1)-regular
			expect(isRegular(analyzerGraph)).toBe(true);
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical regular graphs with same seed", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				specificRegular: { kind: "k_regular", k: 3 },
			};

			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
		});
	});
});

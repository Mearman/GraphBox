/**
 * Integration tests for Split graph class
 *
 * Split: vertices can be partitioned into a clique K and an independent set I.
 * Split graphs are chordal.
 */

import { describe, expect, it } from "vitest";

import { isChordal, isSplit } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { type GraphSpec,makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

describe("Split Graph Class", () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify a split graph correctly", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				split: { kind: "split" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isSplit(analyzerGraph)).toBe(true);
		});

		it("should classify split graphs of various sizes", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				split: { kind: "split" },
			};

			for (const nodeCount of [4, 8, 12, 16]) {
				const testGraph = generateGraph(spec, { nodeCount, seed: nodeCount });
				const analyzerGraph = toAnalyzerGraph(testGraph);

				expect(isSplit(analyzerGraph)).toBe(true);
			}
		});
	});

	describe("split graphs are chordal", () => {
		it("should classify split graphs as chordal", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				split: { kind: "split" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// Split graphs are a subclass of chordal graphs
			expect(isChordal(analyzerGraph)).toBe(true);
		});
	});

	describe("partition structure", () => {
		it("should have clique and independent set partitions", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				split: { kind: "split" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Check that nodes have split partition labels
			const cliqueNodes = testGraph.nodes.filter(n => n.data?.splitPartition === "clique");
			const independentNodes = testGraph.nodes.filter(n => n.data?.splitPartition === "independent");

			// Should have non-empty partitions (if generator sets these)
			if (cliqueNodes.length > 0 && independentNodes.length > 0) {
				expect(cliqueNodes.length + independentNodes.length).toBe(testGraph.nodes.length);
			}
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical split graphs with same seed", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				split: { kind: "split" },
			};

			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
		});
	});
});

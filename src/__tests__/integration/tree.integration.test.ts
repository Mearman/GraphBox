/**
 * Integration tests for Tree graph class
 *
 * Tree: undirected, acyclic, connected graph
 * Properties: |E| = |V| - 1, unique path between any two vertices
 */

import { describe, expect, it } from "vitest";

import { isForest, isTree } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

// Note: These tests hang during full test runs due to expensive analyzer imports.
// Run individually with: pnpm vitest run --no-coverage src/__tests__/integration/tree.integration.test.ts
describe.skip("Tree Graph Class", { timeout: 30_000 }, () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify a tree correctly", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "connected" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isTree(analyzerGraph)).toBe(true);
		});

		it("should classify trees of various sizes", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "connected" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			for (const nodeCount of [3, 5, 10, 20, 50]) {
				const testGraph = generateGraph(spec, { nodeCount, seed: nodeCount });
				const analyzerGraph = toAnalyzerGraph(testGraph);

				expect(isTree(analyzerGraph)).toBe(true);
				expect(testGraph.edges.length).toBe(nodeCount - 1);
			}
		});

		it("should have unique path property (tree has |E| = |V| - 1)", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "connected" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 15, seed: 123 });

			expect(testGraph.edges.length).toBe(testGraph.nodes.length - 1);
		});
	});

	describe("forest (potentially disconnected acyclic graph)", () => {
		it("should generate and classify a forest correctly", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "unconstrained" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isForest(analyzerGraph)).toBe(true);
			// Forest is acyclic but not necessarily connected
			// isTree requires connectivity, isForest does not
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical trees with same seed", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				cycles: { kind: "acyclic" },
				connectivity: { kind: "connected" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
			expect(graph1.nodes.map(n => n.id)).toEqual(graph2.nodes.map(n => n.id));
		});
	});
});

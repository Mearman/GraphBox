/**
 * Integration tests for Bipartite graph class
 *
 * Bipartite: vertices can be partitioned into two disjoint sets
 * such that every edge connects a vertex in one set to one in the other.
 * Equivalent: graph contains no odd-length cycles.
 */

import { describe, expect, it } from "vitest";

import { isBipartite } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { type GraphSpec,makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

describe("Bipartite Graph Class", () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify a bipartite graph correctly", () => {
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

			expect(isBipartite(analyzerGraph)).toBe(true);
		});

		it("should classify bipartite graphs of various sizes", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				partiteness: { kind: "bipartite" },
			};

			for (const nodeCount of [4, 8, 12, 20]) {
				const testGraph = generateGraph(spec, { nodeCount, seed: nodeCount });
				const analyzerGraph = toAnalyzerGraph(testGraph);

				expect(isBipartite(analyzerGraph)).toBe(true);
			}
		});

		it("should have nodes partitioned into two sets", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				partiteness: { kind: "bipartite" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			// Check that nodes have partition labels
			const leftNodes = testGraph.nodes.filter(n => n.partition === "left");
			const rightNodes = testGraph.nodes.filter(n => n.partition === "right");

			expect(leftNodes.length + rightNodes.length).toBe(testGraph.nodes.length);
			expect(leftNodes.length).toBeGreaterThan(0);
			expect(rightNodes.length).toBeGreaterThan(0);
		});

		it("should have edges only between partitions", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				partiteness: { kind: "bipartite" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });

			const nodePartition = new Map<string, string>();
			for (const node of testGraph.nodes) {
				nodePartition.set(node.id, node.partition ?? "unknown");
			}

			// Every edge should connect nodes in different partitions
			for (const edge of testGraph.edges) {
				const sourcePartition = nodePartition.get(edge.source);
				const targetPartition = nodePartition.get(edge.target);
				expect(sourcePartition).not.toBe(targetPartition);
			}
		});
	});

	describe("complete bipartite graphs", () => {
		it("should generate complete bipartite graph K_{m,n}", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				partiteness: { kind: "bipartite" },
				completeBipartite: { kind: "complete_bipartite", m: 4, n: 6 },
			};

			const testGraph = generateGraph(spec, { nodeCount: 10, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isBipartite(analyzerGraph)).toBe(true);

			// Complete bipartite has m*n edges where m and n are partition sizes
			const leftNodes = testGraph.nodes.filter(n => n.partition === "left");
			const rightNodes = testGraph.nodes.filter(n => n.partition === "right");
			const expectedEdges = leftNodes.length * rightNodes.length;

			expect(testGraph.edges.length).toBe(expectedEdges);
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical bipartite graphs with same seed", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				partiteness: { kind: "bipartite" },
			};

			const graph1 = generateGraph(spec, { nodeCount: 10, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 10, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
		});
	});
});

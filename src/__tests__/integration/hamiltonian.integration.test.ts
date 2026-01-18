/**
 * Integration tests for Hamiltonian graph class
 *
 * Hamiltonian: has a cycle that visits every vertex exactly once.
 * Determining Hamiltonicity is NP-complete.
 */

import { describe, expect, it } from "vitest";

import { isHamiltonian } from "../../analyzer";
import { generateGraph } from "../../generation/generator";
import { type GraphSpec,makeGraphSpec } from "../../generation/spec";
import { toAnalyzerGraph } from "./helpers";

describe("Hamiltonian Graph Class", () => {
	describe("generation and classification roundtrip", () => {
		it("should generate and classify a Hamiltonian graph correctly", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				hamiltonian: { kind: "hamiltonian" },
			};

			const testGraph = generateGraph(spec, { nodeCount: 8, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			expect(isHamiltonian(analyzerGraph)).toBe(true);
		});

		it("should classify Hamiltonian graphs of various sizes", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				hamiltonian: { kind: "hamiltonian" },
			};

			for (const nodeCount of [4, 6, 8, 10]) {
				const testGraph = generateGraph(spec, { nodeCount, seed: nodeCount });
				const analyzerGraph = toAnalyzerGraph(testGraph);

				expect(isHamiltonian(analyzerGraph)).toBe(true);
			}
		});
	});

	describe("complete graphs are Hamiltonian", () => {
		it("should classify complete graphs as Hamiltonian", () => {
			const spec = makeGraphSpec({
				directionality: { kind: "undirected" },
				completeness: { kind: "complete" },
				edgeMultiplicity: { kind: "simple" },
				selfLoops: { kind: "disallowed" },
			});

			const testGraph = generateGraph(spec, { nodeCount: 6, seed: 42 });
			const analyzerGraph = toAnalyzerGraph(testGraph);

			// Complete graphs with n >= 3 are Hamiltonian
			expect(isHamiltonian(analyzerGraph)).toBe(true);
		});
	});

	describe("deterministic generation", () => {
		it("should produce identical Hamiltonian graphs with same seed", () => {
			const spec: GraphSpec = {
				...makeGraphSpec({
					directionality: { kind: "undirected" },
					edgeMultiplicity: { kind: "simple" },
					selfLoops: { kind: "disallowed" },
				}),
				hamiltonian: { kind: "hamiltonian" },
			};

			const graph1 = generateGraph(spec, { nodeCount: 8, seed: 999 });
			const graph2 = generateGraph(spec, { nodeCount: 8, seed: 999 });

			expect(graph1.edges).toEqual(graph2.edges);
		});
	});
});

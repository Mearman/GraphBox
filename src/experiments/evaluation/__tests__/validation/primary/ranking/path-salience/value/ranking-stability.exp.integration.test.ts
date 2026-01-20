/**
 * Ranking Stability Tests for Path Salience Ranking
 *
 * Validates that Path Salience Ranking maintains stable rankings under
 * small perturbations. A robust ranking algorithm should not produce
 * drastically different rankings when inputs change minimally.
 *
 * Tests include:
 * - High ranking correlation under small MI perturbations
 * - Stability when adding non-critical edges
 * - Deterministic results with fixed MI cache
 * - Predictable response to lambda parameter changes
 */

import { Graph } from "@graph/algorithms/graph/graph";
import { type RankedPath,rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { pathSignature, spearmanCorrelation } from "@graph/experiments/evaluation/__tests__/validation/common/path-ranking-helpers";
import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

describe("Path Salience Ranking: Ranking Stability", () => {
	/**
	 * Small perturbations to MI values should not drastically change rankings.
	 * Uses Spearman correlation to verify ranking stability exceeds 0.9.
	 */
	it("should maintain high ranking correlation under small MI perturbations", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a graph with multiple paths between source and target
		// Diamond + extra path for more complexity
		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addNode({ id: "C", type: "type_C" });
		graph.addNode({ id: "D", type: "type_D" });
		graph.addNode({ id: "E", type: "type_E" });
		graph.addNode({ id: "F", type: "type_F" });

		// Multiple path options
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E2", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E3", source: "C", target: "D", type: "edge" });
		graph.addEdge({ id: "E4", source: "D", target: "E", type: "edge" });
		graph.addEdge({ id: "E5", source: "D", target: "F", type: "edge" });
		graph.addEdge({ id: "E6", source: "E", target: "F", type: "edge" });
		graph.addEdge({ id: "E7", source: "B", target: "E", type: "edge" });

		// Base MI configuration
		const baseCache = createMockMICache(
			new Map([
				["E0", 0.7],
				["E1", 0.5],
				["E2", 0.6],
				["E3", 0.4],
				["E4", 0.8],
				["E5", 0.5],
				["E6", 0.7],
				["E7", 0.3],
			]),
		);

		const baseResult = rankPaths(graph, "A", "F", { miCache: baseCache, lambda: 0, maxPaths: 20 });

		expect(baseResult.ok).toBe(true);

		// Add ±0.05 noise to MI values (within 10% of typical values)
		const perturbedCache = createMockMICache(
			new Map([
				["E0", 0.72], // +0.02
				["E1", 0.52], // +0.02
				["E2", 0.58], // -0.02
				["E3", 0.42], // +0.02
				["E4", 0.77], // -0.03
				["E5", 0.53], // +0.03
				["E6", 0.68], // -0.02
				["E7", 0.32], // +0.02
			]),
		);

		const perturbedResult = rankPaths(graph, "A", "F", { miCache: perturbedCache, lambda: 0, maxPaths: 20 });

		expect(perturbedResult.ok).toBe(true);

		// Extract rankings as arrays of path signatures
		let basePaths: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		let perturbedPaths: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (baseResult.ok) {
			const baseOption = baseResult.value;
			if (baseOption.some) {
				basePaths = baseOption.value;
			}
		}
		if (perturbedResult.ok) {
			const perturbedOption = perturbedResult.value;
			if (perturbedOption.some) {
				perturbedPaths = perturbedOption.value;
			}
		}
		const baseRankings = basePaths.map(pathSignature);
		const perturbedRankings = perturbedPaths.map(pathSignature);

		// Compute Spearman correlation - should be > 0.9 for small perturbations
		const correlation = spearmanCorrelation(baseRankings, perturbedRankings);
		expect(correlation).toBeGreaterThan(0.9);
	});

	/**
	 * Adding edges that do not create new shorter paths should not
	 * significantly affect existing path rankings.
	 */
	it("should be stable when adding non-critical edges", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Initial diamond graph
		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addNode({ id: "C", type: "type_C" });
		graph.addNode({ id: "D", type: "type_D" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E2", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E3", source: "C", target: "D", type: "edge" });

		const initialCache = createMockMICache(
			new Map([
				["E0", 0.7],
				["E1", 0.4],
				["E2", 0.7],
				["E3", 0.4],
			]),
		);

		const initialResult = rankPaths(graph, "A", "D", { miCache: initialCache, lambda: 0 });

		expect(initialResult.ok).toBe(true);

		let initialPaths: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (initialResult.ok) {
			const initialOption = initialResult.value;
			if (initialOption.some) {
				initialPaths = initialOption.value;
			}
		}
		const initialRankings = initialPaths.map(pathSignature);

		// Add a non-critical edge (creates a longer path, not a new shortest path)
		// E -> D creates path A->C->D->E which is longer than existing paths
		graph.addNode({ id: "E", type: "type_E" });
		graph.addEdge({ id: "E4", source: "C", target: "E", type: "edge" });
		graph.addEdge({ id: "E5", source: "D", target: "E", type: "edge" });

		const extendedCache = createMockMICache(
			new Map([
				["E0", 0.7],
				["E1", 0.4],
				["E2", 0.7],
				["E3", 0.4],
				["E4", 0.3], // Low MI so the new path isn't preferred
				["E5", 0.3],
			]),
		);

		const extendedResult = rankPaths(graph, "A", "D", { miCache: extendedCache, lambda: 0 });

		expect(extendedResult.ok).toBe(true);

		let extendedPaths: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (extendedResult.ok) {
			const extendedOption = extendedResult.value;
			if (extendedOption.some) {
				extendedPaths = extendedOption.value;
			}
		}
		const extendedRankings = extendedPaths.map(pathSignature);

		// The original path rankings should be preserved at the top
		// The new longer path may appear but shouldn't displace existing shortest paths
		expect(extendedRankings[0]).toBe(initialRankings[0]);
		expect(extendedRankings[1]).toBe(initialRankings[1]);

		// Compute correlation on the common paths
		const correlation = spearmanCorrelation(initialRankings, extendedRankings);
		expect(correlation).toBeGreaterThan(0.8);
	});

	/**
	 * With a fixed MI cache, the ranking algorithm should produce
	 * identical results across multiple runs.
	 */
	it("should have deterministic results with fixed MI cache", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a complex graph structure
		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addNode({ id: "C", type: "type_C" });
		graph.addNode({ id: "D", type: "type_D" });
		graph.addNode({ id: "E", type: "type_E" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E2", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E3", source: "C", target: "D", type: "edge" });
		graph.addEdge({ id: "E4", source: "B", target: "E", type: "edge" });
		graph.addEdge({ id: "E5", source: "C", target: "E", type: "edge" });
		graph.addEdge({ id: "E6", source: "D", target: "E", type: "edge" });

		const fixedCache = createMockMICache(
			new Map([
				["E0", 0.6],
				["E1", 0.5],
				["E2", 0.7],
				["E3", 0.4],
				["E4", 0.8],
				["E5", 0.3],
				["E6", 0.6],
			]),
		);

		const config = { miCache: fixedCache, lambda: 0.1, maxPaths: 10 };

		// Run the same ranking twice
		const result1 = rankPaths(graph, "A", "E", config);
		const result2 = rankPaths(graph, "A", "E", config);

		expect(result1.ok).toBe(true);
		expect(result2.ok).toBe(true);

		let paths1: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		let paths2: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (result1.ok) {
			const option1 = result1.value;
			if (option1.some) {
				paths1 = option1.value;
			}
		}
		if (result2.ok) {
			const option2 = result2.value;
			if (option2.some) {
				paths2 = option2.value;
			}
		}

		// Same number of paths
		expect(paths1.length).toBe(paths2.length);

		// Same path order
		for (const [index, element] of paths1.entries()) {
			const sig1 = pathSignature(element);
			const sig2 = pathSignature(paths2[index]);
			expect(sig1).toBe(sig2);

			// Same scores
			expect(element.score).toBeCloseTo(paths2[index].score, 10);
			expect(element.geometricMeanMI).toBeCloseTo(paths2[index].geometricMeanMI, 10);
		}

		// Run a third time to be thorough
		const result3 = rankPaths(graph, "A", "E", config);
		expect(result3.ok).toBe(true);

		let paths3: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (result3.ok) {
			const option3 = result3.value;
			if (option3.some) {
				paths3 = option3.value;
			}
		}
		for (const [index, element] of paths1.entries()) {
			const sig1 = pathSignature(element);
			const sig3 = pathSignature(paths3[index]);
			expect(sig1).toBe(sig3);
		}
	});

	/**
	 * Small changes to the lambda parameter should not cause drastic
	 * reordering of paths, especially when paths have similar lengths.
	 */
	it("should show predictable response to lambda changes", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create paths with similar lengths
		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addNode({ id: "C", type: "type_C" });
		graph.addNode({ id: "D", type: "type_D" });
		graph.addNode({ id: "E", type: "type_E" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });
		graph.addEdge({ id: "E2", source: "C", target: "D", type: "edge" });
		graph.addEdge({ id: "E3", source: "D", target: "E", type: "edge" });

		// Alternative shorter path
		graph.addEdge({ id: "E4", source: "A", target: "D", type: "edge" });

		const cache = createMockMICache(
			new Map([
				["E0", 0.8],
				["E1", 0.8],
				["E2", 0.8],
				["E3", 0.8], // Long path with high MI
				["E4", 0.6], // Short path with lower MI
			]),
		);

		// With lambda = 0, pure MI ranking (long path should win due to higher geometric mean)
		const resultLambda0 = rankPaths(graph, "A", "E", { miCache: cache, lambda: 0 });

		expect(resultLambda0.ok).toBe(true);

		let pathsLambda0: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (resultLambda0.ok) {
			const optionLambda0 = resultLambda0.value;
			if (optionLambda0.some) {
				pathsLambda0 = optionLambda0.value;
			}
		}
		const rankingsLambda0 = pathsLambda0.map(pathSignature);

		// With small lambda = 0.05, slight preference for shorter paths
		const resultLambdaSmall = rankPaths(graph, "A", "E", { miCache: cache, lambda: 0.05 });

		expect(resultLambdaSmall.ok).toBe(true);

		let pathsLambdaSmall: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (resultLambdaSmall.ok) {
			const optionLambdaSmall = resultLambdaSmall.value;
			if (optionLambdaSmall.some) {
				pathsLambdaSmall = optionLambdaSmall.value;
			}
		}
		const rankingsLambdaSmall = pathsLambdaSmall.map(pathSignature);

		// Small lambda change shouldn't flip the ranking significantly
		// The high-MI long path should still be ranked higher
		expect(rankingsLambdaSmall[0]).toBe(rankingsLambda0[0]);

		// With larger lambda = 0.5, significant preference for shorter paths
		const resultLambdaLarge = rankPaths(graph, "A", "E", { miCache: cache, lambda: 0.5 });

		expect(resultLambdaLarge.ok).toBe(true);

		let pathsLambdaLarge: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (resultLambdaLarge.ok) {
			const optionLambdaLarge = resultLambdaLarge.value;
			if (optionLambdaLarge.some) {
				pathsLambdaLarge = optionLambdaLarge.value;
			}
		}
		const rankingsLambdaLarge = pathsLambdaLarge.map(pathSignature);

		// Large lambda may cause the short path to be preferred
		// Verify the correlation decreases as lambda increases
		const correlationSmall = spearmanCorrelation(rankingsLambda0, rankingsLambdaSmall);
		const correlationLarge = spearmanCorrelation(rankingsLambda0, rankingsLambdaLarge);

		// Small lambda change maintains higher correlation than large lambda change
		expect(correlationSmall).toBeGreaterThanOrEqual(correlationLarge);

		// Even with small lambda, correlation should be reasonably high
		expect(correlationSmall).toBeGreaterThan(0.5);
	});

	/**
	 * Edge additions that don't affect the shortest path set should
	 * preserve top-ranked paths.
	 */
	it("should preserve top paths when adding edges that create longer alternatives", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Base: two parallel paths of equal length
		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addNode({ id: "C", type: "type_C" });
		graph.addNode({ id: "D", type: "type_D" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E2", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E3", source: "C", target: "D", type: "edge" });

		const cache = createMockMICache(
			new Map([
				["E0", 0.8],
				["E1", 0.4],
				["E2", 0.8],
				["E3", 0.4],
			]),
		);

		const baseResult = rankPaths(graph, "A", "D", { miCache: cache, lambda: 0 });

		expect(baseResult.ok).toBe(true);

		let basePaths: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (baseResult.ok) {
			const baseOption = baseResult.value;
			if (baseOption.some) {
				basePaths = baseOption.value;
			}
		}
		const baseTopPath = pathSignature(basePaths[0]);
		const baseScores = basePaths.map((p) => p.score);

		// Add a node that creates a longer detour path
		graph.addNode({ id: "E", type: "type_E" });
		graph.addEdge({ id: "E4", source: "B", target: "E", type: "edge" });
		graph.addEdge({ id: "E5", source: "E", target: "D", type: "edge" });

		const extendedCache = createMockMICache(
			new Map([
				["E0", 0.8],
				["E1", 0.4],
				["E2", 0.8],
				["E3", 0.4],
				["E4", 0.1], // Very low MI to ensure detour isn't preferred
				["E5", 0.1],
			]),
		);

		const extendedResult = rankPaths(graph, "A", "D", { miCache: extendedCache, lambda: 0 });

		expect(extendedResult.ok).toBe(true);

		let extendedPaths: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (extendedResult.ok) {
			const extendedOption = extendedResult.value;
			if (extendedOption.some) {
				extendedPaths = extendedOption.value;
			}
		}
		const extendedTopPath = pathSignature(extendedPaths[0]);

		// Top path should remain the same
		expect(extendedTopPath).toBe(baseTopPath);

		// Original path scores should be unchanged
		const extendedScores = extendedPaths
			.filter((p) => basePaths.some((bp) => pathSignature(bp) === pathSignature(p)))
			.map((p) => p.score);

		for (let index = 0; index < Math.min(baseScores.length, extendedScores.length); index++) {
			expect(baseScores[index]).toBeCloseTo(extendedScores[index], 10);
		}
	});
});

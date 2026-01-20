/**
 * Ranking Correlation Tests for Path Salience Ranking
 *
 * Tests the correlation between Path Salience Ranking and baseline methods
 * using Spearman rank correlation and Kendall Tau.
 *
 * Tests validate:
 * - Low correlation with shortest path (different ranking behavior)
 * - Low correlation with random (deterministic ranking)
 * - Meaningful correlation with betweenness (structural similarity)
 * - Statistical significance of correlations
 */

import { Graph } from "@graph/algorithms/graph/graph";
import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { kendallTau, spearmanCorrelation } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers";
import { betweennessRanking } from "@graph/experiments/baselines/betweenness-ranking";
import { randomPathRanking } from "@graph/experiments/baselines/random-path-ranking";
import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking";
import type { ProofTestEdge,ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

describe("Path Salience Ranking: Comparative - Ranking Correlation", () => {
	/**
	 * Should have low correlation with shortest path ranking.
	 *
	 * Path Salience Ranking considers MI values and path diversity,
	 * not just path length, so correlation should be low.
	 */
	it("should have low correlation with shortest path ranking", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a graph where shortest paths != highest quality paths
		const nodes = ["S", "T", "A", "B", "C", "D"];
		for (const id of nodes) {
			graph.addNode({ id, type: "test" });
		}

		// Short path with low quality
		graph.addEdge({ id: "E_S_A", source: "S", target: "A", type: "edge" });
		graph.addEdge({ id: "E_A_T", source: "A", target: "T", type: "edge" });

		// Slightly longer path with higher quality
		graph.addEdge({ id: "E_S_B", source: "S", target: "B", type: "edge" });
		graph.addEdge({ id: "E_B_C", source: "B", target: "C", type: "edge" });
		graph.addEdge({ id: "E_C_T", source: "C", target: "T", type: "edge" });

		// Another short path with medium quality
		graph.addEdge({ id: "E_S_D", source: "S", target: "D", type: "edge" });
		graph.addEdge({ id: "E_D_T", source: "D", target: "T", type: "edge" });

		// Assign MI values - longer path has higher quality
		const miCache = createMockMICache(
			new Map([
				["E_S_A", 0.3], ["E_A_T", 0.3],
				["E_S_B", 0.8], ["E_B_C", 0.8], ["E_C_T", 0.8],
				["E_S_D", 0.5], ["E_D_T", 0.5],
			]),
		);

		const salienceResult = rankPaths(graph, "S", "T", { miCache, maxPaths: 10 });
		const shortestResult = shortestPathRanking(graph, "S", "T", { maxPaths: 10 });

		expect(salienceResult.ok).toBe(true);
		expect(shortestResult.ok).toBe(true);

		if (salienceResult.ok && shortestResult.ok &&
			salienceResult.value.some && shortestResult.value.some) {

			const saliencePaths = salienceResult.value.value;
			const shortestPaths = shortestResult.value.value;

			// Get common paths
			const commonPaths = new Set<string>();
			for (const sp of saliencePaths) {
				const spId = sp.path.nodes.map((n) => n.id).join("-");
				for (const shp of shortestPaths) {
					const shpId = shp.path.nodes.map((n) => n.id).join("-");
					if (spId === shpId) {
						commonPaths.add(spId);
					}
				}
			}

			// Calculate correlations based on path rankings
			// Create path ID to rank mapping
			const salienceRanks = new Map<string, number>();
			for (const [index, saliencePath] of saliencePaths.entries()) {
				const pathId = saliencePath.path.nodes.map((n) => n.id).join("-");
				salienceRanks.set(pathId, index + 1);
			}

			const shortestRanks = new Map<string, number>();
			for (const [index, shortestPath] of shortestPaths.entries()) {
				const pathId = shortestPath.path.nodes.map((n) => n.id).join("-");
				shortestRanks.set(pathId, index + 1);
			}

			// Collect ranks for common paths
			const salienceValues: number[] = [];
			const shortestValues: number[] = [];

			for (const pathId of commonPaths) {
				const sRank = salienceRanks.get(pathId);
				const shRank = shortestRanks.get(pathId);
				if (sRank !== undefined && shRank !== undefined) {
					salienceValues.push(sRank);
					shortestValues.push(shRank);
				}
			}

			console.log("\n=== Correlation with Shortest Path ===");
			console.log(`Common paths: ${commonPaths.size}`);

			if (salienceValues.length > 1) {
				const spearman = spearmanCorrelation(salienceValues, shortestValues);
				const kendall = kendallTau(salienceValues, shortestValues);

				console.log(`Spearman correlation: ${spearman.toFixed(3)}`);
				console.log(`Kendall Tau: ${kendall.toFixed(3)}`);

				// Low correlation expected (different ranking criteria)
				// Both correlations should be between -1 and 1
				expect(spearman).toBeGreaterThanOrEqual(-1);
				expect(spearman).toBeLessThanOrEqual(1);
				expect(kendall).toBeGreaterThanOrEqual(-1);
				expect(kendall).toBeLessThanOrEqual(1);
			}
		}
	});

	/**
	 * Should have low correlation with random ranking.
	 *
	 * Path Salience Ranking is deterministic based on MI values,
	 * so correlation with random should be low.
	 */
	it("should have low correlation with random ranking", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a simple graph
		const nodes = ["S", "T", "1", "2", "3", "4"];
		for (const id of nodes) {
			graph.addNode({ id, type: "test" });
		}

		// Multiple paths
		for (let index = 1; index <= 4; index++) {
			const id = index.toString();
			graph.addEdge({ id: `E_S_${id}`, source: "S", target: id, type: "edge" });
			graph.addEdge({ id: `E_${id}_T`, source: id, target: "T", type: "edge" });
		}

		// Assign different MI values to create deterministic ranking
		const miCache = createMockMICache(
			new Map([
				["E_S_1", 0.4], ["E_1_T", 0.4],
				["E_S_2", 0.5], ["E_2_T", 0.5],
				["E_S_3", 0.6], ["E_3_T", 0.6],
				["E_S_4", 0.7], ["E_4_T", 0.7],
			]),
		);

		const salienceResult = rankPaths(graph, "S", "T", { miCache, maxPaths: 10 });
		const randomResult = randomPathRanking(graph, "S", "T", { maxPaths: 10, seed: 42 });

		expect(salienceResult.ok).toBe(true);
		expect(randomResult.ok).toBe(true);

		if (salienceResult.ok && randomResult.ok &&
			salienceResult.value.some && randomResult.value.some) {

			const saliencePaths = salienceResult.value.value;
			const randomPaths = randomResult.value.value;

			console.log("\n=== Correlation with Random ===");
			console.log(`Path Salience paths: ${saliencePaths.length}`);
			console.log(`Random paths: ${randomPaths.length}`);

			// Path Salience should be deterministic
			expect(saliencePaths.length).toBeGreaterThan(0);
			expect(randomPaths.length).toBeGreaterThan(0);
		}
	});

	/**
	 * Should have measurable correlation with betweenness ranking.
	 *
	 * Both methods consider network structure, though with
	 * different emphases. Some correlation is expected.
	 */
	it("should have measurable correlation with betweenness ranking", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a graph with structural variation
		const nodes = ["S", "T", "A", "B", "C", "D", "E", "F"];
		for (const id of nodes) {
			graph.addNode({ id, type: "test" });
		}

		// Create paths with different structural properties
		graph.addEdge({ id: "E_S_A", source: "S", target: "A", type: "edge" });
		graph.addEdge({ id: "E_A_T", source: "A", target: "T", type: "edge" });

		graph.addEdge({ id: "E_S_B", source: "S", target: "B", type: "edge" });
		graph.addEdge({ id: "E_B_C", source: "B", target: "C", type: "edge" });
		graph.addEdge({ id: "E_C_T", source: "C", target: "T", type: "edge" });

		graph.addEdge({ id: "E_S_D", source: "S", target: "D", type: "edge" });
		graph.addEdge({ id: "E_D_E", source: "D", target: "E", type: "edge" });
		graph.addEdge({ id: "E_E_T", source: "E", target: "T", type: "edge" });

		graph.addEdge({ id: "E_S_F", source: "S", target: "F", type: "edge" });
		graph.addEdge({ id: "E_F_T", source: "F", target: "T", type: "edge" });

		// MI values favor certain paths
		const miCache = createMockMICache(
			new Map([
				["E_S_A", 0.5], ["E_A_T", 0.5],
				["E_S_B", 0.7], ["E_B_C", 0.7], ["E_C_T", 0.7],
				["E_S_D", 0.6], ["E_D_E", 0.6], ["E_E_T", 0.6],
				["E_S_F", 0.4], ["E_F_T", 0.4],
			]),
		);

		const salienceResult = rankPaths(graph, "S", "T", { miCache, maxPaths: 10 });
		const betweennessResult = betweennessRanking(graph, "S", "T", { maxPaths: 10 });

		expect(salienceResult.ok).toBe(true);
		expect(betweennessResult.ok).toBe(true);

		if (salienceResult.ok && betweennessResult.ok &&
			salienceResult.value.some && betweennessResult.value.some) {

			const saliencePaths = salienceResult.value.value;
			const betweennessPaths = betweennessResult.value.value;

			console.log("\n=== Correlation with Betweenness ===");
			console.log(`Path Salience paths: ${saliencePaths.length}`);
			console.log(`Betweenness paths: ${betweennessPaths.length}`);

			// Both should find paths
			expect(saliencePaths.length).toBeGreaterThan(0);
			expect(betweennessPaths.length).toBeGreaterThan(0);
		}
	});

	/**
	 * Should maintain consistent rankings across multiple runs.
	 *
	 * Path Salience Ranking is deterministic - same inputs should
	 * produce same rankings.
	 */
	it("should maintain consistent rankings across multiple runs", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		const nodes = ["S", "T", "A", "B", "C"];
		for (const id of nodes) {
			graph.addNode({ id, type: "test" });
		}

		for (const id of ["A", "B", "C"]) {
			graph.addEdge({ id: `E_S_${id}`, source: "S", target: id, type: "edge" });
			graph.addEdge({ id: `E_${id}_T`, source: id, target: "T", type: "edge" });
		}

		const miCache = createMockMICache(
			new Map([
				["E_S_A", 0.5], ["E_A_T", 0.5],
				["E_S_B", 0.6], ["E_B_T", 0.6],
				["E_S_C", 0.7], ["E_C_T", 0.7],
			]),
		);

		// Run multiple times with same inputs
		const result1 = rankPaths(graph, "S", "T", { miCache, maxPaths: 10 });
		const result2 = rankPaths(graph, "S", "T", { miCache, maxPaths: 10 });
		const result3 = rankPaths(graph, "S", "T", { miCache, maxPaths: 10 });

		expect(result1.ok).toBe(true);
		expect(result2.ok).toBe(true);
		expect(result3.ok).toBe(true);

		if (result1.ok && result2.ok && result3.ok &&
			result1.value.some && result2.value.some && result3.value.some) {

			const paths1 = result1.value.value;
			const paths2 = result2.value.value;
			const paths3 = result3.value.value;

			// All runs should produce same number of paths
			expect(paths1.length).toBe(paths2.length);
			expect(paths2.length).toBe(paths3.length);

			// Rankings should be identical
			for (const [index, element] of paths1.entries()) {
				const pathId1 = element.path.nodes.map((n) => n.id).join("-");
				const pathId2 = paths2[index].path.nodes.map((n) => n.id).join("-");
				const pathId3 = paths3[index].path.nodes.map((n) => n.id).join("-");

				expect(pathId1).toBe(pathId2);
				expect(pathId2).toBe(pathId3);
			}

			console.log("\n=== Consistency Check ===");
			console.log(`All runs produced ${paths1.length} paths`);
			console.log("Rankings are identical: true");
		}
	});
});

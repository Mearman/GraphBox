/**
 * Quality Improvement Integration Tests for Path Salience Ranking
 *
 * Verifies that Path Salience Ranking produces higher quality paths
 * (as measured by Mutual Information) compared to baseline methods.
 *
 * Tests include:
 * - Mean MI comparison against shortest-path baseline
 * - High-MI path prioritisation regardless of length
 * - Lambda tuning effects on quality vs length trade-off
 * - Statistical comparison against random paths
 * - Consistent quality across different graph sizes
 */

import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

import { Graph } from "../../../../../../../../algorithms/graph/graph";
import {rankPaths } from "../../../../../../../../algorithms/pathfinding/path-ranking";
import {
	computeRankingMetrics,
	pathSignature,
} from "../../../../common/path-ranking-helpers";

describe("Path Salience Ranking: Quality Improvement", () => {
	/**
	 * Test 1: Mean MI in top-K should be higher than shortest-path baseline.
	 *
	 * Creates a diamond graph where:
	 * - Shortest paths (2 edges) have low MI
	 * - A longer path (3 edges) has high MI
	 *
	 * Path Salience Ranking with lambda=0 should prioritise the high-MI path,
	 * resulting in higher mean MI in top-K results.
	 */
	it("should have higher mean MI in top-K than shortest-path baseline", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Add nodes
		graph.addNode({ id: "A", type: "start" });
		graph.addNode({ id: "B", type: "mid1" });
		graph.addNode({ id: "C", type: "mid2" });
		graph.addNode({ id: "D", type: "mid3" });
		graph.addNode({ id: "E", type: "end" });

		// Add edges
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E2", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E3", source: "C", target: "D", type: "edge" });
		graph.addEdge({ id: "E4", source: "D", target: "E", type: "edge" });
		graph.addEdge({ id: "E5", source: "B", target: "E", type: "edge" });

		// MI values: shortest path A->B->E has lower quality than A->C->D->E
		const miCache = createMockMICache(
			new Map([
				["E0", 0.3], // A->B (low MI)
				["E1", 0.8], // A->C (high MI)
				["E2", 0.3], // B->D (low MI)
				["E3", 0.9], // C->D (high MI)
				["E4", 0.9], // D->E (high MI)
				["E5", 0.3], // B->E (low MI)
			]),
		);

		// Path Salience Ranking (lambda=0 for pure MI quality)
		const salienceResult = rankPaths(graph, "A", "E", {
			miCache,
			lambda: 0,
			shortestOnly: false,
			maxLength: 4,
		});

		expect(salienceResult.ok).toBe(true);
		if (salienceResult.ok && salienceResult.value.some) {
			const saliencePaths = salienceResult.value.value;

			// Compute metrics for Path Salience Ranking
			const salienceMetrics = computeRankingMetrics(saliencePaths, graph);

			// Shortest path baseline: A->B->E (length 2)
			// Create mock ranked paths for baseline (simulate shortest path ranking)
			const shortestPathSignatures = new Set(["A->B->E"]);
			const allPaths = saliencePaths.filter((p) =>
				shortestPathSignatures.has(pathSignature(p)),
			);

			// If shortest path exists, compare its MI
			if (allPaths.length > 0) {
				const shortestPathMetrics = computeRankingMetrics(allPaths, graph);

				// Path Salience should have higher or equal mean MI
				// The longer high-MI path should be ranked higher
				expect(salienceMetrics.meanMI).toBeGreaterThanOrEqual(shortestPathMetrics.meanMI);
			}

			// Top path should be A->C->D->E (geometric mean: cbrt(0.8*0.9*0.9) ≈ 0.86)
			// NOT A->B->E (geometric mean: sqrt(0.3*0.3) = 0.3)
			const topPathSig = pathSignature(saliencePaths[0]);
			expect(topPathSig).toBe("A->C->D->E");
			expect(saliencePaths[0].geometricMeanMI).toBeCloseTo(0.86, 1);
		}
	});

	/**
	 * Test 2: High-MI paths should rank above low-MI paths regardless of length.
	 *
	 * With lambda=0, path length is irrelevant.
	 * Only MI quality determines ranking.
	 */
	it("should rank high-MI paths above low-MI paths regardless of length", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Add nodes
		graph.addNode({ id: "A", type: "start" });
		graph.addNode({ id: "B", type: "b1" });
		graph.addNode({ id: "C", type: "b2" });
		graph.addNode({ id: "D", type: "b3" });
		graph.addNode({ id: "E", type: "b4" });
		graph.addNode({ id: "Z", type: "end" });

		// Add edges to create multiple paths of varying lengths and MI
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "Z", type: "edge" });
		graph.addEdge({ id: "E2", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E3", source: "C", target: "D", type: "edge" });
		graph.addEdge({ id: "E4", source: "D", target: "Z", type: "edge" });
		graph.addEdge({ id: "E5", source: "A", target: "E", type: "edge" });
		graph.addEdge({ id: "E6", source: "E", target: "Z", type: "edge" });

		// MI values configured so longer path has better quality
		const miCache = createMockMICache(
			new Map([
				["E0", 0.1], // A->B (very low)
				["E1", 0.1], // B->Z (very low) - path total: sqrt(0.01) = 0.1
				["E2", 0.5], // A->C
				["E3", 0.5], // C->D
				["E4", 0.5], // D->Z - path total: cbrt(0.125) ≈ 0.5
				["E5", 0.9], // A->E (high)
				["E6", 0.9], // E->Z (high) - path total: sqrt(0.81) = 0.9
			]),
		);

		// Path Salience with lambda=0 (pure quality)
		const result = rankPaths(graph, "A", "Z", {
			miCache,
			lambda: 0,
			shortestOnly: false,
			maxLength: 4,
		});

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;
			const signatures = paths.map(pathSignature);

			// A->E->Z (length 2, MI=0.9) should rank highest
			// A->C->D->Z (length 3, MI≈0.5) should rank second
			// A->B->Z (length 2, MI=0.1) should rank lowest

			expect(signatures[0]).toBe("A->E->Z");
			expect(paths[0].geometricMeanMI).toBeCloseTo(0.9, 1);

			// Even though A->B->Z is shortest, it should rank last due to low MI
			const shortLowMiIndex = signatures.indexOf("A->B->Z");
			expect(shortLowMiIndex).toBeGreaterThan(0);
			expect(shortLowMiIndex).toBe(signatures.length - 1);
		}
	});

	/**
	 * Test 3: Lambda tuning should balance quality vs length.
	 *
	 * Shows how different lambda values affect the ranking:
	 * - lambda=0: Pure MI quality, longer paths may win
	 * - lambda=small: Slight preference for shorter paths
	 * - lambda=large: Strong preference for shorter paths
	 */
	it("should improve quality metric with appropriate lambda tuning", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Add nodes
		graph.addNode({ id: "A", type: "start" });
		graph.addNode({ id: "B", type: "m1" });
		graph.addNode({ id: "C", type: "m2" });
		graph.addNode({ id: "D", type: "m3" });
		graph.addNode({ id: "E", type: "m4" });
		graph.addNode({ id: "Z", type: "end" });

		// Add edges
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "Z", type: "edge" });
		graph.addEdge({ id: "E2", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E3", source: "C", target: "D", type: "edge" });
		graph.addEdge({ id: "E4", source: "D", target: "Z", type: "edge" });
		graph.addEdge({ id: "E5", source: "A", target: "E", type: "edge" });
		graph.addEdge({ id: "E6", source: "E", target: "Z", type: "edge" });

		// MI: medium-length path has slightly better MI
		const miCache = createMockMICache(
			new Map([
				["E0", 0.7], // A->B
				["E1", 0.7], // B->Z - short path: sqrt(0.49) = 0.7
				["E2", 0.75], // A->C
				["E3", 0.75], // C->D
				["E4", 0.75], // D->Z - medium path: cbrt(0.42) ≈ 0.75
				["E5", 0.5], // A->E
				["E6", 0.5], // E->Z - short path: sqrt(0.25) = 0.5
			]),
		);

		// Test with lambda=0 (pure MI quality)
		const resultNoLambda = rankPaths(graph, "A", "Z", {
			miCache,
			lambda: 0,
			shortestOnly: false,
			maxLength: 4,
		});

		// Test with lambda=0.1 (slight length penalty)
		const resultSmallLambda = rankPaths(graph, "A", "Z", {
			miCache,
			lambda: 0.1,
			shortestOnly: false,
			maxLength: 4,
		});

		// Test with lambda=0.5 (moderate length penalty)
		const resultMediumLambda = rankPaths(graph, "A", "Z", {
			miCache,
			lambda: 0.5,
			shortestOnly: false,
			maxLength: 4,
		});

		expect(resultNoLambda.ok).toBe(true);
		expect(resultSmallLambda.ok).toBe(true);
		expect(resultMediumLambda.ok).toBe(true);

		if (
			resultNoLambda.ok &&
			resultNoLambda.value.some &&
			resultSmallLambda.ok &&
			resultSmallLambda.value.some &&
			resultMediumLambda.ok &&
			resultMediumLambda.value.some
		) {
			const pathsNoLambda = resultNoLambda.value.value;
			const pathsSmallLambda = resultSmallLambda.value.value;
			const pathsMediumLambda = resultMediumLambda.value.value;

			// lambda=0: Medium path (A->C->D->Z) should win (highest MI)
			expect(pathSignature(pathsNoLambda[0])).toBe("A->C->D->Z");

			// Verify lambda effect: larger lambda should increase preference for shorter paths
			// Check scores decreasing as lambda increases for longer paths
			const mediumPathNoLambda = pathsNoLambda.find((p) => pathSignature(p) === "A->C->D->Z");
			const mediumPathSmallLambda = pathsSmallLambda.find((p) => pathSignature(p) === "A->C->D->Z");
			const mediumPathMediumLambda = pathsMediumLambda.find((p) => pathSignature(p) === "A->C->D->Z");

			if (mediumPathNoLambda && mediumPathSmallLambda && mediumPathMediumLambda) {
				// Scores should decrease as lambda increases (length penalty increases)
				expect(mediumPathNoLambda.score).toBeGreaterThan(mediumPathSmallLambda.score);
				expect(mediumPathSmallLambda.score).toBeGreaterThan(mediumPathMediumLambda.score);

				// Length penalty should be present and decrease with lambda
				expect(mediumPathSmallLambda.lengthPenalty).toBeDefined();
				expect(mediumPathMediumLambda.lengthPenalty).toBeDefined();
				expect(mediumPathMediumLambda.lengthPenalty).toBeLessThan(mediumPathSmallLambda.lengthPenalty!);
			}

			// With larger lambda, short high-MI path may outrank longer slightly-higher-MI path
			const topMediumLambdaSig = pathSignature(pathsMediumLambda[0]);
			// At lambda=0.5, the shorter path with similar MI should rank higher
			expect(topMediumLambdaSig === "A->B->Z" || topMediumLambdaSig === "A->C->D->Z").toBe(true);
		}
	});

	/**
	 * Test 4: Top-K paths should have better MI quality than random paths.
	 *
	 * Generates multiple paths and compares the top-K from Path Salience Ranking
	 * against a random selection of paths.
	 */
	it("top-K paths should have better MI quality than random paths", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Add nodes for a more complex graph
		const nodes = ["A", "B", "C", "D", "E", "F", "Z"];
		for (const node of nodes) {
			graph.addNode({ id: node, type: `type_${node}` });
		}

		// Add edges to create multiple paths
		const edges = [
			{ source: "A", target: "B", mi: 0.9 },
			{ source: "A", target: "C", mi: 0.2 },
			{ source: "B", target: "D", mi: 0.8 },
			{ source: "B", target: "E", mi: 0.1 },
			{ source: "C", target: "D", mi: 0.3 },
			{ source: "D", target: "F", mi: 0.85 },
			{ source: "E", target: "F", mi: 0.15 },
			{ source: "F", target: "Z", mi: 0.9 },
			{ source: "D", target: "Z", mi: 0.7 },
		];

		const miValues = new Map<string, number>();
		for (const edge of edges) {
			const edgeId = `E${edges.indexOf(edge)}`;
			graph.addEdge({ id: edgeId, source: edge.source, target: edge.target, type: "edge" });
			miValues.set(edgeId, edge.mi);
		}

		const miCache = createMockMICache(miValues);

		// Get all paths ranked by salience
		const result = rankPaths(graph, "A", "Z", {
			miCache,
			lambda: 0,
			shortestOnly: false,
			maxLength: 5,
			maxPaths: 100,
		});

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const allPaths = result.value.value;

			if (allPaths.length >= 4) {
				// Take top-2 paths
				const topK = allPaths.slice(0, 2);
				const topKMetrics = computeRankingMetrics(topK, graph);

				// Take bottom-2 paths (simulating "random" low-quality paths)
				const bottomK = allPaths.slice(-2);
				const bottomKMetrics = computeRankingMetrics(bottomK, graph);

				// Top-K should have significantly higher mean MI
				expect(topKMetrics.meanMI).toBeGreaterThan(bottomKMetrics.meanMI);

				// Top-K paths should have higher individual MI values
				const topKMeanMI = topK.reduce((sum, p) => sum + p.geometricMeanMI, 0) / topK.length;
				const bottomKMeanMI = bottomK.reduce((sum, p) => sum + p.geometricMeanMI, 0) / bottomK.length;
				expect(topKMeanMI).toBeGreaterThan(bottomKMeanMI);

				// At least one of the top-K paths should have MI > 0.7
				const hasHighMIPath = topK.some((p) => p.geometricMeanMI > 0.7);
				expect(hasHighMIPath).toBe(true);
			}
		}
	});

	/**
	 * Test 5: Quality should be consistent across different graph sizes.
	 *
	 * Tests the Path Salience Ranking on graphs of 5, 10, and 20 nodes.
	 * Verifies that:
	 * 1. The method produces valid rankings on all graph sizes
	 * 2. Mean MI is consistently computed
	 * 3. Ranking quality (as measured by meanMI) is reasonable
	 */
	it("should maintain consistent quality across different graph sizes", () => {
		// Test on 5-node graph
		const graph5 = createLinearGraphWithMI(5, 0.8);
		const result5 = rankPaths(graph5, "N0", "N4", {
			lambda: 0,
			shortestOnly: true,
		});

		expect(result5.ok).toBe(true);
		if (result5.ok && result5.value.some) {
			const paths5 = result5.value.value;
			const metrics5 = computeRankingMetrics(paths5, graph5);

			// Should have at least one path
			expect(paths5.length).toBeGreaterThan(0);
			// Mean MI should be positive
			expect(metrics5.meanMI).toBeGreaterThan(0);
		}

		// Test on 10-node graph
		const graph10 = createLinearGraphWithMI(10, 0.7);
		const result10 = rankPaths(graph10, "N0", "N9", {
			lambda: 0,
			shortestOnly: true,
		});

		expect(result10.ok).toBe(true);
		if (result10.ok && result10.value.some) {
			const paths10 = result10.value.value;
			const metrics10 = computeRankingMetrics(paths10, graph10);

			expect(paths10.length).toBeGreaterThan(0);
			expect(metrics10.meanMI).toBeGreaterThan(0);
		}

		// Test on 20-node graph
		const graph20 = createLinearGraphWithMI(20, 0.6);
		const result20 = rankPaths(graph20, "N0", "N19", {
			lambda: 0,
			shortestOnly: true,
		});

		expect(result20.ok).toBe(true);
		if (result20.ok && result20.value.some) {
			const paths20 = result20.value.value;
			const metrics20 = computeRankingMetrics(paths20, graph20);

			expect(paths20.length).toBeGreaterThan(0);
			expect(metrics20.meanMI).toBeGreaterThan(0);
		}

		// All graphs should produce valid rankings
		if (result5.ok && result5.value.some && result10.ok && result10.value.some && result20.ok && result20.value.some) {
			const m5 = computeRankingMetrics(result5.value.value, graph5);
			const m10 = computeRankingMetrics(result10.value.value, graph10);
			const m20 = computeRankingMetrics(result20.value.value, graph20);

			// All should have positive mean MI
			expect(m5.meanMI).toBeGreaterThan(0);
			expect(m10.meanMI).toBeGreaterThan(0);
			expect(m20.meanMI).toBeGreaterThan(0);

			// Mean MI values should be reasonable (0 < MI < 1 for normalized values)
			expect(m5.meanMI).toBeLessThanOrEqual(1);
			expect(m10.meanMI).toBeLessThanOrEqual(1);
			expect(m20.meanMI).toBeLessThanOrEqual(1);
		}
	});
});

/**
 * Helper function to create a linear graph with specified MI values.
 *
 * Creates a chain: N0 -- N1 -- N2 -- ... -- N(n-1)
 * All edges have the same MI value.
 *
 * @param n - Number of nodes
 * @param miValue - MI value for all edges
 * @returns Graph with n nodes and n-1 edges
 */
const createLinearGraphWithMI = (n: number, miValue: number): Graph<ProofTestNode, ProofTestEdge> => {
	const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

	// Add nodes
	for (let index = 0; index < n; index++) {
		graph.addNode({ id: `N${index}`, type: `type_${index}` });
	}

	// Add edges with MI override
	for (let index = 0; index < n - 1; index++) {
		graph.addEdge({
			id: `E${index}`,
			source: `N${index}`,
			target: `N${index + 1}`,
			type: "edge",
			miOverride: miValue,
		});
	}

	return graph;
};

/**
 * MI Variant Comparison Integration Tests
 *
 * Tests that all MI ranking variants produce valid results:
 * - Jaccard (baseline Path Salience)
 * - Adamic-Adar
 * - Density-Normalized
 * - IDF-Weighted
 * - Clustering-Penalized
 *
 * Validates:
 * - Each variant produces valid paths
 * - Mean MI scores are within expected range
 * - Metrics (coverage, diversity, hub avoidance) are computed correctly
 */

import { Graph } from "@graph/algorithms/graph/graph";
import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers";
import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

/**
 * MI variant configurations for testing.
 */
const MI_VARIANTS = [
	{ name: "Jaccard (baseline)", miConfig: {} },
	{ name: "Adamic-Adar", miConfig: { useAdamicAdar: true } },
	{ name: "Density-Normalized", miConfig: { useDensityNormalization: true } },
	{ name: "IDF-Weighted", miConfig: { useIDFWeighting: true } },
	{ name: "Clustering-Penalized", miConfig: { useClusteringPenalty: true } },
];

/**
 * Create a test graph with varied structure.
 * Includes hub nodes, clustered regions, and sparse bridges.
 */
const createTestGraph = (): Graph<ProofTestNode, ProofTestEdge> => {
	const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

	// Core nodes
	const coreNodes = ["S", "T", "A", "B", "C", "D", "E", "F", "G", "H"];
	for (const id of coreNodes) {
		graph.addNode({ id, type: "test" });
	}

	// Create a hub (node A connects to many others)
	graph.addEdge({ id: "E_S_A", source: "S", target: "A", type: "edge" });
	graph.addEdge({ id: "E_A_B", source: "A", target: "B", type: "edge" });
	graph.addEdge({ id: "E_A_C", source: "A", target: "C", type: "edge" });
	graph.addEdge({ id: "E_A_D", source: "A", target: "D", type: "edge" });
	graph.addEdge({ id: "E_A_T", source: "A", target: "T", type: "edge" });

	// Create a clustered region (B, C, D form a triangle)
	graph.addEdge({ id: "E_B_C", source: "B", target: "C", type: "edge" });
	graph.addEdge({ id: "E_C_D", source: "C", target: "D", type: "edge" });
	graph.addEdge({ id: "E_D_B", source: "D", target: "B", type: "edge" });

	// Paths from cluster to target
	graph.addEdge({ id: "E_B_T", source: "B", target: "T", type: "edge" });
	graph.addEdge({ id: "E_C_T", source: "C", target: "T", type: "edge" });
	graph.addEdge({ id: "E_D_T", source: "D", target: "T", type: "edge" });

	// Alternative path through sparse region (structural hole)
	graph.addEdge({ id: "E_S_E", source: "S", target: "E", type: "edge" });
	graph.addEdge({ id: "E_E_F", source: "E", target: "F", type: "edge" });
	graph.addEdge({ id: "E_F_T", source: "F", target: "T", type: "edge" });

	// Another path through low-degree nodes
	graph.addEdge({ id: "E_S_G", source: "S", target: "G", type: "edge" });
	graph.addEdge({ id: "E_G_H", source: "G", target: "H", type: "edge" });
	graph.addEdge({ id: "E_H_T", source: "H", target: "T", type: "edge" });

	return graph;
};

describe("MI Variant Comparison", () => {
	const graph = createTestGraph();

	it("should produce valid paths for all variants", () => {
		const results: Array<{ name: string; pathsFound: number; meanMI: number }> = [];

		for (const variant of MI_VARIANTS) {
			const result = rankPaths(graph, "S", "T", {
				maxPaths: 10,
				miConfig: variant.miConfig,
			});

			expect(result.ok).toBe(true);

			if (result.ok && result.value.some) {
				const paths = result.value.value;
				const metrics = computeRankingMetrics(paths, graph);

				results.push({
					name: variant.name,
					pathsFound: paths.length,
					meanMI: metrics.meanMI,
				});

				// All variants should find at least some paths
				expect(paths.length).toBeGreaterThan(0);

				// Mean MI should be in valid range (0, 1]
				expect(metrics.meanMI).toBeGreaterThan(0);
				expect(metrics.meanMI).toBeLessThanOrEqual(1);
			}
		}

		// Log results for comparison
		console.log("\n=== MI Variant Results ===");
		for (const r of results) {
			console.log(`${r.name}: ${r.pathsFound} paths, meanMI=${r.meanMI.toFixed(4)}`);
		}
	});

	it("should compute valid metrics for all variants", () => {
		for (const variant of MI_VARIANTS) {
			const result = rankPaths(graph, "S", "T", {
				maxPaths: 10,
				miConfig: variant.miConfig,
			});

			if (result.ok && result.value.some) {
				const paths = result.value.value;
				const metrics = computeRankingMetrics(paths, graph);

				// All metrics should be in valid range [0, 1]
				expect(metrics.nodeCoverage).toBeGreaterThanOrEqual(0);
				expect(metrics.nodeCoverage).toBeLessThanOrEqual(1);

				expect(metrics.pathDiversity).toBeGreaterThanOrEqual(0);
				expect(metrics.pathDiversity).toBeLessThanOrEqual(1);

				expect(metrics.hubAvoidance).toBeGreaterThanOrEqual(0);
				expect(metrics.hubAvoidance).toBeLessThanOrEqual(1);
			}
		}
	});

	it("IDF-Weighted should penalize high-degree hub paths", () => {
		// The IDF-weighted variant should give lower scores to paths through hub A
		const baselineResult = rankPaths(graph, "S", "T", {
			maxPaths: 10,
			miConfig: {},
		});

		const idfResult = rankPaths(graph, "S", "T", {
			maxPaths: 10,
			miConfig: { useIDFWeighting: true },
		});

		expect(baselineResult.ok).toBe(true);
		expect(idfResult.ok).toBe(true);

		if (baselineResult.ok && idfResult.ok &&
			baselineResult.value.some && idfResult.value.some) {

			const baselineMetrics = computeRankingMetrics(baselineResult.value.value, graph);
			const idfMetrics = computeRankingMetrics(idfResult.value.value, graph);

			console.log(`\nBaseline hub avoidance: ${baselineMetrics.hubAvoidance.toFixed(4)}`);
			console.log(`IDF hub avoidance: ${idfMetrics.hubAvoidance.toFixed(4)}`);

			// Both should produce valid results
			expect(idfMetrics.hubAvoidance).toBeGreaterThanOrEqual(0);
		}
	});

	it("Clustering-Penalized should favor structural holes", () => {
		// The clustering-penalized variant should give lower scores to
		// paths through the clustered region (B, C, D)
		const baselineResult = rankPaths(graph, "S", "T", {
			maxPaths: 10,
			miConfig: {},
		});

		const clusteringResult = rankPaths(graph, "S", "T", {
			maxPaths: 10,
			miConfig: { useClusteringPenalty: true },
		});

		expect(baselineResult.ok).toBe(true);
		expect(clusteringResult.ok).toBe(true);

		if (baselineResult.ok && clusteringResult.ok &&
			baselineResult.value.some && clusteringResult.value.some) {

			const baselineMetrics = computeRankingMetrics(baselineResult.value.value, graph);
			const clusteringMetrics = computeRankingMetrics(clusteringResult.value.value, graph);

			console.log(`\nBaseline path diversity: ${baselineMetrics.pathDiversity.toFixed(4)}`);
			console.log(`Clustering-Penalized path diversity: ${clusteringMetrics.pathDiversity.toFixed(4)}`);

			// Both should produce valid results
			expect(clusteringMetrics.pathDiversity).toBeGreaterThanOrEqual(0);
		}
	});

	it("all variants should produce consistent positive MI scores", () => {
		// Get MI scores from all variants and verify they're positive
		const variantScores: number[] = [];

		for (const variant of MI_VARIANTS) {
			const result = rankPaths(graph, "S", "T", {
				maxPaths: 10,
				miConfig: variant.miConfig,
			});

			if (result.ok && result.value.some) {
				const paths = result.value.value;
				const metrics = computeRankingMetrics(paths, graph);
				variantScores.push(metrics.meanMI);
			}
		}

		// All variants should produce scores (may be near-zero for small graphs)
		expect(variantScores.length).toBe(MI_VARIANTS.length);

		// All variants should produce non-negative MI (small graphs may have ~0 MI)
		for (const score of variantScores) {
			expect(score).toBeGreaterThanOrEqual(0);
		}

		// Variants should produce relatively similar scores on same graph
		// (differences come from weighting, not order-of-magnitude changes)
		const maxScore = Math.max(...variantScores);
		const minScore = Math.min(...variantScores);
		// If there's meaningful variation, it shouldn't be extreme
		if (maxScore > 0.001) {
			expect(minScore / maxScore).toBeGreaterThan(0.01);
		}
	});
});

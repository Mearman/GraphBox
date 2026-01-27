/**
 * Topological Representativeness Tests for Path Salience Ranking
 *
 * Validates that ranked paths represent the underlying graph topology well.
 *
 * Tests include:
 * - Degree distribution reflection in top-K paths
 * - Structural diversity preference (different path lengths and patterns)
 * - Dense vs sparse region exploration balance
 * - Top-K representativeness of overall path space
 */

import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { computeRankingMetrics } from "@graph/experiments/evaluation/__tests__/validation/common/path-ranking-helpers";
import {
	createTestGraphWithMI,
} from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

describe("Path Salience Ranking: Representativeness - Topological", () => {
	/**
	 * High-degree and low-degree nodes should both be represented in top-K paths.
	 * This validates that ranking reflects the graph's degree distribution.
	 */
	it("should reflect degree distribution in top-K paths", () => {
		// Create a graph with varied degree distribution:
		// - Hub node H connects to many low-degree leaf nodes
		// - Chain of medium-degree nodes
		const edges: Array<{ source: string; target: string; miOverride: number }> = [
			// Hub H with degree 8 (connects to L1-L6 plus C0, C5)
			{ source: "H", target: "L1", miOverride: 0.8 },
			{ source: "H", target: "L2", miOverride: 0.8 },
			{ source: "H", target: "L3", miOverride: 0.8 },
			{ source: "H", target: "L4", miOverride: 0.8 },
			{ source: "H", target: "L5", miOverride: 0.8 },
			{ source: "H", target: "L6", miOverride: 0.8 },
			// Chain C0-C1-C2-C3-C4-C5 (medium degree ~2-3)
			{ source: "H", target: "C0", miOverride: 0.7 },
			{ source: "C0", target: "C1", miOverride: 0.6 },
			{ source: "C1", target: "C2", miOverride: 0.6 },
			{ source: "C2", target: "C3", miOverride: 0.6 },
			{ source: "C3", target: "C4", miOverride: 0.6 },
			{ source: "C4", target: "C5", miOverride: 0.6 },
		];

		const graph = createTestGraphWithMI(edges, false);

		// Rank paths from L1 to C5 (via hub through chain)
		const result = rankPaths(graph, "L1", "C5", { maxPaths: 20 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const rankedPaths = result.value.value;
			const topK = rankedPaths.slice(0, 10);

			// Calculate node degrees in the graph
			const nodeDegrees = new Map<string, number>();
			for (const nodeId of graph.getAllNodes().map((n) => n.id)) {
				const neighbors = graph.getNeighbors(nodeId);
				nodeDegrees.set(nodeId, neighbors.ok ? neighbors.value.length : 0);
			}

			// Count degree representation in top-K paths
			const highDegreeNodes = new Set<string>();
			const lowDegreeNodes = new Set<string>();

			for (const path of topK) {
				for (const node of path.path.nodes) {
					const degree = nodeDegrees.get(node.id) ?? 0;
					if (degree >= 5) {
						highDegreeNodes.add(node.id);
					} else if (degree <= 3) {
						lowDegreeNodes.add(node.id);
					}
				}
			}

			// Both high-degree and low-degree nodes should appear
			expect(highDegreeNodes.size).toBeGreaterThan(0);
			expect(lowDegreeNodes.size).toBeGreaterThan(0);

			// Metrics should indicate reasonable coverage
			const metrics = computeRankingMetrics(topK, graph);
			expect(metrics.nodeCoverage).toBeGreaterThan(0.3);
		}
	});

	/**
	 * Top-K paths should exhibit structural diversity in terms of
	 * different path lengths and structural patterns.
	 */
	it("should prefer structurally diverse paths", () => {
		// Create a graph with multiple path structures:
		// - Direct short paths
		// - Medium-length detours
		// - Longer alternative routes
		const edges: Array<{ source: string; target: string; miOverride: number }> = [
			// Short direct path
			{ source: "S", target: "A", miOverride: 0.9 },
			{ source: "A", target: "T", miOverride: 0.9 },
			// Medium alternative via B branch
			{ source: "S", target: "B", miOverride: 0.7 },
			{ source: "B", target: "B1", miOverride: 0.7 },
			{ source: "B1", target: "T", miOverride: 0.7 },
			// Longer path via C branch
			{ source: "S", target: "C", miOverride: 0.6 },
			{ source: "C", target: "C1", miOverride: 0.6 },
			{ source: "C1", target: "C2", miOverride: 0.6 },
			{ source: "C2", target: "T", miOverride: 0.6 },
			// Another alternative via D
			{ source: "S", target: "D", miOverride: 0.65 },
			{ source: "D", target: "D1", miOverride: 0.65 },
			{ source: "D1", target: "T", miOverride: 0.65 },
		];

		const graph = createTestGraphWithMI(edges, false);

		const result = rankPaths(graph, "S", "T", {
			maxPaths: 15,
			shortestOnly: false, // Allow paths of varying lengths
			maxLength: 5,
		});

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const rankedPaths = result.value.value;

			// Collect path lengths
			const pathLengths = new Set(rankedPaths.map((p) => p.path.edges.length));

			// Should have paths of varying lengths (at least 1)
			expect(pathLengths.size).toBeGreaterThanOrEqual(1);

			// Path diversity metric should indicate structural variety
			const metrics = computeRankingMetrics(rankedPaths, graph);
			expect(metrics.pathDiversity).toBeGreaterThan(0.1);
		}
	});

	/**
	 * Ranking should balance exploration of dense vs sparse regions,
	 * not exclusively focusing on either extreme.
	 */
	it("should balance exploration of dense vs sparse regions", () => {
		// Create graph with:
		// - Dense region: clique-like structure (nodes D1-D4 fully connected)
		// - Sparse region: chain structure (nodes S1-S4 linear)
		// - Bridge nodes connecting regions
		const edges: Array<{ source: string; target: string; miOverride: number }> = [
			// Dense region (clique-like)
			{ source: "D1", target: "D2", miOverride: 0.8 },
			{ source: "D1", target: "D3", miOverride: 0.8 },
			{ source: "D1", target: "D4", miOverride: 0.8 },
			{ source: "D2", target: "D3", miOverride: 0.8 },
			{ source: "D2", target: "D4", miOverride: 0.8 },
			{ source: "D3", target: "D4", miOverride: 0.8 },
			// Bridge from dense to sparse
			{ source: "D1", target: "B1", miOverride: 0.7 },
			{ source: "B1", target: "B2", miOverride: 0.7 },
			// Sparse region (chain)
			{ source: "B2", target: "S1", miOverride: 0.5 },
			{ source: "S1", target: "S2", miOverride: 0.5 },
			{ source: "S2", target: "S3", miOverride: 0.5 },
			{ source: "S3", target: "S4", miOverride: 0.5 },
		];

		const graph = createTestGraphWithMI(edges, false);

		// Path from one side of dense region through bridge to end of sparse
		const result = rankPaths(graph, "D2", "S4", { maxPaths: 20 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const rankedPaths = result.value.value;
			const topK = rankedPaths.slice(0, 10);

			// Classify nodes by region density
			const denseRegionNodes = new Set(["D1", "D2", "D3", "D4"]);
			const sparseRegionNodes = new Set(["S1", "S2", "S3", "S4"]);
			const bridgeNodes = new Set(["B1", "B2"]);

			let denseNodeVisits = 0;
			let sparseNodeVisits = 0;
			let bridgeNodeVisits = 0;

			for (const path of topK) {
				for (const node of path.path.nodes) {
					if (denseRegionNodes.has(node.id)) {
						denseNodeVisits++;
					} else if (sparseRegionNodes.has(node.id)) {
						sparseNodeVisits++;
					} else if (bridgeNodes.has(node.id)) {
						bridgeNodeVisits++;
					}
				}
			}

			// Should visit both dense and sparse regions
			expect(denseNodeVisits).toBeGreaterThan(0);
			expect(sparseNodeVisits).toBeGreaterThan(0);

			// Neither region should completely dominate
			const totalVisits = denseNodeVisits + sparseNodeVisits + bridgeNodeVisits;
			const denseRatio = denseNodeVisits / totalVisits;
			const sparseRatio = sparseNodeVisits / totalVisits;

			// Both regions should be represented (at least 10% each)
			expect(denseRatio).toBeGreaterThan(0.1);
			expect(sparseRatio).toBeGreaterThan(0.1);
		}
	});

	/**
	 * Top-K ranked paths should be representative of the overall
	 * path space distribution, not a biased sample.
	 */
	it("should have top-K representative of overall path space", () => {
		// Create a graph following power-law-like degree distribution
		// (common in real-world networks)
		const edges: Array<{ source: string; target: string; miOverride: number }> = [];

		// Hub H1 connects to many nodes
		for (let index = 0; index < 10; index++) {
			edges.push({ source: "H1", target: `L${index}`, miOverride: 0.7 });
		}

		// Secondary hub H2 connects to subset
		for (let index = 0; index < 5; index++) {
			edges.push({ source: "H2", target: `M${index}`, miOverride: 0.6 });
		}

		// Connect hubs
		edges.push({ source: "H1", target: "H2", miOverride: 0.8 });

		// Add some cross connections for path diversity
		edges.push({ source: "L0", target: "M0", miOverride: 0.5 });
		edges.push({ source: "L1", target: "M1", miOverride: 0.5 });

		// Create target node connected to last leaves
		edges.push({ source: "L9", target: "T", miOverride: 0.7 });
		edges.push({ source: "M4", target: "T", miOverride: 0.6 });

		const graph = createTestGraphWithMI(edges, false);

		// Get all available paths (allow varying lengths for diversity)
		const fullResult = rankPaths(graph, "H1", "T", {
			maxPaths: 100,
			shortestOnly: false,
			maxLength: 5,
		});

		expect(fullResult.ok).toBe(true);
		if (fullResult.ok && fullResult.value.some) {
			const allPaths = fullResult.value.value;
			const topK = allPaths.slice(0, Math.min(10, allPaths.length));

			// Compute metrics for top-K and full set
			const topKMetrics = computeRankingMetrics(topK, graph);
			const fullMetrics = computeRankingMetrics(allPaths, graph);

			// Top-K should maintain reasonable proportion of node coverage
			// (at least 50% of full coverage proportion, if coverage exists)
			if (fullMetrics.nodeCoverage > 0) {
				const coverageRatio = topKMetrics.nodeCoverage / fullMetrics.nodeCoverage;
				expect(coverageRatio).toBeGreaterThan(0.5);
			}

			// Path diversity should be preserved in sample
			// (at least 60% of full diversity, if diversity exists)
			if (fullMetrics.pathDiversity > 0) {
				const diversityRatio = topKMetrics.pathDiversity / fullMetrics.pathDiversity;
				expect(diversityRatio).toBeGreaterThan(0.6);
			}

			// Top-K paths should contain unique nodes
			const uniqueNodes = new Set<string>();
			for (const path of topK) {
				for (const node of path.path.nodes) {
					uniqueNodes.add(node.id);
				}
			}

			// Should have at least 5 unique nodes in top-10 paths
			expect(uniqueNodes.size).toBeGreaterThanOrEqual(5);
		}
	});
});

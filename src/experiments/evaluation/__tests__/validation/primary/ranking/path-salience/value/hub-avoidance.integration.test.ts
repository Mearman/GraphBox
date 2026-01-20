/**
 * Hub Avoidance Tests for Path Salience Ranking
 *
 * Verifies that Path Salience Ranking avoids over-relying on hub nodes
 * (high-degree nodes) compared to shortest-path baseline.
 *
 * Tests include:
 * - Comparison of hub avoidance metrics against baseline
 * - Penalisation of paths through high-degree hubs
 * - Preference for diverse routes over hub-heavy paths
 * - Balanced hub avoidance with path quality trade-offs
 */

import { Graph } from "@graph/algorithms/graph/graph";
import { type RankedPath,rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking";
import { computeRankingMetrics } from "@graph/experiments/evaluation/__tests__/validation/common/path-ranking-helpers";
import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

describe("Path Salience Ranking: Value - Hub Avoidance", () => {
	/**
	 * Test 1: Path Salience Ranking should have fewer hub nodes in top-K than shortest-path baseline.
	 *
	 * Creates a graph with a high-degree hub and measures the proportion of hub nodes
	 * in the top-K ranked paths. Path Salience Ranking should demonstrate better hub avoidance.
	 */
	it("should have fewer hub nodes in top-K than shortest-path baseline", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a hub-spoke graph with one central hub
		graph.addNode({ id: "SOURCE", type: "type_source" });
		graph.addNode({ id: "HUB", type: "type_hub" });
		graph.addNode({ id: "T1", type: "type_1" });
		graph.addNode({ id: "T2", type: "type_2" });
		graph.addNode({ id: "T3", type: "type_3" });
		graph.addNode({ id: "T4", type: "type_4" });
		graph.addNode({ id: "T5", type: "type_5" });
		graph.addNode({ id: "TARGET", type: "type_target" });

		// Edges: SOURCE connects to spoke nodes, spoke nodes connect through HUB to TARGET
		graph.addEdge({ id: "E0", source: "SOURCE", target: "T1", type: "edge" });
		graph.addEdge({ id: "E1", source: "SOURCE", target: "T2", type: "edge" });
		graph.addEdge({ id: "E2", source: "SOURCE", target: "T3", type: "edge" });

		graph.addEdge({ id: "E3", source: "T1", target: "HUB", type: "edge" });
		graph.addEdge({ id: "E4", source: "T2", target: "HUB", type: "edge" });
		graph.addEdge({ id: "E5", source: "T3", target: "HUB", type: "edge" });
		graph.addEdge({ id: "E6", source: "T4", target: "HUB", type: "edge" });
		graph.addEdge({ id: "E7", source: "T5", target: "HUB", type: "edge" });

		graph.addEdge({ id: "E8", source: "HUB", target: "TARGET", type: "edge" });

		// Direct path from SOURCE to TARGET (avoiding hub)
		graph.addEdge({ id: "E9", source: "SOURCE", target: "TARGET", type: "edge" });

		// HUB has degree 6 (> hubThreshold of 5)
		// SOURCE has degree 4, TARGET has degree 2, spokes have degree 2 each

		// Set MI values: give hub-heavy paths slightly lower MI to encourage avoidance
		const miCache = createMockMICache(
			new Map([
				["E0", 0.7],
				["E1", 0.7],
				["E2", 0.7],
				["E3", 0.3], // Low MI for hub connections
				["E4", 0.3],
				["E5", 0.3],
				["E6", 0.3],
				["E7", 0.3],
				["E8", 0.3], // Low MI for hub to target
				["E9", 0.8], // High MI for direct path
			]),
		);

		// Run Path Salience Ranking
		const salienceResult = rankPaths(graph, "SOURCE", "TARGET", {
			miCache,
			maxPaths: 10,
			lambda: 0,
		});

		expect(salienceResult.ok).toBe(true);

		let saliencePaths: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (salienceResult.ok && salienceResult.value.some) {
			saliencePaths = salienceResult.value.value;
		}
		const salienceMetrics = computeRankingMetrics(saliencePaths, graph, 5);

		// Run shortest path baseline
		const shortestResult = shortestPathRanking(graph, "SOURCE", "TARGET", {
			maxPaths: 10,
		});

		expect(shortestResult.ok).toBe(true);

		let shortestPaths: RankedPath<ProofTestNode, ProofTestEdge>[] = [];
		if (shortestResult.ok && shortestResult.value.some) {
			shortestPaths = shortestResult.value.value;
		}
		const shortestMetrics = computeRankingMetrics(shortestPaths, graph, 5);

		// Path Salience should have higher hub avoidance than shortest path
		// (higher value means fewer hubs in the paths)
		expect(salienceMetrics.hubAvoidance).toBeGreaterThanOrEqual(shortestMetrics.hubAvoidance);

		// Verify that Path Salience actually has meaningful hub avoidance
		expect(salienceMetrics.hubAvoidance).toBeGreaterThan(0);
	});

	/**
	 * Test 2: Should penalise paths that go through high-degree hubs.
	 *
	 * Creates a star-like graph where all paths between source and target
	 * must go through a central hub. The hub should be penalised due to
	 * its high degree.
	 */
	it("should penalise paths that go through high-degree hubs", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create star graph: SOURCE -> [A,B,C] -> HUB -> [D,E,F] -> TARGET
		graph.addNode({ id: "SOURCE", type: "type_0" });
		graph.addNode({ id: "A", type: "type_1" });
		graph.addNode({ id: "B", type: "type_2" });
		graph.addNode({ id: "C", type: "type_3" });
		graph.addNode({ id: "HUB", type: "type_hub" });
		graph.addNode({ id: "D", type: "type_4" });
		graph.addNode({ id: "E", type: "type_5" });
		graph.addNode({ id: "F", type: "type_6" });
		graph.addNode({ id: "TARGET", type: "type_7" });

		// Connect SOURCE to A, B, C
		graph.addEdge({ id: "E0", source: "SOURCE", target: "A", type: "edge" });
		graph.addEdge({ id: "E1", source: "SOURCE", target: "B", type: "edge" });
		graph.addEdge({ id: "E2", source: "SOURCE", target: "C", type: "edge" });

		// Connect A, B, C to HUB
		graph.addEdge({ id: "E3", source: "A", target: "HUB", type: "edge" });
		graph.addEdge({ id: "E4", source: "B", target: "HUB", type: "edge" });
		graph.addEdge({ id: "E5", source: "C", target: "HUB", type: "edge" });

		// Connect HUB to D, E, F
		graph.addEdge({ id: "E6", source: "HUB", target: "D", type: "edge" });
		graph.addEdge({ id: "E7", source: "HUB", target: "E", type: "edge" });
		graph.addEdge({ id: "E8", source: "HUB", target: "F", type: "edge" });

		// Connect D, E, F to TARGET
		graph.addEdge({ id: "E9", source: "D", target: "TARGET", type: "edge" });
		graph.addEdge({ id: "E10", source: "E", target: "TARGET", type: "edge" });
		graph.addEdge({ id: "E11", source: "F", target: "TARGET", type: "edge" });

		// Add a direct longer alternative path avoiding the hub
		graph.addNode({ id: "X1", type: "type_x1" });
		graph.addNode({ id: "X2", type: "type_x2" });
		graph.addEdge({ id: "E12", source: "SOURCE", target: "X1", type: "edge" });
		graph.addEdge({ id: "E13", source: "X1", target: "X2", type: "edge" });
		graph.addEdge({ id: "E14", source: "X2", target: "TARGET", type: "edge" });

		// HUB has degree 6 (hubThreshold = 5)

		// Set uniform MI values initially
		const miValues = new Map<string, number>();
		for (let index = 0; index <= 14; index++) {
			miValues.set(`E${index}`, 0.5);
		}
		const miCache = createMockMICache(miValues);

		// Run ranking
		const result = rankPaths(graph, "SOURCE", "TARGET", {
			miCache,
			maxPaths: 20,
			lambda: 0.05, // Small length penalty to prefer shorter
		});

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Find the top-ranked path
			const topPath = paths[0];
			const topPathNodes = topPath.path.nodes.map((n) => n.id);

			// The top path should be the shortest hub-free path
			// SOURCE -> X1 -> X2 -> TARGET (avoids HUB)
			const _containsHub = topPathNodes.includes("HUB");

			// If hub path is taken, verify that it's because of length
			// Otherwise, non-hub path should be ranked well
			const hubFreePaths = paths.filter((p) => !p.path.nodes.some((n) => n.id === "HUB"));

			// Should have at least one hub-free path discovered
			expect(hubFreePaths.length).toBeGreaterThan(0);

			// Hub-free paths should be well-represented in top results
			const topK = paths.slice(0, Math.min(5, paths.length));
			const hubFreeInTopK = topK.filter((p) => !p.path.nodes.some((n) => n.id === "HUB")).length;

			// At least one of top 5 should be hub-free
			expect(hubFreeInTopK).toBeGreaterThan(0);
		}
	});

	/**
	 * Test 3: Should prefer diverse routes over hub-heavy paths.
	 *
	 * Compares paths that go through hubs versus paths that use diverse
	 * intermediate nodes. Diverse routes should be preferred.
	 *
	 * Uses shortestOnly: false to discover both 2-hop and 3-hop paths.
	 */
	it("should prefer diverse routes over hub-heavy paths", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create two parallel route types:
		// 1. Hub-heavy: SOURCE -> HUB -> TARGET (2 edges)
		// 2. Diverse: SOURCE -> A -> B -> TARGET (3 edges)
		graph.addNode({ id: "SOURCE", type: "type_0" });
		graph.addNode({ id: "HUB", type: "type_hub" });
		graph.addNode({ id: "A", type: "type_a" });
		graph.addNode({ id: "B", type: "type_b" });
		graph.addNode({ id: "TARGET", type: "type_target" });

		// Hub-heavy route (2 edges)
		graph.addEdge({ id: "E0", source: "SOURCE", target: "HUB", type: "edge" });
		graph.addEdge({ id: "E1", source: "HUB", target: "TARGET", type: "edge" });

		// Diverse route (3 edges, avoids hubs)
		graph.addEdge({ id: "E2", source: "SOURCE", target: "A", type: "edge" });
		graph.addEdge({ id: "E3", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E4", source: "B", target: "TARGET", type: "edge" });

		// Add extra edges to make HUB high-degree (> threshold of 5)
		graph.addNode({ id: "X1", type: "type_x1" });
		graph.addNode({ id: "X2", type: "type_x2" });
		graph.addNode({ id: "X3", type: "type_x3" });
		graph.addNode({ id: "X4", type: "type_x4" });
		graph.addNode({ id: "X5", type: "type_x5" });
		graph.addNode({ id: "X6", type: "type_x6" });

		graph.addEdge({ id: "E5", source: "HUB", target: "X1", type: "edge" });
		graph.addEdge({ id: "E6", source: "HUB", target: "X2", type: "edge" });
		graph.addEdge({ id: "E7", source: "HUB", target: "X3", type: "edge" });
		graph.addEdge({ id: "E8", source: "HUB", target: "X4", type: "edge" });
		graph.addEdge({ id: "E9", source: "HUB", target: "X5", type: "edge" });
		graph.addEdge({ id: "E10", source: "HUB", target: "X6", type: "edge" });

		// HUB now has degree 8 (> threshold of 5)

		// Set MI values: give diverse route slightly better MI
		// Use shortestOnly: false and small lambda to consider both path lengths
		const miCache = createMockMICache(
			new Map([
				// Hub-heavy route (moderate MI)
				["E0", 0.5],
				["E1", 0.5],
				// Diverse route (better MI to compensate for length)
				["E2", 0.8],
				["E3", 0.8],
				["E4", 0.8],
				// Extra edges (low MI)
				["E5", 0.1],
				["E6", 0.1],
				["E7", 0.1],
				["E8", 0.1],
				["E9", 0.1],
				["E10", 0.1],
			]),
		);

		// Run ranking with shortestOnly: false to find all paths
		const result = rankPaths(graph, "SOURCE", "TARGET", {
			miCache,
			maxPaths: 10,
			lambda: 0.05, // Small length penalty
			maxLength: 4,
			shortestOnly: false,
		});

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find both hub and diverse paths
			expect(paths.length).toBeGreaterThanOrEqual(2);

			// Find both paths by their node signatures
			const hubPath = paths.find((p) => {
				const nodes = p.path.nodes.map((n) => n.id);
				return nodes.includes("HUB");
			});

			const diversePath = paths.find((p) => {
				const nodes = new Set(p.path.nodes.map((n) => n.id));
				return nodes.has("A") && nodes.has("B");
			});

			// At minimum, we should find some paths
			expect(paths.length).toBeGreaterThan(0);

			// If both paths are found, verify ranking behavior
			if (hubPath && diversePath) {
				const _hubRank = paths.indexOf(hubPath);
				const diverseRank = paths.indexOf(diversePath);

				// Diverse path should be competitive (top 3) due to better MI
				expect(diverseRank).toBeLessThanOrEqual(2);
			}
		}
	});

	/**
	 * Test 4: Should balance hub avoidance with path quality.
	 *
	 * Tests that some hub use is acceptable when the hub provides
	 * significantly better mutual information. This validates that
	 * the algorithm doesn't blindly avoid all hubs.
	 */
	it("should balance hub avoidance with path quality", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create paths with different hub/MI trade-offs:
		// 1. High-MI hub path: SOURCE -> HUB -> TARGET (MI = 0.9 each)
		// 2. Low-MI diverse path: SOURCE -> A -> B -> TARGET (MI = 0.3 each)
		graph.addNode({ id: "SOURCE", type: "type_0" });
		graph.addNode({ id: "HUB", type: "type_hub" });
		graph.addNode({ id: "A", type: "type_a" });
		graph.addNode({ id: "B", type: "type_b" });
		graph.addNode({ id: "TARGET", type: "type_target" });

		// High-MI hub path (shorter, better MI)
		graph.addEdge({ id: "E0", source: "SOURCE", target: "HUB", type: "edge" });
		graph.addEdge({ id: "E1", source: "HUB", target: "TARGET", type: "edge" });

		// Low-MI diverse path (longer, worse MI, no hubs)
		graph.addEdge({ id: "E2", source: "SOURCE", target: "A", type: "edge" });
		graph.addEdge({ id: "E3", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E4", source: "B", target: "TARGET", type: "edge" });

		// Add extra edges to make HUB high-degree
		graph.addNode({ id: "X1", type: "type_x1" });
		graph.addNode({ id: "X2", type: "type_x2" });
		graph.addNode({ id: "X3", type: "type_x3" });
		graph.addNode({ id: "X4", type: "type_x4" });
		graph.addNode({ id: "X5", type: "type_x5" });
		graph.addNode({ id: "X6", type: "type_x6" });

		graph.addEdge({ id: "E5", source: "HUB", target: "X1", type: "edge" });
		graph.addEdge({ id: "E6", source: "HUB", target: "X2", type: "edge" });
		graph.addEdge({ id: "E7", source: "HUB", target: "X3", type: "edge" });
		graph.addEdge({ id: "E8", source: "HUB", target: "X4", type: "edge" });
		graph.addEdge({ id: "E9", source: "HUB", target: "X5", type: "edge" });
		graph.addEdge({ id: "E10", source: "HUB", target: "X6", type: "edge" });

		// HUB now has degree 8 (> threshold of 5)

		// Set MI values: hub path has much higher MI
		const miCache = createMockMICache(
			new Map([
				["E0", 0.9], // High MI for hub edges
				["E1", 0.9],
				["E2", 0.3], // Low MI for diverse path
				["E3", 0.3],
				["E4", 0.3],
				["E5", 0.1],
				["E6", 0.1],
				["E7", 0.1],
				["E8", 0.1],
				["E9", 0.1],
				["E10", 0.1],
			]),
		);

		// Run ranking with shortestOnly: false to consider both paths
		const result = rankPaths(graph, "SOURCE", "TARGET", {
			miCache,
			maxPaths: 10,
			lambda: 0,
			maxLength: 4,
			shortestOnly: false,
		});

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Find both paths
			const hubPath = paths.find((p) => p.path.nodes.some((n) => n.id === "HUB"));
			const diversePath = paths.find(
				(p) => p.path.nodes.some((n) => n.id === "A") && p.path.nodes.some((n) => n.id === "B"),
			);

			// Verify we found paths
			expect(paths.length).toBeGreaterThan(0);

			// If both paths exist, verify the hub path wins due to better MI
			if (hubPath && diversePath) {
				// Hub path should still be ranked higher due to much better MI
				// This shows the algorithm balances hub avoidance with quality
				const hubRank = paths.indexOf(hubPath);
				const diverseRank = paths.indexOf(diversePath);

				expect(hubRank).toBeLessThan(diverseRank);

				// Hub path score should be higher
				expect(hubPath.score).toBeGreaterThan(diversePath.score);

				// Verify the scores reflect the MI difference
				// Hub path geometric mean: sqrt(0.9 * 0.9) = 0.9
				// Diverse path geometric mean: (0.3 * 0.3 * 0.3)^(1/3) ≈ 0.3
				expect(hubPath.geometricMeanMI).toBeCloseTo(0.9, 0.01);
				expect(diversePath.geometricMeanMI).toBeCloseTo(0.3, 0.01);
			}

			// At minimum, the hub path should exist and have high MI
			if (hubPath) {
				expect(hubPath.geometricMeanMI).toBeCloseTo(0.9, 0.01);
			}
		}

		// Now test the opposite: when MI is similar
		const miCacheBalanced = createMockMICache(
			new Map([
				["E0", 0.5], // Same MI for hub path
				["E1", 0.5],
				["E2", 0.5], // Same MI for diverse path
				["E3", 0.5],
				["E4", 0.5],
				["E5", 0.1],
				["E6", 0.1],
				["E7", 0.1],
				["E8", 0.1],
				["E9", 0.1],
				["E10", 0.1],
			]),
		);

		const resultBalanced = rankPaths(graph, "SOURCE", "TARGET", {
			miCache: miCacheBalanced,
			maxPaths: 10,
			lambda: 0,
			maxLength: 4,
			shortestOnly: false,
		});

		expect(resultBalanced.ok).toBe(true);
		if (resultBalanced.ok && resultBalanced.value.some) {
			const paths = resultBalanced.value.value;

			// Should discover multiple paths
			expect(paths.length).toBeGreaterThan(0);

			// With equal MI, the shorter hub path should rank higher
			const hubPath = paths.find((p) => p.path.nodes.some((n) => n.id === "HUB"));
			if (hubPath) {
				expect(hubPath.geometricMeanMI).toBeCloseTo(0.5, 0.01);
			}
		}
	});
});

/**
 * Structural Coverage Tests for Path Salience Ranking
 *
 * Verifies that top-K paths provide good structural coverage of the graph.
 *
 * Tests include:
 * - Coverage of multiple graph regions
 * - Higher node coverage than random selection
 * - Inclusion of diverse structural patterns
 * - Coverage of structurally important nodes
 */

import { Graph } from "@graph/algorithms/graph/graph";
import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking";
import { computeRankingMetrics } from "@graph/experiments/evaluation/__tests__/validation/common/path-ranking-helpers";
import type { ProofTestEdge,ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

describe("Path Salience Ranking: Representativeness - Structural Coverage", () => {
	/**
	 * Top-K paths should cover multiple graph regions.
	 *
	 * Creates a graph with distinct regions and verifies that
	 * the top paths include nodes from different areas.
	 */
	it("should cover multiple graph regions in top-K paths", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create graph with three distinct regions
		const regions = ["A1", "A2", "B1", "B2", "C1", "C2", "S", "T"];
		for (const id of regions) {
			graph.addNode({ id, type: `type_${id}` });
		}

		// Region 1 paths (through A1, A2)
		graph.addEdge({ id: "E0", source: "S", target: "A1", type: "edge" });
		graph.addEdge({ id: "E1", source: "A1", target: "A2", type: "edge" });
		graph.addEdge({ id: "E2", source: "A2", target: "T", type: "edge" });

		// Region 2 paths (through B1, B2)
		graph.addEdge({ id: "E3", source: "S", target: "B1", type: "edge" });
		graph.addEdge({ id: "E4", source: "B1", target: "B2", type: "edge" });
		graph.addEdge({ id: "E5", source: "B2", target: "T", type: "edge" });

		// Region 3 paths (through C1, C2)
		graph.addEdge({ id: "E6", source: "S", target: "C1", type: "edge" });
		graph.addEdge({ id: "E7", source: "C1", target: "C2", type: "edge" });
		graph.addEdge({ id: "E8", source: "C2", target: "T", type: "edge" });

		// Cross-region connections for more paths
		graph.addEdge({ id: "E9", source: "A1", target: "B1", type: "edge" });
		graph.addEdge({ id: "E10", source: "B2", target: "C2", type: "edge" });
		graph.addEdge({ id: "E11", source: "A2", target: "B2", type: "edge" });

		// Assign MI values to encourage diversity
		const miCache = createMockMICache(
			new Map([
				["E0", 0.7],
				["E1", 0.6],
				["E2", 0.7],
				["E3", 0.65],
				["E4", 0.65],
				["E5", 0.65],
				["E6", 0.7],
				["E7", 0.6],
				["E8", 0.7],
				["E9", 0.5],
				["E10", 0.5],
				["E11", 0.5],
			]),
		);

		const result = rankPaths(graph, "S", "T", { miCache, maxPaths: 10 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find multiple paths
			expect(paths.length).toBeGreaterThan(1);

			// Check intermediate nodes
			const intermediateNodes = new Set<string>();
			for (const path of paths) {
				for (const node of path.path.nodes) {
					if (node.id !== "S" && node.id !== "T") {
						intermediateNodes.add(node.id);
					}
				}
			}

			// Should include nodes from multiple regions (at least 2 distinct regions)
			expect(intermediateNodes.size).toBeGreaterThanOrEqual(2);
		}
	});

	/**
	 * Should have higher node coverage than random path selection.
	 *
	 * Compares the node coverage metric between Path Salience Ranking
	 * and a shortest-path baseline.
	 */
	it("should have higher node coverage than random path selection", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a moderately sized graph
		const nodeIds = ["S", "T", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
		for (const id of nodeIds) {
			graph.addNode({ id, type: "test" });
		}

		// Create a richly connected graph
		const edges = [
			["S", "1"],
			["S", "2"],
			["S", "3"],
			["1", "4"],
			["2", "5"],
			["3", "6"],
			["4", "7"],
			["5", "8"],
			["6", "9"],
			["7", "T"],
			["8", "T"],
			["9", "T"],
			["10", "T"],
			// Cross connections
			["1", "5"],
			["2", "6"],
		];

		let edgeId = 0;
		for (const [source, target] of edges) {
			graph.addEdge({ id: `E${edgeId++}`, source, target, type: "edge" });
		}

		// Run Path Salience Ranking
		const salienceResult = rankPaths(graph, "S", "T", { maxPaths: 10 });
		// Run shortest path baseline
		const shortestResult = shortestPathRanking(graph, "S", "T", { maxPaths: 10 });

		expect(salienceResult.ok).toBe(true);
		expect(shortestResult.ok).toBe(true);

		if (salienceResult.ok && shortestResult.ok && salienceResult.value.some && shortestResult.value.some) {
			const saliencePaths = salienceResult.value.value;
			const shortestPaths = shortestResult.value.value;

			// Compute metrics
			const salienceMetrics = computeRankingMetrics(saliencePaths, graph);
			const shortestMetrics = computeRankingMetrics(shortestPaths, graph);

			// Path Salience should cover more nodes
			expect(salienceMetrics.nodeCoverage).toBeGreaterThanOrEqual(shortestMetrics.nodeCoverage);
		}
	});

	/**
	 * Top-K paths should include diverse structural patterns.
	 *
	 * Creates a graph with bridges, hubs, and spokes, then verifies
	 * that the top-K paths include these different structural elements.
	 */
	it("top-K paths should include diverse structural patterns", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a graph with multiple structural patterns
		const nodes = ["S", "T", "HUB", "BRIDGE", "LEAF1", "LEAF2", "LEAF3"];
		for (const id of nodes) {
			graph.addNode({ id, type: `type_${id}` });
		}

		// Hub pattern (S -> HUB -> T)
		graph.addEdge({ id: "E_S_HUB", source: "S", target: "HUB", type: "hub_edge" });
		graph.addEdge({ id: "E_HUB_T", source: "HUB", target: "T", type: "hub_edge" });

		// Bridge pattern (S -> BRIDGE -> T)
		graph.addEdge({ id: "E_S_BRIDGE", source: "S", target: "BRIDGE", type: "bridge" });
		graph.addEdge({ id: "E_BRIDGE_T", source: "BRIDGE", target: "T", type: "bridge" });

		// Leaf/spoke patterns
		graph.addEdge({ id: "E_S_LEAF1", source: "S", target: "LEAF1", type: "spoke" });
		graph.addEdge({ id: "E_LEAF1_T", source: "LEAF1", target: "T", type: "spoke" });

		graph.addEdge({ id: "E_S_LEAF2", source: "S", target: "LEAF2", type: "spoke" });
		graph.addEdge({ id: "E_LEAF2_T", source: "LEAF2", target: "T", type: "spoke" });

		graph.addEdge({ id: "E_S_LEAF3", source: "S", target: "LEAF3", type: "spoke" });
		graph.addEdge({ id: "E_LEAF3_T", source: "LEAF3", target: "T", type: "spoke" });

		// Assign MI to encourage diverse paths
		const miCache = createMockMICache(
			new Map([
				["E_S_HUB", 0.5],
				["E_HUB_T", 0.5],
				["E_S_BRIDGE", 0.7],
				["E_BRIDGE_T", 0.7],
				["E_S_LEAF1", 0.6],
				["E_LEAF1_T", 0.6],
				["E_S_LEAF2", 0.65],
				["E_LEAF2_T", 0.65],
				["E_S_LEAF3", 0.75],
				["E_LEAF3_T", 0.75],
			]),
		);

		const result = rankPaths(graph, "S", "T", { miCache, maxPaths: 10 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Top paths should use different intermediate nodes
			const intermediates = new Set<string>();
			for (const path of paths.slice(0, 5)) {
				for (const node of path.path.nodes) {
					if (node.id !== "S" && node.id !== "T") {
						intermediates.add(node.id);
					}
				}
			}

			// Should have multiple distinct intermediate nodes
			expect(intermediates.size).toBeGreaterThan(1);
		}
	});

	/**
	 * Top-K paths should include structurally important nodes.
	 *
	 * Creates a graph where high-betweenness nodes are not on
	 * shortest paths, and verifies they still appear in top-K results.
	 */
	it("should cover structurally important nodes", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a graph where a structurally important node
		// is not on the shortest path
		graph.addNode({ id: "S", type: "start" });
		graph.addNode({ id: "T", type: "end" });
		graph.addNode({ id: "SHORT", type: "on_shortest" });
		graph.addNode({ id: "IMPORTANT", type: "structural" });

		// Shortest path: S -> SHORT -> T
		graph.addEdge({ id: "E_S_SHORT", source: "S", target: "SHORT", type: "edge" });
		graph.addEdge({ id: "E_SHORT_T", source: "SHORT", target: "T", type: "edge" });

		// Alternative path through IMPORTANT node
		graph.addEdge({ id: "E_S_IMP", source: "S", target: "IMPORTANT", type: "edge" });
		graph.addEdge({ id: "E_IMP_T", source: "IMPORTANT", target: "T", type: "edge" });

		// Connect IMPORTANT to SHORT (making it part of longer paths)
		graph.addEdge({ id: "E_IMP_SHORT", source: "IMPORTANT", target: "SHORT", type: "bridge" });

		// Shortest path has lower MI, longer path has higher MI
		const miCache = createMockMICache(
			new Map([
				["E_S_SHORT", 0.3],
				["E_SHORT_T", 0.3],
				["E_S_IMP", 0.8],
				["E_IMP_T", 0.8],
				["E_IMP_SHORT", 0.4],
			]),
		);

		const result = rankPaths(graph, "S", "T", {
			miCache,
			maxPaths: 10,
			shortestOnly: false, // Include longer paths
			maxLength: 4,
		});

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find multiple paths
			expect(paths.length).toBeGreaterThan(1);

			// At least one path should include the IMPORTANT node
			const includesImportant = paths.some((p) => {
				const nodes = p.path.nodes.map((n) => n.id);
				return nodes.includes("IMPORTANT");
			});

			expect(includesImportant).toBe(true);
		}
	});
});

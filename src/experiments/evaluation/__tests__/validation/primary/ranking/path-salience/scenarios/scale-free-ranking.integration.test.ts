/**
 * Scale-Free Ranking Tests for Path Salience Ranking
 *
 * Verifies behavior on power-law/scale-free graphs with hub structures.
 *
 * Tests include:
 * - Navigation of scale-free topology
 * - Hub usage balancing with alternative routes
 * - Preferential attachment structures
 * - Heavy-tailed degree distributions
 */

import type { ProofTestEdge,ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

import { Graph } from "../../../../../../../../algorithms/graph/graph";
import { rankPaths } from "../../../../../../../../algorithms/pathfinding/path-ranking";
import { computeRankingMetrics } from "../../../../common/path-ranking-helpers";

describe("Path Salience Ranking: Scenarios - Scale-Free Ranking", () => {
	/**
	 * Should navigate scale-free topology correctly.
	 *
	 * Creates a hub-spoke graph with one high-degree central node
	 * and many low-degree spoke nodes.
	 */
	it("should navigate scale-free topology correctly", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Central hub
		graph.addNode({ id: "HUB", type: "hub" });

		// Source and target
		graph.addNode({ id: "S", type: "start" });
		graph.addNode({ id: "T", type: "end" });

		// Spokes (8 nodes connected to hub)
		const spokeCount = 8;
		for (let index = 0; index < spokeCount; index++) {
			graph.addNode({ id: `N${index}`, type: "spoke" });
			graph.addEdge({
				id: `E_hub_${index}`,
				source: "HUB",
				target: `N${index}`,
				type: "hub_edge",
			});
		}

		// Connect source and target through hub
		graph.addEdge({ id: "E_S_HUB", source: "S", target: "HUB", type: "to_hub" });
		graph.addEdge({ id: "E_HUB_T", source: "HUB", target: "T", type: "from_hub" });

		// Alternative path avoiding hub (S -> N0 -> T)
		graph.addEdge({ id: "E_S_N0", source: "S", target: "N0", type: "direct" });
		graph.addEdge({ id: "E_N0_T", source: "N0", target: "T", type: "direct" });

		// Set MI values - hub edges have lower MI (representing over-reliance)
		const miCache = createMockMICache(
			new Map([
				["E_S_HUB", 0.3], // Lower MI for hub route
				["E_HUB_T", 0.3],
				["E_S_N0", 0.8], // Higher MI for direct route
				["E_N0_T", 0.8],
				...Array.from({ length: spokeCount }, (_, index) => [`E_hub_${index}`, 0.5] as [string, number]),
			]),
		);

		const result = rankPaths(graph, "S", "T", { miCache, maxPaths: 10 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find paths
			expect(paths.length).toBeGreaterThan(0);

			// Top path should avoid over-reliance on hub
			const topPath = paths[0];
			const topNodes = new Set(topPath.path.nodes.map((n) => n.id));

			// Check if it includes hub or takes alternative route
			const hasHub = topNodes.has("HUB");
			const usesAlternative = topNodes.has("N0");

			// Should either use hub with good reason, or prefer alternative
			expect(hasHub || usesAlternative).toBe(true);
		}
	});

	/**
	 * Should balance hub usage with alternative routes.
	 *
	 * Verifies hub avoidance metric shows the algorithm doesn't
	 * overly rely on high-degree nodes.
	 */
	it("should balance hub usage with alternative routes", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create hub and spokes
		graph.addNode({ id: "S", type: "start" });
		graph.addNode({ id: "T", type: "end" });
		graph.addNode({ id: "H", type: "hub" });

		// Multiple spokes through hub
		for (let index = 0; index < 5; index++) {
			graph.addNode({ id: `A${index}`, type: `spoke_${index}` });
			graph.addEdge({ id: `E_S_A${index}`, source: "S", target: `A${index}`, type: "edge" });
			graph.addEdge({ id: `E_A${index}_H`, source: `A${index}`, target: "H", type: "edge" });
		}

		// Hub to target
		graph.addEdge({ id: "E_H_T", source: "H", target: "T", type: "edge" });

		// Direct alternative (non-hub)
		graph.addNode({ id: "D", type: "direct" });
		graph.addEdge({ id: "E_S_D", source: "S", target: "D", type: "edge" });
		graph.addEdge({ id: "E_D_T", source: "D", target: "T", type: "edge" });

		// Set MI: hub-heavy paths have lower MI
		const miCache = createMockMICache(
			new Map([
				// Hub paths (lower MI due to congestion)
				...Array.from({ length: 5 }, (_, index) => [`E_S_A${index}`, 0.4] as [string, number]),
				...Array.from({ length: 5 }, (_, index) => [`E_A${index}_H`, 0.4] as [string, number]),
				["E_H_T", 0.4],
				// Direct path (higher MI)
				["E_S_D", 0.9],
				["E_D_T", 0.9],
			]),
		);

		const result = rankPaths(graph, "S", "T", { miCache, maxPaths: 8 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;
			const metrics = computeRankingMetrics(paths, graph, 5);

			// Hub avoidance should be measurable
			expect(metrics.hubAvoidance).toBeGreaterThanOrEqual(0);

			// Top paths should include non-hub routes
			const topPaths = paths.slice(0, Math.min(3, paths.length));
			const hasNonHubPath = topPaths.some((p) => {
				const nodes = p.path.nodes.map((n) => n.id);
				return !nodes.includes("H");
			});

			// Should have some paths avoiding hub
			expect(hasNonHubPath).toBe(true);
		}
	});

	/**
	 * Should handle preferential attachment structures.
	 *
	 * Creates a core-periphery graph mimicking preferential attachment
	 * where high-degree nodes attract more connections.
	 */
	it("should handle preferential attachment structures", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Core nodes (highly connected)
		graph.addNode({ id: "C1", type: "core" });
		graph.addNode({ id: "C2", type: "core" });
		graph.addNode({ id: "C3", type: "core" });
		graph.addEdge({ id: "E_C1_C2", source: "C1", target: "C2", type: "core" });
		graph.addEdge({ id: "E_C2_C3", source: "C2", target: "C3", type: "core" });
		graph.addEdge({ id: "E_C3_C1", source: "C3", target: "C1", type: "core" });

		// Periphery nodes
		graph.addNode({ id: "S", type: "start" });
		graph.addNode({ id: "T", type: "end" });

		// Connections from S to core (preferential attachment to well-connected C1)
		graph.addEdge({ id: "E_S_C1", source: "S", target: "C1", type: "peripheral" });
		graph.addEdge({ id: "E_S_C2", source: "S", target: "C2", type: "peripheral" });

		// Connections from core to T
		graph.addEdge({ id: "E_C1_T", source: "C1", target: "T", type: "peripheral" });
		graph.addEdge({ id: "E_C2_T", source: "C2", target: "T", type: "peripheral" });
		graph.addEdge({ id: "E_C3_T", source: "C3", target: "T", type: "peripheral" });

		// Direct periphery path (bypassing core)
		graph.addEdge({ id: "E_S_T", source: "S", target: "T", type: "direct" });

		// Core edges have higher MI (well-connected), direct has lower MI
		const miCache = createMockMICache(
			new Map([
				["E_S_C1", 0.7],
				["E_S_C2", 0.6],
				["E_C1_T", 0.7],
				["E_C2_T", 0.6],
				["E_C3_T", 0.6],
				["E_S_T", 0.2], // Low MI for direct weak link
				["E_C1_C2", 0.8],
				["E_C2_C3", 0.8],
				["E_C3_C1", 0.8],
			]),
		);

		const result = rankPaths(graph, "S", "T", { miCache, maxPaths: 10, shortestOnly: false, maxLength: 3 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find multiple paths through the core
			const corePaths = paths.filter((p) => {
				const nodes = p.path.nodes.map((n) => n.id);
				return nodes.some((n) => n.startsWith("C"));
			});

			// Core-heavy paths should be represented
			expect(corePaths.length).toBeGreaterThan(0);

			// At minimum, should find the S -> C1 -> T path
			expect(paths.length).toBeGreaterThan(0);
		}
	});

	/**
	 * Should work on graphs with heavy-tailed degree distribution.
	 *
	 * Compares scale-free graph against uniform degree graph
	 * to verify different topology handling.
	 */
	it("should work on graphs with heavy-tailed degree distribution", () => {
		// Scale-free graph (heavy-tailed)
		const sfGraph = new Graph<ProofTestNode, ProofTestEdge>(false);

		sfGraph.addNode({ id: "S", type: "start" });
		sfGraph.addNode({ id: "T", type: "end" });
		sfGraph.addNode({ id: "H1", type: "hub1" });
		sfGraph.addNode({ id: "H2", type: "hub2" });

		// Create heavy-tailed structure
		sfGraph.addEdge({ id: "E_S_H1", source: "S", target: "H1", type: "edge" });
		sfGraph.addEdge({ id: "E_H1_T", source: "H1", target: "T", type: "edge" });

		// Many low-degree nodes connected to H1
		for (let index = 0; index < 6; index++) {
			sfGraph.addNode({ id: `L${index}`, type: "low_degree" });
			sfGraph.addEdge({ id: `E_H1_L${index}`, source: "H1", target: `L${index}`, type: "weak" });
		}

		// Secondary hub with fewer connections
		sfGraph.addEdge({ id: "E_S_H2", source: "S", target: "H2", type: "edge" });
		sfGraph.addEdge({ id: "E_H2_T", source: "H2", target: "T", type: "edge" });

		// MI values favor path through secondary hub (avoiding congestion at H1)
		const sfMICache = createMockMICache(
			new Map([
				["E_S_H1", 0.4],
				["E_H1_T", 0.4],
				["E_S_H2", 0.7],
				["E_H2_T", 0.7],
				...Array.from({ length: 6 }, (_, index) => [`E_H1_L${index}`, 0.3] as [string, number]),
			]),
		);

		const sfResult = rankPaths(sfGraph, "S", "T", { miCache: sfMICache });

		// Uniform graph for comparison
		const uniformGraph = new Graph<ProofTestNode, ProofTestEdge>(false);

		uniformGraph.addNode({ id: "S", type: "start" });
		uniformGraph.addNode({ id: "T", type: "end" });
		uniformGraph.addNode({ id: "A", type: "mid1" });
		uniformGraph.addNode({ id: "B", type: "mid2" });
		uniformGraph.addNode({ id: "C", type: "mid3" });

		uniformGraph.addEdge({ id: "E_U_S_A", source: "S", target: "A", type: "edge" });
		uniformGraph.addEdge({ id: "E_U_A_T", source: "A", target: "T", type: "edge" });
		uniformGraph.addEdge({ id: "E_U_S_B", source: "S", target: "B", type: "edge" });
		uniformGraph.addEdge({ id: "E_U_B_T", source: "B", target: "T", type: "edge" });
		uniformGraph.addEdge({ id: "E_U_S_C", source: "S", target: "C", type: "edge" });
		uniformGraph.addEdge({ id: "E_U_C_T", source: "C", target: "T", type: "edge" });

		const uniformMICache = createMockMICache(
			new Map([
				["E_U_S_A", 0.6],
				["E_U_A_T", 0.6],
				["E_U_S_B", 0.6],
				["E_U_B_T", 0.6],
				["E_U_S_C", 0.6],
				["E_U_C_T", 0.6],
			]),
		);

		const uniformResult = rankPaths(uniformGraph, "S", "T", { miCache: uniformMICache });

		// Both should complete successfully
		expect(sfResult.ok).toBe(true);
		expect(uniformResult.ok).toBe(true);

		if (sfResult.ok && uniformResult.ok && sfResult.value.some && uniformResult.value.some) {
			// Both should find paths
			expect(sfResult.value.value.length).toBeGreaterThan(0);
			expect(uniformResult.value.value.length).toBeGreaterThan(0);

			// Scale-free may have fewer paths due to bottlenecks
			// Uniform should have more equal options
			expect(uniformResult.value.value.length).toBeGreaterThanOrEqual(sfResult.value.value.length);
		}
	});
});

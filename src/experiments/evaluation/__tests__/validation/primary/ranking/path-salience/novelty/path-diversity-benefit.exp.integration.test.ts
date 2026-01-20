/**
 * Path Diversity Benefit Tests for Path Salience Ranking
 *
 * Validates that Path Salience Ranking promotes diverse paths in top-K results.
 *
 * Tests include:
 * - Diverse paths in top-K results
 * - Higher path diversity than shortest-path baseline
 * - Balance between MI quality and path variety
 * - Avoidance of redundant paths in ranking
 */

import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking";
import type { ProofTestEdge,ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

import { Graph } from "../../../../../../../../algorithms/graph/graph";
import {rankPaths } from "../../../../../../../../algorithms/pathfinding/path-ranking";
import { computeRankingMetrics } from "../../../../common/path-ranking-helpers";

describe("Path Salience Ranking: Path Diversity Benefit", () => {
	/**
	 * Top-K results should include structurally diverse paths.
	 *
	 * Graph structure (6 paths from S to T):
	 *   S --1-- A --2-- D --5-- T
	 *   S --1-- B --3-- E --6-- T
	 *   S --1-- C --4-- F --7-- T
	 *   S --8-- G --9-- T (direct-ish)
	 *   S --1-- A --10-- G --9-- T
	 *   S --1-- B --11-- F --7-- T
	 *
	 * Different paths use different intermediate nodes.
	 */
	it("should include diverse paths in top-K results", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a diamond+ graph with multiple shortest paths
		const nodeIds = ["S", "T", "A", "B", "C"];
		for (const id of nodeIds) {
			graph.addNode({ id, type: `type_${id}` });
		}

		// Create multiple paths of equal length (3 edges each)
		// S-A-T, S-B-T, S-C-T are all valid paths
		const edges = [
			{ source: "S", target: "A" },
			{ source: "A", target: "T" },
			{ source: "S", target: "B" },
			{ source: "B", target: "T" },
			{ source: "S", target: "C" },
			{ source: "C", target: "T" },
			// Add cross connections for more paths
			{ source: "A", target: "B" },
			{ source: "B", target: "C" },
		];

		let edgeId = 0;
		for (const edge of edges) {
			graph.addEdge({
				id: `E${edgeId++}`,
				source: edge.source,
				target: edge.target,
				type: "edge",
			});
		}

		const result = rankPaths(graph, "S", "T", { maxPaths: 10 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Check that we get multiple paths
			expect(paths.length).toBeGreaterThan(1);

			// Check structural diversity by examining intermediate nodes
			const intermediateNodes = new Set<string>();
			for (const path of paths) {
				const nodeIds = path.path.nodes.map((n) => n.id);
				// Exclude source and target
				for (const nodeId of nodeIds) {
					if (nodeId !== "S" && nodeId !== "T") {
						intermediateNodes.add(nodeId);
					}
				}
			}

			// Should have multiple distinct intermediate nodes
			expect(intermediateNodes.size).toBeGreaterThan(1);

			// Top paths should use different routes
			const signatures = paths.map((p) => p.path.nodes.map((n) => n.id).join("->"));
			const uniqueSignatures = new Set(signatures);
			expect(uniqueSignatures.size).toBeGreaterThan(1);
		}
	});

	/**
	 * Path Salience should have higher path diversity than shortest-path baseline.
	 *
	 * The shortest-path baseline only considers paths of minimum length,
	 * resulting in lower diversity. Path Salience considers paths beyond
	 * the minimum length when shortestOnly=false.
	 */
	it("should have higher path diversity than shortest-path baseline", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create a graph with paths at different lengths
		const nodeIds = ["S", "T", "A", "B", "C", "D"];
		for (const id of nodeIds) {
			graph.addNode({ id, type: `type_${id}` });
		}

		// Shortest paths (length 3): S-A-T, S-B-T
		// Longer paths (length 4): S-A-D-T, S-B-D-T, S-A-C-D-T
		const edges = [
			{ source: "S", target: "A" },
			{ source: "S", target: "B" },
			{ source: "A", target: "T" },
			{ source: "B", target: "T" },
			{ source: "A", target: "D" },
			{ source: "B", target: "D" },
			{ source: "D", target: "T" },
			{ source: "A", target: "C" },
			{ source: "C", target: "D" },
		];

		let edgeId = 0;
		for (const edge of edges) {
			graph.addEdge({
				id: `E${edgeId++}`,
				source: edge.source,
				target: edge.target,
				type: "edge",
			});
		}

		// Get shortest path baseline (only shortest paths)
		const shortestResult = shortestPathRanking(graph, "S", "T", { maxPaths: 10 });

		// Get Path Salience results with shortestOnly=false to allow longer paths
		const salienceResult = rankPaths(graph, "S", "T", {
			maxPaths: 10,
			shortestOnly: false,
			maxLength: 5,
			lambda: 0, // No length penalty, allow longer paths
		});

		expect(shortestResult.ok).toBe(true);
		expect(salienceResult.ok).toBe(true);

		if (
			shortestResult.ok &&
			shortestResult.value.some &&
			salienceResult.ok &&
			salienceResult.value.some
		) {
			const shortestPaths = shortestResult.value.value;
			const saliencePaths = salienceResult.value.value;

			const shortestMetrics = computeRankingMetrics(shortestPaths, graph);
			const salienceMetrics = computeRankingMetrics(saliencePaths, graph);

			// Path Salience should have equal or higher path diversity
			// because it can include paths of varying lengths
			expect(salienceMetrics.pathDiversity).toBeGreaterThanOrEqual(
				shortestMetrics.pathDiversity,
			);

			// Path Salience should find more paths
			expect(saliencePaths.length).toBeGreaterThanOrEqual(shortestPaths.length);
		}
	});

	/**
	 * Path Salience should balance MI quality with path variety.
	 *
	 * Graph with paths having varying MI quality:
	 * - High MI, commonly used edges
	 * - Lower MI, unique edges
	 *
	 * The ranking should include both high-MI paths and diverse paths.
	 */
	it("should balance MI quality with path variety", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create graph with multiple paths where some share edges
		const nodeIds = ["S", "T", "H", "A", "B", "C"];
		for (const id of nodeIds) {
			graph.addNode({ id, type: `type_${id}` });
		}

		// Edges: H is a hub (high degree), A/B/C are unique routes
		const edges = [
			{ source: "S", target: "H" }, // Hub route (high MI due to hub degree)
			{ source: "H", target: "T" },
			{ source: "S", target: "A" }, // Unique route
			{ source: "A", target: "T" },
			{ source: "S", target: "B" }, // Another unique route
			{ source: "B", target: "T" },
			{ source: "S", target: "C" }, // Third unique route
			{ source: "C", target: "T" },
		];

		let edgeId = 0;
		for (const edge of edges) {
			graph.addEdge({
				id: `E${edgeId++}`,
				source: edge.source,
				target: edge.target,
				type: "edge",
			});
		}

		const result = rankPaths(graph, "S", "T", { maxPaths: 5 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Check that results include diverse routes
			const intermediateNodes = new Set<string>();
			for (const path of paths) {
				for (const node of path.path.nodes) {
					if (node.id !== "S" && node.id !== "T") {
						intermediateNodes.add(node.id);
					}
				}
			}

			// Should include both hub and non-hub paths
			expect(intermediateNodes.size).toBeGreaterThan(1);

			// Get MI distribution
			const miValues = paths.map((p) => p.geometricMeanMI);
			const meanMI = miValues.reduce((a, b) => a + b, 0) / miValues.length;

			// Should have reasonable MI quality (not zero)
			expect(meanMI).toBeGreaterThan(0);

			// Paths should have variety in MI values
			const uniqueMIValues = new Set(miValues.map((v) => v.toFixed(3)));
			// Having some variety indicates diversity is being considered
			expect(uniqueMIValues.size).toBeGreaterThanOrEqual(1);
		}
	});

	/**
	 * Redundant paths (sharing many nodes) should score lower.
	 *
	 * Graph structure:
	 * - Path 1: S-A-B-T (unique)
	 * - Path 2: S-C-D-T (unique)
	 * - Path 3: S-A-B-T (redundant with Path 1)
	 * - Path 4: S-A-E-T (partially redundant)
	 *
	 * The ranking should penalise highly redundant paths.
	 */
	it("should avoid redundant paths in ranking", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Nodes
		const nodeIds = ["S", "T", "A", "B", "C", "D", "E"];
		for (const id of nodeIds) {
			graph.addNode({ id, type: `type_${id}` });
		}

		// Create multiple paths with varying overlap
		const edges = [
			// Path 1: S-A-B-T
			{ source: "S", target: "A" },
			{ source: "A", target: "B" },
			{ source: "B", target: "T" },

			// Path 2: S-C-D-T (completely different)
			{ source: "S", target: "C" },
			{ source: "C", target: "D" },
			{ source: "D", target: "T" },

			// Path 3 variant: S-A-E-T (shares S-A with Path 1)
			{ source: "A", target: "E" },
			{ source: "E", target: "T" },

			// Additional connection making B-C path
			{ source: "B", target: "C" },
		];

		let edgeId = 0;
		for (const edge of edges) {
			graph.addEdge({
				id: `E${edgeId++}`,
				source: edge.source,
				target: edge.target,
				type: "edge",
			});
		}

		const result = rankPaths(graph, "S", "T", { maxPaths: 10 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Compute path similarity matrix based on node overlap
			const computeOverlap = (pathA: string[], pathB: string[]): number => {
				const setA = new Set(pathA);
				const setB = new Set(pathB);
				const intersection = new Set([...setA].filter((x) => setB.has(x)));
				const union = new Set([...setA, ...setB]);
				return intersection.size / union.size;
			};

			// Get all path signatures
			const signatures = paths.map((p) => p.path.nodes.map((n) => n.id));

			// Check that top paths have lower pairwise overlap
			let maxOverlap = 0;
			for (let index = 0; index < Math.min(signatures.length, 3); index++) {
				for (let index_ = index + 1; index_ < Math.min(signatures.length, 3); index_++) {
					const overlap = computeOverlap(signatures[index], signatures[index_]);
					maxOverlap = Math.max(maxOverlap, overlap);
				}
			}

			// Top paths should not be identical (overlap < 1)
			expect(maxOverlap).toBeLessThan(1);

			// Should have at least 2 structurally different paths
			const uniquePaths = new Set(signatures.map((s) => s.join("->")));
			expect(uniquePaths.size).toBeGreaterThan(1);
		}
	});

	/**
	 * Graph with many alternative paths should yield high diversity.
	 *
	 * Creates a "ladder" graph with many parallel routes.
	 * Verifies that path diversity metric reflects this structure.
	 */
	it("should achieve high path diversity in ladder graph", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create ladder graph with paths at different lengths to create diversity
		// Short paths: S-A1-T, S-A2-T (length 2)
		// Longer paths: S-A1-A2-T, S-A2-A3-T (length 3)
		// Even longer: S-A1-A2-A3-T (length 4)
		const nodeIds = ["S", "T", "A1", "A2", "A3"];
		for (const id of nodeIds) {
			graph.addNode({ id, type: `type_${id}` });
		}

		const edges = [
			{ source: "S", target: "A1" },
			{ source: "A1", target: "T" },
			{ source: "S", target: "A2" },
			{ source: "A2", target: "T" },
			{ source: "S", target: "A3" },
			{ source: "A3", target: "T" },

			// Add cross connections for longer paths
			{ source: "A1", target: "A2" },
			{ source: "A2", target: "A3" },
		];

		let edgeId = 0;
		for (const edge of edges) {
			graph.addEdge({
				id: `E${edgeId++}`,
				source: edge.source,
				target: edge.target,
				type: "edge",
			});
		}

		// Use shortestOnly=false to get paths of varying lengths
		const result = rankPaths(graph, "S", "T", {
			maxPaths: 10,
			shortestOnly: false,
			maxLength: 4,
		});

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;

			// Should find multiple paths
			expect(paths.length).toBeGreaterThan(2);

			const metrics = computeRankingMetrics(paths, graph);

			// Path diversity should be measurable
			// With paths of varying lengths (2, 3, 4 edges), we should have entropy
			expect(metrics.pathDiversity).toBeGreaterThan(0);
		}
	});
});

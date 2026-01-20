/**
 * Weak Link Path Tests for Path Salience Ranking
 *
 * Verifies behavior when paths contain weak (low-MI) edges.
 * The geometric mean property ensures that weak links significantly
 * reduce overall path scores regardless of position.
 *
 * Tests include:
 * - Single weak link penalisation
 * - All-weak vs all-strong path ranking
 * - Zero-MI edge handling
 * - Position independence of weak links
 */

import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

import { Graph } from "../../../../../../../../algorithms/graph/graph";
import { rankPaths } from "../../../../../../../../algorithms/pathfinding/path-ranking";

describe("Path Salience Ranking: Scenarios - Weak Link Paths", () => {
	/**
	 * Test 1: Single weak link should significantly reduce path score.
	 *
	 * Graph structure (chain):
	 *   A -> B -> C -> D
	 *
	 * Edge MI values:
	 * - A->B: 0.9 (strong)
	 * - B->C: 0.1 (weak)
	 * - C->D: 0.9 (strong)
	 *
	 * Expected geometric mean: (0.9 * 0.1 * 0.9)^(1/3) = 0.081^(1/3) ≈ 0.433
	 * The single weak link (MI=0.1) dominates the geometric mean.
	 */
	it("should penalise paths with single weak link", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "start" });
		graph.addNode({ id: "B", type: "middle1" });
		graph.addNode({ id: "C", type: "middle2" });
		graph.addNode({ id: "D", type: "end" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "strong" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "weak" });
		graph.addEdge({ id: "E2", source: "C", target: "D", type: "strong" });

		const miCache = createMockMICache(
			new Map([
				["E0", 0.9], // Strong
				["E1", 0.1], // Weak
				["E2", 0.9], // Strong
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache, lambda: 0 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			// geometric_mean(0.9, 0.1, 0.9) = (0.081)^(1/3) ≈ 0.433
			expect(path.geometricMeanMI).toBeCloseTo(0.433, 0.01);
			// Weak link reduces score below 0.5 despite two strong edges
			expect(path.geometricMeanMI).toBeLessThan(0.5);
			expect(path.edgeMIValues).toEqual([0.9, 0.1, 0.9]);
		}
	});

	/**
	 * Test 2: All-weak paths should rank below all-strong paths.
	 *
	 * Graph structure (diamond):
	 *   A
	 *  / \
	 * B   C
	 *  \ /
	 *   D
	 *
	 * Edge MI values:
	 * - Path 1 (A->B->D): all MI=0.2 (weak)
	 * - Path 2 (A->C->D): all MI=0.8 (strong)
	 *
	 * Expected scores:
	 * - Path 1: geometric_mean(0.2, 0.2) = sqrt(0.04) = 0.2
	 * - Path 2: geometric_mean(0.8, 0.8) = sqrt(0.64) = 0.8
	 *
	 * Strong path should rank first.
	 */
	it("should rank all-weak paths below all-strong paths", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "start" });
		graph.addNode({ id: "B", type: "weak_middle" });
		graph.addNode({ id: "C", type: "strong_middle" });
		graph.addNode({ id: "D", type: "end" });

		// Weak path edges
		graph.addEdge({ id: "E_weak_1", source: "A", target: "B", type: "weak" });
		graph.addEdge({ id: "E_weak_2", source: "B", target: "D", type: "weak" });

		// Strong path edges
		graph.addEdge({ id: "E_strong_1", source: "A", target: "C", type: "strong" });
		graph.addEdge({ id: "E_strong_2", source: "C", target: "D", type: "strong" });

		const miCache = createMockMICache(
			new Map([
				["E_weak_1", 0.2], // Weak path edges
				["E_weak_2", 0.2],
				["E_strong_1", 0.8], // Strong path edges
				["E_strong_2", 0.8],
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache, lambda: 0 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;
			expect(paths.length).toBe(2);

			// Find paths by their node signatures
			const weakPath = paths.find((p) => {
				const nodes = p.path.nodes.map((n) => n.id);
				return nodes.includes("B");
			});
			const strongPath = paths.find((p) => {
				const nodes = p.path.nodes.map((n) => n.id);
				return nodes.includes("C");
			});

			expect(weakPath).toBeDefined();
			expect(strongPath).toBeDefined();

			if (weakPath && strongPath) {
				// Verify geometric means
				expect(weakPath.geometricMeanMI).toBeCloseTo(0.2, 0.01);
				expect(strongPath.geometricMeanMI).toBeCloseTo(0.8, 0.01);

				// Strong path should be ranked higher (first)
				const topPath = paths[0];
				const topPathNodes = topPath.path.nodes.map((n) => n.id);
				expect(topPathNodes).toContain("C");

				// Strong path score should be 4x the weak path score
				expect(strongPath.score).toBeGreaterThan(weakPath.score * 3);
			}
		}
	});

	/**
	 * Test 3: Zero-MI edges should make path score zero.
	 *
	 * Graph structure:
	 *   A -> B -> C
	 *
	 * Edge MI values:
	 * - A->B: 0.5
	 * - B->C: 0.0
	 *
	 * Expected geometric mean: sqrt(0.5 * 0.0) = 0.0
	 * Any zero-MI edge forces the entire path score to zero.
	 */
	it("should handle zero-MI edges gracefully", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "start" });
		graph.addNode({ id: "B", type: "middle" });
		graph.addNode({ id: "C", type: "end" });

		graph.addEdge({ id: "E0", source: "A", target: "B", type: "normal" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "zero_mi" });

		const miCache = createMockMICache(
			new Map([
				["E0", 0.5],
				["E1", 0], // Zero MI
			]),
		);

		const result = rankPaths(graph, "A", "C", { miCache, lambda: 0 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const [path] = result.value.value;
			// geometric_mean(0.5, 0.0) = sqrt(0) = 0
			// Implementation may use epsilon smoothing, so check for near-zero
			expect(path.geometricMeanMI).toBeCloseTo(0, 4);
			expect(path.score).toBeCloseTo(0, 4);
			// Check that both values are present (order may vary)
			expect(path.edgeMIValues).toContain(0.5);
			expect(path.edgeMIValues).toContain(0);
			expect(path.edgeMIValues).toHaveLength(2);
		}
	});

	/**
	 * Test 4: Weak link position should not affect score (geometric mean property).
	 *
	 * Graph structure (diamond with symmetric paths):
	 *   A
	 *  / \
	 * B   C
	 *  \ /
	 *   D
	 *
	 * Path 1: A->B->D with weak link at position 1 (A->B)
	 * Path 2: A->C->D with weak link at position 2 (C->D)
	 *
	 * Edge MI values:
	 * - A->B: 0.1 (weak, first edge)
	 * - B->D: 0.9 (strong)
	 * - A->C: 0.9 (strong)
	 * - C->D: 0.1 (weak, last edge)
	 *
	 * Both paths should have identical scores: geometric_mean(0.1, 0.9) ≈ 0.3
	 * This demonstrates the commutative property of geometric mean.
	 */
	it("weak link at different positions affects score equally", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "start" });
		graph.addNode({ id: "B", type: "weak_first" });
		graph.addNode({ id: "C", type: "weak_last" });
		graph.addNode({ id: "D", type: "end" });

		// Path 1: weak link at start
		graph.addEdge({ id: "E_start_weak", source: "A", target: "B", type: "weak" });
		graph.addEdge({ id: "E_middle_strong", source: "B", target: "D", type: "strong" });

		// Path 2: weak link at end
		graph.addEdge({ id: "E_start_strong", source: "A", target: "C", type: "strong" });
		graph.addEdge({ id: "E_end_weak", source: "C", target: "D", type: "weak" });

		const miCache = createMockMICache(
			new Map([
				["E_start_weak", 0.1], // Weak at position 1
				["E_middle_strong", 0.9],
				["E_start_strong", 0.9],
				["E_end_weak", 0.1], // Weak at position 2
			]),
		);

		const result = rankPaths(graph, "A", "D", { miCache, lambda: 0 });

		expect(result.ok).toBe(true);
		if (result.ok && result.value.some) {
			const paths = result.value.value;
			expect(paths.length).toBe(2);

			// Find both paths
			const weakFirstPath = paths.find((p) => {
				const nodes = p.path.nodes.map((n) => n.id);
				return nodes.includes("B");
			});
			const weakLastPath = paths.find((p) => {
				const nodes = p.path.nodes.map((n) => n.id);
				return nodes.includes("C");
			});

			expect(weakFirstPath).toBeDefined();
			expect(weakLastPath).toBeDefined();

			if (weakFirstPath && weakLastPath) {
				// Both paths should have the same geometric mean
				// geometric_mean(0.1, 0.9) = sqrt(0.09) = 0.3
				expect(weakFirstPath.geometricMeanMI).toBeCloseTo(0.3, 0.01);
				expect(weakLastPath.geometricMeanMI).toBeCloseTo(0.3, 0.01);

				// Scores should be identical (position doesn't matter)
				expect(weakFirstPath.score).toBeCloseTo(weakLastPath.score, 0.001);

				// Verify both paths contain the same edge MI values (order may differ)
				// The geometric mean is commutative, so position doesn't matter
				const sortedWeakFirst = [...weakFirstPath.edgeMIValues].sort();
				const sortedWeakLast = [...weakLastPath.edgeMIValues].sort();
				expect(sortedWeakFirst).toEqual([0.1, 0.9]);
				expect(sortedWeakLast).toEqual([0.1, 0.9]);
			}
		}
	});
});

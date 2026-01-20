/**
 * MI Sensitivity Tests for Path Salience Ranking
 *
 * Validates that Path Salience Ranking responds appropriately to MI value variations.
 * The ranking should demonstrate predictable behaviour when edge MI values change.
 *
 * Tests include:
 * - Proportional response to uniform MI scaling
 * - Sensitivity to single-edge MI changes
 * - Disproportionate impact of weak links
 * - Correct handling of MI range [0, 1]
 * - Stability under small perturbations
 */

import type { ProofTestEdge, ProofTestNode } from "@graph/experiments/proofs/test-utils";
import { createMockMICache } from "@graph/experiments/proofs/test-utils";
import { describe, expect, it } from "vitest";

import { Graph } from "../../../../../../../../algorithms/graph/graph";
import { rankPaths } from "../../../../../../../../algorithms/pathfinding/path-ranking";

describe("Path Salience Ranking: MI Sensitivity", () => {
	/**
	 * Uniform scaling of all MI values should proportionally scale path scores.
	 * Uses a simple 3-node chain graph with two paths of equal length.
	 */
	it("should increase score proportionally with uniform MI increase", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Create chain: A -> B -> C
		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addNode({ id: "C", type: "type_C" });
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		// Baseline: MI = 0.4 for all edges
		const baselineCache = createMockMICache(
			new Map([
				["E0", 0.4],
				["E1", 0.4],
			]),
		);
		const baselineResult = rankPaths(graph, "A", "C", { miCache: baselineCache, lambda: 0 });

		expect(baselineResult.ok).toBe(true);
		let baselineScore = 0;
		if (baselineResult.ok && baselineResult.value.some) {
			const [path] = baselineResult.value.value;
			baselineScore = path.score;
			// For equal MI values, geometric mean equals the MI value
			expect(baselineScore).toBeCloseTo(0.4, 0.01);
		}

		// Scale by 1.5x: MI = 0.6 for all edges
		const scaledCache = createMockMICache(
			new Map([
				["E0", 0.6],
				["E1", 0.6],
			]),
		);
		const scaledResult = rankPaths(graph, "A", "C", { miCache: scaledCache, lambda: 0 });

		expect(scaledResult.ok).toBe(true);
		if (scaledResult.ok && scaledResult.value.some) {
			const [path] = scaledResult.value.value;
			const scaledScore = path.score;
			// Score should scale proportionally
			expect(scaledScore).toBeCloseTo(0.6, 0.01);
			expect(scaledScore / baselineScore).toBeCloseTo(1.5, 0.1);
		}

		// Scale by 2x: MI = 0.8 for all edges
		const doubledCache = createMockMICache(
			new Map([
				["E0", 0.8],
				["E1", 0.8],
			]),
		);
		const doubledResult = rankPaths(graph, "A", "C", { miCache: doubledCache, lambda: 0 });

		expect(doubledResult.ok).toBe(true);
		if (doubledResult.ok && doubledResult.value.some) {
			const [path] = doubledResult.value.value;
			const doubledScore = path.score;
			expect(doubledScore).toBeCloseTo(0.8, 0.01);
			expect(doubledScore / baselineScore).toBeCloseTo(2, 0.1);
		}
	});

	/**
	 * Changing a single edge's MI should affect rankings.
	 * Uses a diamond graph where one path can be strengthened relative to the other.
	 */
	it("should respond to single-edge MI changes", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Diamond: A -> B -> D and A -> C -> D
		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addNode({ id: "C", type: "type_C" });
		graph.addNode({ id: "D", type: "type_D" });
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E2", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E3", source: "C", target: "D", type: "edge" });

		// Initial configuration: both paths have equal geometric mean
		// Path A->B->D: sqrt(0.5 * 0.7) ≈ 0.591
		// Path A->C->D: sqrt(0.6 * 0.6) = 0.6
		// A->C->D should be ranked higher
		const initialCache = createMockMICache(
			new Map([
				["E0", 0.5], // A->B
				["E1", 0.6], // A->C
				["E2", 0.7], // B->D
				["E3", 0.6], // C->D
			]),
		);
		const initialResult = rankPaths(graph, "A", "D", { miCache: initialCache, lambda: 0 });

		expect(initialResult.ok).toBe(true);
		if (initialResult.ok && initialResult.value.some) {
			const paths = initialResult.value.value;
			expect(paths.length).toBe(2);
			// A->C->D should be top-ranked
			const topPathSignature = paths[0].path.nodes.map((n) => n.id).join("->");
			expect(topPathSignature).toBe("A->C->D");
		}

		// Increase E2 (B->D) to 0.9, flipping the ranking
		// Path A->B->D: sqrt(0.5 * 0.9) ≈ 0.671
		// Path A->C->D: sqrt(0.6 * 0.6) = 0.6
		// A->B->D should now be ranked higher
		const modifiedCache = createMockMICache(
			new Map([
				["E0", 0.5], // A->B (unchanged)
				["E1", 0.6], // A->C (unchanged)
				["E2", 0.9], // B->D (increased from 0.7)
				["E3", 0.6], // C->D (unchanged)
			]),
		);
		const modifiedResult = rankPaths(graph, "A", "D", { miCache: modifiedCache, lambda: 0 });

		expect(modifiedResult.ok).toBe(true);
		if (modifiedResult.ok && modifiedResult.value.some) {
			const paths = modifiedResult.value.value;
			expect(paths.length).toBe(2);
			// A->B->D should now be top-ranked
			const topPathSignature = paths[0].path.nodes.map((n) => n.id).join("->");
			expect(topPathSignature).toBe("A->B->D");

			// Verify the geometric means
			for (const path of paths) {
				const sig = path.path.nodes.map((n) => n.id).join("->");
				if (sig === "A->B->D") {
					expect(path.geometricMeanMI).toBeCloseTo(0.671, 0.01);
				} else if (sig === "A->C->D") {
					expect(path.geometricMeanMI).toBeCloseTo(0.6, 0.01);
				}
			}
		}
	});

	/**
	 * Due to geometric mean, a weak link should disproportionately affect path score.
	 * A single low-MI edge should significantly reduce the overall score.
	 */
	it("should be more sensitive to weak links than strong links", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Chain: A -> B -> C
		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addNode({ id: "C", type: "type_C" });
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		// Strong link + weak link: geometric_mean(0.9, 0.2) ≈ 0.424
		// The weak link dominates the score
		const weakLinkCache = createMockMICache(
			new Map([
				["E0", 0.9], // Strong
				["E1", 0.2], // Weak
			]),
		);
		const weakLinkResult = rankPaths(graph, "A", "C", { miCache: weakLinkCache, lambda: 0 });

		expect(weakLinkResult.ok).toBe(true);
		let weakLinkScore = 0;
		if (weakLinkResult.ok && weakLinkResult.value.some) {
			const [path] = weakLinkResult.value.value;
			weakLinkScore = path.score;
			// Geometric mean heavily penalises weak link
			expect(weakLinkScore).toBeCloseTo(0.424, 0.01);
		}

		// Now strengthen the weak link: geometric_mean(0.9, 0.5) ≈ 0.671
		// Increasing the weak link from 0.2 to 0.5 (2.5x) increases score by ~58%
		const strengthenedCache = createMockMICache(
			new Map([
				["E0", 0.9], // Strong (unchanged)
				["E1", 0.5], // Strengthened from 0.2
			]),
		);
		const strengthenedResult = rankPaths(graph, "A", "C", { miCache: strengthenedCache, lambda: 0 });

		expect(strengthenedResult.ok).toBe(true);
		let strengthenedScore = 0;
		if (strengthenedResult.ok && strengthenedResult.value.some) {
			const [path] = strengthenedResult.value.value;
			strengthenedScore = path.score;
			expect(strengthenedScore).toBeCloseTo(0.671, 0.01);
		}

		// Now weaken the strong link: geometric_mean(0.5, 0.5) = 0.5
		// Decreasing strong link from 0.9 to 0.5 has less impact than strengthening weak link
		const balancedCache = createMockMICache(
			new Map([
				["E0", 0.5], // Weakened from 0.9
				["E1", 0.5], // Same as strengthened
			]),
		);
		let balancedScore = 0;
		const balancedResult = rankPaths(graph, "A", "C", { miCache: balancedCache, lambda: 0 });

		expect(balancedResult.ok).toBe(true);
		if (balancedResult.ok && balancedResult.value.some) {
			const [path] = balancedResult.value.value;
			balancedScore = path.score;
			expect(balancedScore).toBeCloseTo(0.5, 0.01);
		}

		// Verify weak-link sensitivity: strengthening weak link (0.2->0.5) increased score more
		// than weakening strong link (0.9->0.5) decreased it
		const weakLinkImprovement = (strengthenedScore - weakLinkScore) / weakLinkScore;
		const strongLinkDecline = (strengthenedScore - balancedScore) / strengthenedScore;
		expect(weakLinkImprovement).toBeGreaterThan(strongLinkDecline);
	});

	/**
	 * MI values should be handled correctly across the full valid range [0, 1].
	 * Tests boundary cases including zero and maximum MI.
	 */
	it("should handle MI range from 0 to 1 correctly", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addNode({ id: "C", type: "type_C" });
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

		// Test with MI = 1.0 (maximum)
		const maxCache = createMockMICache(
			new Map([
				["E0", 1],
				["E1", 1],
			]),
		);
		const maxResult = rankPaths(graph, "A", "C", { miCache: maxCache, lambda: 0 });

		expect(maxResult.ok).toBe(true);
		if (maxResult.ok && maxResult.value.some) {
			const [path] = maxResult.value.value;
			// Maximum MI should give maximum score
			expect(path.score).toBeCloseTo(1, 0.01);
			expect(path.geometricMeanMI).toBeCloseTo(1, 0.01);
		}

		// Test with MI = 0.5 (mid-range)
		const midCache = createMockMICache(
			new Map([
				["E0", 0.5],
				["E1", 0.5],
			]),
		);
		const midResult = rankPaths(graph, "A", "C", { miCache: midCache, lambda: 0 });

		expect(midResult.ok).toBe(true);
		if (midResult.ok && midResult.value.some) {
			const [path] = midResult.value.value;
			expect(path.score).toBeCloseTo(0.5, 0.01);
		}

		// Test with mixed MI values: 0, 0.5, 1.0
		// Need a longer path to test all three values
		graph.addNode({ id: "D", type: "type_D" });
		graph.addEdge({ id: "E2", source: "C", target: "D", type: "edge" });

		const mixedCache = createMockMICache(
			new Map([
				["E0", 0], // Zero MI
				["E1", 0.5], // Mid MI
				["E2", 1], // Max MI
			]),
		);
		const mixedResult = rankPaths(graph, "A", "D", { miCache: mixedCache, lambda: 0 });

		expect(mixedResult.ok).toBe(true);
		if (mixedResult.ok && mixedResult.value.some) {
			const [path] = mixedResult.value.value;
			// Geometric mean with zero should be zero
			expect(path.score).toBeCloseTo(0, 0.01);
			expect(path.geometricMeanMI).toBeCloseTo(0, 0.01);
		}

		// Test with near-zero but non-zero MI
		const nearZeroCache = createMockMICache(
			new Map([
				["E0", 0.01],
				["E1", 0.01],
			]),
		);
		const nearZeroResult = rankPaths(graph, "A", "C", { miCache: nearZeroCache, lambda: 0 });

		expect(nearZeroResult.ok).toBe(true);
		if (nearZeroResult.ok && nearZeroResult.value.some) {
			const [path] = nearZeroResult.value.value;
			// Near-zero MI should give near-zero score
			expect(path.score).toBeLessThan(0.02);
		}
	});

	/**
	 * Small perturbations in MI values should not cause large ranking changes.
	 * Tests stability and noise tolerance of the ranking algorithm.
	 */
	it("should maintain ranking stability under small MI perturbations", () => {
		const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

		// Diamond graph with two distinct paths
		graph.addNode({ id: "A", type: "type_A" });
		graph.addNode({ id: "B", type: "type_B" });
		graph.addNode({ id: "C", type: "type_C" });
		graph.addNode({ id: "D", type: "type_D" });
		graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
		graph.addEdge({ id: "E1", source: "A", target: "C", type: "edge" });
		graph.addEdge({ id: "E2", source: "B", target: "D", type: "edge" });
		graph.addEdge({ id: "E3", source: "C", target: "D", type: "edge" });

		// Base configuration with clear ranking preference
		// Path A->B->D: sqrt(0.7 * 0.7) = 0.7
		// Path A->C->D: sqrt(0.4 * 0.4) = 0.4
		// A->B->D is clearly better
		const baseCache = createMockMICache(
			new Map([
				["E0", 0.7],
				["E1", 0.4],
				["E2", 0.7],
				["E3", 0.4],
			]),
		);
		const baseResult = rankPaths(graph, "A", "D", { miCache: baseCache, lambda: 0 });

		expect(baseResult.ok).toBe(true);
		let baseTopSignature = "";
		if (baseResult.ok && baseResult.value.some) {
			const paths = baseResult.value.value;
			baseTopSignature = paths[0].path.nodes.map((n) => n.id).join("->");
			expect(baseTopSignature).toBe("A->B->D");
		}

		// Add small noise (±0.05) to all MI values
		const noisyCache = createMockMICache(
			new Map([
				["E0", 0.72], // +0.02
				["E1", 0.42], // +0.02
				["E2", 0.68], // -0.02
				["E3", 0.38], // -0.02
			]),
		);
		const noisyResult = rankPaths(graph, "A", "D", { miCache: noisyCache, lambda: 0 });

		expect(noisyResult.ok).toBe(true);
		if (noisyResult.ok && noisyResult.value.some) {
			const paths = noisyResult.value.value;
			const noisyTopSignature = paths[0].path.nodes.map((n) => n.id).join("->");
			// Top path should remain the same despite noise
			expect(noisyTopSignature).toBe(baseTopSignature);
		}

		// Add maximum noise (±0.05) to test boundary of stability
		const maxNoiseCache = createMockMICache(
			new Map([
				["E0", 0.75], // +0.05
				["E1", 0.45], // +0.05
				["E2", 0.65], // -0.05
				["E3", 0.35], // -0.05
			]),
		);
		const maxNoiseResult = rankPaths(graph, "A", "D", { miCache: maxNoiseCache, lambda: 0 });

		expect(maxNoiseResult.ok).toBe(true);
		if (maxNoiseResult.ok && maxNoiseResult.value.some) {
			const paths = maxNoiseResult.value.value;
			const maxNoiseTopSignature = paths[0].path.nodes.map((n) => n.id).join("->");
			// Even with max noise, ranking should be stable
			expect(maxNoiseTopSignature).toBe(baseTopSignature);
		}

		// Verify scores don't change drastically
		if (baseResult.ok && baseResult.value.some && noisyResult.ok && noisyResult.value.some) {
			const baseScore = baseResult.value.value[0].score;
			const noisyScore = noisyResult.value.value[0].score;
			// Score change should be proportional to noise (within 10%)
			const relativeChange = Math.abs(noisyScore - baseScore) / baseScore;
			expect(relativeChange).toBeLessThan(0.1);
		}
	});
});

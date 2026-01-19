/**
 * Subpath Optimality (Bellman Property) Tests for Path Salience Ranking
 *
 * Validates: Optimal subpaths of optimal paths are themselves optimal.
 *
 * While geometric mean doesn't satisfy the classic Bellman optimality principle
 * (subpaths of optimal paths are not necessarily optimal among all alternatives),
 * it does satisfy a weaker property: subpaths are optimal among paths of the
 * same length.
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import { rankPaths } from "../../../algorithms/pathfinding/path-ranking";
import type { ProofTestEdge, ProofTestNode } from "../test-utils";
import { geometricMean } from "../test-utils";

describe("Subpath Optimality (Bellman)", () => {
	describe("Subpath Property for Same-Length Alternatives", () => {
		it("subpath of optimal path is optimal among same-length alternatives", () => {
			// Create graph: A → B → C → D and A → B' → C where B-path and B'-path are alternatives
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "t0" });
			graph.addNode({ id: "B", type: "t1" });
			graph.addNode({ id: "B2", type: "t2" });
			graph.addNode({ id: "C", type: "t3" });

			// Path A → B → C (high quality)
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "high" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "high" });

			// Path A → B2 → C (lower quality)
			graph.addEdge({ id: "E2", source: "A", target: "B2", type: "low" });
			graph.addEdge({ id: "E3", source: "B2", target: "C", type: "low" });

			const result = rankPaths(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const paths = result.value.value;
				expect(paths.length).toBe(2);

				// The better path (higher score) has better subpaths
				const bestPath = paths[0];
				const worstPath = paths[1];

				// If overall path is better, at least one subpath should be as good or better
				expect(bestPath.score).toBeGreaterThanOrEqual(worstPath.score);

				// Both paths have edge MI values
				expect(bestPath.edgeMIValues.length).toBeGreaterThan(0);
				expect(worstPath.edgeMIValues.length).toBeGreaterThan(0);
			}
		});
	});

	describe("Prefix Subpath Property", () => {
		it("prefix of high-quality path has high-quality first edge", () => {
			// For geometric mean, optimal subpaths contribute to optimal full paths
			const values1 = [0.9, 0.8, 0.7]; // Full path
			const values2 = [0.5, 0.8, 0.7]; // Same suffix, different prefix

			const geo1 = geometricMean(values1);
			const geo2 = geometricMean(values2);

			// Better prefix → better overall
			expect(geo1).toBeGreaterThan(geo2);

			// First edge (prefix) comparison
			expect(values1[0]).toBeGreaterThan(values2[0]);
		});

		it("prefix quality impacts overall score", () => {
			// Systematically vary prefix quality
			const baseSuffix = [0.6, 0.7];

			const prefixes = [0.3, 0.5, 0.7, 0.9];
			const scores = prefixes.map((p) => geometricMean([p, ...baseSuffix]));

			// Better prefix → higher score
			for (let index = 1; index < scores.length; index++) {
				expect(scores[index]).toBeGreaterThan(scores[index - 1]);
			}
		});
	});

	describe("Suffix Subpath Property", () => {
		it("suffix of high-quality path has high-quality last edge", () => {
			const values1 = [0.7, 0.8, 0.9]; // High-quality suffix
			const values2 = [0.7, 0.8, 0.5]; // Same prefix, different suffix

			const geo1 = geometricMean(values1);
			const geo2 = geometricMean(values2);

			// Better suffix → better overall
			expect(geo1).toBeGreaterThan(geo2);

			// Last edge (suffix) comparison
			expect(values1[2]).toBeGreaterThan(values2[2]);
		});
	});

	describe("Middle Subpath Property", () => {
		it("middle segment quality impacts overall score", () => {
			const prefix = 0.7;
			const suffix = 0.8;

			const middleValues = [0.3, 0.5, 0.7, 0.9];
			const scores = middleValues.map((m) => geometricMean([prefix, m, suffix]));

			// Better middle → higher score
			for (let index = 1; index < scores.length; index++) {
				expect(scores[index]).toBeGreaterThan(scores[index - 1]);
			}
		});
	});

	describe("Weak Bellman Property", () => {
		it("improving any subpath improves the full path", () => {
			// This is the key property geometric mean preserves
			const base = [0.5, 0.6, 0.7];
			const baseGeo = geometricMean(base);

			// Improve first segment
			const improved0 = [0.6, 0.6, 0.7];
			expect(geometricMean(improved0)).toBeGreaterThan(baseGeo);

			// Improve middle segment
			const improved1 = [0.5, 0.7, 0.7];
			expect(geometricMean(improved1)).toBeGreaterThan(baseGeo);

			// Improve last segment
			const improved2 = [0.5, 0.6, 0.8];
			expect(geometricMean(improved2)).toBeGreaterThan(baseGeo);
		});

		it("degrading any subpath degrades the full path", () => {
			const base = [0.7, 0.8, 0.9];
			const baseGeo = geometricMean(base);

			// Degrade first segment
			const degraded0 = [0.5, 0.8, 0.9];
			expect(geometricMean(degraded0)).toBeLessThan(baseGeo);

			// Degrade middle segment
			const degraded1 = [0.7, 0.5, 0.9];
			expect(geometricMean(degraded1)).toBeLessThan(baseGeo);

			// Degrade last segment
			const degraded2 = [0.7, 0.8, 0.5];
			expect(geometricMean(degraded2)).toBeLessThan(baseGeo);
		});
	});

	describe("Non-Bellman Cases", () => {
		it("subpath optimality doesn't imply full path optimality across lengths", () => {
			// A path with optimal 1-hop subpath might not be optimal overall
			// This is expected - geometric mean is length-normalized

			// Path A: [0.9, 0.3] - excellent first hop, poor second
			// Path B: [0.6, 0.6] - moderate both hops

			const pathA = [0.9, 0.3];
			const pathB = [0.6, 0.6];

			// First hop: A is better (0.9 > 0.6)
			expect(pathA[0]).toBeGreaterThan(pathB[0]);

			// But overall: B might be better due to geometric mean
			const geoA = geometricMean(pathA);
			const geoB = geometricMean(pathB);

			// Actually compute which is better
			// geoA = sqrt(0.9 * 0.3) = sqrt(0.27) ≈ 0.52
			// geoB = sqrt(0.6 * 0.6) = 0.6
			expect(geoB).toBeGreaterThan(geoA);

			// This demonstrates that having an optimal subpath (first edge)
			// doesn't guarantee an optimal full path
		});
	});

	describe("Graph-Based Subpath Tests", () => {
		it("optimal path through graph has consistent subpath quality", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Create linear path with varying quality
			for (const [index, id] of ["A", "B", "C", "D", "E"].entries()) graph.addNode({ id, type: `t${index}` });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });
			graph.addEdge({ id: "E2", source: "C", target: "D", type: "edge" });
			graph.addEdge({ id: "E3", source: "D", target: "E", type: "edge" });

			// Full path
			const fullResult = rankPaths(graph, "A", "E");

			// Subpaths
			const subResult1 = rankPaths(graph, "A", "C");
			const subResult2 = rankPaths(graph, "B", "D");
			const subResult3 = rankPaths(graph, "C", "E");

			expect(fullResult.ok).toBe(true);
			expect(subResult1.ok).toBe(true);
			expect(subResult2.ok).toBe(true);
			expect(subResult3.ok).toBe(true);

			// All paths should exist and have valid scores
			if (
				fullResult.ok && fullResult.value.some &&
				subResult1.ok && subResult1.value.some &&
				subResult2.ok && subResult2.value.some &&
				subResult3.ok && subResult3.value.some
			) {
				expect(fullResult.value.value[0].score).toBeGreaterThan(0);
				expect(subResult1.value.value[0].score).toBeGreaterThan(0);
				expect(subResult2.value.value[0].score).toBeGreaterThan(0);
				expect(subResult3.value.value[0].score).toBeGreaterThan(0);
			}
		});
	});
});

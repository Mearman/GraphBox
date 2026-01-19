/**
 * Length Independence Tests for Path Salience Ranking
 *
 * Validates: Geometric mean makes score length-independent.
 *
 * The 1/k exponent in the geometric mean formula normalises for path length,
 * allowing fair comparison of paths with different numbers of edges.
 * Quality (average MI per edge) is what matters, not raw path length.
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import { rankPaths } from "../../../algorithms/pathfinding/path-ranking";
import type { ProofTestEdge, ProofTestNode } from "../test-utils";
import { geometricMean } from "../test-utils";

describe("Length Independence", () => {
	describe("Same Average MI Scores Equally", () => {
		it("paths with same average MI score equally regardless of length", () => {
			// Uniform MI paths of different lengths
			const uniform2 = [0.6, 0.6];
			const uniform4 = [0.6, 0.6, 0.6, 0.6];
			const uniform8 = Array.from({ length: 8 }, () => 0.6);

			const geo2 = geometricMean(uniform2);
			const geo4 = geometricMean(uniform4);
			const geo8 = geometricMean(uniform8);

			// All should equal 0.6 (the uniform value)
			expect(Math.abs(geo2 - 0.6)).toBeLessThan(0.0001);
			expect(Math.abs(geo4 - 0.6)).toBeLessThan(0.0001);
			expect(Math.abs(geo8 - 0.6)).toBeLessThan(0.0001);
		});

		it("geometric mean represents average MI per edge", () => {
			// The geometric mean is the "average" in log space
			// It represents the typical MI value per edge

			const values = [0.5, 0.8]; // 2 edges
			const geo = geometricMean(values);

			// If we extend the path with this average value
			const extended = [0.5, 0.8, geo];
			const extendedGeo = geometricMean(extended);

			// The geometric mean should be approximately preserved
			// (not exactly due to discrete nature)
			expect(Math.abs(extendedGeo - geo)).toBeLessThan(0.05);
		});
	});

	describe("Quality Over Brevity (λ = 0)", () => {
		it("longer high-quality path beats shorter low-quality path", () => {
			// Long path: 5 edges, all high MI
			const longHigh = [0.9, 0.9, 0.9, 0.9, 0.9];

			// Short path: 2 edges, low MI
			const shortLow = [0.4, 0.4];

			const geoLong = geometricMean(longHigh);
			const geoShort = geometricMean(shortLow);

			// Quality matters, not length
			expect(geoLong).toBeGreaterThan(geoShort);
		});

		it("short high-quality path beats long low-quality path", () => {
			const shortHigh = [0.9, 0.9];
			const longLow = [0.3, 0.3, 0.3, 0.3, 0.3];

			const geoShort = geometricMean(shortHigh);
			const geoLong = geometricMean(longLow);

			expect(geoShort).toBeGreaterThan(geoLong);
		});
	});

	describe("Length Normalisation", () => {
		it("doubling path length with same values doesn't change score", () => {
			const original = [0.5, 0.7, 0.6];
			const doubled = [...original, ...original];

			const geoOriginal = geometricMean(original);
			const geoDoubled = geometricMean(doubled);

			expect(Math.abs(geoOriginal - geoDoubled)).toBeLessThan(0.0001);
		});

		it("tripling path length with same values doesn't change score", () => {
			const original = [0.6, 0.8];
			const tripled = [...original, ...original, ...original];

			const geoOriginal = geometricMean(original);
			const geoTripled = geometricMean(tripled);

			expect(Math.abs(geoOriginal - geoTripled)).toBeLessThan(0.0001);
		});
	});

	describe("Per-Edge Quality Interpretation", () => {
		it("score represents per-edge information quality", () => {
			// High per-edge quality
			const highQuality = [0.9, 0.8, 0.85, 0.9, 0.8];
			const geoHigh = geometricMean(highQuality);

			// Low per-edge quality
			const lowQuality = [0.3, 0.4, 0.35, 0.3, 0.4];
			const geoLow = geometricMean(lowQuality);

			// Geometric mean reflects per-edge quality, not total information
			expect(geoHigh).toBeGreaterThan(0.8);
			expect(geoLow).toBeLessThan(0.4);
		});

		it("adding low-quality edges reduces per-edge average", () => {
			const highOnly = [0.9, 0.9, 0.9];
			const withLow = [0.9, 0.9, 0.9, 0.3, 0.3];

			const geoHigh = geometricMean(highOnly);
			const geoMixed = geometricMean(withLow);

			// Adding low-quality edges reduces the per-edge average
			expect(geoMixed).toBeLessThan(geoHigh);
		});
	});

	describe("Length Penalty Interaction (λ > 0)", () => {
		it("length penalty introduces preference for shorter paths", () => {
			// When λ > 0, longer paths are penalised
			// M(P) = geometricMean × exp(-λk)

			const short = [0.7, 0.7]; // k=2
			const long = [0.7, 0.7, 0.7, 0.7, 0.7]; // k=5

			// Without penalty: same score
			expect(Math.abs(geometricMean(short) - geometricMean(long))).toBeLessThan(0.0001);

			// With penalty (λ=0.1):
			// short: 0.7 × exp(-0.1 × 2) = 0.7 × 0.819 ≈ 0.573
			// long:  0.7 × exp(-0.1 × 5) = 0.7 × 0.607 ≈ 0.425
			const lambda = 0.1;
			const shortWithPenalty = geometricMean(short) * Math.exp(-lambda * short.length);
			const longWithPenalty = geometricMean(long) * Math.exp(-lambda * long.length);

			expect(shortWithPenalty).toBeGreaterThan(longWithPenalty);
		});

		it("λ=0 gives pure length independence", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			for (const [index, id] of ["A", "B", "C"].entries()) graph.addNode({ id, type: `t${index}` });
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

			const result = rankPaths(graph, "A", "C", { lambda: 0 });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value[0];

				// With λ=0, no length penalty
				expect(path.lengthPenalty).toBeUndefined();

				// Score equals geometric mean
				expect(Math.abs(path.score - path.geometricMeanMI)).toBeLessThan(0.0001);
			}
		});
	});

	describe("Comparison Across Lengths", () => {
		it("fair comparison of 2-hop vs 5-hop paths", () => {
			// Same geometric mean, different lengths
			const path2 = [0.64, 0.64]; // geo = 0.64
			const path5 = [0.64, 0.64, 0.64, 0.64, 0.64]; // geo = 0.64

			const geo2 = geometricMean(path2);
			const geo5 = geometricMean(path5);

			// Equal scores when normalised for length
			expect(Math.abs(geo2 - geo5)).toBeLessThan(0.0001);
		});

		it("slightly better per-edge quality wins regardless of length", () => {
			const short = [0.65, 0.65]; // geo = 0.65
			const long = [0.64, 0.64, 0.64, 0.64, 0.64]; // geo = 0.64

			const geoShort = geometricMean(short);
			const geoLong = geometricMean(long);

			// Short path with slightly better per-edge quality wins
			expect(geoShort).toBeGreaterThan(geoLong);
		});
	});

	describe("Edge Cases", () => {
		it("single edge path: score equals that edge's MI", () => {
			const single = [0.75];
			expect(geometricMean(single)).toBe(0.75);
		});

		it("very long path maintains normalisation", () => {
			const veryLong = Array.from({ length: 100 }, () => 0.5);
			const geo = geometricMean(veryLong);

			expect(Math.abs(geo - 0.5)).toBeLessThan(0.0001);
		});

		it("mixed quality long path averages correctly", () => {
			// Alternating high and low
			const alternating = Array.from({ length: 20 }, (_, index) => (index % 2 === 0 ? 0.8 : 0.4));
			const geo = geometricMean(alternating);

			// Should be geometric mean of 0.8 and 0.4 ≈ 0.566
			const expectedGeo = Math.sqrt(0.8 * 0.4);
			expect(Math.abs(geo - expectedGeo)).toBeLessThan(0.01);
		});
	});
});

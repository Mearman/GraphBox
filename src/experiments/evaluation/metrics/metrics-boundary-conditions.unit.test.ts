/**
 * Boundary condition and edge case tests for metrics
 * Tests empty inputs, minimal inputs, and edge cases that survive mutation testing
 */
import { describe, expect, it } from "vitest";

import {
	computeDegreeDistribution,
	computeDegreeHistogram,
	earthMoversDistance,
	jsDivergence,
	klDivergence,
} from "./degree-distribution";
import {
	computePathDiversityMetrics,
	meanPairwiseEdgeJaccardDistance,
	meanPairwiseJaccardDistance,
} from "./path-diversity";
import {
	computeCommunityCoverage,
	computeSetOverlap,
	spearmanRankCorrelation,
} from "./structural-representativeness";

describe("Boundary Conditions - Path Diversity", () => {
	describe("Empty inputs", () => {
		it("meanPairwiseJaccardDistance returns 0 for empty paths", () => {
			expect(meanPairwiseJaccardDistance([])).toBe(0);
		});

		it("meanPairwiseJaccardDistance returns 0 for single path", () => {
			expect(meanPairwiseJaccardDistance([["1", "2"]])).toBe(0);
		});

		it("meanPairwiseEdgeJaccardDistance returns 0 for empty paths", () => {
			expect(meanPairwiseEdgeJaccardDistance([])).toBe(0);
		});

		it("meanPairwiseEdgeJaccardDistance returns 0 for single path", () => {
			expect(meanPairwiseEdgeJaccardDistance([["1", "2"]])).toBe(0);
		});

		it("computePathDiversityMetrics handles empty paths", () => {
			const result = computePathDiversityMetrics([]);
			expect(result.pathCount).toBe(0);
			expect(result.uniqueNodeCount).toBe(0);
			expect(result.uniqueEdgeCount).toBe(0);
			expect(result.meanPathLength).toBe(0);
			expect(result.stdPathLength).toBe(0);
			expect(result.nodeJaccardDistance).toBe(0);
			expect(result.edgeJaccardDistance).toBe(0);
		});
	});

	describe("Minimal inputs", () => {
		it("meanPairwiseJaccardDistance works with exactly 2 paths", () => {
			const result = meanPairwiseJaccardDistance([
				["1", "2"],
				["3", "4"],
			]);
			expect(result).toBe(1); // Completely disjoint
		});

		it("meanPairwiseJaccardDistance works with identical paths", () => {
			const result = meanPairwiseJaccardDistance([
				["1", "2"],
				["1", "2"],
			]);
			expect(result).toBe(0); // Identical
		});

		it("meanPairwiseJaccardDistance computes exact value for 3 paths", () => {
			// 3 paths: ABC, BCD, CDE
			// Pair 1-2: {A,B,C} ∩ {B,C,D} = {B,C}, union = {A,B,C,D}, J=2/4=0.5, dist=0.5
			// Pair 1-3: {A,B,C} ∩ {C,D,E} = {C}, union = {A,B,C,D,E}, J=1/5=0.2, dist=0.8
			// Pair 2-3: {B,C,D} ∩ {C,D,E} = {C,D}, union = {B,C,D,E}, J=2/4=0.5, dist=0.5
			// Mean = (0.5 + 0.8 + 0.5) / 3 = 1.8 / 3 = 0.6
			const result = meanPairwiseJaccardDistance([
				["A", "B", "C"],
				["B", "C", "D"],
				["C", "D", "E"],
			]);
			expect(result).toBeCloseTo(0.6, 5);
			// Validates loop bounds are correct (no out-of-bounds access)
			expect(isNaN(result)).toBe(false);
		});

		it("meanPairwiseEdgeJaccardDistance works with exactly 2 paths", () => {
			const result = meanPairwiseEdgeJaccardDistance([
				["1", "2"],
				["3", "4"],
			]);
			expect(result).toBe(1); // Completely disjoint edges
		});

		it("meanPairwiseEdgeJaccardDistance computes exact value for 3 paths", () => {
			// 3 paths with 2 edges each: A-B-C, B-C-D, C-D-E
			// Path1 edges: A--B, B--C
			// Path2 edges: B--C, C--D
			// Path3 edges: C--D, D--E
			// Pair 1-2: intersect={B--C}, union={A--B, B--C, C--D}, J=1/3, dist=2/3
			// Pair 1-3: intersect={}, union={A--B, B--C, C--D, D--E}, J=0/4, dist=1
			// Pair 2-3: intersect={C--D}, union={B--C, C--D, D--E}, J=1/3, dist=2/3
			// Mean = (2/3 + 1 + 2/3) / 3 = 7/9 ≈ 0.778
			const result = meanPairwiseEdgeJaccardDistance([
				["A", "B", "C"],
				["B", "C", "D"],
				["C", "D", "E"],
			]);
			expect(result).toBeCloseTo(0.778, 2);
			expect(isNaN(result)).toBe(false);
		});

		it("handles single-element paths without crash", () => {
			expect(() => meanPairwiseJaccardDistance([["1"]])).not.toThrow();
			const result = meanPairwiseJaccardDistance([["1"]]);
			expect(result).toBe(0);
		});

		it("handles two single-element paths", () => {
			const result = meanPairwiseJaccardDistance([["1"], ["2"]]);
			expect(result).toBeGreaterThanOrEqual(0);
			expect(result).toBeLessThanOrEqual(1);
		});

		it("handles two-element arrays correctly for edge distance", () => {
			const result = meanPairwiseEdgeJaccardDistance([
				["1", "2"],
				["2", "3"],
			]);
			expect(result).toBeGreaterThanOrEqual(0);
			expect(result).toBeLessThanOrEqual(1);
		});
	});
});

describe("Boundary Conditions - Degree Distribution", () => {
	describe("Empty inputs", () => {
		it("computeDegreeDistribution returns empty map for empty input", () => {
			const result = computeDegreeDistribution([]);
			expect(result.size).toBe(0);
		});

		it("klDivergence returns 0 for empty distributions", () => {
			expect(klDivergence(new Map(), new Map())).toBe(0);
		});

		it("jsDivergence returns 0 for empty distributions", () => {
			expect(jsDivergence(new Map(), new Map())).toBe(0);
		});

		it("earthMoversDistance returns 0 for empty distributions", () => {
			expect(earthMoversDistance(new Map(), new Map())).toBe(0);
		});
	});

	describe("Single value inputs", () => {
		it("computeDegreeDistribution handles single degree value", () => {
			const result = computeDegreeDistribution([5]);
			expect(result.get(5)).toBeCloseTo(1);
			expect(result.size).toBe(1);
		});

		it("earthMoversDistance handles single-degree distributions", () => {
			const distribution = new Map([[1, 1]]);
			expect(earthMoversDistance(distribution, distribution)).toBe(0);
		});

		it("earthMoversDistance handles two different single-degree distributions", () => {
			const distribution1 = new Map([[1, 1]]);
			const distribution2 = new Map([[2, 1]]);
			const result = earthMoversDistance(distribution1, distribution2);
			expect(result).toBeGreaterThan(0);
			expect(isFinite(result)).toBe(true);
		});

		it("earthMoversDistance computes exact value for simple case", () => {
			// dist1: all mass at degree 1, dist2: all mass at degree 3
			// EMD should be exactly 2.0 (move 1 unit of mass 2 degrees)
			const distribution1 = new Map([[1, 1]]);
			const distribution2 = new Map([[3, 1]]);
			const result = earthMoversDistance(distribution1, distribution2);
			expect(result).toBeCloseTo(2, 5);
			// Validates loop doesn't access out-of-bounds
			expect(isFinite(result)).toBe(true);
			expect(isNaN(result)).toBe(false);
		});

		it("klDivergence handles identical single-degree distributions", () => {
			const distribution = new Map([[5, 1]]);
			expect(klDivergence(distribution, distribution)).toBe(0);
		});

		it("jsDivergence handles identical single-degree distributions", () => {
			const distribution = new Map([[5, 1]]);
			expect(jsDivergence(distribution, distribution)).toBe(0);
		});
	});

	describe("Histogram boundary cases", () => {
		it("computeDegreeHistogram handles small degree values", () => {
			const hist = computeDegreeHistogram([1, 2, 3]);
			expect(hist.get("1-5")).toBe(3); // All values in first bucket
		});

		it("computeDegreeHistogram handles empty degrees", () => {
			const hist = computeDegreeHistogram([]);
			// All buckets should be 0
			for (const count of hist.values()) {
				expect(count).toBe(0);
			}
		});

		it("computeDegreeHistogram handles single degree value", () => {
			const hist = computeDegreeHistogram([1]);
			expect(hist.get("1-5")).toBe(1);
		});
	});
});

describe("Boundary Conditions - Structural Representativeness", () => {
	describe("Empty set operations", () => {
		it("computeSetOverlap handles empty ground truth", () => {
			const result = computeSetOverlap(new Set(["1"]), new Set());
			expect(result.coverage).toBe(0);
			expect(result.precision).toBe(0);
			expect(result.f1Score).toBe(0);
		});

		it("computeSetOverlap handles empty sampled set", () => {
			const result = computeSetOverlap(new Set(), new Set(["1"]));
			expect(result.coverage).toBe(0);
			expect(result.precision).toBe(0);
			expect(result.f1Score).toBe(0);
		});

		it("computeSetOverlap handles both sets empty", () => {
			const result = computeSetOverlap(new Set(), new Set());
			expect(result.coverage).toBe(0);
			expect(result.precision).toBe(0);
			expect(result.f1Score).toBe(0);
		});
	});

	describe("Spearman correlation boundary cases", () => {
		it("spearmanRankCorrelation returns 0 for < 2 common nodes", () => {
			const r1 = new Map([["1", 1]]);
			const r2 = new Map([["1", 1]]);
			expect(spearmanRankCorrelation(r1, r2, new Set(["1"]))).toBe(0);
		});

		it("spearmanRankCorrelation handles exactly 2 common nodes - perfect correlation", () => {
			const r1 = new Map([
				["1", 1],
				["2", 2],
			]);
			const r2 = new Map([
				["1", 1],
				["2", 2],
			]);
			const result = spearmanRankCorrelation(r1, r2, new Set(["1", "2"]));
			expect(result).toBeCloseTo(1, 5); // Perfect positive correlation
		});

		it("spearmanRankCorrelation handles exactly 2 common nodes - inverse correlation", () => {
			const r1 = new Map([
				["1", 1],
				["2", 2],
			]);
			const r2 = new Map([
				["1", 2],
				["2", 1],
			]);
			const result = spearmanRankCorrelation(r1, r2, new Set(["1", "2"]));
			expect(result).toBeCloseTo(-1, 5); // Perfect inverse
		});

		it("spearmanRankCorrelation handles no common nodes", () => {
			const r1 = new Map([["1", 1]]);
			const r2 = new Map([["2", 2]]);
			const result = spearmanRankCorrelation(r1, r2, new Set());
			expect(result).toBe(0);
		});

		it("spearmanRankCorrelation uses correct formula (constant 6)", () => {
			// Perfect inverse ranking: [1,2,3] vs [3,2,1]
			// Formula: rho = 1 - (6 * sumD2) / (n * (n^2 - 1))
			// sumD2 = (1-3)^2 + (2-2)^2 + (3-1)^2 = 4 + 0 + 4 = 8
			// rho = 1 - (6 * 8) / (3 * (9 - 1)) = 1 - 48/24 = 1 - 2 = -1
			const r1 = new Map([
				["a", 1],
				["b", 2],
				["c", 3],
			]);
			const r2 = new Map([
				["a", 3],
				["b", 2],
				["c", 1],
			]);
			const rho = spearmanRankCorrelation(r1, r2, new Set(["a", "b", "c"]));
			expect(rho).toBeCloseTo(-1, 5);
		});

		it("spearmanRankCorrelation computes perfect positive correlation", () => {
			// Formula: sumD2 = 0 when ranks are identical
			// rho = 1 - (6 * 0) / (n * (n^2 - 1)) = 1
			const r1 = new Map([
				["a", 1],
				["b", 2],
				["c", 3],
			]);
			const r2 = new Map([
				["a", 1],
				["b", 2],
				["c", 3],
			]);
			const rho = spearmanRankCorrelation(r1, r2, new Set(["a", "b", "c"]));
			expect(rho).toBeCloseTo(1, 5);
		});
	});

	describe("Community coverage boundary cases", () => {
		it("computeCommunityCoverage returns 0 for empty communities", () => {
			expect(computeCommunityCoverage(new Set(["1"]), [])).toBe(0);
		});

		it("computeCommunityCoverage returns 0 for empty sampled nodes", () => {
			const communities = [new Set(["1", "2"])];
			expect(computeCommunityCoverage(new Set(), communities)).toBe(0);
		});

		it("computeCommunityCoverage handles single community", () => {
			expect(computeCommunityCoverage(new Set(["1"]), [new Set(["1"])])).toBe(1);
		});

		it("computeCommunityCoverage handles single node in single community", () => {
			const result = computeCommunityCoverage(new Set(["1"]), [new Set(["1", "2", "3"])]);
			expect(result).toBe(1);
		});

		it("computeCommunityCoverage handles node not in any community", () => {
			const communities = [new Set(["2", "3"])];
			const result = computeCommunityCoverage(new Set(["1"]), communities);
			expect(result).toBe(0);
		});
	});
});

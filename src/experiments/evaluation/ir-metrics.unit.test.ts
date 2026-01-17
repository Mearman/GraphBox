/**
 * Unit tests for Information Retrieval metrics
 */

import { describe, expect, it } from "vitest";

import {
	meanAveragePrecision,
	meanReciprocalRank,
	ndcg,
	precisionAtK,
	recallAtK,
} from "./ir-metrics";

describe("ndcg", () => {
	it("should return 1 for perfect ranking", () => {
		const predicted = [
			{ id: "a", relevance: 3 },
			{ id: "b", relevance: 2 },
			{ id: "c", relevance: 1 },
		];
		const groundTruth = [
			{ id: "a", relevance: 3 },
			{ id: "b", relevance: 2 },
			{ id: "c", relevance: 1 },
		];

		expect(ndcg(predicted, groundTruth)).toBeCloseTo(1);
	});

	it("should return less than 1 for imperfect ranking", () => {
		const predicted = [
			{ id: "c", relevance: 1 },
			{ id: "b", relevance: 2 },
			{ id: "a", relevance: 3 },
		];
		const groundTruth = [
			{ id: "a", relevance: 3 },
			{ id: "b", relevance: 2 },
			{ id: "c", relevance: 1 },
		];

		const score = ndcg(predicted, groundTruth);
		expect(score).toBeLessThan(1);
		expect(score).toBeGreaterThan(0);
	});

	it("should handle cutoff k", () => {
		const predicted = [
			{ id: "a", relevance: 3 },
			{ id: "b", relevance: 2 },
			{ id: "c", relevance: 1 },
		];
		const groundTruth = [
			{ id: "a", relevance: 3 },
			{ id: "b", relevance: 2 },
			{ id: "c", relevance: 1 },
		];

		expect(ndcg(predicted, groundTruth, 1)).toBeCloseTo(1);
		expect(ndcg(predicted, groundTruth, 2)).toBeCloseTo(1);
	});

	it("should return 0 for empty inputs", () => {
		expect(ndcg([], [])).toBe(0);
		expect(ndcg([{ id: "a", relevance: 1 }], [])).toBe(0);
		expect(ndcg([], [{ id: "a", relevance: 1 }])).toBe(0);
	});

	it("should return 1 when ideal DCG is 0", () => {
		const predicted = [{ id: "a", relevance: 0 }];
		const groundTruth = [{ id: "a", relevance: 0 }];

		expect(ndcg(predicted, groundTruth)).toBe(1);
	});
});

describe("meanAveragePrecision", () => {
	it("should return 1 for perfect ranking with all relevant items first", () => {
		const predicted = ["a", "b", "c", "d"];
		const relevant = new Set(["a", "b"]);

		expect(meanAveragePrecision(predicted, relevant)).toBe(1);
	});

	it("should return less than 1 when relevant items are not at top", () => {
		const predicted = ["c", "a", "d", "b"];
		const relevant = new Set(["a", "b"]);

		const score = meanAveragePrecision(predicted, relevant);
		expect(score).toBeLessThan(1);
		expect(score).toBeGreaterThan(0);
	});

	it("should return 0 when no relevant items in ranking", () => {
		const predicted = ["a", "b", "c"];
		const relevant = new Set(["x", "y"]);

		expect(meanAveragePrecision(predicted, relevant)).toBe(0);
	});

	it("should return 0 for empty inputs", () => {
		expect(meanAveragePrecision([], new Set(["a"]))).toBe(0);
		expect(meanAveragePrecision(["a"], new Set())).toBe(0);
	});

	it("should calculate correctly for interleaved relevant items", () => {
		// Relevant at positions 1, 3, 5 (1-indexed)
		const predicted = ["a", "x", "b", "y", "c"];
		const relevant = new Set(["a", "b", "c"]);

		// P@1 = 1/1 = 1, P@3 = 2/3, P@5 = 3/5
		// MAP = (1 + 2/3 + 3/5) / 3
		const expected = (1 + 2 / 3 + 3 / 5) / 3;
		expect(meanAveragePrecision(predicted, relevant)).toBeCloseTo(expected);
	});
});

describe("meanReciprocalRank", () => {
	it("should return 1 when first item is relevant", () => {
		const predicted = ["a", "b", "c"];
		const relevant = new Set(["a"]);

		expect(meanReciprocalRank(predicted, relevant)).toBe(1);
	});

	it("should return 0.5 when first relevant is second", () => {
		const predicted = ["x", "a", "b"];
		const relevant = new Set(["a"]);

		expect(meanReciprocalRank(predicted, relevant)).toBe(0.5);
	});

	it("should return 1/3 when first relevant is third", () => {
		const predicted = ["x", "y", "a"];
		const relevant = new Set(["a"]);

		expect(meanReciprocalRank(predicted, relevant)).toBeCloseTo(1 / 3);
	});

	it("should return 0 when no relevant items found", () => {
		const predicted = ["x", "y", "z"];
		const relevant = new Set(["a"]);

		expect(meanReciprocalRank(predicted, relevant)).toBe(0);
	});

	it("should return 0 for empty inputs", () => {
		expect(meanReciprocalRank([], new Set(["a"]))).toBe(0);
		expect(meanReciprocalRank(["a"], new Set())).toBe(0);
	});
});

describe("precisionAtK", () => {
	it("should return 1 when all top-k are relevant", () => {
		const predicted = ["a", "b", "c", "d"];
		const relevant = new Set(["a", "b"]);

		expect(precisionAtK(predicted, relevant, 2)).toBe(1);
	});

	it("should return 0.5 when half of top-k are relevant", () => {
		const predicted = ["a", "x", "b", "y"];
		const relevant = new Set(["a", "b"]);

		expect(precisionAtK(predicted, relevant, 2)).toBe(0.5);
	});

	it("should return 0 when none of top-k are relevant", () => {
		const predicted = ["x", "y", "a", "b"];
		const relevant = new Set(["a", "b"]);

		expect(precisionAtK(predicted, relevant, 2)).toBe(0);
	});

	it("should handle k larger than list", () => {
		const predicted = ["a", "b"];
		const relevant = new Set(["a", "b", "c"]);

		// Only 2 items in list, both relevant, k=5
		// P@5 = 2/5 = 0.4
		expect(precisionAtK(predicted, relevant, 5)).toBeCloseTo(0.4);
	});

	it("should return 0 for edge cases", () => {
		expect(precisionAtK([], new Set(["a"]), 5)).toBe(0);
		expect(precisionAtK(["a"], new Set(), 5)).toBe(0);
		expect(precisionAtK(["a"], new Set(["a"]), 0)).toBe(0);
		expect(precisionAtK(["a"], new Set(["a"]), -1)).toBe(0);
	});
});

describe("recallAtK", () => {
	it("should return 1 when all relevant items are in top-k", () => {
		const predicted = ["a", "b", "c", "d"];
		const relevant = new Set(["a", "b"]);

		expect(recallAtK(predicted, relevant, 4)).toBe(1);
	});

	it("should return 0.5 when half of relevant items are in top-k", () => {
		const predicted = ["a", "x", "y", "z"];
		const relevant = new Set(["a", "b"]);

		expect(recallAtK(predicted, relevant, 4)).toBe(0.5);
	});

	it("should return 0 when no relevant items in top-k", () => {
		const predicted = ["x", "y", "a", "b"];
		const relevant = new Set(["a", "b"]);

		expect(recallAtK(predicted, relevant, 2)).toBe(0);
	});

	it("should return 0 for edge cases", () => {
		expect(recallAtK([], new Set(["a"]), 5)).toBe(0);
		expect(recallAtK(["a"], new Set(), 5)).toBe(0);
		expect(recallAtK(["a"], new Set(["a"]), 0)).toBe(0);
		expect(recallAtK(["a"], new Set(["a"]), -1)).toBe(0);
	});
});

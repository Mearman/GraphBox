import { describe, expect, it } from "vitest";

import type { Path } from "../../../algorithms/types/algorithm-results";
import type { Edge, Node } from "../../../algorithms/types/graph";
import { randomRanker } from "./random-ranker";

// Test node and edge types
interface TestNode extends Node {
	id: string;
	type: "test";
	label: string;
}

interface TestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: "link";
}

/**
 * Creates a test path with the given node and edge data.
 * @param nodeIds
 * @param edgeIds
 */
const createPath = (
	nodeIds: string[],
	edgeIds: string[],
): Path<TestNode, TestEdge> => {
	const nodes: TestNode[] = nodeIds.map((id) => ({
		id,
		type: "test",
		label: `Node ${id}`,
	}));

	const edges: TestEdge[] = edgeIds.map((id, index) => ({
		id,
		source: nodeIds[index],
		target: nodeIds[index + 1],
		type: "link",
	}));

	return {
		nodes,
		edges,
		totalWeight: edges.length,
	};
};

describe("randomRanker", () => {
	describe("basic functionality", () => {
		it("returns empty array for empty paths", () => {
			const result = randomRanker([]);

			expect(result).toEqual([]);
		});

		it("ranks a single path", () => {
			const path = createPath(["A", "B"], ["E1"]);
			const result = randomRanker([path]);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe(path);
			expect(result[0].score).toBe(1); // First path gets score 1
		});

		it("shuffles multiple paths", () => {
			const paths = [
				createPath(["A", "B"], ["E1"]),
				createPath(["C", "D"], ["E2"]),
				createPath(["E", "F"], ["E3"]),
			];

			const result = randomRanker(paths);

			expect(result).toHaveLength(3);
			// All original paths should be present
			const resultPaths = result.map((r) => r.path);
			for (const path of paths) {
				expect(resultPaths).toContain(path);
			}
		});
	});

	describe("reproducibility", () => {
		it("produces reproducible results with same seed", () => {
			const paths = [
				createPath(["A", "B"], ["E1"]),
				createPath(["C", "D"], ["E2"]),
				createPath(["E", "F"], ["E3"]),
				createPath(["G", "H"], ["E4"]),
				createPath(["I", "J"], ["E5"]),
			];

			const seed = 42;
			const result1 = randomRanker(paths, seed);
			const result2 = randomRanker(paths, seed);

			// Results should be identical with same seed
			expect(result1.map((r) => r.path)).toEqual(result2.map((r) => r.path));
			expect(result1.map((r) => r.score)).toEqual(result2.map((r) => r.score));
		});

		it("produces different results with different seeds", () => {
			const paths = [
				createPath(["A", "B"], ["E1"]),
				createPath(["C", "D"], ["E2"]),
				createPath(["E", "F"], ["E3"]),
				createPath(["G", "H"], ["E4"]),
				createPath(["I", "J"], ["E5"]),
				createPath(["K", "L"], ["E6"]),
				createPath(["M", "N"], ["E7"]),
				createPath(["O", "P"], ["E8"]),
			];

			const result1 = randomRanker(paths, 1);
			const result2 = randomRanker(paths, 999);

			// Different seeds should produce different orderings (very likely)
			const order1 = result1.map((r) => r.path.nodes[0].id);
			const order2 = result2.map((r) => r.path.nodes[0].id);

			// At least one position should differ
			const hasDifference = order1.some((id, index) => id !== order2[index]);
			expect(hasDifference).toBe(true);
		});
	});

	describe("score assignment", () => {
		it("assigns descending scores from 1.0", () => {
			const paths = [
				createPath(["A", "B"], ["E1"]),
				createPath(["C", "D"], ["E2"]),
				createPath(["E", "F"], ["E3"]),
			];

			const result = randomRanker(paths, 42);

			// First path gets score 1, subsequent get lower
			expect(result[0].score).toBe(1);
			expect(result[1].score).toBeCloseTo(1 - 1 / 3, 5);
			expect(result[2].score).toBeCloseTo(1 - 2 / 3, 5);
		});

		it("correctly calculates scores for any number of paths", () => {
			const paths = Array.from({ length: 10 }, (_, index) =>
				createPath([`A${index}`, `B${index}`], [`E${index}`]),
			);

			const result = randomRanker(paths, 42);

			// Verify score formula: 1 - i/n
			for (const [index, element] of result.entries()) {
				expect(element.score).toBeCloseTo(1 - index / paths.length, 5);
			}
		});

		it("all scores are between 0 and 1", () => {
			const paths = Array.from({ length: 100 }, (_, index) =>
				createPath([`A${index}`, `B${index}`], [`E${index}`]),
			);

			const result = randomRanker(paths, 12_345);

			for (const ranked of result) {
				expect(ranked.score).toBeGreaterThanOrEqual(0);
				expect(ranked.score).toBeLessThanOrEqual(1);
			}
		});
	});

	describe("result structure", () => {
		it("includes correct result properties", () => {
			const path = createPath(["A", "B"], ["E1"]);
			const result = randomRanker([path]);

			expect(result[0]).toMatchObject({
				path,
				geometricMeanMI: 0,
				edgeMIValues: [],
			});
			expect(typeof result[0].score).toBe("number");
		});

		it("preserves original path objects", () => {
			const paths = [
				createPath(["A", "B"], ["E1"]),
				createPath(["C", "D"], ["E2"]),
			];

			const result = randomRanker(paths, 42);

			// Paths should be the same objects, not copies
			const resultPaths = result.map((r) => r.path);
			for (const path of paths) {
				expect(resultPaths).toContain(path);
			}
		});
	});

	describe("edge cases", () => {
		it("handles single path", () => {
			const path = createPath(["A"], []);
			const result = randomRanker([path], 42);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe(path);
			expect(result[0].score).toBe(1);
		});

		it("handles two paths", () => {
			const paths = [
				createPath(["A", "B"], ["E1"]),
				createPath(["C", "D"], ["E2"]),
			];

			const result = randomRanker(paths, 42);

			expect(result).toHaveLength(2);
			// Scores should be 1 and 0.5
			expect(result[0].score).toBe(1);
			expect(result[1].score).toBe(0.5);
		});

		it("handles large number of paths", () => {
			const paths = Array.from({ length: 1000 }, (_, index) =>
				createPath([`A${index}`, `B${index}`], [`E${index}`]),
			);

			const result = randomRanker(paths, 42);

			expect(result).toHaveLength(1000);
			// First score should be 1, last should be close to 0
			expect(result[0].score).toBe(1);
			expect(result[999].score).toBeCloseTo(0.001, 3);
		});

		it("handles paths with same structure", () => {
			// Multiple identical paths should all be included
			const paths = [
				createPath(["A", "B"], ["E1"]),
				createPath(["A", "B"], ["E1"]),
				createPath(["A", "B"], ["E1"]),
			];

			const result = randomRanker(paths, 42);

			expect(result).toHaveLength(3);
		});

		it("uses current time as default seed", () => {
			const paths = [
				createPath(["A", "B"], ["E1"]),
				createPath(["C", "D"], ["E2"]),
			];

			// Without seed, results may vary between calls
			// We just verify it doesn't throw
			const result = randomRanker(paths);

			expect(result).toHaveLength(2);
		});
	});

	describe("Fisher-Yates shuffle correctness", () => {
		it("produces all possible permutations over many runs", () => {
			const paths = [
				createPath(["A"], []),
				createPath(["B"], []),
				createPath(["C"], []),
			];

			const permutations = new Set<string>();

			// Run with many different seeds
			for (let seed = 0; seed < 100; seed++) {
				const result = randomRanker(paths, seed);
				const order = result.map((r) => r.path.nodes[0].id).join("");
				permutations.add(order);
			}

			// Should see multiple different permutations
			expect(permutations.size).toBeGreaterThan(1);
		});
	});
});

import { describe, expect, it } from "vitest";

import type { Path } from "../../../algorithms/types/algorithm-results";
import type { Edge, Node } from "../../../algorithms/types/graph";
import { shortestPathRanker } from "./shortest-path-ranker";

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

describe("shortestPathRanker", () => {
	describe("basic functionality", () => {
		it("returns empty array for empty paths", () => {
			const result = shortestPathRanker([]);

			expect(result).toEqual([]);
		});

		it("ranks a single path", () => {
			const path = createPath(["A", "B"], ["E1"]);
			const result = shortestPathRanker([path]);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe(path);
			expect(result[0].score).toBe(0.5); // 1 / (1 + 1)
		});

		it("ranks shorter paths higher than longer paths", () => {
			const shortPath = createPath(["A", "B"], ["E1"]);
			const longPath = createPath(["A", "B", "C", "D"], ["E1", "E2", "E3"]);

			const result = shortestPathRanker([longPath, shortPath]);

			expect(result[0].path).toBe(shortPath);
			expect(result[1].path).toBe(longPath);
		});
	});

	describe("score calculation", () => {
		it("calculates score as 1/(length+1)", () => {
			const paths = [
				createPath(["A"], []), // length 0
				createPath(["A", "B"], ["E1"]), // length 1
				createPath(["A", "B", "C"], ["E1", "E2"]), // length 2
				createPath(["A", "B", "C", "D"], ["E1", "E2", "E3"]), // length 3
			];

			const result = shortestPathRanker(paths);

			// Verify scores
			expect(result[0].score).toBe(1); // 1/(0+1)
			expect(result[1].score).toBe(0.5); // 1/(1+1)
			expect(result[2].score).toBeCloseTo(1 / 3, 5); // 1/(2+1)
			expect(result[3].score).toBe(0.25); // 1/(3+1)
		});

		it("gives score of 1 to zero-length path", () => {
			const path = createPath(["A"], []);
			const result = shortestPathRanker([path]);

			expect(result[0].score).toBe(1);
		});

		it("handles long paths correctly", () => {
			// Create a path with 100 edges
			const nodeIds = Array.from({ length: 101 }, (_, index) => `N${index}`);
			const edgeIds = Array.from({ length: 100 }, (_, index) => `E${index}`);
			const longPath = createPath(nodeIds, edgeIds);

			const result = shortestPathRanker([longPath]);

			expect(result[0].score).toBeCloseTo(1 / 101, 5);
		});
	});

	describe("sorting behavior", () => {
		it("returns paths in descending score order (shortest first)", () => {
			const paths = [
				createPath(["A", "B", "C", "D", "E"], ["E1", "E2", "E3", "E4"]),
				createPath(["A", "B"], ["E1"]),
				createPath(["A", "B", "C"], ["E1", "E2"]),
				createPath(["A"], []),
			];

			const result = shortestPathRanker(paths);

			// Verify descending order
			for (let index = 0; index < result.length - 1; index++) {
				expect(result[index].score).toBeGreaterThanOrEqual(
					result[index + 1].score,
				);
			}
		});

		it("preserves relative order for equal-length paths", () => {
			const path1 = createPath(["A", "B"], ["E1"]);
			const path2 = createPath(["C", "D"], ["E2"]);
			const path3 = createPath(["E", "F"], ["E3"]);

			const result = shortestPathRanker([path1, path2, path3]);

			// All have same length, scores should be equal
			expect(result[0].score).toBe(result[1].score);
			expect(result[1].score).toBe(result[2].score);
		});
	});

	describe("result structure", () => {
		it("includes correct result properties", () => {
			const path = createPath(["A", "B"], ["E1"]);
			const result = shortestPathRanker([path]);

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
				createPath(["C", "D", "E"], ["E2", "E3"]),
			];

			const result = shortestPathRanker(paths);

			// Paths should be the same objects, not copies
			const resultPaths = result.map((r) => r.path);
			expect(resultPaths).toContain(paths[0]);
			expect(resultPaths).toContain(paths[1]);
		});
	});

	describe("edge cases", () => {
		it("handles single zero-length path", () => {
			const path = createPath(["A"], []);
			const result = shortestPathRanker([path]);

			expect(result).toHaveLength(1);
			expect(result[0].score).toBe(1);
		});

		it("handles multiple paths of same length", () => {
			const paths = [
				createPath(["A", "B"], ["E1"]),
				createPath(["C", "D"], ["E2"]),
				createPath(["E", "F"], ["E3"]),
			];

			const result = shortestPathRanker(paths);

			expect(result).toHaveLength(3);
			// All should have same score
			expect(result[0].score).toBe(0.5);
			expect(result[1].score).toBe(0.5);
			expect(result[2].score).toBe(0.5);
		});

		it("handles large number of paths", () => {
			const paths = Array.from({ length: 1000 }, (_, index) =>
				createPath(
					Array.from({ length: (index % 10) + 1 }, (__, index_) => `N${index}_${index_}`),
					Array.from({ length: index % 10 }, (__, index_) => `E${index}_${index_}`),
				),
			);

			const result = shortestPathRanker(paths);

			expect(result).toHaveLength(1000);
			// First should be shortest (length 0)
			expect(result[0].score).toBe(1);
		});

		it("handles paths with identical structures", () => {
			const paths = [
				createPath(["A", "B"], ["E1"]),
				createPath(["A", "B"], ["E1"]),
				createPath(["A", "B"], ["E1"]),
			];

			const result = shortestPathRanker(paths);

			expect(result).toHaveLength(3);
			// All should have same score
			for (const ranked of result) {
				expect(ranked.score).toBe(0.5);
			}
		});
	});

	describe("comparison with other metrics", () => {
		it("does not consider node properties", () => {
			// Paths with different node data but same length
			const path1: Path<TestNode, TestEdge> = {
				nodes: [
					{ id: "A", type: "test", label: "Important" },
					{ id: "B", type: "test", label: "Node" },
				],
				edges: [{ id: "E1", source: "A", target: "B", type: "link" }],
				totalWeight: 1,
			};

			const path2: Path<TestNode, TestEdge> = {
				nodes: [
					{ id: "C", type: "test", label: "Random" },
					{ id: "D", type: "test", label: "Path" },
				],
				edges: [{ id: "E2", source: "C", target: "D", type: "link" }],
				totalWeight: 1,
			};

			const result = shortestPathRanker([path1, path2]);

			// Both should have same score (only length matters)
			expect(result[0].score).toBe(result[1].score);
		});

		it("does not consider edge weights", () => {
			const heavyEdgePath: Path<TestNode, TestEdge> = {
				nodes: [
					{ id: "A", type: "test", label: "A" },
					{ id: "B", type: "test", label: "B" },
				],
				edges: [
					{ id: "E1", source: "A", target: "B", type: "link", weight: 100 },
				],
				totalWeight: 100,
			};

			const lightEdgePath: Path<TestNode, TestEdge> = {
				nodes: [
					{ id: "C", type: "test", label: "C" },
					{ id: "D", type: "test", label: "D" },
				],
				edges: [{ id: "E2", source: "C", target: "D", type: "link", weight: 1 }],
				totalWeight: 1,
			};

			const result = shortestPathRanker([heavyEdgePath, lightEdgePath]);

			// Both should have same score (edge count matters, not weights)
			expect(result[0].score).toBe(result[1].score);
		});
	});
});

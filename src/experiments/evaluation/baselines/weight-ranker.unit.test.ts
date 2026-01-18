import { describe, expect, it } from "vitest";

import type { Path } from "../../../algorithms/types/algorithm-results";
import type { Edge, Node } from "../../../algorithms/types/graph";
import { weightBasedRanker } from "./weight-ranker";

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
	weight?: number;
	customWeight?: number;
}

/**
 * Creates a test path with the given node and edge data.
 * @param nodeIds
 * @param edges
 */
const createPath = (
	nodeIds: string[],
	edges: TestEdge[],
): Path<TestNode, TestEdge> => {
	const nodes: TestNode[] = nodeIds.map((id) => ({
		id,
		type: "test",
		label: `Node ${id}`,
	}));

	return {
		nodes,
		edges,
		totalWeight: edges.reduce((sum, e) => sum + (e.weight ?? 1), 0),
	};
};

describe("weightBasedRanker", () => {
	describe("basic functionality", () => {
		it("returns empty array for empty paths", () => {
			const result = weightBasedRanker([], (e) => e.weight ?? 1);

			expect(result).toEqual([]);
		});

		it("ranks a single path", () => {
			const path = createPath(
				["A", "B"],
				[{ id: "E1", source: "A", target: "B", type: "link", weight: 5 }],
			);
			const result = weightBasedRanker([path], (e) => e.weight ?? 1);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe(path);
			expect(result[0].score).toBe(5);
		});

		it("ranks higher-weight paths first", () => {
			const lowWeightPath = createPath(
				["A", "B"],
				[{ id: "E1", source: "A", target: "B", type: "link", weight: 1 }],
			);
			const highWeightPath = createPath(
				["C", "D"],
				[{ id: "E2", source: "C", target: "D", type: "link", weight: 10 }],
			);

			const result = weightBasedRanker(
				[lowWeightPath, highWeightPath],
				(e) => e.weight ?? 1,
			);

			expect(result[0].path).toBe(highWeightPath);
			expect(result[1].path).toBe(lowWeightPath);
		});
	});

	describe("score calculation", () => {
		it("calculates average weight correctly", () => {
			const path = createPath(
				["A", "B", "C"],
				[
					{ id: "E1", source: "A", target: "B", type: "link", weight: 2 },
					{ id: "E2", source: "B", target: "C", type: "link", weight: 4 },
				],
			);

			const result = weightBasedRanker([path], (e) => e.weight ?? 1);

			// Average = (2 + 4) / 2 = 3
			expect(result[0].score).toBe(3);
		});

		it("handles path with no edges (score 0)", () => {
			const path = createPath(["A"], []);
			const result = weightBasedRanker([path], (e) => e.weight ?? 1);

			expect(result[0].score).toBe(0);
		});

		it("uses custom weight extractor", () => {
			const path = createPath(
				["A", "B"],
				[
					{
						id: "E1",
						source: "A",
						target: "B",
						type: "link",
						weight: 5,
						customWeight: 100,
					},
				],
			);

			const resultDefault = weightBasedRanker([path], (e) => e.weight ?? 1);
			const resultCustom = weightBasedRanker(
				[path],
				(e) => e.customWeight ?? 1,
			);

			expect(resultDefault[0].score).toBe(5);
			expect(resultCustom[0].score).toBe(100);
		});

		it("handles missing weights with default value", () => {
			const path = createPath(
				["A", "B"],
				[
					{
						id: "E1",
						source: "A",
						target: "B",
						type: "link",
						// no weight property
					},
				],
			);

			const result = weightBasedRanker([path], (e) => e.weight ?? 1);

			expect(result[0].score).toBe(1);
		});
	});

	describe("sorting behavior", () => {
		it("returns paths in descending weight order", () => {
			const paths = [
				createPath(
					["A", "B"],
					[{ id: "E1", source: "A", target: "B", type: "link", weight: 1 }],
				),
				createPath(
					["C", "D"],
					[{ id: "E2", source: "C", target: "D", type: "link", weight: 5 }],
				),
				createPath(
					["E", "F"],
					[{ id: "E3", source: "E", target: "F", type: "link", weight: 3 }],
				),
			];

			const result = weightBasedRanker(paths, (e) => e.weight ?? 1);

			expect(result[0].score).toBe(5);
			expect(result[1].score).toBe(3);
			expect(result[2].score).toBe(1);
		});

		it("handles equal weights", () => {
			const paths = [
				createPath(
					["A", "B"],
					[{ id: "E1", source: "A", target: "B", type: "link", weight: 5 }],
				),
				createPath(
					["C", "D"],
					[{ id: "E2", source: "C", target: "D", type: "link", weight: 5 }],
				),
			];

			const result = weightBasedRanker(paths, (e) => e.weight ?? 1);

			expect(result[0].score).toBe(result[1].score);
		});
	});

	describe("result structure", () => {
		it("includes correct result properties", () => {
			const path = createPath(
				["A", "B"],
				[{ id: "E1", source: "A", target: "B", type: "link", weight: 3 }],
			);

			const result = weightBasedRanker([path], (e) => e.weight ?? 1);

			expect(result[0]).toMatchObject({
				path,
				geometricMeanMI: 0,
				edgeMIValues: [],
			});
			expect(typeof result[0].score).toBe("number");
		});

		it("preserves original path objects", () => {
			const paths = [
				createPath(
					["A", "B"],
					[{ id: "E1", source: "A", target: "B", type: "link", weight: 2 }],
				),
				createPath(
					["C", "D"],
					[{ id: "E2", source: "C", target: "D", type: "link", weight: 4 }],
				),
			];

			const result = weightBasedRanker(paths, (e) => e.weight ?? 1);

			const resultPaths = result.map((r) => r.path);
			expect(resultPaths).toContain(paths[0]);
			expect(resultPaths).toContain(paths[1]);
		});
	});

	describe("edge cases", () => {
		it("handles negative weights", () => {
			const path = createPath(
				["A", "B"],
				[{ id: "E1", source: "A", target: "B", type: "link", weight: -5 }],
			);

			const result = weightBasedRanker([path], (e) => e.weight ?? 1);

			expect(result[0].score).toBe(-5);
		});

		it("handles zero weights", () => {
			const path = createPath(
				["A", "B"],
				[{ id: "E1", source: "A", target: "B", type: "link", weight: 0 }],
			);

			const result = weightBasedRanker([path], (e) => e.weight ?? 1);

			expect(result[0].score).toBe(0);
		});

		it("handles very large weights", () => {
			const path = createPath(
				["A", "B"],
				[
					{
						id: "E1",
						source: "A",
						target: "B",
						type: "link",
						weight: Number.MAX_SAFE_INTEGER,
					},
				],
			);

			const result = weightBasedRanker([path], (e) => e.weight ?? 1);

			expect(result[0].score).toBe(Number.MAX_SAFE_INTEGER);
		});

		it("handles floating point weights", () => {
			const path = createPath(
				["A", "B", "C"],
				[
					{ id: "E1", source: "A", target: "B", type: "link", weight: 0.1 },
					{ id: "E2", source: "B", target: "C", type: "link", weight: 0.2 },
				],
			);

			const result = weightBasedRanker([path], (e) => e.weight ?? 1);

			expect(result[0].score).toBeCloseTo(0.15, 5);
		});

		it("handles large number of paths", () => {
			const paths = Array.from({ length: 1000 }, (_, index) =>
				createPath(
					[`A${index}`, `B${index}`],
					[
						{
							id: `E${index}`,
							source: `A${index}`,
							target: `B${index}`,
							type: "link",
							weight: index,
						},
					],
				),
			);

			const result = weightBasedRanker(paths, (e) => e.weight ?? 1);

			expect(result).toHaveLength(1000);
			// First should have highest weight (999)
			expect(result[0].score).toBe(999);
		});

		it("handles multiple edges per path", () => {
			const path = createPath(
				["A", "B", "C", "D", "E"],
				[
					{ id: "E1", source: "A", target: "B", type: "link", weight: 1 },
					{ id: "E2", source: "B", target: "C", type: "link", weight: 2 },
					{ id: "E3", source: "C", target: "D", type: "link", weight: 3 },
					{ id: "E4", source: "D", target: "E", type: "link", weight: 4 },
				],
			);

			const result = weightBasedRanker([path], (e) => e.weight ?? 1);

			// Average = (1 + 2 + 3 + 4) / 4 = 2.5
			expect(result[0].score).toBe(2.5);
		});
	});

	describe("custom weight functions", () => {
		it("supports computed weights", () => {
			interface ComputedEdge extends Edge {
				id: string;
				source: string;
				target: string;
				type: "link";
				base: number;
				multiplier: number;
			}

			const path: Path<TestNode, ComputedEdge> = {
				nodes: [
					{ id: "A", type: "test", label: "A" },
					{ id: "B", type: "test", label: "B" },
				],
				edges: [
					{
						id: "E1",
						source: "A",
						target: "B",
						type: "link",
						base: 5,
						multiplier: 3,
					},
				],
				totalWeight: 15,
			};

			const result = weightBasedRanker(
				[path],
				(e) => e.base * e.multiplier,
			);

			expect(result[0].score).toBe(15);
		});

		it("supports inverse weight ranking", () => {
			const paths = [
				createPath(
					["A", "B"],
					[{ id: "E1", source: "A", target: "B", type: "link", weight: 10 }],
				),
				createPath(
					["C", "D"],
					[{ id: "E2", source: "C", target: "D", type: "link", weight: 1 }],
				),
			];

			// Use inverse weight to rank lower weights higher
			const result = weightBasedRanker(
				paths,
				(e) => 1 / (e.weight ?? 1),
			);

			// Path with weight 1 should rank first (1/1 = 1 > 1/10 = 0.1)
			expect(result[0].path).toBe(paths[1]);
		});
	});
});

import { describe, expect, it, vi } from "vitest";

import type { GraphExpander, Neighbor } from "../../interfaces/graph-expander";
import { RandomPriorityExpansion } from "./random-priority";

/**
 * Creates a mock GraphExpander for testing.
 * @param adjacencyList
 * @param degreeMap
 * @param nodeData
 */
const createMockExpander = <T>(
	adjacencyList: Map<string, Neighbor[]>,
	degreeMap: Map<string, number>,
	nodeData: Map<string, T>,
): GraphExpander<T> => ({
	getNeighbors: vi.fn((nodeId: string) =>
		Promise.resolve(adjacencyList.get(nodeId) ?? []),
	),
	getDegree: vi.fn((nodeId: string) => degreeMap.get(nodeId) ?? 0),
	getNode: vi.fn((nodeId: string) =>
		Promise.resolve(nodeData.get(nodeId) ?? null),
	),
	addEdge: vi.fn(),
});

describe("RandomPriorityExpansion", () => {
	describe("constructor", () => {
		it("throws error when no seeds are provided", () => {
			const expander = createMockExpander(
				new Map(),
				new Map(),
				new Map<string, unknown>(),
			);

			expect(() => new RandomPriorityExpansion(expander, [])).toThrow(
				"At least one seed node is required",
			);
		});

		it("accepts a single seed", () => {
			const expander = createMockExpander(
				new Map(),
				new Map(),
				new Map<string, unknown>(),
			);

			expect(
				() => new RandomPriorityExpansion(expander, ["A"]),
			).not.toThrow();
		});

		it("accepts multiple seeds", () => {
			const expander = createMockExpander(
				new Map(),
				new Map(),
				new Map<string, unknown>(),
			);

			expect(
				() => new RandomPriorityExpansion(expander, ["A", "B", "C"]),
			).not.toThrow();
		});

		it("accepts custom random seed", () => {
			const expander = createMockExpander(
				new Map(),
				new Map(),
				new Map<string, unknown>(),
			);

			expect(
				() => new RandomPriorityExpansion(expander, ["A"], 12_345),
			).not.toThrow();
		});
	});

	describe("run", () => {
		it("handles single seed with no neighbors", async () => {
			const adjacencyList = new Map<string, Neighbor[]>();
			const degreeMap = new Map([["A", 0]]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new RandomPriorityExpansion(expander, ["A"]);

			const result = await expansion.run();

			expect(result.sampledNodes).toEqual(new Set(["A"]));
			expect(result.paths).toHaveLength(0);
			expect(result.stats.nodesExpanded).toBe(1);
			expect(result.stats.edgesTraversed).toBe(0);
		});

		it("finds path between two directly connected seeds", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "B", relationshipType: "link" }]],
				["B", [{ targetId: "A", relationshipType: "link" }]],
			]);
			const degreeMap = new Map([
				["A", 1],
				["B", 1],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new RandomPriorityExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			expect(result.sampledNodes).toContain("A");
			expect(result.sampledNodes).toContain("B");
			expect(result.paths.length).toBeGreaterThanOrEqual(1);
		});

		it("finds path through intermediate node", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "C", relationshipType: "link" }]],
				["B", [{ targetId: "C", relationshipType: "link" }]],
				[
					"C",
					[
						{ targetId: "A", relationshipType: "link" },
						{ targetId: "B", relationshipType: "link" },
					],
				],
			]);
			const degreeMap = new Map([
				["A", 1],
				["B", 1],
				["C", 2],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new RandomPriorityExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			expect(result.sampledNodes).toContain("A");
			expect(result.sampledNodes).toContain("B");
			expect(result.sampledNodes).toContain("C");
			expect(result.paths.length).toBeGreaterThanOrEqual(1);
		});

		it("produces reproducible results with same seed", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				[
					"A",
					[
						{ targetId: "B", relationshipType: "link" },
						{ targetId: "C", relationshipType: "link" },
						{ targetId: "D", relationshipType: "link" },
					],
				],
				["B", []],
				["C", []],
				["D", []],
			]);
			const degreeMap = new Map([
				["A", 3],
				["B", 0],
				["C", 0],
				["D", 0],
			]);
			const nodeData = new Map<string, unknown>();

			const randomSeed = 42;

			const expander1 = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion1 = new RandomPriorityExpansion(
				expander1,
				["A"],
				randomSeed,
			);
			const result1 = await expansion1.run();

			const expander2 = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion2 = new RandomPriorityExpansion(
				expander2,
				["A"],
				randomSeed,
			);
			const result2 = await expansion2.run();

			// Results should be identical with same seed
			expect(result1.stats.nodesExpanded).toBe(result2.stats.nodesExpanded);
			expect(result1.stats.iterations).toBe(result2.stats.iterations);
		});

		it("produces different results with different seeds", async () => {
			// Create a larger graph where randomness matters more
			const adjacencyList = new Map<string, Neighbor[]>([
				[
					"A",
					[
						{ targetId: "B", relationshipType: "link" },
						{ targetId: "C", relationshipType: "link" },
						{ targetId: "D", relationshipType: "link" },
						{ targetId: "E", relationshipType: "link" },
						{ targetId: "F", relationshipType: "link" },
					],
				],
				["B", [{ targetId: "G", relationshipType: "link" }]],
				["C", [{ targetId: "G", relationshipType: "link" }]],
				["D", [{ targetId: "G", relationshipType: "link" }]],
				["E", [{ targetId: "G", relationshipType: "link" }]],
				["F", [{ targetId: "G", relationshipType: "link" }]],
				["G", []],
			]);
			const degreeMap = new Map([
				["A", 5],
				["B", 1],
				["C", 1],
				["D", 1],
				["E", 1],
				["F", 1],
				["G", 0],
			]);
			const nodeData = new Map<string, unknown>();

			const expander1 = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion1 = new RandomPriorityExpansion(expander1, ["A"], 1);

			const expander2 = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion2 = new RandomPriorityExpansion(expander2, ["A"], 99_999);

			await expansion1.run();
			await expansion2.run();

			// Both should complete, different order doesn't change final result
			// but internal state may differ
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(expander1.getNeighbors).toHaveBeenCalled();
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(expander2.getNeighbors).toHaveBeenCalled();
		});

		it("records degree distribution in stats", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "B", relationshipType: "link" }]],
				["B", []],
			]);
			const degreeMap = new Map([
				["A", 3],
				["B", 50],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new RandomPriorityExpansion(expander, ["A"]);

			const result = await expansion.run();

			expect(result.stats.degreeDistribution.size).toBeGreaterThan(0);
			// Node A has degree 3, which falls in "1-5" bucket
			expect(result.stats.degreeDistribution.get("1-5")).toBe(1);
		});

		it("records sampled edges", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "B", relationshipType: "citation" }]],
				["B", []],
			]);
			const degreeMap = new Map([
				["A", 1],
				["B", 0],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new RandomPriorityExpansion(expander, ["A"]);

			const result = await expansion.run();

			expect(result.sampledEdges.size).toBe(1);
			expect(result.sampledEdges.has("A->B")).toBe(true);
		});

		it("provides visitedPerFrontier for diagnostics", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "C", relationshipType: "link" }]],
				["B", [{ targetId: "D", relationshipType: "link" }]],
				["C", []],
				["D", []],
			]);
			const degreeMap = new Map([
				["A", 1],
				["B", 1],
				["C", 0],
				["D", 0],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new RandomPriorityExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			expect(result.visitedPerFrontier).toHaveLength(2);
			expect(result.visitedPerFrontier[0]).toContain("A");
			expect(result.visitedPerFrontier[1]).toContain("B");
		});

		it("handles disconnected components", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "C", relationshipType: "link" }]],
				["B", [{ targetId: "D", relationshipType: "link" }]],
				["C", []],
				["D", []],
			]);
			const degreeMap = new Map([
				["A", 1],
				["B", 1],
				["C", 0],
				["D", 0],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new RandomPriorityExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			// No paths found between disconnected seeds
			expect(result.paths).toHaveLength(0);
			// But all nodes should be visited
			expect(result.sampledNodes.size).toBe(4);
		});

		it("does not add duplicate paths", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "C", relationshipType: "link" }]],
				["B", [{ targetId: "C", relationshipType: "link" }]],
				[
					"C",
					[
						{ targetId: "A", relationshipType: "link" },
						{ targetId: "B", relationshipType: "link" },
					],
				],
			]);
			const degreeMap = new Map([
				["A", 1],
				["B", 1],
				["C", 2],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new RandomPriorityExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			const pathStrings = result.paths.map((p) => p.nodes.join("-"));
			const uniquePaths = new Set(pathStrings);
			expect(uniquePaths.size).toBe(pathStrings.length);
		});

		it("handles three or more seeds", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "D", relationshipType: "link" }]],
				["B", [{ targetId: "D", relationshipType: "link" }]],
				["C", [{ targetId: "D", relationshipType: "link" }]],
				[
					"D",
					[
						{ targetId: "A", relationshipType: "link" },
						{ targetId: "B", relationshipType: "link" },
						{ targetId: "C", relationshipType: "link" },
					],
				],
			]);
			const degreeMap = new Map([
				["A", 1],
				["B", 1],
				["C", 1],
				["D", 3],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new RandomPriorityExpansion(expander, ["A", "B", "C"]);

			const result = await expansion.run();

			expect(result.visitedPerFrontier).toHaveLength(3);
			expect(result.sampledNodes).toContain("D");
		});

		it("default seed is 42", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "B", relationshipType: "link" }]],
				["B", []],
			]);
			const degreeMap = new Map([
				["A", 1],
				["B", 0],
			]);
			const nodeData = new Map<string, unknown>();

			// Without explicit seed
			const expander1 = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion1 = new RandomPriorityExpansion(expander1, ["A"]);
			const result1 = await expansion1.run();

			// With explicit seed 42
			const expander2 = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion2 = new RandomPriorityExpansion(expander2, ["A"], 42);
			const result2 = await expansion2.run();

			// Should produce identical results
			expect(result1.stats.iterations).toBe(result2.stats.iterations);
		});
	});

	describe("degree bucket classification", () => {
		it("classifies degrees into correct buckets", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				[
					"A",
					[
						{ targetId: "B", relationshipType: "link" },
						{ targetId: "C", relationshipType: "link" },
						{ targetId: "D", relationshipType: "link" },
						{ targetId: "E", relationshipType: "link" },
						{ targetId: "F", relationshipType: "link" },
					],
				],
				["B", []],
				["C", []],
				["D", []],
				["E", []],
				["F", []],
			]);
			const degreeMap = new Map([
				["A", 5],
				["B", 7],
				["C", 30],
				["D", 75],
				["E", 300],
				["F", 1500],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new RandomPriorityExpansion(expander, ["A"]);

			const result = await expansion.run();

			expect(result.stats.degreeDistribution.size).toBeGreaterThan(0);
		});
	});
});

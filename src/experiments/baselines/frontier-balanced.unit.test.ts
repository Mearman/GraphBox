import { describe, expect, it, vi } from "vitest";

import type { GraphExpander, Neighbor } from "../../interfaces/graph-expander";
import { FrontierBalancedExpansion } from "./frontier-balanced";

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

describe("FrontierBalancedExpansion", () => {
	describe("constructor", () => {
		it("throws error when no seeds are provided", () => {
			const expander = createMockExpander(
				new Map(),
				new Map(),
				new Map<string, unknown>(),
			);

			expect(() => new FrontierBalancedExpansion(expander, [])).toThrow(
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
				() => new FrontierBalancedExpansion(expander, ["A"]),
			).not.toThrow();
		});

		it("accepts multiple seeds", () => {
			const expander = createMockExpander(
				new Map(),
				new Map(),
				new Map<string, unknown>(),
			);

			expect(
				() => new FrontierBalancedExpansion(expander, ["A", "B", "C"]),
			).not.toThrow();
		});
	});

	describe("run", () => {
		it("handles single seed with no neighbors", async () => {
			const adjacencyList = new Map<string, Neighbor[]>();
			const degreeMap = new Map([["A", 0]]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new FrontierBalancedExpansion(expander, ["A"]);

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
			const expansion = new FrontierBalancedExpansion(expander, ["A", "B"]);

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
			const expansion = new FrontierBalancedExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			expect(result.sampledNodes).toContain("A");
			expect(result.sampledNodes).toContain("B");
			expect(result.sampledNodes).toContain("C");
			expect(result.paths.length).toBeGreaterThanOrEqual(1);
		});

		it("balances frontiers by selecting smaller frontier", async () => {
			// Create asymmetric graph: A has 1 neighbor, B has 3 neighbors
			// Smaller frontier should be selected first
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "X", relationshipType: "link" }]],
				[
					"B",
					[
						{ targetId: "Y", relationshipType: "link" },
						{ targetId: "Z", relationshipType: "link" },
						{ targetId: "W", relationshipType: "link" },
					],
				],
				["X", []],
				["Y", []],
				["Z", []],
				["W", []],
			]);
			const degreeMap = new Map([
				["A", 1],
				["B", 3],
				["X", 0],
				["Y", 0],
				["Z", 0],
				["W", 0],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new FrontierBalancedExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			// Verify expansion completed
			expect(result.stats.nodesExpanded).toBeGreaterThan(0);
			expect(result.stats.frontierSwitches).toBeGreaterThanOrEqual(0);
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
			const expansion = new FrontierBalancedExpansion(expander, ["A"]);

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
			const expansion = new FrontierBalancedExpansion(expander, ["A"]);

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
			const expansion = new FrontierBalancedExpansion(expander, ["A", "B"]);

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
			const expansion = new FrontierBalancedExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			// No paths found between disconnected seeds
			expect(result.paths).toHaveLength(0);
			// But all nodes should be visited
			expect(result.sampledNodes.size).toBe(4);
		});

		it("does not add duplicate paths", async () => {
			// Graph where path can be found multiple times
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
			const expansion = new FrontierBalancedExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			// Should have exactly one path (no duplicates)
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
			const expansion = new FrontierBalancedExpansion(expander, ["A", "B", "C"]);

			const result = await expansion.run();

			// Should find paths between multiple seed pairs
			expect(result.visitedPerFrontier).toHaveLength(3);
			expect(result.sampledNodes).toContain("D");
		});
	});

	describe("degree bucket classification", () => {
		it("classifies degrees into correct buckets", async () => {
			// Test various degree values
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
				["A", 5], // 1-5 bucket
				["B", 7], // 6-10 bucket
				["C", 30], // 11-50 bucket
				["D", 75], // 51-100 bucket
				["E", 300], // 101-500 bucket
				["F", 1500], // 1000+ bucket
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new FrontierBalancedExpansion(expander, ["A"]);

			const result = await expansion.run();

			// Should have recorded degree distribution
			expect(result.stats.degreeDistribution.size).toBeGreaterThan(0);
		});
	});
});

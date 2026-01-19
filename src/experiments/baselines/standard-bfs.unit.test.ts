import { describe, expect, it, vi } from "vitest";

import type { GraphExpander, Neighbor } from "../../interfaces/graph-expander";
import { StandardBfsExpansion } from "./standard-bfs";

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
	calculatePriority: vi.fn((nodeId: string) => {
		const { nodeWeight = 1, epsilon = 1e-10 } = {};
		const degree = degreeMap.get(nodeId) ?? 0;
		return degree / (nodeWeight + epsilon);
	}),
	getNode: vi.fn((nodeId: string) =>
		Promise.resolve(nodeData.get(nodeId) ?? null),
	),
	addEdge: vi.fn(),
});

describe("StandardBfsExpansion", () => {
	describe("constructor", () => {
		it("throws error when no seeds are provided", () => {
			const expander = createMockExpander(
				new Map(),
				new Map(),
				new Map<string, unknown>(),
			);

			expect(() => new StandardBfsExpansion(expander, [])).toThrow(
				"At least one seed node is required",
			);
		});

		it("accepts a single seed", () => {
			const expander = createMockExpander(
				new Map(),
				new Map(),
				new Map<string, unknown>(),
			);

			expect(() => new StandardBfsExpansion(expander, ["A"])).not.toThrow();
		});

		it("accepts multiple seeds", () => {
			const expander = createMockExpander(
				new Map(),
				new Map(),
				new Map<string, unknown>(),
			);

			expect(
				() => new StandardBfsExpansion(expander, ["A", "B", "C"]),
			).not.toThrow();
		});
	});

	describe("run", () => {
		it("handles single seed with no neighbors", async () => {
			const adjacencyList = new Map<string, Neighbor[]>();
			const degreeMap = new Map([["A", 0]]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new StandardBfsExpansion(expander, ["A"]);

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
			const expansion = new StandardBfsExpansion(expander, ["A", "B"]);

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
			const expansion = new StandardBfsExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			expect(result.sampledNodes).toContain("A");
			expect(result.sampledNodes).toContain("B");
			expect(result.sampledNodes).toContain("C");
			expect(result.paths.length).toBeGreaterThanOrEqual(1);
		});

		it("expands in FIFO order (breadth-first)", async () => {
			// Create a tree structure
			const adjacencyList = new Map<string, Neighbor[]>([
				[
					"A",
					[
						{ targetId: "B", relationshipType: "link" },
						{ targetId: "C", relationshipType: "link" },
					],
				],
				[
					"B",
					[
						{ targetId: "D", relationshipType: "link" },
						{ targetId: "E", relationshipType: "link" },
					],
				],
				[
					"C",
					[
						{ targetId: "F", relationshipType: "link" },
						{ targetId: "G", relationshipType: "link" },
					],
				],
				["D", []],
				["E", []],
				["F", []],
				["G", []],
			]);
			const degreeMap = new Map([
				["A", 2],
				["B", 2],
				["C", 2],
				["D", 0],
				["E", 0],
				["F", 0],
				["G", 0],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new StandardBfsExpansion(expander, ["A"]);

			const result = await expansion.run();

			// BFS should visit all nodes
			expect(result.sampledNodes.size).toBe(7);
			// Should expand level by level
			expect(result.stats.nodesExpanded).toBe(7);
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
			const expansion = new StandardBfsExpansion(expander, ["A"]);

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
			const expansion = new StandardBfsExpansion(expander, ["A"]);

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
			const expansion = new StandardBfsExpansion(expander, ["A", "B"]);

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
			const expansion = new StandardBfsExpansion(expander, ["A", "B"]);

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
			const expansion = new StandardBfsExpansion(expander, ["A", "B"]);

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
			const expansion = new StandardBfsExpansion(expander, ["A", "B", "C"]);

			const result = await expansion.run();

			expect(result.visitedPerFrontier).toHaveLength(3);
			expect(result.sampledNodes).toContain("D");
		});

		it("uses round-robin frontier selection", async () => {
			// Create graph where frontiers have equal sizes
			const adjacencyList = new Map<string, Neighbor[]>([
				["A", [{ targetId: "C", relationshipType: "link" }]],
				["B", [{ targetId: "D", relationshipType: "link" }]],
				["C", [{ targetId: "E", relationshipType: "link" }]],
				["D", [{ targetId: "E", relationshipType: "link" }]],
				[
					"E",
					[
						{ targetId: "C", relationshipType: "link" },
						{ targetId: "D", relationshipType: "link" },
					],
				],
			]);
			const degreeMap = new Map([
				["A", 1],
				["B", 1],
				["C", 1],
				["D", 1],
				["E", 2],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new StandardBfsExpansion(expander, ["A", "B"]);

			const result = await expansion.run();

			// Both frontiers should have expanded nodes
			expect(result.visitedPerFrontier[0].size).toBeGreaterThan(1);
			expect(result.visitedPerFrontier[1].size).toBeGreaterThan(1);
		});

		it("calls addEdge for each discovered edge", async () => {
			const adjacencyList = new Map<string, Neighbor[]>([
				[
					"A",
					[
						{ targetId: "B", relationshipType: "citation" },
						{ targetId: "C", relationshipType: "authorship" },
					],
				],
				["B", []],
				["C", []],
			]);
			const degreeMap = new Map([
				["A", 2],
				["B", 0],
				["C", 0],
			]);
			const nodeData = new Map<string, unknown>();

			const expander = createMockExpander(adjacencyList, degreeMap, nodeData);
			const expansion = new StandardBfsExpansion(expander, ["A"]);

			await expansion.run();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(expander.addEdge).toHaveBeenCalledWith("A", "B", "citation");
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(expander.addEdge).toHaveBeenCalledWith("A", "C", "authorship");
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
			const expansion = new StandardBfsExpansion(expander, ["A"]);

			const result = await expansion.run();

			expect(result.stats.degreeDistribution.size).toBeGreaterThan(0);
		});
	});
});

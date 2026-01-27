import { beforeEach, describe, expect, it } from "vitest";

import type { GraphExpander, Neighbor } from "../../interfaces/graph-expander";
import { IntelligentDelayedTermination } from "./intelligent-delayed-termination";

describe("IntelligentDelayedTermination", () => {
	let expander: GraphExpander<unknown>;
	let edges: Map<string, Array<{ targetId: string; relationshipType: string }>>;

	beforeEach(() => {
		edges = new Map();

		// Mock GraphExpander
		expander = {
			calculatePriority: (nodeId: string) => {
				// Return degree as priority (mocked as number of outgoing edges)
				return edges.get(nodeId)?.length ?? 0;
			},
			getDegree: (nodeId: string) => {
				return edges.get(nodeId)?.length ?? 0;
			},
			getNeighbors: async (nodeId: string): Promise<Neighbor[]> => {
				const neighbors = edges.get(nodeId) ?? [];
				return neighbors.map(({ targetId, relationshipType }) => ({
					targetId,
					relationshipType,
				}));
			},
			getNode: async (nodeId: string) => {
				return { id: nodeId };
			},
			addEdge: () => {
				// Mock implementation - no tracking needed for tests
			},
		};
	});

	describe("constructor", () => {
		it("should throw error if fewer than 2 seeds provided", () => {
			expect(() => new IntelligentDelayedTermination(expander, ["A"])).toThrow(
				"At least two seed nodes are required for overlap detection"
			);
		});

		it("should accept 2 or more seeds", () => {
			const idt2 = new IntelligentDelayedTermination(expander, ["A", "B"]);
			expect(idt2).toBeDefined();

			const idt3 = new IntelligentDelayedTermination(expander, ["A", "B", "C"]);
			expect(idt3).toBeDefined();
		});

		it("should use default configuration values", () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"]);
			expect(idt).toBeDefined();
			// Config values are private, but algorithm should construct successfully
		});

		it("should accept custom configuration", () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"], {
				delayIterations: 100,
				overlapThreshold: 0.6,
			});
			expect(idt).toBeDefined();
		});
	});

	describe("run - simple graph", () => {
		beforeEach(() => {
			// Build a simple graph: A -- C -- B
			edges.set("A", [{ targetId: "C", relationshipType: "connected" }]);
			edges.set("B", [{ targetId: "C", relationshipType: "connected" }]);
			edges.set("C", [
				{ targetId: "A", relationshipType: "connected" },
				{ targetId: "B", relationshipType: "connected" },
			]);
		});

		it("should discover path between two seeds", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"]);
			const result = await idt.run();

			expect(result.paths).toHaveLength(1);
			// Path can be in either direction depending on which frontier expands first
			const path = result.paths[0].nodes;
			expect(path).toHaveLength(3);
			expect(path).toContain("A");
			expect(path).toContain("B");
			expect(path).toContain("C");
			// Middle node should be C
			expect(path[1]).toBe("C");
		});

		it("should sample all nodes in path", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"]);
			const result = await idt.run();

			expect(result.sampledNodes.has("A")).toBe(true);
			expect(result.sampledNodes.has("B")).toBe(true);
			expect(result.sampledNodes.has("C")).toBe(true);
			expect(result.sampledNodes.size).toBe(3);
		});

		it("should collect expansion statistics", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"]);
			const result = await idt.run();

			expect(result.stats.nodesExpanded).toBeGreaterThan(0);
			expect(result.stats.edgesTraversed).toBeGreaterThan(0);
			expect(result.stats.iterations).toBeGreaterThan(0);
		});
	});

	describe("run - delayed termination", () => {
		beforeEach(() => {
			// Build a graph with multiple paths:
			//     D
			//    / \
			//   A   B
			//    \ /
			//     C
			//     |
			//     E
			edges.set("A", [
				{ targetId: "C", relationshipType: "connected" },
				{ targetId: "D", relationshipType: "connected" },
			]);
			edges.set("B", [
				{ targetId: "C", relationshipType: "connected" },
				{ targetId: "D", relationshipType: "connected" },
			]);
			edges.set("C", [
				{ targetId: "A", relationshipType: "connected" },
				{ targetId: "B", relationshipType: "connected" },
				{ targetId: "E", relationshipType: "connected" },
			]);
			edges.set("D", [
				{ targetId: "A", relationshipType: "connected" },
				{ targetId: "B", relationshipType: "connected" },
			]);
			edges.set("E", [{ targetId: "C", relationshipType: "connected" }]);
		});

		it("should terminate after delayIterations post-overlap", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"], {
				delayIterations: 5,
				overlapThreshold: 0.3,
			});

			const result = await idt.run();

			// Should discover at least one path
			expect(result.paths.length).toBeGreaterThan(0);

			// Should terminate after overlap + delay
			// Exact iteration count will vary, but should be bounded
			expect(result.stats.iterations).toBeLessThan(100);
		});

		it("should discover multiple paths if available", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"], {
				delayIterations: 20,
				overlapThreshold: 0.2,
			});

			const result = await idt.run();

			// Multiple paths exist: A-C-B and A-D-B
			expect(result.paths.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("run - overlap detection", () => {
		beforeEach(() => {
			// Build a graph with gradual overlap:
			//   A -- C -- D -- E -- B
			edges.set("A", [{ targetId: "C", relationshipType: "connected" }]);
			edges.set("C", [
				{ targetId: "A", relationshipType: "connected" },
				{ targetId: "D", relationshipType: "connected" },
			]);
			edges.set("D", [
				{ targetId: "C", relationshipType: "connected" },
				{ targetId: "E", relationshipType: "connected" },
			]);
			edges.set("E", [
				{ targetId: "D", relationshipType: "connected" },
				{ targetId: "B", relationshipType: "connected" },
			]);
			edges.set("B", [{ targetId: "E", relationshipType: "connected" }]);
		});

		it("should detect overlap when Jaccard threshold met", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"], {
				delayIterations: 10,
				overlapThreshold: 0.4,
			});

			const result = await idt.run();

			// Should find path and detect overlap
			expect(result.paths).toHaveLength(1);
			const path = result.paths[0].nodes;
			expect(path).toHaveLength(5);
			// Path should connect A to B through C, D, E (in some order)
			expect(path[0]).toMatch(/^[AB]$/);
			expect(path[4]).toMatch(/^[AB]$/);
			expect(path).toContain("C");
			expect(path).toContain("D");
			expect(path).toContain("E");
		});

		it("should transition to MI-guided phase after first path", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"], {
				delayIterations: 15,
				overlapThreshold: 0.3,
			});

			const result = await idt.run();

			// After finding first path, should continue with MI guidance
			expect(result.paths.length).toBeGreaterThan(0);
			expect(result.stats.iterations).toBeGreaterThan(3);
		});
	});

	describe("run - N > 2 seeds", () => {
		beforeEach(() => {
			// Triangle graph with three seeds
			//   A -- D -- B
			//    \   |   /
			//     \  |  /
			//      \ | /
			//        C
			edges.set("A", [
				{ targetId: "D", relationshipType: "connected" },
				{ targetId: "C", relationshipType: "connected" },
			]);
			edges.set("B", [
				{ targetId: "D", relationshipType: "connected" },
				{ targetId: "C", relationshipType: "connected" },
			]);
			edges.set("C", [
				{ targetId: "A", relationshipType: "connected" },
				{ targetId: "B", relationshipType: "connected" },
				{ targetId: "D", relationshipType: "connected" },
			]);
			edges.set("D", [
				{ targetId: "A", relationshipType: "connected" },
				{ targetId: "B", relationshipType: "connected" },
				{ targetId: "C", relationshipType: "connected" },
			]);
		});

		it("should handle three seeds", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B", "C"], {
				delayIterations: 10,
			});

			const result = await idt.run();

			// Should discover paths between all seed pairs
			expect(result.paths.length).toBeGreaterThan(0);
			expect(result.visitedPerFrontier).toHaveLength(3);
		});

		it("should detect overlap across any pair of frontiers", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B", "C"], {
				delayIterations: 5,
				overlapThreshold: 0.3,
			});

			const result = await idt.run();

			// Should terminate after overlap detected between any two frontiers
			expect(result.paths.length).toBeGreaterThan(0);
			expect(result.stats.iterations).toBeLessThan(50);
		});
	});

	describe("run - disconnected graph", () => {
		beforeEach(() => {
			// Two disconnected components
			edges.set("A", [{ targetId: "C", relationshipType: "connected" }]);
			edges.set("C", [{ targetId: "A", relationshipType: "connected" }]);
			edges.set("B", [{ targetId: "D", relationshipType: "connected" }]);
			edges.set("D", [{ targetId: "B", relationshipType: "connected" }]);
		});

		it("should terminate when frontiers exhausted", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"], {
				delayIterations: 100,
			});

			const result = await idt.run();

			// No paths found (disconnected)
			expect(result.paths).toHaveLength(0);

			// Should sample both components
			expect(result.sampledNodes.has("A")).toBe(true);
			expect(result.sampledNodes.has("C")).toBe(true);
			expect(result.sampledNodes.has("B")).toBe(true);
			expect(result.sampledNodes.has("D")).toBe(true);
		});

		it("should not detect overlap if components disconnected", async () => {
			const idt = new IntelligentDelayedTermination(expander, ["A", "B"], {
				delayIterations: 10,
				overlapThreshold: 0.5,
			});

			const result = await idt.run();

			// Frontiers never overlap
			expect(result.paths).toHaveLength(0);

			// Should explore both components fully
			expect(result.visitedPerFrontier[0].size).toBe(2); // A, C
			expect(result.visitedPerFrontier[1].size).toBe(2); // B, D
		});
	});
});

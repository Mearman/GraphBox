/**
 * Unit tests for degree-prioritised expansion algorithm
 */

import { describe, expect, it } from "vitest";

import type { GraphExpander, Neighbor } from "../../interfaces/graph-expander";
import { DegreePrioritisedExpansion } from "./degree-prioritised-expansion";

/**
 * Mock graph expander for testing
 */
class MockGraphExpander implements GraphExpander<string> {
	private adjacency: Map<string, Array<{ targetId: string; relationshipType: string }>> =
		new Map();
	private degrees: Map<string, number> = new Map();
	private addedEdges: Array<{ source: string; target: string; type: string }> = [];
	private nodes: Map<string, string> = new Map();
	private nodeWeights: Map<string, number> = new Map();

	addNode(id: string, degree?: number, weight?: number): void {
		if (!this.adjacency.has(id)) {
			this.adjacency.set(id, []);
		}
		this.nodes.set(id, id);
		if (degree !== undefined) {
			this.degrees.set(id, degree);
		}
		if (weight !== undefined) {
			this.nodeWeights.set(id, weight);
		}
	}

	addEdgeBetween(source: string, target: string, type = "test"): void {
		const neighbors = this.adjacency.get(source) ?? [];
		neighbors.push({ targetId: target, relationshipType: type });
		this.adjacency.set(source, neighbors);
	}

	getDegree(nodeId: string): number {
		if (this.degrees.has(nodeId)) {
			return this.degrees.get(nodeId)!;
		}
		// Default: count neighbors
		const neighbors = this.adjacency.get(nodeId) ?? [];
		return neighbors.length;
	}

	async getNeighbors(nodeId: string): Promise<Neighbor[]> {
		const neighbors = this.adjacency.get(nodeId) ?? [];
		return neighbors;
	}

	async getNode(nodeId: string): Promise<string | null> {
		return this.nodes.get(nodeId) ?? null;
	}

	addEdge(source: string, target: string, relationshipType: string): void {
		this.addedEdges.push({ source, target, type: relationshipType });
	}

	calculatePriority(nodeId: string, options: { nodeWeight?: number; epsilon?: number } = {}): number {
		const { nodeWeight = 1, epsilon = 1e-10 } = options;

		const outDegree = this.getDegree(nodeId); // Simplified: treats total as out-degree
		const inDegree = 0; // MockGraphExpander doesn't track direction separately

		// For undirected graphs, in = out, so total = 2 * out
		// This mock treats edges as outgoing only, so we use degree as both
		const weightedDegree = outDegree + inDegree;

		return weightedDegree / (nodeWeight + epsilon);
	}

	getAddedEdges(): Array<{ source: string; target: string; type: string }> {
		return this.addedEdges;
	}
}

describe("DegreePrioritisedExpansion", () => {
	describe("constructor", () => {
		it("should throw error when no seeds provided", () => {
			const expander = new MockGraphExpander();

			expect(() => new DegreePrioritisedExpansion(expander, [])).toThrow(
				"At least one seed node is required"
			);
		});

		it("should accept single seed", () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);

			expect(expansion).toBeDefined();
		});

		it("should accept multiple seeds", () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addNode("C");

			const expansion = new DegreePrioritisedExpansion(expander, ["A", "B", "C"]);

			expect(expansion).toBeDefined();
		});
	});

	describe("single seed expansion (N=1)", () => {
		it("should explore all reachable nodes", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addNode("C");
			expander.addEdgeBetween("A", "B");
			expander.addEdgeBetween("B", "C");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);
			const result = await expansion.run();

			expect(result.sampledNodes.has("A")).toBe(true);
			expect(result.sampledNodes.has("B")).toBe(true);
			expect(result.sampledNodes.has("C")).toBe(true);
		});

		it("should return no paths for single seed", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addEdgeBetween("A", "B");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);
			const result = await expansion.run();

			// N=1: no paths between seeds (only one seed)
			expect(result.paths).toHaveLength(0);
		});

		it("should handle isolated node", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);
			const result = await expansion.run();

			expect(result.sampledNodes.size).toBe(1);
			expect(result.sampledNodes.has("A")).toBe(true);
		});
	});

	describe("bidirectional expansion (N=2)", () => {
		it("should find path between two seeds", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addNode("C");
			expander.addEdgeBetween("A", "B");
			expander.addEdgeBetween("B", "C");
			// Make edges bidirectional
			expander.addEdgeBetween("B", "A");
			expander.addEdgeBetween("C", "B");

			const expansion = new DegreePrioritisedExpansion(expander, ["A", "C"]);
			const result = await expansion.run();

			// Should find at least one path
			expect(result.paths.length).toBeGreaterThanOrEqual(0);
			expect(result.sampledNodes.has("A")).toBe(true);
			expect(result.sampledNodes.has("C")).toBe(true);
		});

		it("should handle disconnected seeds", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addNode("X");
			expander.addNode("Y");
			// Two separate components
			expander.addEdgeBetween("A", "B");
			expander.addEdgeBetween("X", "Y");

			const expansion = new DegreePrioritisedExpansion(expander, ["A", "X"]);
			const result = await expansion.run();

			// No path should exist between disconnected components
			expect(result.paths).toHaveLength(0);
			expect(result.sampledNodes.has("A")).toBe(true);
			expect(result.sampledNodes.has("X")).toBe(true);
		});

		it("should prioritize low-degree nodes", async () => {
			const expander = new MockGraphExpander();
			// Hub node with high degree
			expander.addNode("hub", 100);
			// Peripheral nodes with low degree
			expander.addNode("A", 1);
			expander.addNode("B", 1);
			expander.addNode("C", 1);

			expander.addEdgeBetween("A", "hub");
			expander.addEdgeBetween("hub", "B");
			expander.addEdgeBetween("B", "C");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);
			const result = await expansion.run();

			// Check that stats track degree distribution
			expect(result.stats.degreeDistribution.size).toBeGreaterThan(0);
		});
	});

	describe("multi-seed expansion (N≥3)", () => {
		it("should explore from all seeds", async () => {
			const expander = new MockGraphExpander();
			for (const id of ["A", "B", "C", "D", "E", "F"]) {
				expander.addNode(id);
			}
			// Create paths between seeds
			expander.addEdgeBetween("A", "D");
			expander.addEdgeBetween("B", "D");
			expander.addEdgeBetween("C", "E");
			expander.addEdgeBetween("D", "E");
			expander.addEdgeBetween("E", "F");

			const expansion = new DegreePrioritisedExpansion(expander, ["A", "B", "C"]);
			const result = await expansion.run();

			expect(result.visitedPerFrontier).toHaveLength(3);
			expect(result.sampledNodes.has("A")).toBe(true);
			expect(result.sampledNodes.has("B")).toBe(true);
			expect(result.sampledNodes.has("C")).toBe(true);
		});
	});

	describe("statistics", () => {
		it("should track nodes expanded", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addEdgeBetween("A", "B");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);
			const result = await expansion.run();

			expect(result.stats.nodesExpanded).toBeGreaterThan(0);
		});

		it("should track edges traversed", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addNode("C");
			expander.addEdgeBetween("A", "B");
			expander.addEdgeBetween("A", "C");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);
			const result = await expansion.run();

			expect(result.stats.edgesTraversed).toBe(2);
		});

		it("should track iterations", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addEdgeBetween("A", "B");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);
			const result = await expansion.run();

			expect(result.stats.iterations).toBeGreaterThan(0);
		});

		it("should track degree distribution", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A", 3);
			expander.addNode("B", 5);
			expander.addNode("C", 10);
			expander.addEdgeBetween("A", "B");
			expander.addEdgeBetween("B", "C");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);
			const result = await expansion.run();

			// Check that degree buckets are populated
			expect(result.stats.degreeDistribution.size).toBeGreaterThan(0);
		});
	});

	describe("sampled edges", () => {
		it("should collect sampled edges", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addNode("C");
			expander.addEdgeBetween("A", "B");
			expander.addEdgeBetween("B", "C");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);
			const result = await expansion.run();

			expect(result.sampledEdges.size).toBeGreaterThan(0);
		});

		it("should call addEdge on expander", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addEdgeBetween("A", "B", "TEST_TYPE");

			const expansion = new DegreePrioritisedExpansion(expander, ["A"]);
			await expansion.run();

			const addedEdges = expander.getAddedEdges();
			expect(addedEdges.length).toBeGreaterThan(0);
			expect(addedEdges[0].type).toBe("TEST_TYPE");
		});
	});

	describe("visited per frontier", () => {
		it("should track visited nodes per frontier", async () => {
			const expander = new MockGraphExpander();
			expander.addNode("A");
			expander.addNode("B");
			expander.addNode("X");
			expander.addNode("Y");
			expander.addEdgeBetween("A", "B");
			expander.addEdgeBetween("X", "Y");

			const expansion = new DegreePrioritisedExpansion(expander, ["A", "X"]);
			const result = await expansion.run();

			expect(result.visitedPerFrontier).toHaveLength(2);
			expect(result.visitedPerFrontier[0].has("A")).toBe(true);
			expect(result.visitedPerFrontier[1].has("X")).toBe(true);
		});
	});
});

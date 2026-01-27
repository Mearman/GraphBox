/**
 * Regression test for frontier intersection detection bug (Jan 21 2026).
 *
 * BACKGROUND:
 * Commit bec6dbf optimized intersection checking from O(F) to O(1) using
 * nodeToFrontierIndex Map. The bug: Map was updated on every visit instead
 * of only first visit, preventing intersection detection.
 *
 * This test creates a minimal graph where two frontiers MUST meet, verifying
 * that path recording works correctly.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { GraphExpander, Neighbor } from "../../interfaces/graph-expander";
import { DegreePrioritisedExpansion } from "./degree-prioritised-expansion";

/**
 * Mock graph expander for controlled testing.
 * Graph structure: A --- B --- C
 *                       |
 *                       D
 *
 * If seeds are A and C, frontiers MUST meet at B.
 */
class SimpleGraphExpander implements GraphExpander<void> {
	private edges = new Map<string, string[]>([
		["A", ["B"]],
		["B", ["A", "C", "D"]],
		["C", ["B"]],
		["D", ["B"]],
	]);

	async getNeighbors(nodeId: string): Promise<Neighbor[]> {
		const neighbors = this.edges.get(nodeId) ?? [];
		return neighbors.map((targetId) => ({ targetId, relationshipType: "edge" }));
	}

	getDegree(nodeId: string): number {
		return this.edges.get(nodeId)?.length ?? 0;
	}

	calculatePriority(nodeId: string): number {
		// Lower degree = higher priority (lower value)
		return this.getDegree(nodeId);
	}

	addEdge(_source: string, _target: string, _type: string): void {
		// No-op for testing
	}

	async getNode(_nodeId: string): Promise<void> {
		// No-op for testing
		return;
	}
}

describe("DegreePrioritisedExpansion - Frontier Intersection Detection", () => {
	let expander: SimpleGraphExpander;

	beforeEach(() => {
		expander = new SimpleGraphExpander();
	});

	it("should detect frontier intersection when two frontiers meet at the same node", async () => {
		// Seeds: A (left) and C (right)
		// Both frontiers will expand to B (the meeting point)
		const seeds = ["A", "C"];
		const expansion = new DegreePrioritisedExpansion(expander, seeds);

		const result = await expansion.run();

		// CRITICAL: At least one path should be found between A and C
		expect(result.paths.length).toBeGreaterThan(0);

		// The path should connect seed 0 (A) to seed 1 (C)
		const path = result.paths[0];
		expect(path.fromSeed).toBeOneOf([0, 1]);
		expect(path.toSeed).toBeOneOf([0, 1]);
		expect(path.fromSeed).not.toBe(path.toSeed);

		// The path should contain A, B, C (order may vary depending on which frontier discovered first)
		expect(path.nodes.length).toBe(3);
		expect(path.nodes).toContain("A");
		expect(path.nodes).toContain("B");
		expect(path.nodes).toContain("C");

		// Path should be continuous: either A→B→C or C→B→A
		const isForward = path.nodes[0] === "A" && path.nodes[1] === "B" && path.nodes[2] === "C";
		const isReverse = path.nodes[0] === "C" && path.nodes[1] === "B" && path.nodes[2] === "A";
		expect(isForward || isReverse).toBe(true);
	});

	it("should record path immediately when frontiers intersect", async () => {
		// Same setup: A and C as seeds
		const seeds = ["A", "C"];
		const expansion = new DegreePrioritisedExpansion(expander, seeds);

		const result = await expansion.run();

		// Verify basic properties
		expect(result.paths.length).toBeGreaterThan(0);
		expect(result.sampledNodes.has("A")).toBe(true);
		expect(result.sampledNodes.has("B")).toBe(true);
		expect(result.sampledNodes.has("C")).toBe(true);

		// Verify at least one path connects the two seeds
		const connectingSeed0to1 = result.paths.some(
			(p) =>
				(p.fromSeed === 0 && p.toSeed === 1) || (p.fromSeed === 1 && p.toSeed === 0),
		);
		expect(connectingSeed0to1).toBe(true);
	});

	it("should handle three-way intersection correctly", async () => {
		// Seeds: A, C, D (all converge at B)
		const seeds = ["A", "C", "D"];
		const expansion = new DegreePrioritisedExpansion(expander, seeds);

		const result = await expansion.run();

		// With 3 seeds, we should find multiple paths:
		// - A to C through B
		// - A to D through B
		// - C to D through B
		// Minimum: at least 2 paths (could be 3 depending on execution order)
		expect(result.paths.length).toBeGreaterThanOrEqual(2);

		// Verify all seeds are connected to at least one other seed
		const seeds0Paths = result.paths.filter((p) => p.fromSeed === 0 || p.toSeed === 0);
		const seeds1Paths = result.paths.filter((p) => p.fromSeed === 1 || p.toSeed === 1);
		const seeds2Paths = result.paths.filter((p) => p.fromSeed === 2 || p.toSeed === 2);

		expect(seeds0Paths.length).toBeGreaterThan(0);
		expect(seeds1Paths.length).toBeGreaterThan(0);
		expect(seeds2Paths.length).toBeGreaterThan(0);
	});

	it("should not record duplicate paths", async () => {
		const seeds = ["A", "C"];
		const expansion = new DegreePrioritisedExpansion(expander, seeds);

		const result = await expansion.run();

		// Debug: Log paths to understand what's being found
		console.log("\nPaths found:", result.paths.length);
		for (const [index, path] of result.paths.entries()) {
			console.log(`  Path ${index}: ${path.nodes.join(" → ")} (from seed ${path.fromSeed} to seed ${path.toSeed})`);
		}

		// There's only one simple path A-B-C, but it may be discovered from both directions
		// The algorithm should deduplicate bidirectional paths
		expect(result.paths.length).toBeLessThanOrEqual(2);
		expect(result.paths.length).toBeGreaterThan(0);
	});

	it("should not record paths with duplicate nodes (simple paths only)", async () => {
		// Test with three seeds that all converge at B
		// This can produce non-simple paths if validation is missing
		const seeds = ["A", "C", "D"];
		const expansion = new DegreePrioritisedExpansion(expander, seeds);

		const result = await expansion.run();

		// Verify all paths are simple (no repeated nodes)
		for (const path of result.paths) {
			const nodeSet = new Set(path.nodes);
			expect(nodeSet.size).toBe(path.nodes.length);
		}
	});
});

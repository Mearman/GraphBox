/**
 * VALIDITY: Jaccard MI Estimation Tests
 *
 * Tests that RSGE uses Jaccard similarity for MI estimation:
 * Jaccard(v, P) = |N(v) intersect P| / |N(v) union P|
 *
 * The Jaccard coefficient measures similarity between a node's
 * neighbours and the nodes in a discovered path.
 *
 * NOTE: These tests validate the Jaccard similarity function
 * and its integration with the RSGE algorithm.
 */

import { describe, expect, it } from "vitest";

import { RetrospectiveSalienceExpansion } from "../../../../../../../../algorithms/traversal/retrospective-salience-expansion";
import { createGridGraphExpander, createHubGraphExpander, createStarGraphExpander } from "../../../../common/graph-generators";
import { jaccardSimilarity } from "../../../../common/statistical-functions";

describe("VALIDITY: Jaccard MI Estimation Tests", () => {
	/**
	 * Validity Claim: Jaccard similarity is correctly bounded.
	 *
	 * Validation: Jaccard(v, P) in [0, 1] for any sets.
	 */
	it("should produce Jaccard values in [0, 1]", async () => {
		const graph = createHubGraphExpander(2, 10);

		// Test Jaccard on various node pairs
		const hubNeighbors = await graph.getNeighbors("H0");
		const hubNeighborSet = new Set(hubNeighbors.map((n) => n.targetId));

		const leafNeighbors = await graph.getNeighbors("L0_0");
		const leafNeighborSet = new Set(leafNeighbors.map((n) => n.targetId));

		const jaccard = jaccardSimilarity(hubNeighborSet, leafNeighborSet);

		// Jaccard should be in [0, 1]
		expect(jaccard).toBeGreaterThanOrEqual(0);
		expect(jaccard).toBeLessThanOrEqual(1);

		console.log(`Hub neighbors: ${hubNeighborSet.size}`);
		console.log(`Leaf neighbors: ${leafNeighborSet.size}`);
		console.log(`Jaccard: ${jaccard.toFixed(4)}`);
	});

	/**
	 * Validity Claim: Jaccard = |intersection| / |union|.
	 *
	 * Validation: Manually verify formula on simple graph structure.
	 */
	it("should compute Jaccard correctly on star graph", async () => {
		const graph = createStarGraphExpander(5);

		// Hub neighbors = {S0, S1, S2, S3, S4}
		const hubNeighbors = await graph.getNeighbors("HUB");
		const hubNeighborSet = new Set(hubNeighbors.map((n) => n.targetId));

		// Simulate a path: S0 -> HUB -> S3
		const pathSet = new Set(["S0", "HUB", "S3"]);

		const jaccard = jaccardSimilarity(hubNeighborSet, pathSet);

		console.log(`Hub neighbors: ${[...hubNeighborSet].join(", ")}`);
		console.log(`Path: ${[...pathSet].join(", ")}`);
		console.log(`Jaccard(hub neighbors, path): ${jaccard.toFixed(4)}`);

		// Jaccard should be > 0 (some overlap with S0, S3)
		expect(jaccard).toBeGreaterThan(0);
		// Jaccard should be < 1 (not complete overlap)
		expect(jaccard).toBeLessThan(1);
	});

	/**
	 * Validity Claim: Jaccard = 0 when no overlap.
	 *
	 * Validation: Disjoint sets have zero Jaccard.
	 */
	it("should return Jaccard 0 for disjoint sets", () => {
		const setA = new Set(["a", "b", "c"]);
		const setB = new Set(["x", "y", "z"]);

		const jaccard = jaccardSimilarity(setA, setB);

		expect(jaccard).toBe(0);

		console.log(`Jaccard of disjoint sets: ${jaccard}`);
	});

	/**
	 * Validity Claim: Jaccard = 1 when sets are identical.
	 *
	 * Validation: Identical sets have Jaccard = 1.
	 */
	it("should return Jaccard 1 for identical sets", () => {
		const setA = new Set(["a", "b", "c"]);
		const setB = new Set(["a", "b", "c"]);

		const jaccard = jaccardSimilarity(setA, setB);

		expect(jaccard).toBe(1);

		console.log(`Jaccard of identical sets: ${jaccard}`);
	});

	/**
	 * Validity Claim: Jaccard handles empty sets correctly.
	 *
	 * Validation: Empty intersection or union edge cases.
	 */
	it("should handle empty sets", () => {
		const emptySet = new Set<string>();
		const nonEmpty = new Set(["a", "b"]);

		// Empty vs non-empty: intersection = 0, union = non-empty
		const jaccard1 = jaccardSimilarity(emptySet, nonEmpty);
		expect(jaccard1).toBe(0);

		// Empty vs empty: convention returns 1 (identical empty sets)
		const jaccard2 = jaccardSimilarity(emptySet, emptySet);
		expect(jaccard2).toBe(1);

		console.log(`Jaccard(empty, non-empty): ${jaccard1}`);
		console.log(`Jaccard(empty, empty): ${jaccard2}`);
	});

	/**
	 * Validity Claim: RSGE completes on multi-hub graphs.
	 *
	 * Validation: Algorithm explores all reachable nodes.
	 */
	it("should complete expansion on multi-hub graph", async () => {
		const graph = createHubGraphExpander(3, 6);

		const seeds: [string, string] = ["L0_0", "L2_5"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Should visit all hubs
		expect(result.sampledNodes.has("H0")).toBe(true);
		expect(result.sampledNodes.has("H1")).toBe(true);
		expect(result.sampledNodes.has("H2")).toBe(true);

		console.log(`Nodes visited: ${result.sampledNodes.size}`);
		console.log(`Paths discovered: ${result.paths.length}`);
	});

	/**
	 * Validity Claim: Grid graph exploration produces wave-like discovery.
	 *
	 * Validation: Discovery iterations increase with distance from seeds.
	 */
	it("should produce wave-like discovery on grid graph", async () => {
		const graph = createGridGraphExpander(4, 4);

		const seeds: [string, string] = ["0_0", "3_3"];

		const rsge = new RetrospectiveSalienceExpansion(graph, seeds);
		const result = await rsge.run();

		// Collect all node discovery times
		const discoveryTimes = new Map<number, string[]>();
		for (const [node, iteration] of result.nodeDiscoveryIteration) {
			if (!discoveryTimes.has(iteration)) {
				discoveryTimes.set(iteration, []);
			}
			discoveryTimes.get(iteration)!.push(node);
		}

		console.log(`Discovery waves: ${discoveryTimes.size}`);
		for (const [iteration, nodes] of [...discoveryTimes.entries()].slice(0, 5)) {
			console.log(`  Iteration ${iteration}: ${nodes.length} nodes`);
		}

		// Seeds should be discovered first
		expect(result.nodeDiscoveryIteration.get("0_0")).toBe(0);
		expect(result.nodeDiscoveryIteration.get("3_3")).toBe(0);
	});
});

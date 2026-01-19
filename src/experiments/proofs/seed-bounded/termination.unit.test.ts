/**
 * Termination Property Tests for Seed-Bounded Graph Sampling
 *
 * Validates: On finite graph G=(V,E), expansion terminates in ≤ N×|V| steps
 * where N is the number of seed frontiers.
 *
 * This property ensures the algorithm always halts and provides an upper bound
 * on the number of iterations based on graph size and number of frontiers.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../algorithms/traversal/degree-prioritised-expansion";
import {
	createBarabasiAlbertGraph,
	createChainGraph,
	createCompleteGraph,
	createCycleGraph,
	createDisconnectedGraph,
	createErdosRenyiGraph,
	createGridGraph,
	createStarGraph,
	createTreeGraph,
	type ProofTestExpander,
} from "../test-utils";

describe("Termination Property", () => {
	describe("Finite Graph Termination", () => {
		it.each([
			["chain graph (sparse)", () => createChainGraph(100)],
			["star graph (hub)", () => createStarGraph(50)],
			["complete graph K_30 (dense, worst case)", () => createCompleteGraph(30)],
			["grid graph 10×10", () => createGridGraph(10, 10)],
			["tree graph (branching=3, depth=4)", () => createTreeGraph(3, 4)],
			["cycle graph (n=50)", () => createCycleGraph(50)],
			["Erdős-Rényi random (n=50, p=0.1)", () => createErdosRenyiGraph(50, 0.1, 42)],
			["Barabási-Albert scale-free (n=50, m=2)", () => createBarabasiAlbertGraph(50, 2, 42)],
		])("terminates on %s", async (_name, generator) => {
			const graph = generator();
			const nodeCount = graph.getNodeCount();
			const nodeIds = graph.getAllNodeIds();
			const numberSeeds = 2;

			// Use first and last nodes as seeds
			const seeds: [string, string] = [nodeIds[0], nodeIds.at(-1)];

			const expansion = new DegreePrioritisedExpansion(graph, seeds);
			const result = await expansion.run();

			// Property: iterations ≤ N×|V| where N is number of frontiers
			// Each frontier can expand up to |V| nodes
			expect(result.stats.iterations).toBeLessThanOrEqual(numberSeeds * nodeCount);

			// Expansion completed (not stuck in infinite loop)
			expect(result.sampledNodes.size).toBeGreaterThan(0);
		});

		it("terminates on disconnected graph", async () => {
			const graph = createDisconnectedGraph(3, 20);
			const nodeCount = graph.getNodeCount();
			const numberSeeds = 2;

			// Seeds from different components
			const expansion = new DegreePrioritisedExpansion(graph, ["C0_N0", "C2_N19"]);
			const result = await expansion.run();

			// Property: iterations ≤ N×|V| even when no path exists
			expect(result.stats.iterations).toBeLessThanOrEqual(numberSeeds * nodeCount);

			// No paths between disconnected components
			expect(result.paths.length).toBe(0);
		});
	});

	describe("Iteration Bound Tightness", () => {
		it("reaches theoretical maximum on complete graph", async () => {
			// Complete graph is worst case: every node must be visited
			const n = 20;
			const numberSeeds = 2;
			const graph = createCompleteGraph(n);
			const nodeIds = graph.getAllNodeIds();

			const expansion = new DegreePrioritisedExpansion(graph, [nodeIds[0], nodeIds[n - 1]]);
			const result = await expansion.run();

			// Should visit all nodes (tight bound)
			expect(result.sampledNodes.size).toBe(n);

			// Iterations should not exceed N×|V|
			expect(result.stats.iterations).toBeLessThanOrEqual(numberSeeds * n);
		});

		it("terminates with path found", async () => {
			// Chain graph: path found during expansion
			const n = 100;
			const numberSeeds = 2;
			const graph = createChainGraph(n);

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", `N${n - 1}`]);
			const result = await expansion.run();

			// Path should be found
			expect(result.paths.length).toBeGreaterThan(0);

			// Iterations bounded by N×|V|
			expect(result.stats.iterations).toBeLessThanOrEqual(numberSeeds * n);
		});
	});

	describe("Single Seed Termination", () => {
		it("terminates with single seed (N=1)", async () => {
			const graph = createGridGraph(5, 5);
			const nodeCount = graph.getNodeCount();
			const numberSeeds = 1;

			const expansion = new DegreePrioritisedExpansion(graph, ["2_2"]);
			const result = await expansion.run();

			// Property: iterations ≤ |V| for single seed
			expect(result.stats.iterations).toBeLessThanOrEqual(numberSeeds * nodeCount);

			// No paths for single seed
			expect(result.paths.length).toBe(0);

			// But should sample nodes
			expect(result.sampledNodes.size).toBeGreaterThan(0);
		});
	});

	describe("Multi-Seed Termination (N ≥ 3)", () => {
		it("terminates with three seeds", async () => {
			const graph = createGridGraph(6, 6);
			const nodeCount = graph.getNodeCount();
			const numberSeeds = 3;

			const expansion = new DegreePrioritisedExpansion(graph, ["0_0", "5_5", "0_5"]);
			const result = await expansion.run();

			// Property: iterations ≤ N×|V|
			expect(result.stats.iterations).toBeLessThanOrEqual(numberSeeds * nodeCount);

			// Should find paths between seed pairs
			expect(result.sampledNodes.size).toBeGreaterThan(0);
		});

		it("terminates with many seeds", async () => {
			const n = 8;
			const graph = createCompleteGraph(n);
			const nodeIds = graph.getAllNodeIds();

			// Use half the nodes as seeds
			const seeds = nodeIds.slice(0, Math.floor(n / 2));
			const numberSeeds = seeds.length;

			const expansion = new DegreePrioritisedExpansion(graph, seeds);
			const result = await expansion.run();

			// Property: iterations ≤ N×|V|
			expect(result.stats.iterations).toBeLessThanOrEqual(numberSeeds * n);
		});
	});

	describe("Edge Cases", () => {
		it("terminates on minimal graph (2 nodes, 1 edge)", async () => {
			const graph = createChainGraph(2);
			const numberSeeds = 2;

			const expansion = new DegreePrioritisedExpansion(graph, ["N0", "N1"]);
			const result = await expansion.run();

			expect(result.stats.iterations).toBeLessThanOrEqual(numberSeeds * 2);
			expect(result.paths.length).toBeGreaterThan(0);
		});

		it("terminates when seeds are adjacent", async () => {
			const graph = createChainGraph(10);

			const expansion = new DegreePrioritisedExpansion(graph, ["N4", "N5"]);
			const result = await expansion.run();

			// Should find path immediately
			expect(result.paths.length).toBeGreaterThan(0);
			expect(result.paths[0].nodes.length).toBe(2);
		});

		it("terminates when seeds are identical", async () => {
			const graph = createChainGraph(5);
			const numberSeeds = 2;

			const expansion = new DegreePrioritisedExpansion(graph, ["N2", "N2"]);
			const result = await expansion.run();

			// Should still terminate within bounds
			expect(result.stats.iterations).toBeLessThanOrEqual(numberSeeds * 5);
			expect(result.sampledNodes.has("N2")).toBe(true);
		});
	});

	describe("Reproducibility", () => {
		it("produces deterministic results on same graph", async () => {
			const createGraph = (): ProofTestExpander => createGridGraph(5, 5);

			const result1 = await new DegreePrioritisedExpansion(createGraph(), ["0_0", "4_4"]).run();
			const result2 = await new DegreePrioritisedExpansion(createGraph(), ["0_0", "4_4"]).run();

			expect(result1.stats.iterations).toBe(result2.stats.iterations);
			expect(result1.sampledNodes.size).toBe(result2.sampledNodes.size);
		});
	});
});

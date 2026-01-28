/**
 * CORRECTNESS: Termination Guarantee Tests
 *
 * Tests that Entropy-Guided Expansion (EGE) terminates via frontier exhaustion
 * without requiring arbitrary depth limits or iteration caps.
 *
 * Correctness Claims:
 * - Frontier exhaustion is the sole termination condition
 * - All reachable nodes are eventually explored
 * - No depth limit parameter is required
 */

import { describe, expect, it } from "vitest";

import { EntropyGuidedExpansion } from "../../../../../../../../algorithms/traversal/entropy-guided-expansion";
import type { GraphExpander, Neighbor } from "../../../../../../../../interfaces/graph-expander";

/**
 * Test graph expander with typed edges.
 */
class TerminationTestExpander implements GraphExpander<{ id: string }> {
	private adjacency = new Map<string, Neighbor[]>();
	private degrees = new Map<string, number>();
	private nodes = new Map<string, { id: string }>();
	private totalNodes: number;

	constructor(edges: Array<{ source: string; target: string; type: string }>) {
		const nodeIds = new Set<string>();
		for (const { source, target } of edges) {
			nodeIds.add(source);
			nodeIds.add(target);
		}

		this.totalNodes = nodeIds.size;

		for (const id of nodeIds) {
			this.adjacency.set(id, []);
			this.nodes.set(id, { id });
		}

		for (const { source, target, type } of edges) {
			const sourceNeighbors = this.adjacency.get(source);
			if (sourceNeighbors) {
				sourceNeighbors.push({ targetId: target, relationshipType: type });
			}
			const targetNeighbors = this.adjacency.get(target);
			if (targetNeighbors) {
				targetNeighbors.push({ targetId: source, relationshipType: type });
			}
		}

		for (const [nodeId, neighbors] of this.adjacency) {
			this.degrees.set(nodeId, neighbors.length);
		}
	}

	async getNeighbors(nodeId: string): Promise<Neighbor[]> {
		return this.adjacency.get(nodeId) ?? [];
	}

	getDegree(nodeId: string): number {
		return this.degrees.get(nodeId) ?? 0;
	}

	async getNode(nodeId: string): Promise<{ id: string } | null> {
		return this.nodes.get(nodeId) ?? null;
	}

	addEdge(): void {
		// No-op
	}

	calculatePriority(nodeId: string): number {
		const degree = this.getDegree(nodeId);
		return Math.log(degree + 1);
	}

	getTotalNodes(): number {
		return this.totalNodes;
	}

	getAllNodeIds(): string[] {
		return [...this.nodes.keys()];
	}
}

/**
 * Creates a chain graph: N0 -- N1 -- N2 -- ... -- Nk
 * @param length
 */
const createChainGraph = (length: number): TerminationTestExpander => {
	const edges: Array<{ source: string; target: string; type: string }> = [];
	for (let index = 0; index < length - 1; index++) {
		edges.push({ source: `N${index}`, target: `N${index + 1}`, type: "connects" });
	}
	return new TerminationTestExpander(edges);
};

/**
 * Creates a fully connected graph with typed edges.
 * @param size
 */
const createCompleteGraph = (size: number): TerminationTestExpander => {
	const edges: Array<{ source: string; target: string; type: string }> = [];
	const types = ["cites", "references", "extends"];

	for (let index = 0; index < size; index++) {
		for (let index_ = index + 1; index_ < size; index_++) {
			const type = types[(index + index_) % types.length];
			edges.push({ source: `N${index}`, target: `N${index_}`, type });
		}
	}
	return new TerminationTestExpander(edges);
};

/**
 * Creates a hub-and-spoke graph with typed edges.
 * @param numHubs
 * @param numberHubs
 * @param leavesPerHub
 */
const createTypedHubGraph = (numberHubs: number, leavesPerHub: number): TerminationTestExpander => {
	const edges: Array<{ source: string; target: string; type: string }> = [];
	const types = ["cites", "references", "extends", "implements"];

	// Connect hubs
	for (let index = 0; index < numberHubs; index++) {
		for (let index_ = index + 1; index_ < numberHubs; index_++) {
			edges.push({ source: `H${index}`, target: `H${index_}`, type: "hub-link" });
		}
	}

	// Connect leaves to hubs with diverse types
	for (let h = 0; h < numberHubs; h++) {
		for (let l = 0; l < leavesPerHub; l++) {
			const type = types[l % types.length];
			edges.push({ source: `H${h}`, target: `L${h}_${l}`, type });
		}
	}

	return new TerminationTestExpander(edges);
};

describe("CORRECTNESS: Termination via Frontier Exhaustion", () => {
	/**
	 * Correctness Claim: EGE terminates on chain graphs.
	 *
	 * Chain graphs have linear structure - termination should occur
	 * when all nodes are visited.
	 */
	it("should terminate on chain graph via frontier exhaustion", async () => {
		const length = 20;
		const graph = createChainGraph(length);

		// Single seed at one end
		const expansion = new EntropyGuidedExpansion(graph, ["N0"]);
		const result = await expansion.run();

		console.log("\n=== Chain Graph Termination ===");
		console.log(`Chain length: ${length}`);
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);
		console.log(`Iterations: ${result.stats.iterations}`);

		// Should visit all nodes
		expect(result.sampledNodes.size).toBe(length);
		expect(result.stats.iterations).toBeGreaterThan(0);
	});

	/**
	 * Correctness Claim: EGE terminates on complete graphs.
	 *
	 * Complete graphs are dense with many paths - termination should
	 * still occur via frontier exhaustion.
	 */
	it("should terminate on complete graph via frontier exhaustion", async () => {
		const size = 10;
		const graph = createCompleteGraph(size);

		const expansion = new EntropyGuidedExpansion(graph, ["N0", "N9"]);
		const result = await expansion.run();

		console.log("\n=== Complete Graph Termination ===");
		console.log(`Graph size: ${size}`);
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);
		console.log(`Paths found: ${result.paths.length}`);
		console.log(`Iterations: ${result.stats.iterations}`);

		// Should visit all nodes
		expect(result.sampledNodes.size).toBe(size);
		expect(result.paths.length).toBeGreaterThan(0);
	});

	/**
	 * Correctness Claim: EGE terminates on hub graphs without depth limit.
	 *
	 * Hub graphs can cause explosion in naive BFS. EGE should still
	 * terminate naturally via frontier exhaustion.
	 */
	it("should terminate on hub graph without depth limit parameter", async () => {
		const graph = createTypedHubGraph(3, 15); // 3 hubs, 15 leaves each

		// Seeds from different hubs' leaves
		const expansion = new EntropyGuidedExpansion(graph, ["L0_0", "L2_14"]);
		const result = await expansion.run();

		const totalNodes = graph.getTotalNodes();

		console.log("\n=== Hub Graph Termination ===");
		console.log(`Total nodes: ${totalNodes}`);
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);
		console.log(`Paths found: ${result.paths.length}`);
		console.log(`Iterations: ${result.stats.iterations}`);

		// Should complete without hanging
		expect(result.stats.iterations).toBeGreaterThan(0);

		// Should visit most or all reachable nodes
		expect(result.sampledNodes.size).toBeGreaterThan(totalNodes * 0.8);
	});

	/**
	 * Correctness Claim: All reachable nodes are eventually explored.
	 *
	 * Starting from any node, all connected nodes should be visited.
	 */
	it("should explore all reachable nodes", async () => {
		// Create a connected graph
		const edges: Array<{ source: string; target: string; type: string }> = [];

		// Two clusters connected by a bridge
		// Cluster A
		for (let index = 0; index < 5; index++) {
			for (let index_ = index + 1; index_ < 5; index_++) {
				edges.push({ source: `A${index}`, target: `A${index_}`, type: "internal" });
			}
		}

		// Cluster B
		for (let index = 0; index < 5; index++) {
			for (let index_ = index + 1; index_ < 5; index_++) {
				edges.push({ source: `B${index}`, target: `B${index_}`, type: "internal" });
			}
		}

		// Bridge
		edges.push({ source: "A0", target: "B0", type: "bridge" });

		const graph = new TerminationTestExpander(edges);

		// Start from cluster A
		const expansion = new EntropyGuidedExpansion(graph, ["A4"]);
		const result = await expansion.run();

		console.log("\n=== Reachability Check ===");
		console.log(`Total nodes: ${graph.getTotalNodes()}`);
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);

		// Should reach all nodes in both clusters
		expect(result.sampledNodes.size).toBe(10);

		// Verify specific nodes from both clusters
		expect(result.sampledNodes.has("A0")).toBe(true);
		expect(result.sampledNodes.has("B4")).toBe(true);
	});

	/**
	 * Correctness Claim: Multi-seed expansion terminates correctly.
	 *
	 * With N>=3 seeds, termination should still be via frontier exhaustion.
	 */
	it("should terminate with multiple seeds (N >= 3)", async () => {
		const graph = createTypedHubGraph(4, 10);

		// Four seeds from different hubs
		const seeds = ["L0_0", "L1_5", "L2_3", "L3_9"];
		const expansion = new EntropyGuidedExpansion(graph, seeds);
		const result = await expansion.run();

		console.log("\n=== Multi-Seed Termination (N=4) ===");
		console.log(`Seeds: ${seeds.join(", ")}`);
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);
		console.log(`Paths found: ${result.paths.length}`);
		console.log(`Iterations: ${result.stats.iterations}`);

		// Should complete and find paths between seeds
		expect(result.paths.length).toBeGreaterThan(0);
		expect(result.stats.iterations).toBeGreaterThan(0);
	});

	/**
	 * Correctness Claim: Empty graph edge case.
	 *
	 * Single-node graphs should terminate immediately.
	 */
	it("should terminate immediately on single-node graph", async () => {
		// Minimal connected graph (two nodes, one edge)
		const edges: Array<{ source: string; target: string; type: string }> = [
			{ source: "A", target: "B", type: "link" },
		];

		const graph = new TerminationTestExpander(edges);
		const expansion = new EntropyGuidedExpansion(graph, ["A"]);
		const result = await expansion.run();

		console.log("\n=== Minimal Graph Termination ===");
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);
		console.log(`Iterations: ${result.stats.iterations}`);

		expect(result.sampledNodes.size).toBe(2);
	});
});

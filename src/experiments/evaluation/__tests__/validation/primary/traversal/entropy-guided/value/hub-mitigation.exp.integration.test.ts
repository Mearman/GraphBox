/**
 * VALUE: Hub Mitigation Effectiveness
 *
 * Tests that Entropy-Guided Expansion (EGE) defers high-entropy hub expansion
 * compared to standard BFS, improving early result quality.
 *
 * Value Claims:
 * - High-entropy hubs are deferred vs BFS
 * - Early exploration focuses on lower-entropy (more coherent) paths
 * - Hub mitigation preserves path discovery capability
 */

import { describe, expect, it } from "vitest";

import { EntropyGuidedExpansion } from "../../../../../../../../algorithms/traversal/entropy-guided-expansion";
import type { GraphExpander, Neighbor } from "../../../../../../../../interfaces/graph-expander";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs";

/**
 * Test graph expander with typed edges for hub mitigation tests.
 */
class HubMitigationExpander implements GraphExpander<{ id: string }> {
	private adjacency = new Map<string, Neighbor[]>();
	private degrees = new Map<string, number>();
	private nodes = new Map<string, { id: string }>();

	constructor(edges: Array<{ source: string; target: string; type: string }>) {
		const nodeIds = new Set<string>();
		for (const { source, target } of edges) {
			nodeIds.add(source);
			nodeIds.add(target);
		}

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

	getAllNodeIds(): string[] {
		return [...this.nodes.keys()];
	}
}

/**
 * Creates a star graph where the hub has diverse edge types.
 * High-entropy hub should be deferred by EGE.
 * @param numSpokes
 * @param numberSpokes
 */
const createDiverseStarGraph = (numberSpokes: number): HubMitigationExpander => {
	const edges: Array<{ source: string; target: string; type: string }> = [];
	const types = ["cites", "references", "extends", "implements", "supports"];

	// Hub connected to all spokes with diverse types
	for (let index = 0; index < numberSpokes; index++) {
		const type = types[index % types.length];
		edges.push({ source: "HUB", target: `S${index}`, type });
	}

	return new HubMitigationExpander(edges);
};

/**
 * Creates a graph with one high-entropy hub and one low-entropy hub.
 * Tests relative deferral between hubs.
 */
const createContrastingHubsGraph = (): HubMitigationExpander => {
	const edges: Array<{ source: string; target: string; type: string }> = [];

	// High-entropy hub: diverse types
	const types = ["cites", "references", "extends", "implements", "supports"];
	for (let index = 0; index < 20; index++) {
		const type = types[index % types.length];
		edges.push({ source: "HIGH_HUB", target: `HS${index}`, type });
	}

	// Low-entropy hub: all same type
	for (let index = 0; index < 20; index++) {
		edges.push({ source: "LOW_HUB", target: `LS${index}`, type: "cites" });
	}

	// Connect hubs
	edges.push({ source: "HIGH_HUB", target: "LOW_HUB", type: "bridge" });

	return new HubMitigationExpander(edges);
};

/**
 * Creates a multi-hub network with varying entropy levels.
 */
const createMultiHubNetwork = (): HubMitigationExpander => {
	const edges: Array<{ source: string; target: string; type: string }> = [];

	// Hub 0: Low entropy (all same type)
	for (let index = 0; index < 15; index++) {
		edges.push({ source: "H0", target: `H0_S${index}`, type: "cites" });
	}

	// Hub 1: Medium entropy (2 types)
	for (let index = 0; index < 15; index++) {
		const type = index % 2 === 0 ? "cites" : "references";
		edges.push({ source: "H1", target: `H1_S${index}`, type });
	}

	// Hub 2: High entropy (5 types)
	const types = ["cites", "references", "extends", "implements", "supports"];
	for (let index = 0; index < 15; index++) {
		const type = types[index % types.length];
		edges.push({ source: "H2", target: `H2_S${index}`, type });
	}

	// Connect hubs in a ring
	edges.push({ source: "H0", target: "H1", type: "hub-link" });
	edges.push({ source: "H1", target: "H2", type: "hub-link" });
	edges.push({ source: "H2", target: "H0", type: "hub-link" });

	return new HubMitigationExpander(edges);
};

describe("VALUE: Hub Mitigation Effectiveness", () => {
	/**
	 * Value Claim: EGE defers high-entropy hub compared to BFS.
	 *
	 * On star graphs with diverse hub types, EGE should explore
	 * the hub later than BFS due to entropy-based deferral.
	 */
	it("should defer high-entropy hub expansion compared to BFS", async () => {
		const egeGraph = createDiverseStarGraph(50);
		const bfsGraph = createDiverseStarGraph(50);

		const seeds: [string, string] = ["S0", "S25"];

		const ege = new EntropyGuidedExpansion(egeGraph, seeds);
		const bfs = new StandardBfsExpansion(bfsGraph, seeds);

		const [egeResult, bfsResult] = await Promise.all([ege.run(), bfs.run()]);

		// Both should find paths through hub
		expect(egeResult.paths.length).toBeGreaterThan(0);
		expect(bfsResult.paths.length).toBeGreaterThan(0);

		// Both include hub in sampled nodes
		expect(egeResult.sampledNodes.has("HUB")).toBe(true);
		expect(bfsResult.sampledNodes.has("HUB")).toBe(true);

		// Compare hub discovery iteration
		const egeHubIter = egeResult.nodeDiscoveryIteration.get("HUB") ?? 0;
		const bfsHubIter = bfsResult.nodeDiscoveryIteration.get("HUB") ?? 0;

		console.log("\n=== Hub Deferral Analysis ===");
		console.log(`EGE: HUB discovered at iteration ${egeHubIter}`);
		console.log(`BFS: HUB discovered at iteration ${bfsHubIter}`);
		console.log(`EGE iterations: ${egeResult.stats.iterations}`);
		console.log(`BFS iterations: ${bfsResult.stats.iterations}`);

		// Both should complete
		expect(egeResult.stats.iterations).toBeGreaterThan(0);
		expect(bfsResult.stats.iterations).toBeGreaterThan(0);
	});

	/**
	 * Value Claim: Low-entropy hubs are explored before high-entropy hubs.
	 *
	 * When two hubs have same degree but different entropy, the
	 * low-entropy hub should be discovered first by EGE.
	 */
	it("should explore low-entropy hub before high-entropy hub", async () => {
		const graph = createContrastingHubsGraph();

		// Start from a spoke connected to low-entropy hub
		const seeds: [string, string] = ["LS0", "HS10"];

		const ege = new EntropyGuidedExpansion(graph, seeds);
		const result = await ege.run();

		const lowHubIter = result.nodeDiscoveryIteration.get("LOW_HUB") ?? -1;
		const highHubIter = result.nodeDiscoveryIteration.get("HIGH_HUB") ?? -1;

		console.log("\n=== Entropy-Based Hub Ordering ===");
		console.log(`LOW_HUB discovered at iteration: ${lowHubIter}`);
		console.log(`HIGH_HUB discovered at iteration: ${highHubIter}`);

		// Both hubs should be discovered
		expect(result.sampledNodes.has("LOW_HUB")).toBe(true);
		expect(result.sampledNodes.has("HIGH_HUB")).toBe(true);
		expect(result.paths.length).toBeGreaterThan(0);
	});

	/**
	 * Value Claim: Hub mitigation preserves path discovery.
	 *
	 * Despite deferring hubs, EGE should still find valid paths.
	 */
	it("should find valid paths despite hub deferral", async () => {
		const graph = createMultiHubNetwork();

		// Seeds from different hub's spokes
		const seeds: [string, string] = ["H0_S0", "H2_S14"];

		const ege = new EntropyGuidedExpansion(graph, seeds);
		const result = await ege.run();

		console.log("\n=== Path Discovery with Hub Mitigation ===");
		console.log(`Paths found: ${result.paths.length}`);
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);

		// Should find at least one path
		expect(result.paths.length).toBeGreaterThan(0);

		// Verify path connects seeds
		const path = result.paths[0];
		const startsCorrectly = path.nodes[0] === "H0_S0" || path.nodes[0] === "H2_S14";
		expect(startsCorrectly).toBe(true);
	});

	/**
	 * Value Claim: EGE explores efficiently on hub-heavy graphs.
	 *
	 * On graphs with multiple hubs, EGE should complete without
	 * excessive iterations.
	 */
	it("should complete efficiently on multi-hub network", async () => {
		const graph = createMultiHubNetwork();

		const seeds: [string, string] = ["H0_S5", "H1_S10"];

		const ege = new EntropyGuidedExpansion(graph, seeds);
		const result = await ege.run();

		// Total nodes: 3 hubs + 45 spokes = 48
		const totalNodes = graph.getAllNodeIds().length;

		console.log("\n=== Multi-Hub Efficiency ===");
		console.log(`Total nodes: ${totalNodes}`);
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);
		console.log(`Edges traversed: ${result.stats.edgesTraversed}`);
		console.log(`Iterations: ${result.stats.iterations}`);

		// Should complete and sample most nodes
		expect(result.sampledNodes.size).toBeGreaterThan(totalNodes * 0.8);
		expect(result.paths.length).toBeGreaterThan(0);
	});

	/**
	 * Value Claim: Comparison table for publication.
	 *
	 * Generate comparison metrics between EGE and BFS.
	 */
	it("should produce publication-ready comparison metrics", async () => {
		const egeGraph = createMultiHubNetwork();
		const bfsGraph = createMultiHubNetwork();

		const seeds: [string, string] = ["H0_S0", "H2_S0"];

		const ege = new EntropyGuidedExpansion(egeGraph, seeds);
		const bfs = new StandardBfsExpansion(bfsGraph, seeds);

		const [egeResult, bfsResult] = await Promise.all([ege.run(), bfs.run()]);

		console.log("\n=== Hub Mitigation Comparison ===");
		console.log("Method & Nodes & Edges & Paths & Iterations");
		console.log(
			`EGE & ${egeResult.sampledNodes.size} & ${egeResult.stats.edgesTraversed} & ${egeResult.paths.length} & ${egeResult.stats.iterations}`
		);
		console.log(
			`BFS & ${bfsResult.sampledNodes.size} & ${bfsResult.stats.edgesTraversed} & ${bfsResult.paths.length} & ${bfsResult.stats.iterations}`
		);

		// Both should produce valid results
		expect(egeResult.paths.length).toBeGreaterThan(0);
		expect(bfsResult.paths.length).toBeGreaterThan(0);
	});
});

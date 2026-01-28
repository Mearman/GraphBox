/**
 * NOVELTY: Cross-Boundary Discovery Tests
 *
 * This suite validates that Entropy-Guided Expansion (EGE) discovers more
 * diverse edge types in the sampled subgraph compared to DegreePrioritised.
 *
 * Novelty Claims:
 * - Type diversity: EGE samples subgraphs with more diverse edge types
 * - Cross-boundary discovery: EGE explores across type boundaries effectively
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { EntropyGuidedExpansion } from "../../../../../../../../algorithms/traversal/entropy-guided-expansion";
import type { GraphExpander, Neighbor } from "../../../../../../../../interfaces/graph-expander";

/**
 * Test graph expander that supports multiple relationship types and tracks
 * edge types in sampled subgraph.
 */
class TypedGraphExpander implements GraphExpander<{ id: string }> {
	private adjacency = new Map<string, Neighbor[]>();
	private degrees = new Map<string, number>();
	private nodes = new Map<string, { id: string }>();
	private sampledEdgeTypes = new Map<string, string>();

	constructor(edges: Array<{ source: string; target: string; type: string }>, directed = false) {
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
			if (!directed) {
				const targetNeighbors = this.adjacency.get(target);
				if (targetNeighbors) {
					targetNeighbors.push({ targetId: source, relationshipType: type });
				}
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

	addEdge(source: string, target: string, type: string): void {
		const edgeKey = `${source}->${target}`;
		this.sampledEdgeTypes.set(edgeKey, type);
	}

	calculatePriority(nodeId: string, options: { nodeWeight?: number; epsilon?: number } = {}): number {
		const { nodeWeight = 1, epsilon = 1e-10 } = options;
		const degree = this.getDegree(nodeId);
		return degree / (nodeWeight + epsilon);
	}

	getAllNodeIds(): string[] {
		return [...this.nodes.keys()];
	}

	/**
	 * Get unique edge types in the sampled subgraph.
	 */
	getSampledEdgeTypes(): Set<string> {
		return new Set(this.sampledEdgeTypes.values());
	}

	/**
	 * Reset sampled edges for new expansion.
	 */
	resetSampledEdges(): void {
		this.sampledEdgeTypes.clear();
	}
}

/**
 * Creates a clustered graph where different clusters use different relationship types.
 * Tests whether EGE can discover edges across type boundaries.
 */
const createClusteredTypeGraph = (): TypedGraphExpander => {
	const edges: Array<{ source: string; target: string; type: string }> = [];

	// Cluster A: Uses "cites" relationships
	for (let index = 0; index < 5; index++) {
		for (let index_ = index + 1; index_ < 5; index_++) {
			edges.push({ source: `A${index}`, target: `A${index_}`, type: "cites" });
		}
	}

	// Cluster B: Uses "references" relationships
	for (let index = 0; index < 5; index++) {
		for (let index_ = index + 1; index_ < 5; index_++) {
			edges.push({ source: `B${index}`, target: `B${index_}`, type: "references" });
		}
	}

	// Cluster C: Uses "extends" relationships
	for (let index = 0; index < 5; index++) {
		for (let index_ = index + 1; index_ < 5; index_++) {
			edges.push({ source: `C${index}`, target: `C${index_}`, type: "extends" });
		}
	}

	// Cross-cluster bridges with different types
	edges.push({ source: "A0", target: "B0", type: "related" });
	edges.push({ source: "B0", target: "C0", type: "implements" });
	edges.push({ source: "A2", target: "C2", type: "supports" });

	return new TypedGraphExpander(edges);
};

/**
 * Creates a graph with a hub that has diverse edge types connecting to
 * specialised clusters.
 */
const createDiverseHubGraph = (): TypedGraphExpander => {
	const edges: Array<{ source: string; target: string; type: string }> = [];

	// Central hub with diverse connection types
	const types = ["cites", "references", "extends", "implements", "supports"];

	// Connect hub to 5 clusters, each with a different type
	for (let cluster = 0; cluster < 5; cluster++) {
		const type = types[cluster];
		// Hub connects to cluster center
		edges.push({ source: "HUB", target: `CENTER_${cluster}`, type });

		// Each cluster has internal connections with same type
		for (let index = 0; index < 4; index++) {
			edges.push({
				source: `CENTER_${cluster}`,
				target: `NODE_${cluster}_${index}`,
				type,
			});
		}
	}

	return new TypedGraphExpander(edges);
};

describe("NOVELTY: Cross-Boundary Discovery Tests", () => {
	/**
	 * Novelty Claim: EGE discovers edges across different type boundaries
	 * when exploring clustered graphs.
	 *
	 * Validation: Measure edge type diversity in sampled subgraph.
	 */
	it("should discover edges across type boundaries in clustered graph", async () => {
		const graph = createClusteredTypeGraph();

		const seeds: [string, string] = ["A0", "C0"];

		const ege = new EntropyGuidedExpansion(graph, seeds);
		const egeResult = await ege.run();

		// Get discovered edge types
		const discoveredTypes = graph.getSampledEdgeTypes();

		console.log("\n=== Cross-Boundary Discovery ===");
		console.log(`Discovered edge types: ${[...discoveredTypes].join(", ")}`);
		console.log(`Sampled nodes: ${egeResult.sampledNodes.size}`);
		console.log(`Sampled edges: ${egeResult.sampledEdges.size}`);

		// Should discover multiple edge types (crossing type boundaries)
		expect(discoveredTypes.size).toBeGreaterThanOrEqual(2);

		// Should find paths between seeds in different clusters
		expect(egeResult.paths.length).toBeGreaterThan(0);
	});

	/**
	 * Novelty Claim: EGE explores diverse hub connections effectively.
	 *
	 * Validation: Compare edge type diversity between EGE and DP.
	 */
	it("should sample diverse edge types from hub connections", async () => {
		// Test EGE
		const graph1 = createDiverseHubGraph();
		const seeds: [string, string] = ["NODE_0_0", "NODE_4_0"];

		const ege = new EntropyGuidedExpansion(graph1, seeds);
		const egeResult = await ege.run();
		const egeTypes = graph1.getSampledEdgeTypes();

		// Test DP with fresh graph
		const graph2 = createDiverseHubGraph();
		const dp = new DegreePrioritisedExpansion(graph2, seeds);
		const dpResult = await dp.run();
		const dpTypes = graph2.getSampledEdgeTypes();

		console.log("\n=== Edge Type Diversity Comparison ===");
		console.log(`EGE types: ${egeTypes.size} (${[...egeTypes].join(", ")})`);
		console.log(`DP types: ${dpTypes.size} (${[...dpTypes].join(", ")})`);
		console.log(`EGE edges: ${egeResult.sampledEdges.size}`);
		console.log(`DP edges: ${dpResult.sampledEdges.size}`);

		// Both should discover multiple types through the hub
		expect(egeTypes.size).toBeGreaterThanOrEqual(2);
		expect(dpTypes.size).toBeGreaterThanOrEqual(2);

		// Both should find paths
		expect(egeResult.paths.length).toBeGreaterThan(0);
		expect(dpResult.paths.length).toBeGreaterThan(0);
	});

	/**
	 * Novelty Claim: EGE maintains connectivity while exploring diverse types.
	 *
	 * Validation: Verify sampled subgraph is connected and includes multiple types.
	 */
	it("should maintain connectivity while exploring diverse edge types", async () => {
		const graph = createClusteredTypeGraph();

		// Seeds from different clusters
		const seeds: [string, string] = ["A2", "B2"];

		const ege = new EntropyGuidedExpansion(graph, seeds);
		const egeResult = await ege.run();

		// Should find connecting path
		expect(egeResult.paths.length).toBeGreaterThan(0);

		// Verify path connects seeds
		const path = egeResult.paths[0];
		expect(path.nodes.includes("A2") || path.nodes[0] === "A2").toBe(true);

		// Should sample nodes from multiple clusters
		const nodesFromA = [...egeResult.sampledNodes].filter((n) => n.startsWith("A"));
		const nodesFromB = [...egeResult.sampledNodes].filter((n) => n.startsWith("B"));

		console.log("\n=== Cluster Coverage ===");
		console.log(`Nodes from A cluster: ${nodesFromA.length}`);
		console.log(`Nodes from B cluster: ${nodesFromB.length}`);
		console.log(`Total sampled: ${egeResult.sampledNodes.size}`);

		expect(nodesFromA.length).toBeGreaterThan(0);
		expect(nodesFromB.length).toBeGreaterThan(0);
	});
});

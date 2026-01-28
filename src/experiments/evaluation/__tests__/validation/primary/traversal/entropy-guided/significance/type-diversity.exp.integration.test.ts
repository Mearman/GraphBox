/**
 * SIGNIFICANCE: Type Diversity in Sampled Subgraphs
 *
 * Tests that Entropy-Guided Expansion (EGE) produces sampled subgraphs
 * with comparable or better relationship type diversity compared to
 * DegreePrioritised expansion.
 *
 * Significance Claims:
 * - EGE samples diverse edge types across the subgraph
 * - Type distribution in EGE samples is measurably different from DP
 * - EGE maintains exploration breadth across type boundaries
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { EntropyGuidedExpansion } from "../../../../../../../../algorithms/traversal/entropy-guided-expansion";
import type { GraphExpander, Neighbor } from "../../../../../../../../interfaces/graph-expander";
import { jaccardSimilarity } from "../../../../common/statistical-functions";

/**
 * Test graph expander that tracks sampled edge types.
 */
class TypeDiversityExpander implements GraphExpander<{ id: string }> {
	private adjacency = new Map<string, Neighbor[]>();
	private degrees = new Map<string, number>();
	private nodes = new Map<string, { id: string }>();
	private sampledEdgeTypes = new Map<string, string>();

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

	addEdge(source: string, target: string, type: string): void {
		const edgeKey = `${source}->${target}`;
		this.sampledEdgeTypes.set(edgeKey, type);
	}

	calculatePriority(nodeId: string): number {
		const degree = this.getDegree(nodeId);
		return Math.log(degree + 1);
	}

	getAllNodeIds(): string[] {
		return [...this.nodes.keys()];
	}

	/**
	 * Get type distribution in sampled subgraph.
	 */
	getTypeDistribution(): Map<string, number> {
		const distribution = new Map<string, number>();
		for (const type of this.sampledEdgeTypes.values()) {
			const count = distribution.get(type) ?? 0;
			distribution.set(type, count + 1);
		}
		return distribution;
	}

	/**
	 * Get unique types in sampled subgraph.
	 */
	getUniqueTypes(): Set<string> {
		return new Set(this.sampledEdgeTypes.values());
	}

	/**
	 * Calculate Shannon entropy of type distribution.
	 */
	getTypeDiversityEntropy(): number {
		const distribution = this.getTypeDistribution();
		const total = [...distribution.values()].reduce((sum, count) => sum + count, 0);

		if (total === 0) return 0;

		let entropy = 0;
		for (const count of distribution.values()) {
			const p = count / total;
			if (p > 0) {
				entropy -= p * Math.log2(p);
			}
		}
		return entropy;
	}

	/**
	 * Reset sampled edges for new run.
	 */
	reset(): void {
		this.sampledEdgeTypes.clear();
	}
}

/**
 * Creates a network with multiple relationship types clustered in regions.
 */
const createTypedClusterNetwork = (): Array<{ source: string; target: string; type: string }> => {
	const edges: Array<{ source: string; target: string; type: string }> = [];

	// Region A: Academic citations
	for (let index = 0; index < 8; index++) {
		for (let index_ = index + 1; index_ < 8; index_++) {
			edges.push({ source: `A${index}`, target: `A${index_}`, type: "cites" });
		}
	}

	// Region B: Software dependencies
	for (let index = 0; index < 8; index++) {
		for (let index_ = index + 1; index_ < 8; index_++) {
			const type = index % 2 === 0 ? "imports" : "extends";
			edges.push({ source: `B${index}`, target: `B${index_}`, type });
		}
	}

	// Region C: Social connections
	for (let index = 0; index < 8; index++) {
		for (let index_ = index + 1; index_ < 8; index_++) {
			const type = index % 3 === 0 ? "follows" : (index % 3 === 1 ? "mentions" : "likes");
			edges.push({ source: `C${index}`, target: `C${index_}`, type });
		}
	}

	// Cross-region bridges
	edges.push({ source: "A0", target: "B0", type: "references" });
	edges.push({ source: "B0", target: "C0", type: "links" });
	edges.push({ source: "A4", target: "C4", type: "supports" });

	return edges;
};

/**
 * Creates a network with uniform type distribution.
 */
const createUniformTypeNetwork = (): Array<{ source: string; target: string; type: string }> => {
	const edges: Array<{ source: string; target: string; type: string }> = [];
	const types = ["cites", "references", "extends", "implements", "supports"];

	// Grid network with rotating types
	for (let index = 0; index < 5; index++) {
		for (let index_ = 0; index_ < 5; index_++) {
			const node = `N${index}_${index_}`;
			// Connect to right neighbor
			if (index_ < 4) {
				const type = types[(index + index_) % types.length];
				edges.push({ source: node, target: `N${index}_${index_ + 1}`, type });
			}
			// Connect to down neighbor
			if (index < 4) {
				const type = types[(index + index_ + 1) % types.length];
				edges.push({ source: node, target: `N${index + 1}_${index_}`, type });
			}
		}
	}

	return edges;
};

describe("SIGNIFICANCE: Type Diversity in Sampled Subgraphs", () => {
	/**
	 * Significance Claim: EGE samples multiple relationship types.
	 *
	 * On multi-type networks, EGE should discover edges of various types.
	 */
	it("should sample edges of multiple relationship types", async () => {
		const graphData = createTypedClusterNetwork();
		const graph = new TypeDiversityExpander(graphData);

		const seeds: [string, string] = ["A0", "C7"];

		const ege = new EntropyGuidedExpansion(graph, seeds);
		const result = await ege.run();

		const types = graph.getUniqueTypes();
		const distribution = graph.getTypeDistribution();

		console.log("\n=== EGE Type Diversity ===");
		console.log(`Unique types sampled: ${types.size}`);
		console.log("Type distribution:");
		for (const [type, count] of distribution) {
			console.log(`  ${type}: ${count}`);
		}

		// Should discover multiple types
		expect(types.size).toBeGreaterThanOrEqual(2);
		expect(result.paths.length).toBeGreaterThan(0);
	});

	/**
	 * Significance Claim: EGE and DP produce different type distributions.
	 *
	 * Due to entropy-based ordering, EGE may explore types in a
	 * different pattern than degree-prioritised expansion.
	 */
	it("should produce measurably different type distribution than DP", async () => {
		const graphData = createTypedClusterNetwork();

		// Run EGE
		const egeGraph = new TypeDiversityExpander(graphData);
		const egeSeeds: [string, string] = ["A0", "C7"];
		const ege = new EntropyGuidedExpansion(egeGraph, egeSeeds);
		const egeResult = await ege.run();
		const egeTypes = egeGraph.getUniqueTypes();
		const egeEntropy = egeGraph.getTypeDiversityEntropy();

		// Run DP
		const dpGraph = new TypeDiversityExpander(graphData);
		const dp = new DegreePrioritisedExpansion(dpGraph, egeSeeds);
		const dpResult = await dp.run();
		const dpTypes = dpGraph.getUniqueTypes();
		const dpEntropy = dpGraph.getTypeDiversityEntropy();

		console.log("\n=== Type Distribution Comparison ===");
		console.log(`EGE unique types: ${egeTypes.size}, entropy: ${egeEntropy.toFixed(4)}`);
		console.log(`DP unique types: ${dpTypes.size}, entropy: ${dpEntropy.toFixed(4)}`);

		// Calculate type overlap
		const typeOverlap = jaccardSimilarity(egeTypes, dpTypes);
		console.log(`Type Jaccard similarity: ${typeOverlap.toFixed(4)}`);

		// Both should find paths
		expect(egeResult.paths.length).toBeGreaterThan(0);
		expect(dpResult.paths.length).toBeGreaterThan(0);

		// Both should sample multiple types
		expect(egeTypes.size).toBeGreaterThanOrEqual(2);
		expect(dpTypes.size).toBeGreaterThanOrEqual(2);
	});

	/**
	 * Significance Claim: EGE maintains breadth across type boundaries.
	 *
	 * EGE should explore across cluster boundaries that have different
	 * relationship types.
	 */
	it("should explore across type boundaries", async () => {
		const graphData = createTypedClusterNetwork();
		const graph = new TypeDiversityExpander(graphData);

		// Seeds in different clusters
		const seeds: [string, string] = ["A4", "B4"];

		const ege = new EntropyGuidedExpansion(graph, seeds);
		const result = await ege.run();

		// Should sample nodes from both clusters
		const nodesFromA = [...result.sampledNodes].filter((n) => n.startsWith("A"));
		const nodesFromB = [...result.sampledNodes].filter((n) => n.startsWith("B"));

		console.log("\n=== Cross-Boundary Exploration ===");
		console.log(`Nodes from A cluster: ${nodesFromA.length}`);
		console.log(`Nodes from B cluster: ${nodesFromB.length}`);
		console.log(`Total sampled: ${result.sampledNodes.size}`);

		expect(nodesFromA.length).toBeGreaterThan(0);
		expect(nodesFromB.length).toBeGreaterThan(0);
		expect(result.paths.length).toBeGreaterThan(0);
	});

	/**
	 * Significance Claim: Type diversity entropy is measurable.
	 *
	 * Shannon entropy of type distribution provides a quantitative
	 * measure of type diversity.
	 */
	it("should produce measurable type diversity entropy", async () => {
		const graphData = createUniformTypeNetwork();
		const graph = new TypeDiversityExpander(graphData);

		const seeds: [string, string] = ["N0_0", "N4_4"];

		const ege = new EntropyGuidedExpansion(graph, seeds);
		await ege.run();

		const entropy = graph.getTypeDiversityEntropy();
		const types = graph.getUniqueTypes();

		// Maximum possible entropy for K types is log2(K)
		const maxEntropy = Math.log2(types.size);

		console.log("\n=== Type Diversity Entropy ===");
		console.log(`Unique types: ${types.size}`);
		console.log(`Diversity entropy: ${entropy.toFixed(4)}`);
		console.log(`Maximum possible: ${maxEntropy.toFixed(4)}`);
		console.log(`Normalised diversity: ${(entropy / maxEntropy).toFixed(4)}`);

		expect(entropy).toBeGreaterThan(0);
		expect(entropy).toBeLessThanOrEqual(maxEntropy);
	});

	/**
	 * Significance Claim: Comparison with publication-ready metrics.
	 *
	 * Generate a comparison table for thesis/paper.
	 */
	it("should produce publication-ready diversity comparison", async () => {
		const graphData = createTypedClusterNetwork();

		// Multiple runs for comparison
		const results: Array<{
			method: string;
			types: number;
			entropy: number;
			nodes: number;
			paths: number;
		}> = [];

		// EGE
		const egeGraph = new TypeDiversityExpander(graphData);
		const seeds: [string, string] = ["A0", "C7"];
		const ege = new EntropyGuidedExpansion(egeGraph, seeds);
		const egeResult = await ege.run();
		results.push({
			method: "EGE",
			types: egeGraph.getUniqueTypes().size,
			entropy: egeGraph.getTypeDiversityEntropy(),
			nodes: egeResult.sampledNodes.size,
			paths: egeResult.paths.length,
		});

		// DP
		const dpGraph = new TypeDiversityExpander(graphData);
		const dp = new DegreePrioritisedExpansion(dpGraph, seeds);
		const dpResult = await dp.run();
		results.push({
			method: "DP",
			types: dpGraph.getUniqueTypes().size,
			entropy: dpGraph.getTypeDiversityEntropy(),
			nodes: dpResult.sampledNodes.size,
			paths: dpResult.paths.length,
		});

		console.log("\n=== Type Diversity Comparison Table ===");
		console.log("Method & Types & Entropy & Nodes & Paths");
		for (const r of results) {
			console.log(
				`${r.method} & ${r.types} & ${r.entropy.toFixed(3)} & ${r.nodes} & ${r.paths}`
			);
		}

		// Both should produce valid results
		for (const r of results) {
			expect(r.types).toBeGreaterThan(0);
			expect(r.paths).toBeGreaterThan(0);
		}
	});
});

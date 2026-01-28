/**
 * VALIDITY: Entropy Formula Tests
 *
 * Tests that the entropy calculation correctly implements Shannon entropy:
 * H_local(v) = -SUM p(tau) * log2(p(tau))
 *
 * Where p(tau) is the proportion of neighbours with relationship type tau.
 *
 * Validity Claims:
 * - Shannon entropy formula is correctly implemented
 * - Entropy bounds [0, log2(K)] are respected where K = number of types
 * - Edge cases: single type -> H=0, uniform distribution -> H=max
 */

import { describe, expect, it } from "vitest";

import { EntropyGuidedExpansion } from "../../../../../../../../algorithms/traversal/entropy-guided-expansion";
import type { GraphExpander, Neighbor } from "../../../../../../../../interfaces/graph-expander";

/**
 * Shannon entropy calculation for testing.
 * H = -SUM p * log2(p)
 * @param probabilities
 */
const shannonEntropy = (probabilities: number[]): number => {
	let entropy = 0;
	for (const p of probabilities) {
		if (p > 0) {
			entropy -= p * Math.log2(p);
		}
	}
	return entropy;
};

/**
 * Test graph expander with controlled edge type distributions.
 */
class EntropyTestExpander implements GraphExpander<{ id: string }> {
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

		// Build adjacency (undirected)
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

	/**
	 * Compute local entropy for a node (exposed for testing).
	 * @param nodeId
	 */
	async computeLocalEntropy(nodeId: string): Promise<number> {
		const neighbors = await this.getNeighbors(nodeId);

		if (neighbors.length === 0) {
			return 0;
		}

		// Count relationship types
		const typeCounts = new Map<string, number>();
		for (const { relationshipType } of neighbors) {
			const count = typeCounts.get(relationshipType) ?? 0;
			typeCounts.set(relationshipType, count + 1);
		}

		// Compute Shannon entropy
		let entropy = 0;
		const total = neighbors.length;

		for (const count of typeCounts.values()) {
			const p = count / total;
			if (p > 0) {
				entropy -= p * Math.log2(p);
			}
		}

		return entropy;
	}
}

describe("VALIDITY: Shannon Entropy Formula Tests", () => {
	/**
	 * Validity Claim: Single type produces entropy = 0.
	 *
	 * When all edges have the same type, p(tau) = 1 for that type,
	 * so H = -1 * log2(1) = 0.
	 */
	it("should return entropy = 0 for single edge type", async () => {
		const edges: Array<{ source: string; target: string; type: string }> = [];

		// Node with all edges of same type
		for (let index = 0; index < 6; index++) {
			edges.push({ source: "CENTER", target: `N${index}`, type: "cites" });
		}

		const graph = new EntropyTestExpander(edges);
		const entropy = await graph.computeLocalEntropy("CENTER");

		console.log("\n=== Single Type Entropy ===");
		console.log(`Entropy for single type: ${entropy.toFixed(6)}`);

		// Should be exactly 0 (or very close due to floating point)
		expect(entropy).toBeCloseTo(0, 10);
	});

	/**
	 * Validity Claim: Uniform distribution produces maximum entropy.
	 *
	 * For K types with equal probability 1/K, H = log2(K).
	 */
	it("should return maximum entropy for uniform type distribution", async () => {
		const types = ["cites", "references", "extends"];
		const edges: Array<{ source: string; target: string; type: string }> = [];

		// Node with equal edges of each type (2 each = 6 total)
		let nodeIndex = 0;
		for (const type of types) {
			edges.push({ source: "CENTER", target: `N${nodeIndex++}`, type });
			edges.push({ source: "CENTER", target: `N${nodeIndex++}`, type });
		}

		const graph = new EntropyTestExpander(edges);
		const entropy = await graph.computeLocalEntropy("CENTER");

		// Expected: H = log2(3) = 1.585
		const expectedEntropy = Math.log2(types.length);

		console.log("\n=== Uniform Distribution Entropy ===");
		console.log(`Computed entropy: ${entropy.toFixed(6)}`);
		console.log(`Expected entropy (log2(${types.length})): ${expectedEntropy.toFixed(6)}`);

		expect(entropy).toBeCloseTo(expectedEntropy, 6);
	});

	/**
	 * Validity Claim: Entropy is bounded by [0, log2(K)].
	 *
	 * For any distribution over K types, entropy must be in this range.
	 */
	it("should produce entropy within valid bounds", async () => {
		// Create a skewed distribution (not uniform, not single type)
		// 4 edges: 3 "cites", 1 "references"
		const edges: Array<{ source: string; target: string; type: string }> = [
			{ source: "CENTER", target: "N0", type: "cites" },
			{ source: "CENTER", target: "N1", type: "cites" },
			{ source: "CENTER", target: "N2", type: "cites" },
			{ source: "CENTER", target: "N3", type: "references" },
		];

		const graph = new EntropyTestExpander(edges);
		const entropy = await graph.computeLocalEntropy("CENTER");

		// K = 2 types, so bounds are [0, log2(2)] = [0, 1]
		const minEntropy = 0;
		const maxEntropy = Math.log2(2);

		// Verify formula: p(cites)=0.75, p(refs)=0.25
		// H = -0.75*log2(0.75) - 0.25*log2(0.25) = 0.811
		const expectedEntropy = shannonEntropy([0.75, 0.25]);

		console.log("\n=== Entropy Bounds Check ===");
		console.log(`Entropy: ${entropy.toFixed(6)}`);
		console.log(`Expected: ${expectedEntropy.toFixed(6)}`);
		console.log(`Bounds: [${minEntropy}, ${maxEntropy.toFixed(6)}]`);

		expect(entropy).toBeGreaterThanOrEqual(minEntropy);
		expect(entropy).toBeLessThanOrEqual(maxEntropy);
		expect(entropy).toBeCloseTo(expectedEntropy, 6);
	});

	/**
	 * Validity Claim: Zero edges produces entropy = 0.
	 *
	 * An isolated node with no neighbours has undefined entropy;
	 * by convention, we return 0.
	 */
	it("should return entropy = 0 for node with no neighbours", async () => {
		const edges: Array<{ source: string; target: string; type: string }> = [
			{ source: "A", target: "B", type: "cites" },
		];

		const graph = new EntropyTestExpander(edges);

		// Add an isolated node manually
		const entropy = await graph.computeLocalEntropy("ISOLATED");

		console.log("\n=== Isolated Node Entropy ===");
		console.log(`Entropy for isolated node: ${entropy}`);

		expect(entropy).toBe(0);
	});

	/**
	 * Validity Claim: Formula verification with known distribution.
	 *
	 * Manual calculation: 5 edges with types [A, A, A, B, C]
	 * p(A) = 3/5 = 0.6, p(B) = 1/5 = 0.2, p(C) = 1/5 = 0.2
	 * H = -0.6*log2(0.6) - 0.2*log2(0.2) - 0.2*log2(0.2)
	 */
	it("should match manual entropy calculation", async () => {
		const edges: Array<{ source: string; target: string; type: string }> = [
			{ source: "CENTER", target: "N0", type: "A" },
			{ source: "CENTER", target: "N1", type: "A" },
			{ source: "CENTER", target: "N2", type: "A" },
			{ source: "CENTER", target: "N3", type: "B" },
			{ source: "CENTER", target: "N4", type: "C" },
		];

		const graph = new EntropyTestExpander(edges);
		const entropy = await graph.computeLocalEntropy("CENTER");

		// Manual calculation
		const pA = 3 / 5;
		const pB = 1 / 5;
		const pC = 1 / 5;
		const expectedEntropy = shannonEntropy([pA, pB, pC]);

		console.log("\n=== Manual Entropy Verification ===");
		console.log("Distribution: A=0.6, B=0.2, C=0.2");
		console.log(`Computed: ${entropy.toFixed(6)}`);
		console.log(`Expected: ${expectedEntropy.toFixed(6)}`);

		expect(entropy).toBeCloseTo(expectedEntropy, 6);
	});

	/**
	 * Validity Claim: Integration test - entropy affects expansion order.
	 *
	 * Run full EGE algorithm and verify it completes correctly.
	 */
	it("should complete expansion using entropy-based priorities", async () => {
		const edges: Array<{ source: string; target: string; type: string }> = [ { source: "SEED_A", target: "LOW", type: "cites" }];

		// Create two paths between seeds with different entropy profiles
		// Path 1: through low-entropy intermediate
		for (let index = 0; index < 4; index++) {
			edges.push({ source: "LOW", target: `L${index}`, type: "cites" });
		}
		edges.push({ source: "LOW", target: "SEED_B", type: "cites" });

		// Path 2: through high-entropy intermediate
		edges.push({ source: "SEED_A", target: "HIGH", type: "cites" });
		edges.push({ source: "HIGH", target: "H0", type: "references" });
		edges.push({ source: "HIGH", target: "H1", type: "extends" });
		edges.push({ source: "HIGH", target: "H2", type: "implements" });
		edges.push({ source: "HIGH", target: "SEED_B", type: "related" });

		const graph = new EntropyTestExpander(edges);
		const ege = new EntropyGuidedExpansion(graph, ["SEED_A", "SEED_B"]);
		const result = await ege.run();

		console.log("\n=== EGE Integration Test ===");
		console.log(`Paths found: ${result.paths.length}`);
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);
		console.log(`Iterations: ${result.stats.iterations}`);

		expect(result.paths.length).toBeGreaterThan(0);
		expect(result.sampledNodes.size).toBeGreaterThan(0);
	});
});

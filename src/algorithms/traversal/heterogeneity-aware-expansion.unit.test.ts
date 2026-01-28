import { describe, expect, it } from "vitest";

import type { GraphExpander } from "../../interfaces/graph-expander.js";
import { HeterogeneityAwareExpansion } from "./heterogeneity-aware-expansion.js";

describe("HeterogeneityAwareExpansion", () => {
	/**
	 * Creates a mock expander with a heterogeneous graph structure.
	 *
	 * Graph structure:
	 * - Domain A: nodes A1, A2, A3 connected by "cites" edges
	 * - Domain B: nodes B1, B2, B3 connected by "references" edges
	 * - Cross-domain: A3 -> B1 via "cross-domain" edge
	 */
	const createHeterogeneousMockExpander = (): GraphExpander<unknown> => {
		const graph = new Map<string, Array<{ targetId: string; relationshipType: string }>>([
			// Domain A (homogeneous neighbourhood - all "cites")
			["A1", [
				{ targetId: "A2", relationshipType: "cites" },
				{ targetId: "A3", relationshipType: "cites" }
			]],
			["A2", [
				{ targetId: "A1", relationshipType: "cites" },
				{ targetId: "A3", relationshipType: "cites" }
			]],
			["A3", [
				{ targetId: "A1", relationshipType: "cites" },
				{ targetId: "A2", relationshipType: "cites" },
				{ targetId: "B1", relationshipType: "cross-domain" } // Bridge node
			]],
			// Domain B (homogeneous neighbourhood - all "references")
			["B1", [
				{ targetId: "A3", relationshipType: "cross-domain" },
				{ targetId: "B2", relationshipType: "references" },
				{ targetId: "B3", relationshipType: "references" }
			]],
			["B2", [
				{ targetId: "B1", relationshipType: "references" },
				{ targetId: "B3", relationshipType: "references" }
			]],
			["B3", [
				{ targetId: "B1", relationshipType: "references" },
				{ targetId: "B2", relationshipType: "references" }
			]],
		]);

		const discoveredEdges: Array<{ source: string; target: string; type: string }> = [];

		return {
			getNeighbors: async (nodeId: string) => graph.get(nodeId) ?? [],
			getNode: async (nodeId: string) => ({ id: nodeId }),
			getDegree: (nodeId: string) => graph.get(nodeId)?.length ?? 0,
			calculatePriority(nodeId: string) {
				const degree = this.getDegree(nodeId);
				return Math.log(degree + 1);
			},
			addEdge: (source: string, target: string, relationshipType: string) => {
				discoveredEdges.push({ source, target, type: relationshipType });
			},
		};
	};

	describe("initialization", () => {
		it("should create instance with single seed", () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1"]);
			expect(expansion).toBeDefined();
		});

		it("should create instance with multiple seeds", () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1", "B3"]);
			expect(expansion).toBeDefined();
		});

		it("should throw error for empty seeds", () => {
			const expander = createHeterogeneousMockExpander();
			expect(() => new HeterogeneityAwareExpansion(expander, [])).toThrow(
				"At least one seed node is required"
			);
		});
	});

	describe("path discovery", () => {
		it("should discover paths between seeds in different domains", async () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1", "B3"]);
			const result = await expansion.run();

			expect(result.paths.length).toBeGreaterThan(0);
			expect(result.sampledNodes.size).toBeGreaterThan(0);
		});

		it("should include cross-domain node in discovered paths", async () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1", "B3"]);
			const result = await expansion.run();

			// At least one path should contain the bridge nodes A3 and B1
			const hasCrossDomainPath = result.paths.some(
				(path) => path.nodes.includes("A3") || path.nodes.includes("B1")
			);
			expect(hasCrossDomainPath).toBe(true);
		});

		it("should track node discovery iterations", async () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1", "B3"]);
			const result = await expansion.run();

			// Seeds should be discovered at iteration 0
			expect(result.nodeDiscoveryIteration.get("A1")).toBe(0);
			expect(result.nodeDiscoveryIteration.get("B3")).toBe(0);

			// Other nodes should be discovered at later iterations
			for (const [nodeId, iteration] of result.nodeDiscoveryIteration) {
				if (nodeId !== "A1" && nodeId !== "B3") {
					expect(iteration).toBeGreaterThan(0);
				}
			}
		});
	});

	describe("entropy-based priority", () => {
		it("should compute entropy for heterogeneous neighbourhoods", async () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1"]);

			// A3 has neighbours with 2 different types (cites, cross-domain)
			// B1 also has neighbours with 2 different types (cross-domain, references)
			// These should have higher entropy than homogeneous nodes
			const entropyA3 = await expansion["computeLocalEntropy"]("A3");
			const entropyA1 = await expansion["computeLocalEntropy"]("A1");

			// A3 (heterogeneous: cites + cross-domain) should have higher entropy than A1 (homogeneous: cites)
			expect(entropyA3).toBeGreaterThan(entropyA1);
		});

		it("should return zero entropy for homogeneous neighbourhoods", async () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1"]);

			// A1 has 2 neighbours, all with "cites" type -> entropy = 0
			const entropyA1 = await expansion["computeLocalEntropy"]("A1");
			expect(entropyA1).toBe(0);
		});
	});

	describe("transitive connectivity termination", () => {
		it("should terminate when overlap graph is connected", async () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1", "B3"]);
			const result = await expansion.run();

			// Should have at least one path connecting the two seeds
			expect(result.paths.length).toBeGreaterThanOrEqual(1);

			// Visited sets should contain nodes from both domains
			const visitedAll = new Set<string>();
			for (const visited of result.visitedPerFrontier) {
				for (const node of visited) {
					visitedAll.add(node);
				}
			}
			expect(visitedAll.has("A1")).toBe(true);
			expect(visitedAll.has("B3")).toBe(true);
		});

		it("should handle N=1 case without early termination", async () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1"]);
			const result = await expansion.run();

			// Single seed should explore until frontier exhaustion
			expect(result.sampledNodes.size).toBeGreaterThan(1);
			// No paths expected with single seed (no intersection possible)
			expect(result.paths.length).toBe(0);
		});
	});

	describe("statistics", () => {
		it("should track expansion statistics", async () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1", "B3"]);
			const result = await expansion.run();

			expect(result.stats.nodesExpanded).toBeGreaterThan(0);
			expect(result.stats.edgesTraversed).toBeGreaterThan(0);
			expect(result.stats.iterations).toBeGreaterThan(0);
		});

		it("should track degree distribution", async () => {
			const expander = createHeterogeneousMockExpander();
			const expansion = new HeterogeneityAwareExpansion(expander, ["A1", "B3"]);
			const result = await expansion.run();

			// All nodes have degree 2-3, so should be in "1-5" bucket
			const lowDegreeBucket = result.stats.degreeDistribution.get("1-5") ?? 0;
			expect(lowDegreeBucket).toBeGreaterThan(0);
		});
	});
});

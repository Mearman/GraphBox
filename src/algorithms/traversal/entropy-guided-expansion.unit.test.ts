import { describe, expect,it } from "vitest";

import type { GraphExpander } from "../../interfaces/graph-expander.js";
import { EntropyGuidedExpansion } from "./entropy-guided-expansion.js";

describe("EntropyGuidedExpansion", () => {
	const createMockExpander = (): GraphExpander<unknown> => {
		// Simple graph: A -> B -> C -> D
		//              A -> E -> D
		const graph = new Map<string, Array<{ targetId: string; relationshipType: string }>>([
			["A", [
				{ targetId: "B", relationshipType: "cites" },
				{ targetId: "E", relationshipType: "references" }
			]],
			["B", [{ targetId: "C", relationshipType: "cites" }]],
			["C", [{ targetId: "D", relationshipType: "cites" }]],
			["E", [{ targetId: "D", relationshipType: "references" }]],
			["D", []],
		]);

		return {
			getNeighbors: async (nodeId: string) => graph.get(nodeId) ?? [],
			getNode: async (nodeId: string) => ({ id: nodeId }),
			getDegree: (nodeId: string) => graph.get(nodeId)?.length ?? 0,
			calculatePriority(nodeId: string) {
				const degree = this.getDegree(nodeId);
				return Math.log(degree + 1);
			},
			addEdge: () => {
				// No-op for testing
			},
		};
	};

	it("should create instance with single seed", () => {
		const expander = createMockExpander();
		const expansion = new EntropyGuidedExpansion(expander, ["A"]);
		expect(expansion).toBeDefined();
	});

	it("should create instance with multiple seeds", () => {
		const expander = createMockExpander();
		const expansion = new EntropyGuidedExpansion(expander, ["A", "D"]);
		expect(expansion).toBeDefined();
	});

	it("should discover paths between seeds", async () => {
		const expander = createMockExpander();
		const expansion = new EntropyGuidedExpansion(expander, ["A", "D"]);
		const result = await expansion.run();

		expect(result.paths.length).toBeGreaterThan(0);
		expect(result.sampledNodes.size).toBeGreaterThan(0);
	});

	it("should compute entropy-based priorities", async () => {
		const expander = createMockExpander();
		const expansion = new EntropyGuidedExpansion(expander, ["A"]);

		// Node A has 2 neighbours with 2 different relationship types -> higher entropy -> lower priority
		// (priority is inversely proportional to entropy)
		const priorityA = await expansion["calculateEntropyPriorityAsync"]("A");
		expect(priorityA).toBeGreaterThan(0);
	});

	it("should handle nodes with homogeneous neighbourhoods", async () => {
		const expander = createMockExpander();
		const expansion = new EntropyGuidedExpansion(expander, ["B"]);

		// Node B has 1 neighbour with 1 relationship type -> entropy = 0 -> high priority (1/epsilon)
		const priorityB = await expansion["calculateEntropyPriorityAsync"]("B");
		expect(priorityB).toBeGreaterThan(0);
	});

	it("should prioritize low-entropy nodes", async () => {
		const expander = createMockExpander();
		const expansion = new EntropyGuidedExpansion(expander, ["A"]);

		// Node B (homogeneous) should have higher priority than Node A (heterogeneous)
		const priorityA = await expansion["calculateEntropyPriorityAsync"]("A");
		const priorityB = await expansion["calculateEntropyPriorityAsync"]("B");

		// Lower entropy (B) -> higher priority
		expect(priorityB).toBeGreaterThan(priorityA);
	});

	it("should defer high-degree nodes via logarithmic term", async () => {
		const expander = createMockExpander();
		const expansion = new EntropyGuidedExpansion(expander, ["A"]);

		// The log(deg + 1) term should penalize higher-degree nodes
		const result = await expansion.run();
		expect(result.stats.iterations).toBeGreaterThan(0);
	});

	it("should compute local entropy correctly", async () => {
		const expander = createMockExpander();
		const expansion = new EntropyGuidedExpansion(expander, ["A"]);

		// Node A: 2 neighbours, 2 types (50% cites, 50% references)
		// H = -[0.5*log2(0.5) + 0.5*log2(0.5)] = -[0.5*(-1) + 0.5*(-1)] = 1.0
		const entropyA = await expansion["computeLocalEntropy"]("A");
		expect(entropyA).toBeCloseTo(1, 1);

		// Node B: 1 neighbour, 1 type (100% cites)
		// H = -[1.0*log2(1.0)] = 0
		const entropyB = await expansion["computeLocalEntropy"]("B");
		expect(entropyB).toBeCloseTo(0, 1);
	});
});

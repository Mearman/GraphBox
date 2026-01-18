import { describe, expect, it } from "vitest";

import type { TestGraph } from "../generation/generator";
import type { TestEdge, TestNode } from "../generation/generators/types";
import { validateModular, validateScaleFree, validateSmallWorld } from "./network";

// Helper to create minimal spec
const createSpec = (overrides: Record<string, unknown> = {}) => ({
	directionality: { kind: "undirected" as const },
	weighting: { kind: "unweighted" as const },
	cycles: { kind: "cycles_allowed" as const },
	connectivity: { kind: "unconstrained" as const },
	schema: { kind: "homogeneous" as const },
	edgeMultiplicity: { kind: "simple" as const },
	selfLoops: { kind: "disallowed" as const },
	density: { kind: "unconstrained" as const },
	completeness: { kind: "incomplete" as const },
	...overrides,
});

// Helper to create a test graph
const createGraph = (
	nodes: TestNode[],
	edges: TestEdge[],
	specOverrides: Record<string, unknown> = {}
): TestGraph => ({
	nodes,
	edges,
	spec: createSpec(specOverrides) as TestGraph["spec"],
});

// Helper to create nodes with data
const createNodesWithData = (count: number, data: Record<string, unknown>): TestNode[] => {
	return Array.from({ length: count }, (_, index) => ({
		id: `n${index}`,
		data,
	}));
};

describe("validateScaleFree", () => {
	describe("when scaleFree is not specified", () => {
		it("should return valid for unconstrained scaleFree", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validateScaleFree(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("scaleFree");
		});
	});

	describe("when scaleFree is specified", () => {
		it("should skip validation for small graph (n < 10)", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }],
				[{ source: "a", target: "b" }],
				{ scaleFree: { kind: "scale_free" } }
			);
			const result = validateScaleFree(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("too_small");
			expect(result.message).toContain("n < 10");
		});

		it("should return valid when all nodes have consistent exponent metadata", () => {
			const nodes = createNodesWithData(15, { scaleFreeExponent: 2.5 });
			const graph = createGraph(nodes, [], { scaleFree: { kind: "scale_free" } });
			const result = validateScaleFree(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toContain("exponent=2.5");
		});

		it("should return invalid when nodes have inconsistent exponent metadata", () => {
			const nodes = [
				...createNodesWithData(10, { scaleFreeExponent: 2.5 }),
				...createNodesWithData(5, { scaleFreeExponent: 3 }),
			];
			const graph = createGraph(nodes, [], { scaleFree: { kind: "scale_free" } });
			const result = validateScaleFree(graph);
			expect(result.valid).toBe(false);
			expect(result.actual).toBe("inconsistent_exponents");
		});

		it("should skip power-law validation for small graph (n < 50)", () => {
			const nodes = createNodesWithData(25, { scaleFreeExponent: 2.5 });
			const graph = createGraph(nodes, [], { scaleFree: { kind: "scale_free" } });
			const result = validateScaleFree(graph);
			expect(result.valid).toBe(true);
			expect(result.message).toContain("n < 50");
		});

		it("should return unknown when no exponent metadata found", () => {
			const nodes = createNodesWithData(15, {});
			const graph = createGraph(nodes, [], { scaleFree: { kind: "scale_free" } });
			const result = validateScaleFree(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("unknown");
			expect(result.message).toContain("no exponent metadata");
		});

		it("should handle large graph with consistent exponent", () => {
			const nodes = createNodesWithData(60, { scaleFreeExponent: 2.1 });
			const graph = createGraph(nodes, [], { scaleFree: { kind: "scale_free" } });
			const result = validateScaleFree(graph);
			expect(result.valid).toBe(true);
			expect(result.message).toContain("not yet implemented");
		});
	});
});

describe("validateSmallWorld", () => {
	describe("when smallWorld is not specified", () => {
		it("should return valid for unconstrained smallWorld", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validateSmallWorld(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("smallWorld");
		});
	});

	describe("when smallWorld is specified", () => {
		it("should return trivial for small graph (n < 4)", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }, { id: "c" }],
				[{ source: "a", target: "b" }],
				{ smallWorld: { kind: "small_world" } }
			);
			const result = validateSmallWorld(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("trivial");
		});

		it("should return valid when all nodes have consistent small-world parameters", () => {
			const nodes = createNodesWithData(10, {
				smallWorldRewireProb: 0.1,
				smallWorldMeanDegree: 4,
			});
			const graph = createGraph(nodes, [], { smallWorld: { kind: "small_world" } });
			const result = validateSmallWorld(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toContain("rewire=0.1");
			expect(result.actual).toContain("k=4");
		});

		it("should return invalid when nodes have inconsistent parameters", () => {
			const nodes = [
				...createNodesWithData(5, { smallWorldRewireProb: 0.1, smallWorldMeanDegree: 4 }),
				...createNodesWithData(5, { smallWorldRewireProb: 0.2, smallWorldMeanDegree: 4 }),
			];
			const graph = createGraph(nodes, [], { smallWorld: { kind: "small_world" } });
			const result = validateSmallWorld(graph);
			expect(result.valid).toBe(false);
			expect(result.actual).toBe("inconsistent_parameters");
		});

		it("should return unknown when no parameter metadata found", () => {
			const nodes = createNodesWithData(10, {});
			const graph = createGraph(nodes, [], { smallWorld: { kind: "small_world" } });
			const result = validateSmallWorld(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("unknown");
			expect(result.message).toContain("no parameter metadata");
		});

		it("should handle edge case of exactly 4 nodes", () => {
			const nodes = createNodesWithData(4, {
				smallWorldRewireProb: 0.1,
				smallWorldMeanDegree: 2,
			});
			const graph = createGraph(nodes, [], { smallWorld: { kind: "small_world" } });
			const result = validateSmallWorld(graph);
			expect(result.valid).toBe(true);
		});
	});
});

describe("validateModular", () => {
	describe("when communityStructure is not specified", () => {
		it("should return valid for unconstrained modular", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }]
			);
			const result = validateModular(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("modular");
		});
	});

	describe("when communityStructure is modular", () => {
		it("should return trivial for small graph (n < 3)", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b" }],
				{ communityStructure: { kind: "modular" } }
			);
			const result = validateModular(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("trivial");
		});

		it("should return valid when all nodes have consistent community assignments", () => {
			const nodes = [
				{ id: "a", data: { community: 0, numCommunities: 2 } },
				{ id: "b", data: { community: 0, numCommunities: 2 } },
				{ id: "c", data: { community: 1, numCommunities: 2 } },
				{ id: "d", data: { community: 1, numCommunities: 2 } },
			];
			const graph = createGraph(nodes, [], { communityStructure: { kind: "modular" } });
			const result = validateModular(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toContain("2 communities");
		});

		it("should return invalid when community count does not match numCommunities", () => {
			const nodes = [
				{ id: "a", data: { community: 0, numCommunities: 3 } },
				{ id: "b", data: { community: 0, numCommunities: 3 } },
				{ id: "c", data: { community: 1, numCommunities: 3 } },
				// Missing community 2
			];
			const graph = createGraph(nodes, [], { communityStructure: { kind: "modular" } });
			const result = validateModular(graph);
			expect(result.valid).toBe(false);
			expect(result.actual).toBe("invalid_communities");
			expect(result.message).toContain("Expected 3 communities");
		});

		it("should return unknown when no community metadata found", () => {
			const nodes = createNodesWithData(5, {});
			const graph = createGraph(nodes, [], { communityStructure: { kind: "modular" } });
			const result = validateModular(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("unknown");
			expect(result.message).toContain("no community metadata");
		});

		it("should handle single community", () => {
			const nodes = [
				{ id: "a", data: { community: 0, numCommunities: 1 } },
				{ id: "b", data: { community: 0, numCommunities: 1 } },
				{ id: "c", data: { community: 0, numCommunities: 1 } },
			];
			const graph = createGraph(nodes, [], { communityStructure: { kind: "modular" } });
			const result = validateModular(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toContain("1 communities");
		});

		it("should handle many communities", () => {
			const nodes = [
				{ id: "a", data: { community: 0, numCommunities: 5 } },
				{ id: "b", data: { community: 1, numCommunities: 5 } },
				{ id: "c", data: { community: 2, numCommunities: 5 } },
				{ id: "d", data: { community: 3, numCommunities: 5 } },
				{ id: "e", data: { community: 4, numCommunities: 5 } },
			];
			const graph = createGraph(nodes, [], { communityStructure: { kind: "modular" } });
			const result = validateModular(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toContain("5 communities");
		});

		it("should handle empty graph", () => {
			const graph = createGraph([], [], { communityStructure: { kind: "modular" } });
			const result = validateModular(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("trivial");
		});
	});
});

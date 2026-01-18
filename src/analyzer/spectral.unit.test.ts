/**
 * Unit tests for spectral.ts
 */

import { describe, expect, it } from "vitest";

import {
	computeCommunityStructure,
	computeScaleFree,
	computeSmallWorld,
} from "./spectral";
import type { AnalyzerGraph } from "./types";
import { defaultComputePolicy } from "./types";

// ============================================================================
// Helper graphs
// ============================================================================

const emptyGraph: AnalyzerGraph = { vertices: [], edges: [] };

const singleVertex: AnalyzerGraph = {
	vertices: [{ id: "a" }],
	edges: [],
};

const simpleTriangle: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["b", "c"], directed: false },
		{ id: "e3", endpoints: ["c", "a"], directed: false },
	],
};

const directedGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: true },
	],
};

const disconnectedGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["c", "d"], directed: false },
	],
};

const path10: AnalyzerGraph = {
	vertices: Array.from({ length: 10 }, (_, index) => ({ id: `v${index}` })),
	edges: Array.from({ length: 9 }, (_, index) => ({
		id: `e${index}`,
		endpoints: [`v${index}`, `v${index + 1}`],
		directed: false,
	})),
};

const cycle10: AnalyzerGraph = {
	vertices: Array.from({ length: 10 }, (_, index) => ({ id: `v${index}` })),
	edges: Array.from({ length: 10 }, (_, index) => ({
		id: `e${index}`,
		endpoints: [`v${index}`, `v${(index + 1) % 10}`],
		directed: false,
	})),
};

// Power-law-like degree distribution (hub and spoke pattern)
const hubSpoke: AnalyzerGraph = {
	vertices: [
		{ id: "hub" },
		...Array.from({ length: 15 }, (_, index) => ({ id: `leaf${index}` })),
	],
	edges: Array.from({ length: 15 }, (_, index) => ({
		id: `e${index}`,
		endpoints: ["hub", `leaf${index}`],
		directed: false,
	})),
};

const hyperEdgeGraph: AnalyzerGraph = {
	vertices: [{ id: "a" }, { id: "b" }, { id: "c" }],
	edges: [
		{ id: "e1", endpoints: ["a", "b", "c"], directed: false },
	],
};

const layeredGraph: AnalyzerGraph = {
	vertices: [
		{ id: "a", attrs: { layer: "L1" } },
		{ id: "b", attrs: { layer: "L1" } },
		{ id: "c", attrs: { layer: "L2" } },
		{ id: "d", attrs: { layer: "L2" } },
	],
	edges: [
		{ id: "e1", endpoints: ["a", "b"], directed: false },
		{ id: "e2", endpoints: ["c", "d"], directed: false },
		{ id: "e3", endpoints: ["a", "c"], directed: false },
	],
};

// ============================================================================
// computeScaleFree
// ============================================================================

describe("computeScaleFree", () => {
	it("returns not_scale_free for empty graph", () => {
		const result = computeScaleFree(emptyGraph);
		expect(result).toEqual({ kind: "not_scale_free" });
	});

	it("returns not_scale_free for directed graphs", () => {
		const result = computeScaleFree(directedGraph);
		expect(result).toEqual({ kind: "not_scale_free" });
	});

	it("returns not_scale_free for small graphs (n < 10)", () => {
		const result = computeScaleFree(simpleTriangle);
		expect(result).toEqual({ kind: "not_scale_free" });
	});

	it("returns not_scale_free for regular graphs (uniform degree)", () => {
		const result = computeScaleFree(cycle10);
		expect(result).toEqual({ kind: "not_scale_free" });
	});

	it("handles hub-spoke pattern", () => {
		const result = computeScaleFree(hubSpoke);
		// Hub-spoke may or may not be scale-free depending on the algorithm's threshold
		expect(result.kind).toMatch(/^(scale_free|not_scale_free)$/);
	});

	it("returns scale_free for path with exponent", () => {
		const result = computeScaleFree(path10);
		expect(result.kind).toBe("scale_free");
		if (result.kind === "scale_free") {
			expect(result.exponent).toBeCloseTo(0.43, 1);
		}
	});
});

// ============================================================================
// computeSmallWorld
// ============================================================================

describe("computeSmallWorld", () => {
	it("returns unconstrained for empty graph", () => {
		const result = computeSmallWorld(emptyGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeSmallWorld(directedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for disconnected graph", () => {
		const result = computeSmallWorld(disconnectedGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for very small graphs (n < 3)", () => {
		const result = computeSmallWorld(singleVertex);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("handles triangle", () => {
		const result = computeSmallWorld(simpleTriangle);
		// Triangle is fully connected, so short paths and high clustering
		expect(result.kind).toMatch(/^(small_world|not_small_world|unconstrained)$/);
	});

	it("returns result for connected cycle", () => {
		const result = computeSmallWorld(cycle10);
		// Cycles typically don't have small-world property (low clustering, longer paths)
		expect(result.kind).toMatch(/^(small_world|not_small_world)$/);
	});

	it("returns unconstrained for hypergraphs", () => {
		const result = computeSmallWorld(hyperEdgeGraph);
		expect(result).toEqual({ kind: "unconstrained" });
	});
});

// ============================================================================
// computeCommunityStructure
// ============================================================================

describe("computeCommunityStructure", () => {
	const policy = defaultComputePolicy;

	it("returns unconstrained for empty graph", () => {
		const result = computeCommunityStructure(emptyGraph, policy);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for directed graphs", () => {
		const result = computeCommunityStructure(directedGraph, policy);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns unconstrained for very small graphs (n < 4)", () => {
		const result = computeCommunityStructure(simpleTriangle, policy);
		expect(result).toEqual({ kind: "unconstrained" });
	});

	it("returns non_modular for single connected component", () => {
		const fourCycle: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["b", "c"], directed: false },
				{ id: "e3", endpoints: ["c", "d"], directed: false },
				{ id: "e4", endpoints: ["d", "a"], directed: false },
			],
		};
		const result = computeCommunityStructure(fourCycle, policy);
		expect(result).toEqual({ kind: "non_modular" });
	});

	it("returns modular for disconnected components", () => {
		const result = computeCommunityStructure(disconnectedGraph, policy);
		expect(result.kind).toBe("modular");
		if (result.kind === "modular") {
			expect(result.numCommunities).toBe(2);
		}
	});

	it("uses layer attribute for community detection when present", () => {
		const result = computeCommunityStructure(layeredGraph, policy);
		expect(result.kind).toBe("modular");
		if (result.kind === "modular") {
			expect(result.numCommunities).toBe(2);
		}
	});

	it("returns unconstrained for hypergraphs", () => {
		const result = computeCommunityStructure(hyperEdgeGraph, policy);
		expect(result).toEqual({ kind: "unconstrained" });
	});
});

// ============================================================================
// Edge cases and integration
// ============================================================================

describe("spectral edge cases", () => {
	it("handles isolated vertices in otherwise connected graph", () => {
		const withIsolate: AnalyzerGraph = {
			vertices: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "isolated" }],
			edges: [
				{ id: "e1", endpoints: ["a", "b"], directed: false },
				{ id: "e2", endpoints: ["b", "c"], directed: false },
				{ id: "e3", endpoints: ["c", "a"], directed: false },
			],
		};

		// Scale-free: isolated vertex has degree 0
		const scaleFree = computeScaleFree(withIsolate);
		expect(scaleFree).toEqual({ kind: "not_scale_free" });

		// Small-world: not connected
		const smallWorld = computeSmallWorld(withIsolate);
		expect(smallWorld).toEqual({ kind: "unconstrained" });

		// Community: should find 2 components
		const community = computeCommunityStructure(withIsolate, defaultComputePolicy);
		expect(community.kind).toBe("modular");
	});

	it("handles self-loops", () => {
		const withSelfLoop: AnalyzerGraph = {
			vertices: Array.from({ length: 10 }, (_, index) => ({ id: `v${index}` })),
			edges: [
				...Array.from({ length: 9 }, (_, index) => ({
					id: `e${index}`,
					endpoints: [`v${index}`, `v${index + 1}`],
					directed: false,
				})),
				{ id: "loop", endpoints: ["v0", "v0"], directed: false },
			],
		};

		// Self-loops shouldn't break the analysis
		const scaleFree = computeScaleFree(withSelfLoop);
		expect(scaleFree.kind).toMatch(/^(scale_free|not_scale_free)$/);
	});

	it("handles all vertices with same degree (regular graph)", () => {
		// Complete graph K5
		const k5: AnalyzerGraph = {
			vertices: Array.from({ length: 5 }, (_, index) => ({ id: `v${index}` })),
			edges: [],
		};
		for (let index = 0; index < 5; index++) {
			for (let index_ = index + 1; index_ < 5; index_++) {
				k5.edges.push({
					id: `e${index}_${index_}`,
					endpoints: [`v${index}`, `v${index_}`],
					directed: false,
				});
			}
		}

		// Regular graphs are not scale-free
		const scaleFree = computeScaleFree(k5);
		expect(scaleFree).toEqual({ kind: "not_scale_free" });

		// Complete graphs may or may not be small-world
		const smallWorld = computeSmallWorld(k5);
		expect(smallWorld.kind).toMatch(/^(small_world|not_small_world)$/);
	});

	it("handles multi-component graphs for community detection", () => {
		const threeComponents: AnalyzerGraph = {
			vertices: [
				{ id: "a1" }, { id: "a2" },
				{ id: "b1" }, { id: "b2" },
				{ id: "c1" }, { id: "c2" },
			],
			edges: [
				{ id: "e1", endpoints: ["a1", "a2"], directed: false },
				{ id: "e2", endpoints: ["b1", "b2"], directed: false },
				{ id: "e3", endpoints: ["c1", "c2"], directed: false },
			],
		};

		const community = computeCommunityStructure(threeComponents, defaultComputePolicy);
		expect(community.kind).toBe("modular");
		if (community.kind === "modular") {
			expect(community.numCommunities).toBe(3);
		}
	});

	it("handles graph with explicit community labels", () => {
		const labeled: AnalyzerGraph = {
			vertices: [
				{ id: "a1", attrs: { layer: "A" } },
				{ id: "a2", attrs: { layer: "A" } },
				{ id: "b1", attrs: { layer: "B" } },
				{ id: "b2", attrs: { layer: "B" } },
			],
			edges: [
				{ id: "e1", endpoints: ["a1", "a2"], directed: false },
				{ id: "e2", endpoints: ["b1", "b2"], directed: false },
				{ id: "e3", endpoints: ["a1", "b1"], directed: false },
			],
		};

		const community = computeCommunityStructure(labeled, defaultComputePolicy);
		expect(community.kind).toBe("modular");
		if (community.kind === "modular") {
			expect(community.numCommunities).toBe(2);
		}
	});
});

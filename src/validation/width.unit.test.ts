/**
 * Unit tests for width graph class validators
 */

import { describe, expect, it } from "vitest";

import type { TestGraph } from "../generation/generators/types.js";
import { validateCliquewidth,validatePathwidth } from "./width.js";

/**
 * Helper to create minimal spec with overrides
 * @param overrides
 */
const createSpec = (overrides: Record<string, unknown> = {}) => ({
	directionality: { kind: "undirected" as const },
	weighting: { kind: "unweighted" as const },
	cycles: { kind: "cycles_allowed" as const },
	connectivity: { kind: "connected" as const },
	schema: { kind: "homogeneous" as const },
	edgeMultiplicity: { kind: "simple" as const },
	selfLoops: { kind: "disallowed" as const },
	density: { kind: "sparse" as const },
	completeness: { kind: "incomplete" as const },
	randomness: { kind: "deterministic" as const },
	...overrides,
});

/**
 * Helper to create test graph
 * @param nodes
 * @param edges
 * @param specOverrides
 */
const makeTestGraph = (
	nodes: Array<{ id: string }>,
	edges: Array<{ source: string; target: string }>,
	specOverrides: Record<string, unknown> = {}
): TestGraph => ({
	nodes,
	edges,
	spec: createSpec(specOverrides) as TestGraph["spec"],
});

describe("validatePathwidth", () => {
	it("should pass for unconstrained spec", () => {
		const graph = makeTestGraph([{ id: "A" }], [], { pathwidth: { kind: "unconstrained" } });
		const result = validatePathwidth(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("should skip validation for large graphs (n > 10)", () => {
		const nodes = [];
		for (let index = 0; index < 15; index++) {
			nodes.push({ id: `N${index}` });
		}
		const graph = makeTestGraph(nodes, [], { pathwidth: { kind: "pathwidth_bounded" } });
		const result = validatePathwidth(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("pathwidth_bounded");
	});

	it("should validate tree (pathwidth 1)", () => {
		// Tree has pathwidth 1
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }],
			[
				{ source: "A", target: "B" },
				{ source: "A", target: "C" },
				{ source: "B", target: "D" },
				{ source: "B", target: "E" },
			],
			{ pathwidth: { kind: "pathwidth_bounded" } }
		);
		const result = validatePathwidth(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("pathwidth_bounded");
	});

	it("should validate path graph", () => {
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
			[
				{ source: "A", target: "B" },
				{ source: "B", target: "C" },
				{ source: "C", target: "D" },
			],
			{ pathwidth: { kind: "pathwidth_bounded" } }
		);
		const result = validatePathwidth(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("pathwidth_bounded");
	});

	it("should detect unbounded pathwidth (complete graph K5)", () => {
		// K5 has high pathwidth
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }],
			[
				{ source: "A", target: "B" },
				{ source: "A", target: "C" },
				{ source: "A", target: "D" },
				{ source: "A", target: "E" },
				{ source: "B", target: "C" },
				{ source: "B", target: "D" },
				{ source: "B", target: "E" },
				{ source: "C", target: "D" },
				{ source: "C", target: "E" },
				{ source: "D", target: "E" },
			],
			{ pathwidth: { kind: "pathwidth_bounded" } }
		);
		const result = validatePathwidth(graph);
		expect(result.valid).toBe(false);
		expect(result.actual).toBe("unconstrained");
	});
});

describe("validateCliquewidth", () => {
	it("should pass for unconstrained spec", () => {
		const graph = makeTestGraph([{ id: "A" }], [], { cliquewidth: { kind: "unconstrained" } });
		const result = validateCliquewidth(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("should skip validation for large graphs (n > 10)", () => {
		const nodes = [];
		for (let index = 0; index < 15; index++) {
			nodes.push({ id: `N${index}` });
		}
		const graph = makeTestGraph(nodes, [], { cliquewidth: { kind: "cliquewidth_bounded" } });
		const result = validateCliquewidth(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("cliquewidth_bounded");
	});

	it("should validate cograph (cliquewidth ≤ 2)", () => {
		// Triangle is a cograph
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }],
			[
				{ source: "A", target: "B" },
				{ source: "B", target: "C" },
				{ source: "C", target: "A" },
			],
			{ cliquewidth: { kind: "cliquewidth_bounded" } }
		);
		const result = validateCliquewidth(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("cliquewidth_bounded");
	});

	it("should validate tree (cliquewidth ≤ 3)", () => {
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }],
			[
				{ source: "A", target: "B" },
				{ source: "A", target: "C" },
				{ source: "B", target: "D" },
				{ source: "B", target: "E" },
			],
			{ cliquewidth: { kind: "cliquewidth_bounded" } }
		);
		const result = validateCliquewidth(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("cliquewidth_bounded");
	});

	it("should validate bipartite graph (cliquewidth ≤ 4)", () => {
		// K2,2 bipartite graph
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
			[
				{ source: "A", target: "C" },
				{ source: "A", target: "D" },
				{ source: "B", target: "C" },
				{ source: "B", target: "D" },
			],
			{ cliquewidth: { kind: "cliquewidth_bounded" } }
		);
		const result = validateCliquewidth(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("cliquewidth_bounded");
	});

	it("should detect unbounded cliquewidth (odd cycle C5)", () => {
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }],
			[
				{ source: "A", target: "B" },
				{ source: "B", target: "C" },
				{ source: "C", target: "D" },
				{ source: "D", target: "E" },
				{ source: "E", target: "A" },
			],
			{ cliquewidth: { kind: "cliquewidth_bounded" } }
		);
		const result = validateCliquewidth(graph);
		// C5 has odd cycle, so not bipartite, not tree, not cograph
		expect(result.valid).toBe(false);
		expect(result.actual).toBe("unconstrained");
	});
});

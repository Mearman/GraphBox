/**
 * Unit tests for perfect variant graph class validators
 */

import { describe, expect, it } from "vitest";

import type { TestGraph } from "../generation/generators/types.js";
import { validateModular, validatePtolemaic, validateQuasiLine } from "./perfect-variants.js";

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

describe("validateModular", () => {
	it("should pass for unconstrained spec", () => {
		const graph = makeTestGraph([{ id: "A" }], [], { modular: { kind: "unconstrained" } });
		const result = validateModular(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("should return trivial for very small graphs", () => {
		const graph = makeTestGraph([{ id: "A" }], [], { modular: { kind: "modular" } });
		const result = validateModular(graph);
		expect(result.valid).toBe(true);
		// Single node graph is modular
		expect(result.actual).toBe("modular");
	});

	it("should skip validation for large graphs (n > 10)", () => {
		const nodes = [];
		for (let index = 0; index < 15; index++) {
			nodes.push({ id: `N${index}` });
		}
		const graph = makeTestGraph(nodes, [], { modular: { kind: "modular" } });
		const result = validateModular(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("modular");
	});

	it("should validate modular graph (P2 - path of 2 nodes)", () => {
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }],
			[{ source: "A", target: "B" }],
			{ modular: { kind: "modular" } }
		);
		const result = validateModular(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("modular");
	});

	it("should detect non-modular graph (triangle)", () => {
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }],
			[
				{ source: "A", target: "B" },
				{ source: "B", target: "C" },
				{ source: "C", target: "A" },
			],
			{ modular: { kind: "modular" } }
		);
		const result = validateModular(graph);
		expect(result.valid).toBe(false);
		expect(result.actual).toBe("not_modular");
	});

	it("should detect non-modular graph (disjoint union K2 + K2)", () => {
		// Disjoint union of two edges: nodes in different components are twins
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
			[
				{ source: "A", target: "B" },
				{ source: "C", target: "D" },
			],
			{ modular: { kind: "modular" } }
		);
		const result = validateModular(graph);
		expect(result.valid).toBe(false);
		expect(result.actual).toBe("not_modular");
	});
});

describe("validatePtolemaic", () => {
	it("should pass for unconstrained spec", () => {
		const graph = makeTestGraph([{ id: "A" }], [], { ptolemaic: { kind: "unconstrained" } });
		const result = validatePtolemaic(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("should return trivial for very small graphs", () => {
		const graph = makeTestGraph([{ id: "A" }], [], { ptolemaic: { kind: "ptolemaic" } });
		const result = validatePtolemaic(graph);
		expect(result.valid).toBe(true);
		// Single node graph is ptolemaic
		expect(result.actual).toBe("ptolemaic");
	});

	it("should skip validation for large graphs (n > 10)", () => {
		const nodes = [];
		for (let index = 0; index < 15; index++) {
			nodes.push({ id: `N${index}` });
		}
		const graph = makeTestGraph(nodes, [], { ptolemaic: { kind: "ptolemaic" } });
		const result = validatePtolemaic(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("ptolemaic");
	});

	it("should validate ptolemaic graph (tree)", () => {
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
			[
				{ source: "A", target: "B" },
				{ source: "A", target: "C" },
				{ source: "B", target: "D" },
			],
			{ ptolemaic: { kind: "ptolemaic" } }
		);
		const result = validatePtolemaic(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("ptolemaic");
	});

	it("should detect non-ptolemaic graph (C4)", () => {
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
			[
				{ source: "A", target: "B" },
				{ source: "B", target: "C" },
				{ source: "C", target: "D" },
				{ source: "D", target: "A" },
			],
			{ ptolemaic: { kind: "ptolemaic" } }
		);
		const result = validatePtolemaic(graph);
		expect(result.valid).toBe(false);
		expect(result.actual).toBe("not_ptolemaic");
	});
});

describe("validateQuasiLine", () => {
	it("should pass for unconstrained spec", () => {
		const graph = makeTestGraph([{ id: "A" }], [], { quasiLine: { kind: "unconstrained" } });
		const result = validateQuasiLine(graph);
		expect(result.valid).toBe(true);
		expect(result.expected).toBe("unconstrained");
	});

	it("should return trivial for very small graphs (n < 5)", () => {
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
			[{ source: "A", target: "B" }],
			{ quasiLine: { kind: "quasi_line" } }
		);
		const result = validateQuasiLine(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("quasi_line");
	});

	it("should skip validation for large graphs (n > 10)", () => {
		const nodes = [];
		for (let index = 0; index < 15; index++) {
			nodes.push({ id: `N${index}` });
		}
		const graph = makeTestGraph(nodes, [], { quasiLine: { kind: "quasi_line" } });
		const result = validateQuasiLine(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("quasi_line");
	});

	it("should validate quasi-line graph (path)", () => {
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }],
			[
				{ source: "A", target: "B" },
				{ source: "B", target: "C" },
				{ source: "C", target: "D" },
				{ source: "D", target: "E" },
			],
			{ quasiLine: { kind: "quasi_line" } }
		);
		const result = validateQuasiLine(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("quasi_line");
	});

	it("should validate quasi-line graph (complete bipartite K2,3)", () => {
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }],
			[
				{ source: "A", target: "C" },
				{ source: "A", target: "D" },
				{ source: "A", target: "E" },
				{ source: "B", target: "C" },
				{ source: "B", target: "D" },
				{ source: "B", target: "E" },
			],
			{ quasiLine: { kind: "quasi_line" } }
		);
		const result = validateQuasiLine(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("quasi_line");
	});

	it("should validate quasi-line graph", () => {
		// This graph is quasi-line (no induced gem or co-gem)
		const graph = makeTestGraph(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }],
			[
				{ source: "A", target: "B" },
				{ source: "A", target: "C" },
				{ source: "A", target: "D" },
				{ source: "B", target: "C" },
				{ source: "C", target: "D" },
				{ source: "D", target: "E" },
			],
			{ quasiLine: { kind: "quasi_line" } }
		);
		const result = validateQuasiLine(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("quasi_line");
	});
});

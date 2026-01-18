import { describe, expect, it } from "vitest";

import type { TestEdge, TestGraph , TestNode } from "../generation/generators/types";
import {
	validateBipartite,
	validateDensityAndCompleteness,
	validateTournament,
} from "./density-connectivity";

// Helper to create minimal spec
const createSpec = (overrides: Record<string, any> = {}) => ({
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
	specOverrides: Record<string, any> = {}
): TestGraph => ({
	nodes,
	edges,
	spec: createSpec(specOverrides) as any,
});

describe("validateDensityAndCompleteness", () => {
	it("should return valid for graph with less than 2 nodes", () => {
		const graph = createGraph(
			[{ id: "a" }],
			[],
			{ density: { kind: "sparse" } }
		);
		const result = validateDensityAndCompleteness(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate complete undirected graph", () => {
		// K3 has 3 edges
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "a", target: "c" },
				{ source: "b", target: "c" },
			],
			{ completeness: { kind: "complete" } }
		);
		const result = validateDensityAndCompleteness(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("complete");
	});

	it("should fail incomplete graph when complete expected", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
			],
			{ completeness: { kind: "complete" } }
		);
		const result = validateDensityAndCompleteness(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("missing");
	});

	it("should validate complete directed graph", () => {
		// Complete directed graph on 3 nodes has 6 edges
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "a", target: "c" },
				{ source: "b", target: "a" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
				{ source: "c", target: "b" },
			],
			{
				completeness: { kind: "complete" },
				directionality: { kind: "directed" },
			}
		);
		const result = validateDensityAndCompleteness(graph);
		expect(result.valid).toBe(true);
	});

	it("should classify sparse graph correctly", () => {
		// For sparse classification (< 20%), need very few edges relative to max
		// With unconstrained connectivity, the validator may relax density validation
		// when the graph structure constrains edge count
		const graph = createGraph(
			[
				{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" },
				{ id: "f" }, { id: "g" }, { id: "h" }, { id: "i" }, { id: "j" },
			],
			[
				{ source: "a", target: "b" },
				{ source: "c", target: "d" },
				{ source: "e", target: "f" },
				{ source: "g", target: "h" },
			], // 4 edges out of 45 possible = ~9%
			{ density: { kind: "sparse" }, connectivity: { kind: "connected" } }
		);
		const result = validateDensityAndCompleteness(graph);
		// Due to structural constraints, the validator allows flexibility
		expect(result.valid).toBe(true);
	});

	it("should classify dense graph correctly", () => {
		// K4 minus one edge = 5/6 edges = ~83%
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "a", target: "c" },
				{ source: "a", target: "d" },
				{ source: "b", target: "c" },
				{ source: "b", target: "d" },
			],
			{ density: { kind: "dense" } }
		);
		const result = validateDensityAndCompleteness(graph);
		expect(result.valid).toBe(true);
	});

	it("should return valid for unconstrained density", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[{ source: "a", target: "b" }],
			{ density: { kind: "unconstrained" } }
		);
		const result = validateDensityAndCompleteness(graph);
		expect(result.valid).toBe(true);
	});

	it("should handle self-loops in completeness calculation", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[
				{ source: "a", target: "b" },
				{ source: "a", target: "a" },
				{ source: "b", target: "b" },
			],
			{
				completeness: { kind: "complete" },
				selfLoops: { kind: "allowed" },
			}
		);
		const result = validateDensityAndCompleteness(graph);
		expect(result.valid).toBe(true);
	});

	it("should apply density relaxation with adjustments", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[{ source: "a", target: "b" }],
			{ density: { kind: "dense" } }
		);
		const result = validateDensityAndCompleteness(graph, {
			relaxDensityValidation: true,
		});
		expect(result.valid).toBe(true);
	});
});

describe("validateBipartite", () => {
	it("should return valid when partiteness is unrestricted", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			]
		);
		const result = validateBipartite(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate bipartite path graph", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "d" },
			],
			{ partiteness: { kind: "bipartite" } }
		);
		const result = validateBipartite(graph);
		expect(result.valid).toBe(true);
	});

	it("should fail non-bipartite triangle", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{ partiteness: { kind: "bipartite" } }
		);
		const result = validateBipartite(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("odd-length cycle");
	});

	it("should validate bipartite complete graph K2,3", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "1" }, { id: "2" }, { id: "3" }],
			[
				{ source: "a", target: "1" },
				{ source: "a", target: "2" },
				{ source: "a", target: "3" },
				{ source: "b", target: "1" },
				{ source: "b", target: "2" },
				{ source: "b", target: "3" },
			],
			{ partiteness: { kind: "bipartite" } }
		);
		const result = validateBipartite(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate bipartite even cycle", () => {
		// 4-cycle is bipartite
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "d" },
				{ source: "d", target: "a" },
			],
			{ partiteness: { kind: "bipartite" } }
		);
		const result = validateBipartite(graph);
		expect(result.valid).toBe(true);
	});

	it("should fail non-bipartite odd cycle", () => {
		// 5-cycle is not bipartite
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "d" },
				{ source: "d", target: "e" },
				{ source: "e", target: "a" },
			],
			{ partiteness: { kind: "bipartite" } }
		);
		const result = validateBipartite(graph);
		expect(result.valid).toBe(false);
	});

	it("should handle disconnected bipartite components", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "c", target: "d" },
			],
			{ partiteness: { kind: "bipartite" } }
		);
		const result = validateBipartite(graph);
		expect(result.valid).toBe(true);
	});
});

describe("validateTournament", () => {
	it("should return valid when tournament is unconstrained", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[{ source: "a", target: "b" }]
		);
		const result = validateTournament(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate trivial tournament with less than 2 nodes", () => {
		const graph = createGraph([{ id: "a" }], [], {
			tournament: { kind: "tournament" },
		});
		const result = validateTournament(graph);
		expect(result.valid).toBe(true);
		expect(result.actual).toBe("trivial");
	});

	it("should validate tournament on 3 nodes", () => {
		// Tournament: exactly one directed edge between each pair
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "a", target: "c" },
			],
			{
				tournament: { kind: "tournament" },
				directionality: { kind: "directed" },
			}
		);
		const result = validateTournament(graph);
		expect(result.valid).toBe(true);
	});

	it("should fail tournament with self-loop", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[
				{ source: "a", target: "b" },
				{ source: "a", target: "a" },
			],
			{
				tournament: { kind: "tournament" },
				directionality: { kind: "directed" },
			}
		);
		const result = validateTournament(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("Self-loop");
	});

	it("should fail tournament with bidirectional edges", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "a" },
			],
			{
				tournament: { kind: "tournament" },
				directionality: { kind: "directed" },
			}
		);
		const result = validateTournament(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("Bidirectional");
	});

	it("should fail tournament with missing edges", () => {
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[{ source: "a", target: "b" }],
			{
				tournament: { kind: "tournament" },
				directionality: { kind: "directed" },
			}
		);
		const result = validateTournament(graph);
		expect(result.valid).toBe(false);
		expect(result.message).toContain("Missing");
	});

	it("should validate tournament on 4 nodes", () => {
		// Complete tournament on 4 nodes has 6 directed edges
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
			[
				{ source: "a", target: "b" },
				{ source: "a", target: "c" },
				{ source: "a", target: "d" },
				{ source: "b", target: "c" },
				{ source: "b", target: "d" },
				{ source: "c", target: "d" },
			],
			{
				tournament: { kind: "tournament" },
				directionality: { kind: "directed" },
			}
		);
		const result = validateTournament(graph);
		expect(result.valid).toBe(true);
	});

	it("should validate cyclic tournament on 3 nodes", () => {
		// Cyclic tournament: a->b, b->c, c->a
		const graph = createGraph(
			[{ id: "a" }, { id: "b" }, { id: "c" }],
			[
				{ source: "a", target: "b" },
				{ source: "b", target: "c" },
				{ source: "c", target: "a" },
			],
			{
				tournament: { kind: "tournament" },
				directionality: { kind: "directed" },
			}
		);
		const result = validateTournament(graph);
		expect(result.valid).toBe(true);
	});
});

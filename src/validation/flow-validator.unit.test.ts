import { describe, expect, it } from "vitest";

import type { TestGraph } from "../generation/generator";
import type { TestEdge, TestNode } from "../generation/generators/types";
import { validateFlowNetwork } from "./flow-validator";

// Helper to create minimal spec
const createSpec = (overrides: Record<string, unknown> = {}) => ({
	directionality: { kind: "directed" as const },
	weighting: { kind: "weighted_numeric" as const },
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

describe("validateFlowNetwork", () => {
	describe("when flowNetwork is not specified", () => {
		it("should return valid for unconstrained flowNetwork", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "b" }],
				[{ source: "a", target: "b", weight: 10 }]
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(true);
			expect(result.property).toBe("flowNetwork");
		});
	});

	describe("when flowNetwork is specified", () => {
		it("should return valid for proper flow network", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "a" }, { id: "b" }, { id: "t" }],
				[
					{ source: "s", target: "a", weight: 10 },
					{ source: "s", target: "b", weight: 5 },
					{ source: "a", target: "t", weight: 10 },
					{ source: "b", target: "t", weight: 5 },
				],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("flow_network");
		});

		it("should return invalid when graph is undirected", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "t" }],
				[{ source: "s", target: "t", weight: 10 }],
				{
					directionality: { kind: "undirected" },
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("must be directed");
		});

		it("should return invalid when source node does not exist", () => {
			const graph = createGraph(
				[{ id: "a" }, { id: "t" }],
				[{ source: "a", target: "t", weight: 10 }],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("Source node 's' does not exist");
		});

		it("should return invalid when sink node does not exist", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "a" }],
				[{ source: "s", target: "a", weight: 10 }],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("Sink node 't' does not exist");
		});

		it("should return invalid when source and sink are the same", () => {
			const graph = createGraph(
				[{ id: "s" }],
				[],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "s" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("Source and sink must be different");
		});

		it("should return invalid when graph is unweighted", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "t" }],
				[{ source: "s", target: "t", weight: 10 }],
				{
					weighting: { kind: "unweighted" },
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("must have weighted edges");
		});

		it("should return invalid when edges have no capacity", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "t" }],
				[{ source: "s", target: "t" }],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("Missing capacities");
		});

		it("should return invalid when edges have negative capacity", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "t" }],
				[{ source: "s", target: "t", weight: -5 }],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("Negative capacities");
		});

		it("should warn when edges enter the source", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "a" }, { id: "t" }],
				[
					{ source: "s", target: "a", weight: 10 },
					{ source: "a", target: "s", weight: 5 },
					{ source: "a", target: "t", weight: 10 },
				],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(true);
			expect(result.message).toContain("entering");
			expect(result.message).toContain("source");
		});

		it("should warn when edges leave the sink", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "a" }, { id: "t" }],
				[
					{ source: "s", target: "a", weight: 10 },
					{ source: "a", target: "t", weight: 10 },
					{ source: "t", target: "a", weight: 5 },
				],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(true);
			expect(result.message).toContain("leaving");
			expect(result.message).toContain("sink");
		});

		it("should warn when nodes are disconnected from source-sink path", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "a" }, { id: "b" }, { id: "t" }],
				[
					{ source: "s", target: "a", weight: 10 },
					{ source: "a", target: "t", weight: 10 },
				],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(true);
			expect(result.message).toContain("disconnected node");
		});

		it("should handle empty graph with source and sink specified", () => {
			const graph = createGraph(
				[],
				[],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(false);
			expect(result.message).toContain("does not exist");
		});

		it("should handle graph with only source and sink", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "t" }],
				[{ source: "s", target: "t", weight: 10 }],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(true);
		});

		it("should handle complex flow network with multiple paths", () => {
			const graph = createGraph(
				[
					{ id: "s" },
					{ id: "a" },
					{ id: "b" },
					{ id: "c" },
					{ id: "d" },
					{ id: "t" },
				],
				[
					{ source: "s", target: "a", weight: 10 },
					{ source: "s", target: "b", weight: 10 },
					{ source: "a", target: "c", weight: 5 },
					{ source: "a", target: "d", weight: 5 },
					{ source: "b", target: "c", weight: 5 },
					{ source: "b", target: "d", weight: 5 },
					{ source: "c", target: "t", weight: 10 },
					{ source: "d", target: "t", weight: 10 },
				],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(true);
			expect(result.actual).toBe("flow_network");
		});

		it("should handle zero-capacity edges", () => {
			const graph = createGraph(
				[{ id: "s" }, { id: "t" }],
				[{ source: "s", target: "t", weight: 0 }],
				{
					flowNetwork: { kind: "flow_network", source: "s", sink: "t" },
				}
			);
			const result = validateFlowNetwork(graph);
			expect(result.valid).toBe(true);
		});
	});
});

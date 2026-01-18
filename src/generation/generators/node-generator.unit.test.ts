import { describe, expect, it } from "vitest";

import type { GraphGenerationConfig } from "../generator";
import type { GraphSpec } from "../spec";
import { generateNodes } from "./node-generator";
import { SeededRandom } from "./types";

// Helper to create a basic graph spec
const createSpec = (overrides: Partial<GraphSpec> = {}): GraphSpec => ({
	directionality: { kind: "undirected" },
	connectivity: { kind: "connected" },
	cycles: { kind: "cycles_allowed" },
	density: { kind: "moderate" },
	edgeMultiplicity: { kind: "simple" },
	selfLoops: { kind: "disallowed" },
	completeness: { kind: "incomplete" },
	weighting: { kind: "unweighted" },
	schema: { kind: "homogeneous" },
	...overrides,
});

// Helper to create config
const createConfig = (overrides: Partial<GraphGenerationConfig> = {}): GraphGenerationConfig => ({
	nodeCount: 10,
	seed: 42,
	...overrides,
});

describe("node-generator", () => {
	describe("generateNodes", () => {
		it("should create correct number of nodes", () => {
			const spec = createSpec();
			const config = createConfig({ nodeCount: 8 });
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			expect(nodes.length).toBe(8);
		});

		it("should assign sequential IDs", () => {
			const spec = createSpec();
			const config = createConfig({ nodeCount: 5 });
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			expect(nodes.map(n => n.id)).toEqual(["N0", "N1", "N2", "N3", "N4"]);
		});

		it("should assign bipartite partitions for bipartite graphs", () => {
			const spec = createSpec({
				partiteness: { kind: "bipartite" },
			});
			const config = createConfig({ nodeCount: 10 });
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			const leftCount = nodes.filter(n => n.partition === "left").length;
			const rightCount = nodes.filter(n => n.partition === "right").length;

			// Should split roughly 50-50
			expect(leftCount).toBe(5);
			expect(rightCount).toBe(5);
		});

		it("should handle odd node count for bipartite", () => {
			const spec = createSpec({
				partiteness: { kind: "bipartite" },
			});
			const config = createConfig({ nodeCount: 7 });
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			const leftCount = nodes.filter(n => n.partition === "left").length;
			const rightCount = nodes.filter(n => n.partition === "right").length;

			// 7 nodes: floor(7/2) = 3 left, 7-3 = 4 right
			expect(leftCount).toBe(3);
			expect(rightCount).toBe(4);
		});

		it("should assign partitions for complete bipartite K_{m,n}", () => {
			const spec = createSpec({
				completeBipartite: { kind: "complete_bipartite", m: 3, n: 4 },
			});
			const config = createConfig({ nodeCount: 10 });
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			const leftCount = nodes.filter(n => n.partition === "left").length;
			const rightCount = nodes.filter(n => n.partition === "right").length;

			// Should respect m, n sizes
			expect(leftCount).toBe(3);
			expect(rightCount).toBe(4);
		});

		it("should handle complete bipartite with limited nodeCount", () => {
			const spec = createSpec({
				completeBipartite: { kind: "complete_bipartite", m: 10, n: 10 },
			});
			const config = createConfig({ nodeCount: 5 });
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			// m is limited to nodeCount
			const leftCount = nodes.filter(n => n.partition === "left").length;
			const rightCount = nodes.filter(n => n.partition === "right").length;

			expect(leftCount).toBeLessThanOrEqual(5);
			expect(leftCount + rightCount).toBeLessThanOrEqual(5);
		});

		it("should not assign partitions for non-bipartite graphs", () => {
			const spec = createSpec();
			const config = createConfig({ nodeCount: 5 });
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			for (const node of nodes) {
				expect(node.partition).toBeUndefined();
			}
		});

		it("should assign node types for heterogeneous schema", () => {
			const spec = createSpec({
				schema: { kind: "heterogeneous" },
			});
			const config = createConfig({
				nodeCount: 10,
				nodeTypes: [
					{ type: "person", proportion: 0.5 },
					{ type: "place", proportion: 0.3 },
					{ type: "thing", proportion: 0.2 },
				],
			});
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			for (const node of nodes) {
				expect(node.type).toBeDefined();
				expect(["person", "place", "thing"]).toContain(node.type);
			}
		});

		it("should distribute types according to proportions", () => {
			const spec = createSpec({
				schema: { kind: "heterogeneous" },
			});
			const config = createConfig({
				nodeCount: 100,
				nodeTypes: [
					{ type: "A", proportion: 0.7 },
					{ type: "B", proportion: 0.3 },
				],
			});
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			const typeACounts = nodes.filter(n => n.type === "A").length;
			const typeBCounts = nodes.filter(n => n.type === "B").length;

			// Should be approximately 70/30 split (with some variance)
			expect(typeACounts).toBeGreaterThan(50);
			expect(typeACounts).toBeLessThan(90);
			expect(typeBCounts).toBeGreaterThan(10);
			expect(typeBCounts).toBeLessThan(50);
		});

		it("should use last type as fallback", () => {
			const spec = createSpec({
				schema: { kind: "heterogeneous" },
			});
			const config = createConfig({
				nodeCount: 5,
				nodeTypes: [
					{ type: "only", proportion: 0 }, // 0 proportion
				],
			});
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			// All nodes should get "only" type as fallback
			for (const node of nodes) {
				expect(node.type).toBe("only");
			}
		});

		it("should not assign types for homogeneous schema", () => {
			const spec = createSpec({
				schema: { kind: "homogeneous" },
			});
			const config = createConfig({
				nodeCount: 5,
				nodeTypes: [
					{ type: "ignored", proportion: 1 },
				],
			});
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			for (const node of nodes) {
				expect(node.type).toBeUndefined();
			}
		});

		it("should handle empty nodeCount", () => {
			const spec = createSpec();
			const config = createConfig({ nodeCount: 0 });
			const rng = new SeededRandom(42);

			const nodes = generateNodes(spec, config, rng);

			expect(nodes.length).toBe(0);
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const spec = createSpec({
				schema: { kind: "heterogeneous" },
			});
			const config = createConfig({
				nodeCount: 10,
				nodeTypes: [
					{ type: "A", proportion: 0.5 },
					{ type: "B", proportion: 0.5 },
				],
			});

			const nodes1 = generateNodes(spec, config, new SeededRandom(42));
			const nodes2 = generateNodes(spec, config, new SeededRandom(42));

			expect(nodes1).toEqual(nodes2);
		});

		it("should produce different results with different seeds", () => {
			const spec = createSpec({
				schema: { kind: "heterogeneous" },
			});
			const config = createConfig({
				nodeCount: 20,
				nodeTypes: [
					{ type: "A", proportion: 0.5 },
					{ type: "B", proportion: 0.5 },
				],
			});

			const nodes1 = generateNodes(spec, config, new SeededRandom(42));
			const nodes2 = generateNodes(spec, config, new SeededRandom(999));

			// Types should likely differ
			const types1 = nodes1.map(n => n.type);
			const types2 = nodes2.map(n => n.type);
			expect(types1).not.toEqual(types2);
		});
	});
});

import { describe, expect, it } from "vitest";

import type { GraphGenerationConfig } from "../generator";
import type { GraphSpec } from "../spec";
import {
	addDensityEdges,
	generateBaseStructure,
} from "./edge-generator";
import type { TestEdge, TestNode } from "./types";
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

// Helper to create nodes
const createNodes = (count: number): TestNode[] =>
	Array.from({ length: count }, (_, index) => ({ id: `N${index}` }));

// Helper to create bipartite nodes
const createBipartiteNodes = (leftCount: number, rightCount: number): TestNode[] => {
	const nodes: TestNode[] = [];
	for (let index = 0; index < leftCount; index++) {
		nodes.push({ id: `N${index}`, partition: "left" });
	}
	for (let index = 0; index < rightCount; index++) {
		nodes.push({ id: `N${leftCount + index}`, partition: "right" });
	}
	return nodes;
};

describe("edge-generator", () => {
	describe("generateBaseStructure", () => {
		it("should generate complete bipartite edges", () => {
			const nodes = createBipartiteNodes(3, 4);
			const spec = createSpec({
				completeBipartite: { kind: "complete_bipartite", m: 3, n: 4 },
				partiteness: { kind: "bipartite" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const edges = generateBaseStructure(nodes, spec, config, rng);

			expect(edges.length).toBe(12); // 3 * 4 = 12
		});

		it("should generate bipartite tree edges", () => {
			const nodes = createBipartiteNodes(4, 4);
			const spec = createSpec({
				partiteness: { kind: "bipartite" },
				connectivity: { kind: "connected" },
				cycles: { kind: "acyclic" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const edges = generateBaseStructure(nodes, spec, config, rng);

			expect(edges.length).toBe(nodes.length - 1);
		});

		it("should generate star edges", () => {
			const nodes = createNodes(6);
			const spec = createSpec({
				star: { kind: "star" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const edges = generateBaseStructure(nodes, spec, config, rng);

			expect(edges.length).toBe(nodes.length - 1);
		});

		it("should generate wheel edges", () => {
			const nodes = createNodes(6);
			const spec = createSpec({
				wheel: { kind: "wheel" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const edges = generateBaseStructure(nodes, spec, config, rng);

			// Wheel: cycle (n-1) + hub connections (n-1) = 2(n-1)
			expect(edges.length).toBe(2 * (nodes.length - 1));
		});

		it("should generate grid edges", () => {
			const nodes = createNodes(9);
			const spec = createSpec({
				grid: { kind: "grid", rows: 3, cols: 3 },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const edges = generateBaseStructure(nodes, spec, config, rng);

			expect(edges.length).toBe(12); // 3x3 grid has 12 edges
		});

		it("should generate tournament edges", () => {
			const nodes = createNodes(5);
			const spec = createSpec({
				directionality: { kind: "directed" },
				tournament: { kind: "tournament" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const edges = generateBaseStructure(nodes, spec, config, rng);

			expect(edges.length).toBe(10); // n(n-1)/2 = 5*4/2
		});

		it("should generate tree edges for connected acyclic", () => {
			const nodes = createNodes(8);
			const spec = createSpec({
				connectivity: { kind: "connected" },
				cycles: { kind: "acyclic" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const edges = generateBaseStructure(nodes, spec, config, rng);

			expect(edges.length).toBe(nodes.length - 1);
		});

		it("should generate connected cyclic edges", () => {
			const nodes = createNodes(6);
			const spec = createSpec({
				connectivity: { kind: "connected" },
				cycles: { kind: "cycles_allowed" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const edges = generateBaseStructure(nodes, spec, config, rng);

			expect(edges.length).toBe(nodes.length); // cycle through all
		});

		it("should generate forest edges for unconstrained acyclic", () => {
			const nodes = createNodes(12);
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "acyclic" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const edges = generateBaseStructure(nodes, spec, config, rng);

			expect(edges.length).toBeLessThan(nodes.length - 1);
		});

		it("should generate disconnected edges", () => {
			const nodes = createNodes(12);
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "cycles_allowed" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const edges = generateBaseStructure(nodes, spec, config, rng);

			expect(edges.length).toBeGreaterThan(0);
		});
	});

	describe("addDensityEdges", () => {
		it("should not modify exact structure graphs", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [
				{ source: "N0", target: "N1" },
				{ source: "N0", target: "N2" },
			];
			const spec = createSpec({
				star: { kind: "star" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			const originalLength = edges.length;
			addDensityEdges(nodes, edges, spec, config, rng);

			expect(edges.length).toBe(originalLength);
		});

		it("should add parallel edge for multigraphs with tree", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [
				{ source: "N0", target: "N1" },
				{ source: "N1", target: "N2" },
				{ source: "N2", target: "N3" },
				{ source: "N3", target: "N4" },
			];
			const spec = createSpec({
				connectivity: { kind: "connected" },
				cycles: { kind: "acyclic" },
				edgeMultiplicity: { kind: "multi" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			addDensityEdges(nodes, edges, spec, config, rng);

			// Should have added parallel edge
			expect(edges.length).toBe(5);
		});

		it("should generate complete graph deterministically", () => {
			const nodes = createNodes(4);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				completeness: { kind: "complete" },
				edgeMultiplicity: { kind: "simple" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			addDensityEdges(nodes, edges, spec, config, rng);

			// Complete undirected graph: n(n-1)/2 = 6
			expect(edges.length).toBe(6);
		});

		it("should add self-loop when allowed", () => {
			const nodes = createNodes(4);
			const edges: TestEdge[] = [
				{ source: "N0", target: "N1" },
				{ source: "N1", target: "N2" },
			];
			const spec = createSpec({
				selfLoops: { kind: "allowed" },
				density: { kind: "dense" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			addDensityEdges(nodes, edges, spec, config, rng);

			// Should have self-loop
			const hasSelfLoop = edges.some(e => e.source === e.target);
			expect(hasSelfLoop).toBe(true);
		});

		it("should respect density specification", () => {
			const nodes = createNodes(10);
			const sparseEdges: TestEdge[] = [];
			const denseEdges: TestEdge[] = [];
			const sparseSpec = createSpec({ density: { kind: "sparse" } });
			const denseSpec = createSpec({ density: { kind: "dense" } });
			const config = createConfig();

			// Generate base structure first
			const sparseBase = generateBaseStructure([...nodes], sparseSpec, config, new SeededRandom(42));
			const denseBase = generateBaseStructure([...nodes], denseSpec, config, new SeededRandom(42));

			sparseEdges.push(...sparseBase);
			denseEdges.push(...denseBase);

			addDensityEdges([...nodes], sparseEdges, sparseSpec, config, new SeededRandom(42));
			addDensityEdges([...nodes], denseEdges, denseSpec, config, new SeededRandom(42));

			// Dense should have more or equal edges
			expect(denseEdges.length).toBeGreaterThanOrEqual(sparseEdges.length);
		});

		it("should avoid duplicate edges for simple graphs", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [
				{ source: "N0", target: "N1" },
			];
			const spec = createSpec({
				edgeMultiplicity: { kind: "simple" },
				density: { kind: "dense" },
			});
			const config = createConfig();
			const rng = new SeededRandom(42);

			addDensityEdges(nodes, edges, spec, config, rng);

			// Check for duplicates
			const edgeSet = new Set(edges.map(e =>
				[e.source, e.target].sort().join("-")
			));
			expect(edgeSet.size).toBe(edges.length);
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const nodes1 = createNodes(8);
			const nodes2 = createNodes(8);
			const spec = createSpec();
			const config = createConfig();

			const edges1 = generateBaseStructure(nodes1, spec, config, new SeededRandom(42));
			const edges2 = generateBaseStructure(nodes2, spec, config, new SeededRandom(42));

			expect(edges1).toEqual(edges2);
		});
	});
});

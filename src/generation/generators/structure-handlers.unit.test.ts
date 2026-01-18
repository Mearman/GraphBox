import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	handleAlgebraicConnectivity,
	handleCage,
	handleCartesianProduct,
	handleIntegrity,
	handleLexicographicProduct,
	handleMinorFree,
	handleMoore,
	handleRamanujan,
	handleSpectralRadius,
	handleSpectrum,
	handleStrongProduct,
	handleTensorProduct,
	handleTopologicalMinorFree,
	handleToughness,
} from "./structure-handlers";
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

// Helper to create nodes
const createNodes = (count: number): TestNode[] =>
	Array.from({ length: count }, (_, index) => ({ id: `N${index}` }));

describe("structure-handlers", () => {
	describe("handleSpectrum", () => {
		it("should generate edges and store spectrum metadata", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				spectrum: { kind: "spectrum", eigenvalues: [2, 1, 0, -1, -2, 0] },
			});
			const rng = new SeededRandom(42);

			const result = handleSpectrum(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("handleAlgebraicConnectivity", () => {
		it("should generate edges and store algebraic connectivity metadata", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				algebraicConnectivity: { kind: "algebraic_connectivity", value: 1.5 },
			});
			const rng = new SeededRandom(42);

			const result = handleAlgebraicConnectivity(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("handleSpectralRadius", () => {
		it("should generate edges and store spectral radius metadata", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				spectralRadius: { kind: "spectral_radius", value: 3.5 },
			});
			const rng = new SeededRandom(42);

			const result = handleSpectralRadius(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("handleToughness", () => {
		it("should generate edges and store toughness metadata", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				toughness: { kind: "toughness", value: 1 },
			});
			const rng = new SeededRandom(42);

			const result = handleToughness(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetToughness).toBe(1);
			}
		});
	});

	describe("handleIntegrity", () => {
		it("should generate edges and store integrity metadata", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				integrity: { kind: "integrity", value: 4 },
			});
			const rng = new SeededRandom(42);

			const result = handleIntegrity(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetIntegrity).toBe(4);
			}
		});
	});

	describe("handleCage", () => {
		it("should generate edges and store cage parameters", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				cage: { kind: "cage", girth: 3, degree: 2 },
			});
			const rng = new SeededRandom(42);

			const result = handleCage(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetCageGirth).toBe(3);
				expect(node.data?.targetCageDegree).toBe(2);
			}
		});
	});

	describe("handleMoore", () => {
		it("should generate edges and store Moore graph parameters", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				moore: { kind: "moore", diameter: 2, degree: 3 },
			});
			const rng = new SeededRandom(42);

			const result = handleMoore(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetMooreDiameter).toBe(2);
				expect(node.data?.targetMooreDegree).toBe(3);
			}
		});
	});

	describe("handleRamanujan", () => {
		it("should generate edges and store Ramanujan degree", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				ramanujan: { kind: "ramanujan", degree: 4 },
			});
			const rng = new SeededRandom(42);

			const result = handleRamanujan(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetRamanujanDegree).toBe(4);
			}
		});
	});

	describe("handleCartesianProduct", () => {
		it("should generate edges and store Cartesian product parameters", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				cartesianProduct: { kind: "cartesian_product", leftFactors: 2, rightFactors: 3 },
			});
			const rng = new SeededRandom(42);

			const result = handleCartesianProduct(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetCartesianProductLeft).toBe(2);
				expect(node.data?.targetCartesianProductRight).toBe(3);
			}
		});
	});

	describe("handleTensorProduct", () => {
		it("should generate edges and store tensor product parameters", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				tensorProduct: { kind: "tensor_product", leftFactors: 3, rightFactors: 4 },
			});
			const rng = new SeededRandom(42);

			const result = handleTensorProduct(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetTensorProductLeft).toBe(3);
				expect(node.data?.targetTensorProductRight).toBe(4);
			}
		});
	});

	describe("handleStrongProduct", () => {
		it("should generate edges and store strong product parameters", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				strongProduct: { kind: "strong_product", leftFactors: 2, rightFactors: 2 },
			});
			const rng = new SeededRandom(42);

			const result = handleStrongProduct(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetStrongProductLeft).toBe(2);
				expect(node.data?.targetStrongProductRight).toBe(2);
			}
		});
	});

	describe("handleLexicographicProduct", () => {
		it("should generate edges and store lexicographic product parameters", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				lexicographicProduct: { kind: "lexicographic_product", leftFactors: 3, rightFactors: 2 },
			});
			const rng = new SeededRandom(42);

			const result = handleLexicographicProduct(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetLexicographicProductLeft).toBe(3);
				expect(node.data?.targetLexicographicProductRight).toBe(2);
			}
		});
	});

	describe("handleMinorFree", () => {
		it("should generate edges and store forbidden minors", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				minorFree: { kind: "minor_free", forbiddenMinors: ["K5", "K3,3"] },
			});
			const rng = new SeededRandom(42);

			const result = handleMinorFree(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetForbiddenMinors).toEqual(["K5", "K3,3"]);
			}
		});
	});

	describe("handleTopologicalMinorFree", () => {
		it("should generate edges and store topological forbidden minors", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				topologicalMinorFree: { kind: "topological_minor_free", forbiddenMinors: ["K4"] },
			});
			const rng = new SeededRandom(42);

			const result = handleTopologicalMinorFree(nodes, edges, spec, rng);

			expect(result.length).toBeGreaterThan(0);
			for (const node of nodes) {
				expect(node.data?.targetTopologicalForbiddenMinors).toEqual(["K4"]);
			}
		});
	});

	describe("edge generation based on connectivity/cycles", () => {
		it("should generate tree for connected acyclic", () => {
			const nodes = createNodes(8);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "connected" },
				cycles: { kind: "acyclic" },
				toughness: { kind: "toughness", value: 1 },
			});
			const rng = new SeededRandom(42);

			const result = handleToughness(nodes, edges, spec, rng);

			// Tree has n-1 edges
			expect(result.length).toBe(nodes.length - 1);
		});

		it("should generate cycle for connected cyclic", () => {
			const nodes = createNodes(6);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "connected" },
				cycles: { kind: "cycles_allowed" },
				integrity: { kind: "integrity", value: 4 },
			});
			const rng = new SeededRandom(42);

			const result = handleIntegrity(nodes, edges, spec, rng);

			// Cycle has n edges
			expect(result.length).toBe(nodes.length);
		});

		it("should generate forest for unconstrained acyclic", () => {
			const nodes = createNodes(12);
			const edges: TestEdge[] = [];
			const spec = createSpec({
				connectivity: { kind: "unconstrained" },
				cycles: { kind: "acyclic" },
				cage: { kind: "cage", girth: 3, degree: 2 },
			});
			const rng = new SeededRandom(42);

			const result = handleCage(nodes, edges, spec, rng);

			// Forest has fewer than n-1 edges
			expect(result.length).toBeLessThan(nodes.length - 1);
		});
	});

	describe("determinism with SeededRandom", () => {
		it("should produce identical results with same seed", () => {
			const nodes1 = createNodes(8);
			const nodes2 = createNodes(8);
			const edges1: TestEdge[] = [];
			const edges2: TestEdge[] = [];
			const spec = createSpec({
				toughness: { kind: "toughness", value: 1.5 },
			});

			const result1 = handleToughness(nodes1, edges1, spec, new SeededRandom(42));
			const result2 = handleToughness(nodes2, edges2, spec, new SeededRandom(42));

			expect(result1).toEqual(result2);
		});
	});
});

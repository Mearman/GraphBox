import { describe, expect, it } from "vitest";

import type { GraphSpec } from "../spec";
import {
	computeAndStoreCage,
	computeAndStoreCartesianProduct,
	computeAndStoreIntegrity,
	computeAndStoreLexicographicProduct,
	computeAndStoreMinorFree,
	computeAndStoreMooreGraph,
	computeAndStoreRamanujan,
	computeAndStoreStrongProduct,
	computeAndStoreTensorProduct,
	computeAndStoreTopologicalMinorFree,
	computeAndStoreToughness,
} from "./property-computers";
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

// Helper to create simple edges
const createEdges = (pairs: [number, number][]): TestEdge[] =>
	pairs.map(([s, t]) => ({ source: `N${s}`, target: `N${t}` }));

describe("property-computers", () => {
	describe("computeAndStoreToughness", () => {
		it("should store target toughness in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2], [2, 3]]);
			const spec = createSpec({
				toughness: { kind: "toughness", value: 1.5 },
			});
			const rng = new SeededRandom(42);

			computeAndStoreToughness(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetToughness).toBe(1.5);
			}
		});

		it("should throw if toughness spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreToughness(nodes, edges, spec, rng);
			}).toThrow("Toughness computation requires toughness spec");
		});
	});

	describe("computeAndStoreIntegrity", () => {
		it("should store target integrity in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2]]);
			const spec = createSpec({
				integrity: { kind: "integrity", value: 4 },
			});
			const rng = new SeededRandom(42);

			computeAndStoreIntegrity(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetIntegrity).toBe(4);
			}
		});

		it("should throw if integrity spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreIntegrity(nodes, edges, spec, rng);
			}).toThrow("Integrity computation requires integrity spec");
		});
	});

	describe("computeAndStoreCage", () => {
		it("should store cage parameters in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2], [2, 0]]);
			const spec = createSpec({
				cage: { kind: "cage", girth: 3, degree: 2 },
			});
			const rng = new SeededRandom(42);

			computeAndStoreCage(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetCageGirth).toBe(3);
				expect(node.data?.targetCageDegree).toBe(2);
			}
		});

		it("should throw if cage spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreCage(nodes, edges, spec, rng);
			}).toThrow("Cage computation requires cage spec");
		});
	});

	describe("computeAndStoreMooreGraph", () => {
		it("should store Moore graph parameters in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2]]);
			const spec = createSpec({
				moore: { kind: "moore", diameter: 2, degree: 3 },
			});
			const rng = new SeededRandom(42);

			computeAndStoreMooreGraph(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetMooreDiameter).toBe(2);
				expect(node.data?.targetMooreDegree).toBe(3);
			}
		});

		it("should throw if moore spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreMooreGraph(nodes, edges, spec, rng);
			}).toThrow("Moore graph computation requires moore spec");
		});
	});

	describe("computeAndStoreRamanujan", () => {
		it("should store Ramanujan degree in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2]]);
			const spec = createSpec({
				ramanujan: { kind: "ramanujan", degree: 4 },
			});
			const rng = new SeededRandom(42);

			computeAndStoreRamanujan(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetRamanujanDegree).toBe(4);
			}
		});

		it("should throw if ramanujan spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreRamanujan(nodes, edges, spec, rng);
			}).toThrow("Ramanujan graph computation requires ramanujan spec");
		});
	});

	describe("computeAndStoreCartesianProduct", () => {
		it("should store Cartesian product parameters in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2]]);
			const spec = createSpec({
				cartesianProduct: { kind: "cartesian_product", leftFactors: 2, rightFactors: 3 },
			});
			const rng = new SeededRandom(42);

			computeAndStoreCartesianProduct(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetCartesianProductLeft).toBe(2);
				expect(node.data?.targetCartesianProductRight).toBe(3);
			}
		});

		it("should throw if cartesian_product spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreCartesianProduct(nodes, edges, spec, rng);
			}).toThrow("Cartesian product computation requires cartesian_product spec");
		});
	});

	describe("computeAndStoreTensorProduct", () => {
		it("should store tensor product parameters in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2]]);
			const spec = createSpec({
				tensorProduct: { kind: "tensor_product", leftFactors: 3, rightFactors: 4 },
			});
			const rng = new SeededRandom(42);

			computeAndStoreTensorProduct(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetTensorProductLeft).toBe(3);
				expect(node.data?.targetTensorProductRight).toBe(4);
			}
		});

		it("should throw if tensor_product spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreTensorProduct(nodes, edges, spec, rng);
			}).toThrow("Tensor product computation requires tensor_product spec");
		});
	});

	describe("computeAndStoreStrongProduct", () => {
		it("should store strong product parameters in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2]]);
			const spec = createSpec({
				strongProduct: { kind: "strong_product", leftFactors: 2, rightFactors: 2 },
			});
			const rng = new SeededRandom(42);

			computeAndStoreStrongProduct(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetStrongProductLeft).toBe(2);
				expect(node.data?.targetStrongProductRight).toBe(2);
			}
		});

		it("should throw if strong_product spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreStrongProduct(nodes, edges, spec, rng);
			}).toThrow("Strong product computation requires strong_product spec");
		});
	});

	describe("computeAndStoreLexicographicProduct", () => {
		it("should store lexicographic product parameters in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2]]);
			const spec = createSpec({
				lexicographicProduct: { kind: "lexicographic_product", leftFactors: 3, rightFactors: 2 },
			});
			const rng = new SeededRandom(42);

			computeAndStoreLexicographicProduct(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetLexicographicProductLeft).toBe(3);
				expect(node.data?.targetLexicographicProductRight).toBe(2);
			}
		});

		it("should throw if lexicographic_product spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreLexicographicProduct(nodes, edges, spec, rng);
			}).toThrow("Lexicographic product computation requires lexicographic_product spec");
		});
	});

	describe("computeAndStoreMinorFree", () => {
		it("should store forbidden minors in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2]]);
			const spec = createSpec({
				minorFree: { kind: "minor_free", forbiddenMinors: ["K5", "K3,3"] },
			});
			const rng = new SeededRandom(42);

			computeAndStoreMinorFree(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetForbiddenMinors).toEqual(["K5", "K3,3"]);
			}
		});

		it("should throw if minor_free spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreMinorFree(nodes, edges, spec, rng);
			}).toThrow("Minor-free computation requires minor_free spec");
		});
	});

	describe("computeAndStoreTopologicalMinorFree", () => {
		it("should store topological forbidden minors in node data", () => {
			const nodes = createNodes(6);
			const edges = createEdges([[0, 1], [1, 2]]);
			const spec = createSpec({
				topologicalMinorFree: { kind: "topological_minor_free", forbiddenMinors: ["K4"] },
			});
			const rng = new SeededRandom(42);

			computeAndStoreTopologicalMinorFree(nodes, edges, spec, rng);

			for (const node of nodes) {
				expect(node.data?.targetTopologicalForbiddenMinors).toEqual(["K4"]);
			}
		});

		it("should throw if topological_minor_free spec not provided", () => {
			const nodes = createNodes(5);
			const edges: TestEdge[] = [];
			const spec = createSpec();
			const rng = new SeededRandom(42);

			expect(() => {
				computeAndStoreTopologicalMinorFree(nodes, edges, spec, rng);
			}).toThrow("Topological minor-free computation requires topological_minor_free spec");
		});
	});
});

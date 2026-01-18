import { describe, expect, it } from "vitest";

import type { TestEdge,TestGraph, TestNode } from "../generation/generators/types";
import {
	validateCartesianProduct,
	validateLexicographicProduct,
	validateStrongProduct,
	validateTensorProduct,
} from "./product";

// Helper to create a minimal spec
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

// Helper to create nodes
const createNodes = (count: number, data?: Record<string, unknown>): TestNode[] =>
	Array.from({ length: count }, (_, index) => ({
		id: `n${index}`,
		data: data ? { ...data } : undefined,
	}));

// Helper to create edges
const createEdge = (source: string, target: string): TestEdge => ({
	source,
	target,
});

describe("validateCartesianProduct", () => {
	it("returns valid when cartesian product is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n2", "n3")];
		const graph = createGraph(nodes, edges);

		const result = validateCartesianProduct(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("cartesianProduct");
		expect(result.expected).toBe("unconstrained");
	});

	it("validates cartesian product with metadata", () => {
		const nodes = createNodes(4, { targetCartesianProductLeft: "P2" });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n2", "n3"),
			createEdge("n0", "n2"),
			createEdge("n1", "n3"),
		];
		const spec = createSpec({
			cartesianProduct: { kind: "cartesian_product", leftFactors: "P2", rightFactors: "P2" },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateCartesianProduct(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("cartesian_product(left=P2, right=P2)");
	});

	it("returns invalid without metadata", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n2", "n3"),
			createEdge("n0", "n2"),
			createEdge("n1", "n3"),
		];
		const spec = createSpec({
			cartesianProduct: { kind: "cartesian_product", leftFactors: "P2", rightFactors: "P2" },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateCartesianProduct(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("unknown (no metadata)");
		expect(result.message).toContain("Cannot verify");
	});
});

describe("validateTensorProduct", () => {
	it("returns valid when tensor product is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n2", "n3")];
		const graph = createGraph(nodes, edges);

		const result = validateTensorProduct(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("tensorProduct");
		expect(result.expected).toBe("unconstrained");
	});

	it("validates tensor product with metadata", () => {
		const nodes = createNodes(4, { targetTensorProductLeft: "K2" });
		const edges = [createEdge("n0", "n3"), createEdge("n1", "n2")];
		const spec = createSpec({
			tensorProduct: { kind: "tensor_product", leftFactors: "K2", rightFactors: "K2" },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateTensorProduct(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("tensor_product(left=K2, right=K2)");
	});

	it("returns invalid without metadata", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n3"), createEdge("n1", "n2")];
		const spec = createSpec({
			tensorProduct: { kind: "tensor_product", leftFactors: "K2", rightFactors: "K2" },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateTensorProduct(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("unknown (no metadata)");
		expect(result.message).toContain("Cannot verify");
	});
});

describe("validateStrongProduct", () => {
	it("returns valid when strong product is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n2", "n3")];
		const graph = createGraph(nodes, edges);

		const result = validateStrongProduct(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("strongProduct");
		expect(result.expected).toBe("unconstrained");
	});

	it("validates strong product with metadata", () => {
		const nodes = createNodes(4, { targetStrongProductLeft: "P2" });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n2", "n3"),
			createEdge("n0", "n2"),
			createEdge("n1", "n3"),
			createEdge("n0", "n3"),
			createEdge("n1", "n2"),
		];
		const spec = createSpec({
			strongProduct: { kind: "strong_product", leftFactors: "P2", rightFactors: "P2" },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateStrongProduct(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("strong_product(left=P2, right=P2)");
	});

	it("returns invalid without metadata", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n2", "n3"),
			createEdge("n0", "n2"),
			createEdge("n1", "n3"),
		];
		const spec = createSpec({
			strongProduct: { kind: "strong_product", leftFactors: "P2", rightFactors: "P2" },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateStrongProduct(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("unknown (no metadata)");
		expect(result.message).toContain("Cannot verify");
	});
});

describe("validateLexicographicProduct", () => {
	it("returns valid when lexicographic product is not specified", () => {
		const nodes = createNodes(4);
		const edges = [createEdge("n0", "n1"), createEdge("n2", "n3")];
		const graph = createGraph(nodes, edges);

		const result = validateLexicographicProduct(graph);

		expect(result.valid).toBe(true);
		expect(result.property).toBe("lexicographicProduct");
		expect(result.expected).toBe("unconstrained");
	});

	it("validates lexicographic product with metadata", () => {
		const nodes = createNodes(4, { targetLexicographicProductLeft: "P2" });
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n2", "n3"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
			createEdge("n1", "n2"),
			createEdge("n1", "n3"),
		];
		const spec = createSpec({
			lexicographicProduct: { kind: "lexicographic_product", leftFactors: "P2", rightFactors: "K2" },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateLexicographicProduct(graph);

		expect(result.valid).toBe(true);
		expect(result.actual).toBe("lexicographic_product(left=P2, right=K2)");
	});

	it("returns invalid without metadata", () => {
		const nodes = createNodes(4);
		const edges = [
			createEdge("n0", "n1"),
			createEdge("n2", "n3"),
			createEdge("n0", "n2"),
			createEdge("n0", "n3"),
		];
		const spec = createSpec({
			lexicographicProduct: { kind: "lexicographic_product", leftFactors: "P2", rightFactors: "K2" },
		});
		const graph = createGraph(nodes, edges, spec);

		const result = validateLexicographicProduct(graph);

		expect(result.valid).toBe(false);
		expect(result.actual).toBe("unknown (no metadata)");
		expect(result.message).toContain("Cannot verify");
	});
});

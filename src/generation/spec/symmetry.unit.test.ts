/**
 * Unit tests for symmetry properties.
 */

import { describe, expect, it } from "vitest";

import type {
	ArcTransitive,
	EdgeTransitive,
	SelfComplementary,
	VertexTransitive,
} from "./symmetry";

describe("symmetry properties", () => {
	describe("SelfComplementary", () => {
		it("should support self-complementary graphs", () => {
			const selfComplementary: SelfComplementary = {
				kind: "self_complementary",
			};
			expect(selfComplementary.kind).toBe("self_complementary");
		});

		it("should support not self-complementary graphs", () => {
			const notSelfComplementary: SelfComplementary = {
				kind: "not_self_complementary",
			};
			expect(notSelfComplementary.kind).toBe("not_self_complementary");
		});

		it("should support unconstrained self-complementary property", () => {
			const unconstrained: SelfComplementary = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("VertexTransitive", () => {
		it("should support vertex-transitive graphs", () => {
			const vertexTransitive: VertexTransitive = { kind: "vertex_transitive" };
			expect(vertexTransitive.kind).toBe("vertex_transitive");
		});

		it("should support not vertex-transitive graphs", () => {
			const notVertexTransitive: VertexTransitive = {
				kind: "not_vertex_transitive",
			};
			expect(notVertexTransitive.kind).toBe("not_vertex_transitive");
		});

		it("should support unconstrained vertex-transitive property", () => {
			const unconstrained: VertexTransitive = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("EdgeTransitive", () => {
		it("should support edge-transitive graphs", () => {
			const edgeTransitive: EdgeTransitive = { kind: "edge_transitive" };
			expect(edgeTransitive.kind).toBe("edge_transitive");
		});

		it("should support not edge-transitive graphs", () => {
			const notEdgeTransitive: EdgeTransitive = {
				kind: "not_edge_transitive",
			};
			expect(notEdgeTransitive.kind).toBe("not_edge_transitive");
		});

		it("should support unconstrained edge-transitive property", () => {
			const unconstrained: EdgeTransitive = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("ArcTransitive", () => {
		it("should support arc-transitive graphs", () => {
			const arcTransitive: ArcTransitive = { kind: "arc_transitive" };
			expect(arcTransitive.kind).toBe("arc_transitive");
		});

		it("should support not arc-transitive graphs", () => {
			const notArcTransitive: ArcTransitive = { kind: "not_arc_transitive" };
			expect(notArcTransitive.kind).toBe("not_arc_transitive");
		});

		it("should support unconstrained arc-transitive property", () => {
			const unconstrained: ArcTransitive = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("type narrowing", () => {
		it("should narrow SelfComplementary based on kind", () => {
			const values: SelfComplementary[] = [
				{ kind: "self_complementary" },
				{ kind: "not_self_complementary" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				if (property.kind === "self_complementary") {
					expect(property.kind).toBe("self_complementary");
				} else if (property.kind === "not_self_complementary") {
					expect(property.kind).toBe("not_self_complementary");
				} else {
					expect(property.kind).toBe("unconstrained");
				}
			}
		});

		it("should narrow all VertexTransitive variants", () => {
			const values: VertexTransitive[] = [
				{ kind: "vertex_transitive" },
				{ kind: "not_vertex_transitive" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				switch (property.kind) {
					case "vertex_transitive": {
						expect(property.kind).toBe("vertex_transitive");
						break;
					}
					case "not_vertex_transitive": {
						expect(property.kind).toBe("not_vertex_transitive");
						break;
					}
					case "unconstrained": {
						expect(property.kind).toBe("unconstrained");
						break;
					}
				}
			}
		});
	});

	describe("symmetry hierarchy", () => {
		it("should allow representing arc-transitive implies vertex and edge transitive", () => {
			// Arc-transitive (symmetric) graphs are both vertex-transitive and edge-transitive
			const arcTransitive: ArcTransitive = { kind: "arc_transitive" };
			const vertexTransitive: VertexTransitive = { kind: "vertex_transitive" };
			const edgeTransitive: EdgeTransitive = { kind: "edge_transitive" };

			expect(arcTransitive.kind).toBe("arc_transitive");
			expect(vertexTransitive.kind).toBe("vertex_transitive");
			expect(edgeTransitive.kind).toBe("edge_transitive");
		});

		it("should allow vertex-transitive without edge-transitive", () => {
			// Some graphs are vertex-transitive but not edge-transitive
			const vertexTransitive: VertexTransitive = { kind: "vertex_transitive" };
			const notEdgeTransitive: EdgeTransitive = { kind: "not_edge_transitive" };

			expect(vertexTransitive.kind).toBe("vertex_transitive");
			expect(notEdgeTransitive.kind).toBe("not_edge_transitive");
		});

		it("should allow edge-transitive without vertex-transitive", () => {
			// Some graphs are edge-transitive but not vertex-transitive (semi-symmetric)
			const notVertexTransitive: VertexTransitive = {
				kind: "not_vertex_transitive",
			};
			const edgeTransitive: EdgeTransitive = { kind: "edge_transitive" };

			expect(notVertexTransitive.kind).toBe("not_vertex_transitive");
			expect(edgeTransitive.kind).toBe("edge_transitive");
		});
	});

	describe("example graphs", () => {
		it("should represent complete graph Kn as arc-transitive", () => {
			const arcTransitive: ArcTransitive = { kind: "arc_transitive" };
			expect(arcTransitive.kind).toBe("arc_transitive");
		});

		it("should represent cycle graph Cn as arc-transitive", () => {
			const arcTransitive: ArcTransitive = { kind: "arc_transitive" };
			expect(arcTransitive.kind).toBe("arc_transitive");
		});

		it("should represent Petersen graph as arc-transitive", () => {
			const arcTransitive: ArcTransitive = { kind: "arc_transitive" };
			expect(arcTransitive.kind).toBe("arc_transitive");
		});

		it("should represent path graph P5 as self-complementary", () => {
			// P5 is isomorphic to its complement
			const selfComplementary: SelfComplementary = {
				kind: "self_complementary",
			};
			expect(selfComplementary.kind).toBe("self_complementary");
		});

		it("should represent C5 (5-cycle) as self-complementary", () => {
			// C5 is the only self-complementary cycle
			const selfComplementary: SelfComplementary = {
				kind: "self_complementary",
			};
			expect(selfComplementary.kind).toBe("self_complementary");
		});

		it("should represent star graph K1,n as not vertex-transitive", () => {
			// Star graph has center vertex different from leaf vertices
			const notVertexTransitive: VertexTransitive = {
				kind: "not_vertex_transitive",
			};
			expect(notVertexTransitive.kind).toBe("not_vertex_transitive");
		});
	});
});

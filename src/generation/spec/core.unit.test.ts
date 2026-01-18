/**
 * Unit tests for core graph properties.
 */

import { describe, expect, it } from "vitest";

import type {
	Completeness,
	Connectivity,
	Cycles,
	Density,
	Directionality,
	EdgeMultiplicity,
	SchemaHomogeneity,
	SelfLoops,
	Weighting,
} from "./core";

describe("core graph properties", () => {
	describe("Directionality", () => {
		it("should support directed graphs", () => {
			const directed: Directionality = { kind: "directed" };
			expect(directed.kind).toBe("directed");
		});

		it("should support undirected graphs", () => {
			const undirected: Directionality = { kind: "undirected" };
			expect(undirected.kind).toBe("undirected");
		});
	});

	describe("Weighting", () => {
		it("should support unweighted graphs", () => {
			const unweighted: Weighting = { kind: "unweighted" };
			expect(unweighted.kind).toBe("unweighted");
		});

		it("should support weighted numeric graphs", () => {
			const weighted: Weighting = { kind: "weighted_numeric" };
			expect(weighted.kind).toBe("weighted_numeric");
		});
	});

	describe("Cycles", () => {
		it("should support acyclic graphs", () => {
			const acyclic: Cycles = { kind: "acyclic" };
			expect(acyclic.kind).toBe("acyclic");
		});

		it("should support graphs with cycles allowed", () => {
			const cyclic: Cycles = { kind: "cycles_allowed" };
			expect(cyclic.kind).toBe("cycles_allowed");
		});
	});

	describe("Connectivity", () => {
		it("should support connected graphs", () => {
			const connected: Connectivity = { kind: "connected" };
			expect(connected.kind).toBe("connected");
		});

		it("should support unconstrained connectivity", () => {
			const unconstrained: Connectivity = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("SchemaHomogeneity", () => {
		it("should support homogeneous schemas", () => {
			const homogeneous: SchemaHomogeneity = { kind: "homogeneous" };
			expect(homogeneous.kind).toBe("homogeneous");
		});

		it("should support heterogeneous schemas", () => {
			const heterogeneous: SchemaHomogeneity = { kind: "heterogeneous" };
			expect(heterogeneous.kind).toBe("heterogeneous");
		});
	});

	describe("EdgeMultiplicity", () => {
		it("should support simple graphs", () => {
			const simple: EdgeMultiplicity = { kind: "simple" };
			expect(simple.kind).toBe("simple");
		});

		it("should support multigraphs", () => {
			const multi: EdgeMultiplicity = { kind: "multi" };
			expect(multi.kind).toBe("multi");
		});
	});

	describe("SelfLoops", () => {
		it("should support graphs with self-loops allowed", () => {
			const allowed: SelfLoops = { kind: "allowed" };
			expect(allowed.kind).toBe("allowed");
		});

		it("should support graphs with self-loops disallowed", () => {
			const disallowed: SelfLoops = { kind: "disallowed" };
			expect(disallowed.kind).toBe("disallowed");
		});
	});

	describe("Density", () => {
		it("should support sparse graphs", () => {
			const sparse: Density = { kind: "sparse" };
			expect(sparse.kind).toBe("sparse");
		});

		it("should support moderate density graphs", () => {
			const moderate: Density = { kind: "moderate" };
			expect(moderate.kind).toBe("moderate");
		});

		it("should support dense graphs", () => {
			const dense: Density = { kind: "dense" };
			expect(dense.kind).toBe("dense");
		});

		it("should support unconstrained density", () => {
			const unconstrained: Density = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Completeness", () => {
		it("should support complete graphs", () => {
			const complete: Completeness = { kind: "complete" };
			expect(complete.kind).toBe("complete");
		});

		it("should support incomplete graphs", () => {
			const incomplete: Completeness = { kind: "incomplete" };
			expect(incomplete.kind).toBe("incomplete");
		});
	});

	describe("type safety and discriminated unions", () => {
		it("should allow narrowing Directionality based on kind", () => {
			const values: Directionality[] = [
				{ kind: "directed" },
				{ kind: "undirected" },
			];

			for (const property of values) {
				if (property.kind === "directed") {
					expect(property.kind).toBe("directed");
				} else {
					expect(property.kind).toBe("undirected");
				}
			}
		});

		it("should allow narrowing Density based on kind", () => {
			const values: Density[] = [
				{ kind: "sparse" },
				{ kind: "moderate" },
				{ kind: "dense" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				switch (property.kind) {
					case "sparse": {
						expect(property.kind).toBe("sparse");
				
						break;
					}
					case "moderate": {
						expect(property.kind).toBe("moderate");
				
						break;
					}
					case "dense": {
						expect(property.kind).toBe("dense");
				
						break;
					}
					default: {
						expect(property.kind).toBe("unconstrained");
					}
				}
			}
		});
	});
});

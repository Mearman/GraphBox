/**
 * Unit tests for graph invariants and spectral properties.
 */

import { describe, expect, it } from "vitest";

import type {
	AlgebraicConnectivity,
	DominationNumber,
	HereditaryClass,
	IndependenceNumber,
	SpectralRadius,
	Spectrum,
	VertexCover,
} from "./invariants";

describe("graph invariants and spectral properties", () => {
	describe("HereditaryClass", () => {
		it("should support hereditary class with forbidden subgraphs", () => {
			const hereditary: HereditaryClass = {
				kind: "hereditary_class",
				forbidden: ["K5", "K3,3"],
			};
			expect(hereditary.kind).toBe("hereditary_class");
			expect(hereditary.forbidden).toEqual(["K5", "K3,3"]);
		});

		it("should support empty forbidden list", () => {
			const hereditary: HereditaryClass = {
				kind: "hereditary_class",
				forbidden: [],
			};
			expect(hereditary.kind).toBe("hereditary_class");
			expect(hereditary.forbidden).toHaveLength(0);
		});

		it("should support unconstrained hereditary class", () => {
			const unconstrained: HereditaryClass = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("IndependenceNumber", () => {
		it("should support specific independence number", () => {
			const alpha: IndependenceNumber = {
				kind: "independence_number",
				value: 3,
			};
			expect(alpha.kind).toBe("independence_number");
			expect(alpha.value).toBe(3);
		});

		it("should support unconstrained independence number", () => {
			const unconstrained: IndependenceNumber = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("VertexCover", () => {
		it("should support specific vertex cover number", () => {
			const tau: VertexCover = { kind: "vertex_cover", value: 4 };
			expect(tau.kind).toBe("vertex_cover");
			expect(tau.value).toBe(4);
		});

		it("should support unconstrained vertex cover", () => {
			const unconstrained: VertexCover = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("DominationNumber", () => {
		it("should support specific domination number", () => {
			const gamma: DominationNumber = { kind: "domination_number", value: 2 };
			expect(gamma.kind).toBe("domination_number");
			expect(gamma.value).toBe(2);
		});

		it("should support unconstrained domination number", () => {
			const unconstrained: DominationNumber = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Spectrum", () => {
		it("should support spectrum with eigenvalues", () => {
			const spectrum: Spectrum = {
				kind: "spectrum",
				eigenvalues: [3, 1, 1, -1, -1, -3],
			};
			expect(spectrum.kind).toBe("spectrum");
			expect(spectrum.eigenvalues).toEqual([3, 1, 1, -1, -1, -3]);
		});

		it("should support empty eigenvalue list", () => {
			const spectrum: Spectrum = { kind: "spectrum", eigenvalues: [] };
			expect(spectrum.kind).toBe("spectrum");
			expect(spectrum.eigenvalues).toHaveLength(0);
		});

		it("should support unconstrained spectrum", () => {
			const unconstrained: Spectrum = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("AlgebraicConnectivity", () => {
		it("should support specific algebraic connectivity (Fiedler value)", () => {
			const lambda2: AlgebraicConnectivity = {
				kind: "algebraic_connectivity",
				value: 0.5858,
			};
			expect(lambda2.kind).toBe("algebraic_connectivity");
			expect(lambda2.value).toBeCloseTo(0.5858, 4);
		});

		it("should support zero algebraic connectivity (disconnected)", () => {
			const lambda2: AlgebraicConnectivity = {
				kind: "algebraic_connectivity",
				value: 0,
			};
			expect(lambda2.kind).toBe("algebraic_connectivity");
			expect(lambda2.value).toBe(0);
		});

		it("should support unconstrained algebraic connectivity", () => {
			const unconstrained: AlgebraicConnectivity = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("SpectralRadius", () => {
		it("should support specific spectral radius", () => {
			const rho: SpectralRadius = { kind: "spectral_radius", value: 4 };
			expect(rho.kind).toBe("spectral_radius");
			expect(rho.value).toBe(4);
		});

		it("should support unconstrained spectral radius", () => {
			const unconstrained: SpectralRadius = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("type narrowing", () => {
		it("should narrow HereditaryClass based on kind", () => {
			const property: HereditaryClass = {
				kind: "hereditary_class",
				forbidden: ["C5"],
			};
			if (property.kind === "hereditary_class") {
				expect(property.forbidden).toContain("C5");
			} else {
				expect.fail("Should not reach here");
			}
		});

		it("should narrow numerical invariants for computation", () => {
			const alpha: IndependenceNumber = {
				kind: "independence_number",
				value: 5,
			};
			const tau: VertexCover = { kind: "vertex_cover", value: 7 };

			if (
				alpha.kind === "independence_number" &&
				tau.kind === "vertex_cover"
			) {
				// For any graph: alpha + tau = n (number of vertices)
				const n = alpha.value + tau.value;
				expect(n).toBe(12);
			}
		});
	});
});

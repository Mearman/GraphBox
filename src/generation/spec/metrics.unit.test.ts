/**
 * Unit tests for metric properties.
 */

import { describe, expect, it } from "vitest";

import type { Circumference, Diameter, Girth, Radius } from "./metrics";

describe("metric properties", () => {
	describe("Diameter", () => {
		it("should support specific diameter value", () => {
			const diameter: Diameter = { kind: "diameter", value: 3 };
			expect(diameter.kind).toBe("diameter");
			expect(diameter.value).toBe(3);
		});

		it("should support diameter of 0 (single vertex)", () => {
			const diameter: Diameter = { kind: "diameter", value: 0 };
			expect(diameter.kind).toBe("diameter");
			expect(diameter.value).toBe(0);
		});

		it("should support diameter of 1 (complete graph)", () => {
			const diameter: Diameter = { kind: "diameter", value: 1 };
			expect(diameter.kind).toBe("diameter");
			expect(diameter.value).toBe(1);
		});

		it("should support unconstrained diameter", () => {
			const unconstrained: Diameter = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Radius", () => {
		it("should support specific radius value", () => {
			const radius: Radius = { kind: "radius", value: 2 };
			expect(radius.kind).toBe("radius");
			expect(radius.value).toBe(2);
		});

		it("should support radius of 0 (single vertex)", () => {
			const radius: Radius = { kind: "radius", value: 0 };
			expect(radius.kind).toBe("radius");
			expect(radius.value).toBe(0);
		});

		it("should support unconstrained radius", () => {
			const unconstrained: Radius = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Girth", () => {
		it("should support specific girth value", () => {
			const girth: Girth = { kind: "girth", girth: 5 };
			expect(girth.kind).toBe("girth");
			expect(girth.girth).toBe(5);
		});

		it("should support girth of 3 (triangle)", () => {
			const girth: Girth = { kind: "girth", girth: 3 };
			expect(girth.kind).toBe("girth");
			expect(girth.girth).toBe(3);
		});

		it("should support girth of 4 (square/quadrilateral)", () => {
			const girth: Girth = { kind: "girth", girth: 4 };
			expect(girth.kind).toBe("girth");
			expect(girth.girth).toBe(4);
		});

		it("should support unconstrained girth", () => {
			const unconstrained: Girth = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Circumference", () => {
		it("should support specific circumference value", () => {
			const circumference: Circumference = { kind: "circumference", value: 6 };
			expect(circumference.kind).toBe("circumference");
			expect(circumference.value).toBe(6);
		});

		it("should support circumference equal to vertex count (Hamiltonian)", () => {
			const circumference: Circumference = { kind: "circumference", value: 10 };
			expect(circumference.kind).toBe("circumference");
			expect(circumference.value).toBe(10);
		});

		it("should support unconstrained circumference", () => {
			const unconstrained: Circumference = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("type narrowing", () => {
		it("should narrow Diameter based on kind", () => {
			const property: Diameter = { kind: "diameter", value: 4 };
			if (property.kind === "diameter") {
				expect(property.value).toBe(4);
			} else {
				expect.fail("Should not reach unconstrained case");
			}
		});

		it("should narrow Girth for property check", () => {
			const property: Girth = { kind: "girth", girth: 3 };
			if (property.kind === "girth") {
				const hasTriangle = property.girth === 3;
				expect(hasTriangle).toBe(true);
			}
		});
	});

	describe("metric relationships", () => {
		it("should validate radius <= diameter relationship conceptually", () => {
			// For any connected graph: radius <= diameter <= 2 * radius
			const radius: Radius = { kind: "radius", value: 3 };
			const diameter: Diameter = { kind: "diameter", value: 5 };

			if (radius.kind === "radius" && diameter.kind === "diameter") {
				expect(radius.value).toBeLessThanOrEqual(diameter.value);
				expect(diameter.value).toBeLessThanOrEqual(2 * radius.value);
			}
		});

		it("should validate girth <= circumference relationship conceptually", () => {
			// For any graph with cycles: girth <= circumference
			const girth: Girth = { kind: "girth", girth: 4 };
			const circumference: Circumference = { kind: "circumference", value: 8 };

			if (girth.kind === "girth" && circumference.kind === "circumference") {
				expect(girth.girth).toBeLessThanOrEqual(circumference.value);
			}
		});
	});
});

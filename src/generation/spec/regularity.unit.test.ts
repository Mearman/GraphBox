/**
 * Unit tests for regularity properties.
 */

import { describe, expect, it } from "vitest";

import type { Cubic, SpecificRegular, StronglyRegular } from "./regularity";

describe("regularity properties", () => {
	describe("Cubic", () => {
		it("should support cubic graphs (3-regular)", () => {
			const cubic: Cubic = { kind: "cubic" };
			expect(cubic.kind).toBe("cubic");
		});

		it("should support non-cubic graphs", () => {
			const nonCubic: Cubic = { kind: "non_cubic" };
			expect(nonCubic.kind).toBe("non_cubic");
		});

		it("should support unconstrained cubic property", () => {
			const unconstrained: Cubic = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("SpecificRegular", () => {
		it("should support k-regular graphs", () => {
			const kRegular: SpecificRegular = { kind: "k_regular", k: 4 };
			expect(kRegular.kind).toBe("k_regular");
			expect(kRegular.k).toBe(4);
		});

		it("should support 0-regular (empty graph)", () => {
			const zeroRegular: SpecificRegular = { kind: "k_regular", k: 0 };
			expect(zeroRegular.kind).toBe("k_regular");
			expect(zeroRegular.k).toBe(0);
		});

		it("should support 1-regular (matching)", () => {
			const oneRegular: SpecificRegular = { kind: "k_regular", k: 1 };
			expect(oneRegular.kind).toBe("k_regular");
			expect(oneRegular.k).toBe(1);
		});

		it("should support 2-regular (disjoint cycles)", () => {
			const twoRegular: SpecificRegular = { kind: "k_regular", k: 2 };
			expect(twoRegular.kind).toBe("k_regular");
			expect(twoRegular.k).toBe(2);
		});

		it("should support 3-regular (cubic)", () => {
			const threeRegular: SpecificRegular = { kind: "k_regular", k: 3 };
			expect(threeRegular.kind).toBe("k_regular");
			expect(threeRegular.k).toBe(3);
		});

		it("should support not_k_regular graphs", () => {
			const notKRegular: SpecificRegular = { kind: "not_k_regular" };
			expect(notKRegular.kind).toBe("not_k_regular");
		});

		it("should support unconstrained regularity", () => {
			const unconstrained: SpecificRegular = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("StronglyRegular", () => {
		it("should support strongly regular graphs with parameters", () => {
			// Petersen graph: srg(10, 3, 0, 1)
			const stronglyRegular: StronglyRegular = {
				kind: "strongly_regular",
				k: 3,
				lambda: 0,
				mu: 1,
			};
			expect(stronglyRegular.kind).toBe("strongly_regular");
			expect(stronglyRegular.k).toBe(3);
			expect(stronglyRegular.lambda).toBe(0);
			expect(stronglyRegular.mu).toBe(1);
		});

		it("should support strongly regular with different parameters", () => {
			// Paley graph of order 5: srg(5, 2, 0, 1)
			const paley: StronglyRegular = {
				kind: "strongly_regular",
				k: 2,
				lambda: 0,
				mu: 1,
			};
			expect(paley.kind).toBe("strongly_regular");
			expect(paley.k).toBe(2);
			expect(paley.lambda).toBe(0);
			expect(paley.mu).toBe(1);
		});

		it("should support not_strongly_regular graphs", () => {
			const notStronglyRegular: StronglyRegular = {
				kind: "not_strongly_regular",
			};
			expect(notStronglyRegular.kind).toBe("not_strongly_regular");
		});

		it("should support unconstrained strongly regular property", () => {
			const unconstrained: StronglyRegular = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("type narrowing", () => {
		it("should narrow Cubic based on kind", () => {
			const values: Cubic[] = [
				{ kind: "cubic" },
				{ kind: "non_cubic" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				if (property.kind === "cubic") {
					expect(property.kind).toBe("cubic");
				} else if (property.kind === "non_cubic") {
					expect(property.kind).toBe("non_cubic");
				} else {
					expect(property.kind).toBe("unconstrained");
				}
			}
		});

		it("should narrow SpecificRegular for degree access", () => {
			const property: SpecificRegular = { kind: "k_regular", k: 5 };
			if (property.kind === "k_regular") {
				expect(property.k).toBe(5);
			} else {
				expect.fail("Should not reach this case");
			}
		});

		it("should narrow StronglyRegular for parameter access", () => {
			const property: StronglyRegular = {
				kind: "strongly_regular",
				k: 4,
				lambda: 1,
				mu: 2,
			};
			if (property.kind === "strongly_regular") {
				expect(property.k).toBe(4);
				expect(property.lambda).toBe(1);
				expect(property.mu).toBe(2);
			}
		});
	});

	describe("example graphs", () => {
		it("should represent Petersen graph parameters", () => {
			// Petersen graph is srg(10, 3, 0, 1)
			const petersen: StronglyRegular = {
				kind: "strongly_regular",
				k: 3,
				lambda: 0,
				mu: 1,
			};
			expect(petersen.kind).toBe("strongly_regular");
			// Adjacent vertices have no common neighbors (lambda = 0)
			expect(petersen.lambda).toBe(0);
			// Non-adjacent vertices have exactly 1 common neighbor (mu = 1)
			expect(petersen.mu).toBe(1);
		});

		it("should represent complete graph K5 as 4-regular", () => {
			const k5: SpecificRegular = { kind: "k_regular", k: 4 };
			expect(k5.kind).toBe("k_regular");
			expect(k5.k).toBe(4);
		});

		it("should represent cycle graph C6 as 2-regular", () => {
			const c6: SpecificRegular = { kind: "k_regular", k: 2 };
			expect(c6.kind).toBe("k_regular");
			expect(c6.k).toBe(2);
		});

		it("should represent hypercube Q3 as 3-regular (cubic)", () => {
			const q3: Cubic = { kind: "cubic" };
			expect(q3.kind).toBe("cubic");
		});
	});
});

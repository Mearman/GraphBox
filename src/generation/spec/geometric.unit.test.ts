/**
 * Unit tests for geometric and topological properties.
 */

import { describe, expect, it } from "vitest";

import type { Planar, UnitDisk } from "./geometric";

describe("geometric and topological properties", () => {
	describe("UnitDisk", () => {
		it("should support unit disk graphs with default parameters", () => {
			const unitDisk: UnitDisk = { kind: "unit_disk" };
			expect(unitDisk.kind).toBe("unit_disk");
		});

		it("should support unit disk graphs with custom unit radius", () => {
			const unitDisk: UnitDisk = { kind: "unit_disk", unitRadius: 1.5 };
			expect(unitDisk.kind).toBe("unit_disk");
			expect(unitDisk.unitRadius).toBe(1.5);
		});

		it("should support unit disk graphs with custom space size", () => {
			const unitDisk: UnitDisk = { kind: "unit_disk", spaceSize: 10 };
			expect(unitDisk.kind).toBe("unit_disk");
			expect(unitDisk.spaceSize).toBe(10);
		});

		it("should support unit disk graphs with both parameters", () => {
			const unitDisk: UnitDisk = {
				kind: "unit_disk",
				unitRadius: 2,
				spaceSize: 20,
			};
			expect(unitDisk.kind).toBe("unit_disk");
			expect(unitDisk.unitRadius).toBe(2);
			expect(unitDisk.spaceSize).toBe(20);
		});

		it("should support non-unit disk graphs", () => {
			const notUnitDisk: UnitDisk = { kind: "not_unit_disk" };
			expect(notUnitDisk.kind).toBe("not_unit_disk");
		});

		it("should support unconstrained unit disk property", () => {
			const unconstrained: UnitDisk = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Planar", () => {
		it("should support planar graphs", () => {
			const planar: Planar = { kind: "planar" };
			expect(planar.kind).toBe("planar");
		});

		it("should support non-planar graphs", () => {
			const nonPlanar: Planar = { kind: "nonplanar" };
			expect(nonPlanar.kind).toBe("nonplanar");
		});

		it("should support unconstrained planarity", () => {
			const unconstrained: Planar = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("type narrowing", () => {
		it("should narrow UnitDisk based on kind", () => {
			const values: UnitDisk[] = [
				{ kind: "unit_disk", unitRadius: 1 },
				{ kind: "not_unit_disk" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				if (property.kind === "unit_disk") {
					expect(property.unitRadius).toBe(1);
				} else if (property.kind === "not_unit_disk") {
					expect(property.kind).toBe("not_unit_disk");
				} else {
					expect(property.kind).toBe("unconstrained");
				}
			}
		});

		it("should handle all Planar variants in switch", () => {
			const values: Planar[] = [
				{ kind: "planar" },
				{ kind: "nonplanar" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				switch (property.kind) {
					case "planar": {
						expect(property.kind).toBe("planar");
						break;
					}
					case "nonplanar": {
						expect(property.kind).toBe("nonplanar");
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
});

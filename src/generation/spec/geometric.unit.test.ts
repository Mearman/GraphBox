/**
 * Unit tests for geometric and topological properties.
 */

import { describe, expect, it } from "vitest";

import type { Planarity, UnitDisk } from "./geometric";

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

	describe("Planarity", () => {
		it("should support planar graphs", () => {
			const planar: Planarity = { kind: "planar" };
			expect(planar.kind).toBe("planar");
		});

		it("should support non-planar graphs", () => {
			const nonPlanar: Planarity = { kind: "non_planar" };
			expect(nonPlanar.kind).toBe("non_planar");
		});

		it("should support unconstrained planarity", () => {
			const unconstrained: Planarity = { kind: "unconstrained" };
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

		it("should handle all Planarity variants in switch", () => {
			const values: Planarity[] = [
				{ kind: "planar" },
				{ kind: "non_planar" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				switch (property.kind) {
					case "planar": {
						expect(property.kind).toBe("planar");
						break;
					}
					case "non_planar": {
						expect(property.kind).toBe("non_planar");
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

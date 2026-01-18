/**
 * Unit tests for network analysis properties.
 */

import { describe, expect, it } from "vitest";

import type { CommunityStructure, ScaleFree, SmallWorld } from "./network";

describe("network analysis properties", () => {
	describe("ScaleFree", () => {
		it("should support scale-free graphs with default exponent", () => {
			const scaleFree: ScaleFree = { kind: "scale_free" };
			expect(scaleFree.kind).toBe("scale_free");
		});

		it("should support scale-free graphs with custom exponent", () => {
			const scaleFree: ScaleFree = { kind: "scale_free", exponent: 2.5 };
			expect(scaleFree.kind).toBe("scale_free");
			expect(scaleFree.exponent).toBe(2.5);
		});

		it("should support typical Barabasi-Albert exponent", () => {
			const scaleFree: ScaleFree = { kind: "scale_free", exponent: 3 };
			expect(scaleFree.kind).toBe("scale_free");
			expect(scaleFree.exponent).toBe(3);
		});

		it("should support non-scale-free graphs", () => {
			const notScaleFree: ScaleFree = { kind: "not_scale_free" };
			expect(notScaleFree.kind).toBe("not_scale_free");
		});
	});

	describe("SmallWorld", () => {
		it("should support small-world graphs with default parameters", () => {
			const smallWorld: SmallWorld = { kind: "small_world" };
			expect(smallWorld.kind).toBe("small_world");
		});

		it("should support small-world graphs with rewire probability", () => {
			const smallWorld: SmallWorld = {
				kind: "small_world",
				rewireProbability: 0.1,
			};
			expect(smallWorld.kind).toBe("small_world");
			expect(smallWorld.rewireProbability).toBe(0.1);
		});

		it("should support small-world graphs with mean degree", () => {
			const smallWorld: SmallWorld = { kind: "small_world", meanDegree: 4 };
			expect(smallWorld.kind).toBe("small_world");
			expect(smallWorld.meanDegree).toBe(4);
		});

		it("should support small-world graphs with all parameters", () => {
			const smallWorld: SmallWorld = {
				kind: "small_world",
				rewireProbability: 0.05,
				meanDegree: 6,
			};
			expect(smallWorld.kind).toBe("small_world");
			expect(smallWorld.rewireProbability).toBe(0.05);
			expect(smallWorld.meanDegree).toBe(6);
		});

		it("should support non-small-world graphs", () => {
			const notSmallWorld: SmallWorld = { kind: "not_small_world" };
			expect(notSmallWorld.kind).toBe("not_small_world");
		});

		it("should support unconstrained small-world property", () => {
			const unconstrained: SmallWorld = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("CommunityStructure", () => {
		it("should support modular graphs with default parameters", () => {
			const modular: CommunityStructure = { kind: "modular" };
			expect(modular.kind).toBe("modular");
		});

		it("should support modular graphs with number of communities", () => {
			const modular: CommunityStructure = {
				kind: "modular",
				numCommunities: 5,
			};
			expect(modular.kind).toBe("modular");
			expect(modular.numCommunities).toBe(5);
		});

		it("should support modular graphs with intra-community density", () => {
			const modular: CommunityStructure = {
				kind: "modular",
				intraCommunityDensity: 0.8,
			};
			expect(modular.kind).toBe("modular");
			expect(modular.intraCommunityDensity).toBe(0.8);
		});

		it("should support modular graphs with inter-community density", () => {
			const modular: CommunityStructure = {
				kind: "modular",
				interCommunityDensity: 0.1,
			};
			expect(modular.kind).toBe("modular");
			expect(modular.interCommunityDensity).toBe(0.1);
		});

		it("should support modular graphs with all parameters", () => {
			const modular: CommunityStructure = {
				kind: "modular",
				numCommunities: 4,
				intraCommunityDensity: 0.7,
				interCommunityDensity: 0.05,
			};
			expect(modular.kind).toBe("modular");
			expect(modular.numCommunities).toBe(4);
			expect(modular.intraCommunityDensity).toBe(0.7);
			expect(modular.interCommunityDensity).toBe(0.05);
		});

		it("should support non-modular graphs", () => {
			const nonModular: CommunityStructure = { kind: "non_modular" };
			expect(nonModular.kind).toBe("non_modular");
		});

		it("should support unconstrained community structure", () => {
			const unconstrained: CommunityStructure = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("type narrowing", () => {
		it("should narrow ScaleFree for exponent access", () => {
			const property: ScaleFree = { kind: "scale_free", exponent: 2.2 };
			if (property.kind === "scale_free") {
				expect(property.exponent).toBe(2.2);
			} else {
				expect.fail("Should not reach not_scale_free case");
			}
		});

		it("should narrow SmallWorld for parameter access", () => {
			const property: SmallWorld = {
				kind: "small_world",
				rewireProbability: 0.1,
				meanDegree: 4,
			};
			if (property.kind === "small_world") {
				expect(property.rewireProbability).toBe(0.1);
				expect(property.meanDegree).toBe(4);
			}
		});

		it("should narrow CommunityStructure for density comparison", () => {
			const property: CommunityStructure = {
				kind: "modular",
				intraCommunityDensity: 0.9,
				interCommunityDensity: 0.05,
			};
			if (property.kind === "modular") {
				// Strong community structure: high intra, low inter
				const intraDensity = property.intraCommunityDensity ?? 0;
				const interDensity = property.interCommunityDensity ?? 1;
				expect(intraDensity).toBeGreaterThan(interDensity);
			}
		});
	});

	describe("typical network configurations", () => {
		it("should represent Watts-Strogatz small-world parameters", () => {
			// Typical Watts-Strogatz: low rewire probability, moderate degree
			const wattsStrogatz: SmallWorld = {
				kind: "small_world",
				rewireProbability: 0.1,
				meanDegree: 4,
			};
			expect(wattsStrogatz.kind).toBe("small_world");
			if (wattsStrogatz.kind === "small_world") {
				expect(wattsStrogatz.rewireProbability).toBeLessThan(0.5);
			}
		});

		it("should represent Lancichinetti-Fortunato-Radicchi (LFR) benchmark parameters", () => {
			// LFR benchmark: clear community structure
			const lfr: CommunityStructure = {
				kind: "modular",
				numCommunities: 10,
				intraCommunityDensity: 0.7,
				interCommunityDensity: 0.1,
			};
			expect(lfr.kind).toBe("modular");
			if (lfr.kind === "modular") {
				const ratio =
					(lfr.intraCommunityDensity ?? 0) / (lfr.interCommunityDensity ?? 1);
				expect(ratio).toBeGreaterThan(1);
			}
		});
	});
});

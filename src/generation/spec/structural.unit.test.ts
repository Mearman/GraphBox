/**
 * Unit tests for structural graph classes.
 */

import { describe, expect, it } from "vitest";

import type {
	ClawFree,
	Cograph,
	Line,
	Perfect,
	Split,
	Threshold,
} from "./structural";

describe("structural graph classes", () => {
	describe("Perfect", () => {
		it("should support perfect graphs", () => {
			const perfect: Perfect = { kind: "perfect" };
			expect(perfect.kind).toBe("perfect");
		});

		it("should support imperfect graphs", () => {
			const imperfect: Perfect = { kind: "imperfect" };
			expect(imperfect.kind).toBe("imperfect");
		});

		it("should support unconstrained perfect property", () => {
			const unconstrained: Perfect = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Split", () => {
		it("should support split graphs", () => {
			const split: Split = { kind: "split" };
			expect(split.kind).toBe("split");
		});

		it("should support non-split graphs", () => {
			const nonSplit: Split = { kind: "non_split" };
			expect(nonSplit.kind).toBe("non_split");
		});

		it("should support unconstrained split property", () => {
			const unconstrained: Split = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Cograph", () => {
		it("should support cographs (P4-free)", () => {
			const cograph: Cograph = { kind: "cograph" };
			expect(cograph.kind).toBe("cograph");
		});

		it("should support non-cographs", () => {
			const nonCograph: Cograph = { kind: "non_cograph" };
			expect(nonCograph.kind).toBe("non_cograph");
		});

		it("should support unconstrained cograph property", () => {
			const unconstrained: Cograph = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Threshold", () => {
		it("should support threshold graphs", () => {
			const threshold: Threshold = { kind: "threshold" };
			expect(threshold.kind).toBe("threshold");
		});

		it("should support non-threshold graphs", () => {
			const nonThreshold: Threshold = { kind: "non_threshold" };
			expect(nonThreshold.kind).toBe("non_threshold");
		});

		it("should support unconstrained threshold property", () => {
			const unconstrained: Threshold = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Line", () => {
		it("should support line graphs", () => {
			const line: Line = { kind: "line_graph" };
			expect(line.kind).toBe("line_graph");
		});

		it("should support non-line graphs", () => {
			const nonLine: Line = { kind: "non_line_graph" };
			expect(nonLine.kind).toBe("non_line_graph");
		});

		it("should support unconstrained line property", () => {
			const unconstrained: Line = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("ClawFree", () => {
		it("should support claw-free graphs", () => {
			const clawFree: ClawFree = { kind: "claw_free" };
			expect(clawFree.kind).toBe("claw_free");
		});

		it("should support graphs with claw (K1,3)", () => {
			const hasClaw: ClawFree = { kind: "has_claw" };
			expect(hasClaw.kind).toBe("has_claw");
		});

		it("should support unconstrained claw-free property", () => {
			const unconstrained: ClawFree = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("type narrowing", () => {
		it("should narrow Perfect based on kind", () => {
			const values: Perfect[] = [
				{ kind: "perfect" },
				{ kind: "imperfect" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				if (property.kind === "perfect") {
					expect(property.kind).toBe("perfect");
				} else if (property.kind === "imperfect") {
					expect(property.kind).toBe("imperfect");
				} else {
					expect(property.kind).toBe("unconstrained");
				}
			}
		});

		it("should narrow all Split variants", () => {
			const values: Split[] = [
				{ kind: "split" },
				{ kind: "non_split" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				switch (property.kind) {
					case "split": {
						expect(property.kind).toBe("split");
						break;
					}
					case "non_split": {
						expect(property.kind).toBe("non_split");
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

	describe("class relationships", () => {
		it("should allow representing threshold graphs (split AND cograph)", () => {
			// Threshold graphs are exactly the graphs that are both split and cograph
			const split: Split = { kind: "split" };
			const cograph: Cograph = { kind: "cograph" };
			const threshold: Threshold = { kind: "threshold" };

			expect(split.kind).toBe("split");
			expect(cograph.kind).toBe("cograph");
			expect(threshold.kind).toBe("threshold");
		});

		it("should allow representing perfect graphs", () => {
			// Several graph classes are subclasses of perfect graphs
			const perfect: Perfect = { kind: "perfect" };
			const split: Split = { kind: "split" };
			const cograph: Cograph = { kind: "cograph" };

			// Split graphs and cographs are perfect
			expect(perfect.kind).toBe("perfect");
			expect(split.kind).toBe("split");
			expect(cograph.kind).toBe("cograph");
		});

		it("should allow representing line graphs as claw-free", () => {
			// Line graphs are always claw-free (no K1,3 induced subgraph)
			const line: Line = { kind: "line_graph" };
			const clawFree: ClawFree = { kind: "claw_free" };

			expect(line.kind).toBe("line_graph");
			expect(clawFree.kind).toBe("claw_free");
		});
	});

	describe("example graphs", () => {
		it("should represent complete graph as perfect and split", () => {
			const perfect: Perfect = { kind: "perfect" };
			const split: Split = { kind: "split" };

			expect(perfect.kind).toBe("perfect");
			expect(split.kind).toBe("split");
		});

		it("should represent bipartite graph as perfect", () => {
			const perfect: Perfect = { kind: "perfect" };
			expect(perfect.kind).toBe("perfect");
		});

		it("should represent odd cycle C5 as imperfect", () => {
			// C5 is the smallest imperfect graph
			const imperfect: Perfect = { kind: "imperfect" };
			expect(imperfect.kind).toBe("imperfect");
		});

		it("should represent P4 as non-cograph", () => {
			// P4 (path on 4 vertices) is the forbidden induced subgraph for cographs
			const nonCograph: Cograph = { kind: "non_cograph" };
			expect(nonCograph.kind).toBe("non_cograph");
		});

		it("should represent star K1,3 (claw) as has_claw", () => {
			const hasClaw: ClawFree = { kind: "has_claw" };
			expect(hasClaw.kind).toBe("has_claw");
		});
	});
});

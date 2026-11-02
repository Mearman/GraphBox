import { describe, expect, it } from "vitest";

import { createSeededRng } from "../../../../proofs/test-utils";
import { selectSeedPair } from "./seed-pair-selection";

const NODE_IDS = ["a", "b", "c", "d", "e", "f"];

describe("selectSeedPair", () => {
	it("returns the same pairs for the same seed", () => {
		const draw = (): Array<[string, string]> => {
			const random = createSeededRng(7);
			return Array.from({ length: 20 }, () => selectSeedPair(NODE_IDS, random));
		};

		expect(draw()).toEqual(draw());
	});

	it("always returns two distinct members of the input", () => {
		const random = createSeededRng(3);
		for (let trial = 0; trial < 500; trial++) {
			const [first, second] = selectSeedPair(NODE_IDS, random);
			expect(first).not.toBe(second);
			expect(NODE_IDS).toContain(first);
			expect(NODE_IDS).toContain(second);
		}
	});

	it("returns both nodes when only two exist", () => {
		const random = createSeededRng(1);
		for (let trial = 0; trial < 50; trial++) {
			expect([...selectSeedPair(["x", "y"], random)].sort()).toEqual(["x", "y"]);
		}
	});

	it("covers every ordered pair over enough draws", () => {
		const random = createSeededRng(11);
		const seen = new Set<string>();
		for (let trial = 0; trial < 2000; trial++) {
			seen.add(selectSeedPair(NODE_IDS, random).join(">"));
		}

		expect(seen.size).toBe(NODE_IDS.length * (NODE_IDS.length - 1));
	});

	it("rejects fewer than two nodes", () => {
		expect(() => selectSeedPair(["only"], createSeededRng(1))).toThrow("at least two nodes");
	});
});

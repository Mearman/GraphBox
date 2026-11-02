/**
 * Seeded selection of seed pairs for multi-pair comparison tests.
 *
 * The pair is drawn from a caller-supplied generator so the pairs a test compares are identical on every run.
 */

import type { RandomSource } from "./graph-perturbation";

/**
 * Selects two distinct nodes uniformly at random.
 * @param nodeIds - Candidate node ids, at least two
 * @param random - Source of randomness, such as `createSeededRng(seed)`
 * @returns A pair of distinct ids drawn from `nodeIds`
 * @throws If `nodeIds` holds fewer than two entries
 */
export const selectSeedPair = (nodeIds: readonly string[], random: RandomSource): [string, string] => {
	if (nodeIds.length < 2) {
		throw new Error(`A seed pair needs at least two nodes, received ${nodeIds.length}`);
	}

	const index1 = Math.floor(random() * nodeIds.length);
	// Drawing from the n - 1 remaining positions and skipping index1 is uniform and needs no retry loop.
	const offset = Math.floor(random() * (nodeIds.length - 1));
	const index2 = offset >= index1 ? offset + 1 : offset;

	return [nodeIds[index1], nodeIds[index2]];
};

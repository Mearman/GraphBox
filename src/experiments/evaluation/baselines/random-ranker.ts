/**
 * Random path ranking baseline
 */

import type { RankedPath } from "../../../algorithms/pathfinding/path-ranking";
import type { Path } from "../../../algorithms/types/algorithm-results";
import type { Edge, Node } from "../../../algorithms/types/graph";

/**
 * Seeded random number generator for reproducibility.
 */
class SeededRandom {
	private seed: number;

	constructor(seed: number) {
		this.seed = seed;
	}

	/**
	 * Generate next random number in [0, 1).
	 */
	next(): number {
		const x = Math.sin(this.seed++) * 10_000;
		return x - Math.floor(x);
	}

	/**
	 * Shuffle array using Fisher-Yates algorithm with seeded random.
	 * @param array
	 */
	shuffle<T>(array: T[]): T[] {
		const result = [...array];
		for (let index = result.length - 1; index > 0; index--) {
			const index_ = Math.floor(this.next() * (index + 1));
			[result[index], result[index_]] = [result[index_], result[index]];
		}
		return result;
	}
}

/**
 * Random path ranking baseline.
 * Shuffles paths randomly for comparison.
 *
 * @param paths - Paths to rank
 * @param seed - Random seed for reproducibility
 * @returns Randomly ordered paths with scores
 */
export const randomRanker = <N extends Node, E extends Edge>(paths: Path<N, E>[], seed?: number): RankedPath<N, E>[] => {
	const rng = new SeededRandom(seed ?? Date.now());

	// Shuffle paths randomly
	const shuffled = rng.shuffle(paths);

	// Assign descending scores (1.0 for first, lower for subsequent)
	return shuffled.map((path, index) => ({
		path,
		score: 1 - index / shuffled.length,
		geometricMeanMI: 0, // No MI computation for random baseline
		edgeMIValues: [],
	}));
};

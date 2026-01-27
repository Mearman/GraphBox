import type { FrontierState } from "../../frontier-state.js";
import type { TerminationStrategy } from "./termination-strategy.js";

/**
 * Full Pairwise Termination Strategy
 *
 * Terminates expansion when every seed pair has achieved overlap.
 * This is the strictest termination condition, requiring C(N,2) pairwise overlaps.
 *
 * **Algorithm**: Build an overlap graph where nodes = frontiers and edges = overlaps.
 * Terminate when the overlap graph is complete (all possible edges exist).
 *
 * **Complexity**: O(N²) where N = number of seeds (frontiers)
 *
 * **Thesis Alignment**: This strategy ensures maximum connectivity between all
 * seed regions, providing the strongest guarantee of a well-sampled between-graph
 * at the cost of potentially longer execution time.
 */
export class FullPairwiseStrategy implements TerminationStrategy {
	/** Strategy identifier for naming SUT variants */
	readonly id = "full-pairwise";

	/**
	 * Check if expansion should terminate based on current state.
	 *
	 * @param allFrontiers - All frontiers in the expansion
	 * @param overlapEvents - All recorded overlap events so far
	 * @param _iteration - Current iteration count (unused)
	 * @returns true if expansion should terminate
	 */
	shouldTerminate(
		allFrontiers: FrontierState[],
		overlapEvents: readonly { frontierA: number; frontierB: number }[],
		_iteration: number
	): boolean {
		const n = allFrontiers.length;

		// N=1 is a special case - no overlap possible
		if (n <= 1) {
			return true;
		}

		// Build set of overlapping pairs
		const overlappingPairs = new Set<string>();
		for (const event of overlapEvents) {
			const key = this.getPairKey(event.frontierA, event.frontierB);
			overlappingPairs.add(key);
		}

		// Required pairs: C(N,2) = N * (N-1) / 2
		const requiredPairs = (n * (n - 1)) / 2;

		// Terminate when all pairs have overlapped
		return overlappingPairs.size >= requiredPairs;
	}

	/**
	 * Get a canonical key for a pair of frontier indices.
	 *
	 * @param a - First frontier index
	 * @param b - Second frontier index
	 * @returns Canonical pair key (sorted)
	 * @private
	 */
	private getPairKey(a: number, b: number): string {
		return a < b ? `${a}-${b}` : `${b}-${a}`;
	}
}

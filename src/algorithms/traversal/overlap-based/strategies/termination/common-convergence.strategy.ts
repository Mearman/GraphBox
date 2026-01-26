import type { TerminationStrategy } from "./termination-strategy.js";
import type { FrontierState } from "../../frontier-state.js";

/**
 * Common Convergence Termination Strategy
 *
 * Terminates expansion when all seeds share at least one common visited node.
 * This is the weakest termination condition, allowing termination as soon as
 * a single node is reached by all frontiers.
 *
 * **Algorithm**: Track the intersection of all visited sets. Terminate when
 * the intersection is non-empty (at least one node visited by all frontiers).
 *
 * **Complexity**: O(N × V) where N = number of seeds, V = visited set sizes
 *
 * **Thesis Alignment**: This strategy provides the earliest possible termination
 * for connected seed regions, making it suitable for time-constrained scenarios
 * where any convergent path is sufficient.
 */
export class CommonConvergenceStrategy implements TerminationStrategy {
	/** Strategy identifier for naming SUT variants */
	readonly id = "common-convergence";

	/**
	 * Check if expansion should terminate based on current state.
	 *
	 * @param allFrontiers - All frontiers in the expansion
	 * @param _overlapEvents - All recorded overlap events (unused, we use visited sets directly)
	 * @param _iteration - Current iteration count (unused)
	 * @returns true if expansion should terminate
	 */
	shouldTerminate(
		allFrontiers: FrontierState[],
		_overlapEvents: readonly { frontierA: number; frontierB: number }[],
		_iteration: number
	): boolean {
		const n = allFrontiers.length;

		// N=1 is a special case - no overlap possible
		if (n <= 1) {
			return true;
		}

		// Find intersection of all visited sets
		const commonNodes = this.findCommonVisitedNodes(allFrontiers);

		// Terminate if at least one node is visited by all frontiers
		return commonNodes.size > 0;
	}

	/**
	 * Find nodes that are visited by all frontiers.
	 *
	 * Computes the intersection of all visited sets.
	 *
	 * @param allFrontiers - All frontiers in the expansion
	 * @returns Set of nodes visited by all frontiers
	 * @private
	 */
	private findCommonVisitedNodes(allFrontiers: FrontierState[]): Set<string> {
		if (allFrontiers.length === 0) {
			return new Set();
		}

		// Start with the first frontier's visited set
		const commonNodes = new Set(allFrontiers[0].visited);

		// Intersect with each subsequent frontier's visited set
		for (let i = 1; i < allFrontiers.length; i++) {
			const otherVisited = allFrontiers[i].visited;

			// Remove nodes not in this frontier's visited set
			for (const node of commonNodes) {
				if (!otherVisited.has(node)) {
					commonNodes.delete(node);
				}
			}

			// Early exit if intersection is empty
			if (commonNodes.size === 0) {
				break;
			}
		}

		return commonNodes;
	}
}

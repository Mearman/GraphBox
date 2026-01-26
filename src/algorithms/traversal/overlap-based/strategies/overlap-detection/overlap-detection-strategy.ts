import type { FrontierState } from "../../frontier-state.js";

/**
 * Strategy for detecting overlap between seed search regions during expansion.
 *
 * Called during node expansion to determine if a newly discovered node
 * represents an overlap event that should be tracked.
 *
 * @template TFrontier - Type of frontier state (for type safety)
 */
export interface OverlapDetectionStrategy {
	/**
	 * Strategy identifier for naming SUT variants.
	 */
	readonly id: string;

	/**
	 * Check if adding this node creates overlap with other frontiers.
	 *
	 * @param targetId - Node being added to active frontier
	 * @param activeFrontier - The frontier that is expanding
	 * @param allFrontiers - All frontiers in the expansion
	 * @param nodeToFrontierIndex - O(1) map tracking which frontier owns each node
	 * @returns Array of frontier indices that overlap with active frontier
	 */
	detectOverlap(
		targetId: string,
		activeFrontier: FrontierState,
		allFrontiers: FrontierState[],
		nodeToFrontierIndex: Map<string, number>
	): number[];
}

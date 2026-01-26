import type { OverlapDetectionStrategy } from "./overlap-detection-strategy.js";
import type { FrontierState } from "../../frontier-state.js";

/**
 * Physical Meeting Overlap Detection Strategy
 *
 * Detects overlap when two frontiers physically visit the same node.
 * This is the O(1) overlap detection method used in DegreePrioritisedExpansion,
 * which tracks which frontier owns each node via a `nodeToFrontierIndex` Map.
 *
 * **Algorithm**: When adding a node to the active frontier, check if another
 * frontier already owns it via O(1) Map lookup. If so, return that frontier's index.
 *
 * **Complexity**: O(1) per node added
 *
 * **Thesis Alignment**: This is the original overlap detection method from
 * DegreePrioritisedExpansion, providing the baseline for comparison with
 * more sophisticated strategies.
 */
export class PhysicalMeetingStrategy implements OverlapDetectionStrategy {
	/** Strategy identifier for naming SUT variants */
	readonly id = "physical-meeting";

	/**
	 * Check if adding this node creates overlap with other frontiers.
	 *
	 * Uses O(1) Map lookup to check if another frontier already visited this node.
	 *
	 * @param targetId - Node being added to active frontier
	 * @param activeFrontier - The frontier that is expanding
	 * @param _allFrontiers - All frontiers in the expansion (unused)
	 * @param nodeToFrontierIndex - O(1) map tracking which frontier owns each node
	 * @returns Array of frontier indices that overlap with active frontier
	 */
	detectOverlap(
		targetId: string,
		activeFrontier: FrontierState,
		_allFrontiers: FrontierState[],
		nodeToFrontierIndex: Map<string, number>
	): number[] {
		const otherIndex = nodeToFrontierIndex.get(targetId);

		// If another frontier already visited this node, we have overlap
		if (otherIndex !== undefined && otherIndex !== activeFrontier.index) {
			return [otherIndex];
		}

		return [];
	}
}

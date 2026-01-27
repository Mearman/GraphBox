import type { FrontierState } from "../../frontier-state.js";
import type { OverlapDetectionStrategy } from "./overlap-detection-strategy.js";

/**
 * Configuration for SphereIntersectionStrategy.
 */
export interface SphereIntersectionConfig {
	/**
	 * Maximum distance from seed for overlap detection.
	 * Default: Infinity (no limit)
	 */
	maxDistance?: number;
}

/**
 * Sphere Intersection Overlap Detection Strategy
 *
 * Detects overlap when a node falls within another frontier's search radius.
 * This strategy models each frontier as an N-dimensional sphere expanding
 * from its seed, where radius = maximum distance of any visited node.
 *
 * **Algorithm**: Track the distance from seed for each visited node. When
 * adding a node, check if its distance from the active frontier's seed is
 * within another frontier's current radius:
 *
 * ```
 * overlap if: distance(targetId, seedA) <= radius_of_frontier_B
 * ```
 *
 * **Complexity**: O(N) per node added where N = number of frontiers
 *
 * **Thesis Alignment**: This strategy models the geometric intuition of
 * "search regions meeting" in N-dimensional space, providing early
 * termination based on spatial proximity rather than physical node sharing.
 */
export class SphereIntersectionStrategy implements OverlapDetectionStrategy {
	/** Strategy identifier for naming SUT variants */
	readonly id = "sphere-intersection";

	/** Maximum distance for overlap detection */
	private readonly maxDistance: number;

	/**
	 * Create a SphereIntersection strategy.
	 *
	 * @param config - Strategy configuration
	 */
	constructor(config: SphereIntersectionConfig = {}) {
		this.maxDistance = config.maxDistance ?? Infinity;
	}

	/**
	 * Check if adding this node creates overlap with other frontiers.
	 *
	 * Checks if the node's distance from the active seed is within any
	 * other frontier's current radius.
	 *
	 * @param targetId - Node being added to active frontier
	 * @param activeFrontier - The frontier that is expanding
	 * @param allFrontiers - All frontiers in the expansion
	 * @param _nodeToFrontierIndex - O(1) map (unused, we use distance tracking)
	 * @returns Array of frontier indices that overlap with active frontier
	 */
	detectOverlap(
		targetId: string,
		activeFrontier: FrontierState,
		allFrontiers: FrontierState[],
		_nodeToFrontierIndex: Map<string, number>
	): number[] {
		const overlapping: number[] = [];

		// Get distance from active frontier's seed to this node
		const targetDistance = activeFrontier.nodeDistances?.get(targetId);

		if (targetDistance === undefined) {
			// Distance not tracked, fall back to no overlap
			return overlapping;
		}

		// Check if this distance is within any other frontier's radius
		for (const otherFrontier of allFrontiers) {
			if (otherFrontier.index === activeFrontier.index) continue;

			const otherRadius = otherFrontier.nodeDistances
				? this.calculateFrontierRadius(otherFrontier.nodeDistances)
				: 0;

			if (targetDistance <= otherRadius && targetDistance <= this.maxDistance) {
				overlapping.push(otherFrontier.index);
			}
		}

		return overlapping;
	}

	/**
	 * Calculate the current radius of a frontier.
	 *
	 * Radius = maximum distance of any visited node from the seed.
	 *
	 * @param nodeDistances - Map of node IDs to distances from seed
	 * @returns Current frontier radius
	 * @private
	 */
	private calculateFrontierRadius(nodeDistances: Map<string, number>): number {
		let maxDistance = 0;
		for (const distance of nodeDistances.values()) {
			if (distance > maxDistance) {
				maxDistance = distance;
			}
		}
		return maxDistance;
	}
}

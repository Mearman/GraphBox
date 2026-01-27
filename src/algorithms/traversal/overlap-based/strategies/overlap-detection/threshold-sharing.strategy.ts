import type { FrontierState } from "../../frontier-state.js";
import type { OverlapDetectionStrategy } from "./overlap-detection-strategy.js";

/**
 * Configuration for ThresholdSharingStrategy.
 */
export interface ThresholdSharingConfig {
	/**
	 * Minimum Jaccard similarity threshold to consider frontiers as overlapping.
	 * Range: [0, 1] where 0 = no overlap, 1 = identical sets
	 * Default: 0.5 (50% overlap)
	 */
	threshold?: number;
}

/**
 * Threshold Sharing Overlap Detection Strategy
 *
 * Detects overlap when the Jaccard similarity between two frontiers' visited
 * sets exceeds a threshold. Jaccard similarity measures the ratio of shared
 * nodes to the union of visited nodes.
 *
 * **Algorithm**: Calculate Jaccard similarity between the active frontier's
 * visited set and each other frontier's visited set:
 *
 * ```
 * J(A,B) = |A ∩ B| / |A ∪ B|
 * ```
 *
 * Return all other frontiers where J(active, other) >= threshold.
 *
 * **Complexity**: O(N × V) where N = number of frontiers, V = visited set sizes
 *
 * **Thesis Alignment**: This strategy detects "soft" overlap before physical
 * meeting occurs, potentially enabling earlier termination at the cost of
 * additional computation per node added.
 */
export class ThresholdSharingStrategy implements OverlapDetectionStrategy {
	/** Strategy identifier for naming SUT variants */
	readonly id = "threshold-sharing";

	/** Minimum similarity threshold (default 0.5) */
	private readonly threshold: number;

	/**
	 * Create a ThresholdSharing strategy.
	 *
	 * @param config - Strategy configuration
	 */
	constructor(config: ThresholdSharingConfig = {}) {
		this.threshold = config.threshold ?? 0.5;
	}

	/**
	 * Check if adding this node creates overlap with other frontiers.
	 *
	 * Calculates Jaccard similarity between the active frontier's visited set
	 * (including the new node) and each other frontier's visited set.
	 *
	 * @param targetId - Node being added to active frontier
	 * @param activeFrontier - The frontier that is expanding
	 * @param allFrontiers - All frontiers in the expansion
	 * @param _nodeToFrontierIndex - O(1) map (unused, we use set operations)
	 * @returns Array of frontier indices that overlap with active frontier
	 */
	detectOverlap(
		targetId: string,
		activeFrontier: FrontierState,
		allFrontiers: FrontierState[],
		_nodeToFrontierIndex: Map<string, number>
	): number[] {
		const overlapping: number[] = [];

		// Create temporary visited set including the new node
		const activeVisitedWithNew = new Set(activeFrontier.visited);
		activeVisitedWithNew.add(targetId);

		// Check Jaccard similarity with each other frontier
		for (const otherFrontier of allFrontiers) {
			if (otherFrontier.index === activeFrontier.index) continue;

			const similarity = this.calculateJaccardSimilarity(
				activeVisitedWithNew,
				otherFrontier.visited
			);

			if (similarity >= this.threshold) {
				overlapping.push(otherFrontier.index);
			}
		}

		return overlapping;
	}

	/**
	 * Calculate Jaccard similarity between two sets.
	 *
	 * J(A,B) = |A ∩ B| / |A ∪ B|
	 *
	 * @param setA - First set
	 * @param setB - Second set
	 * @returns Jaccard similarity coefficient [0, 1]
	 * @private
	 */
	private calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
		// Calculate intersection size
		let intersection = 0;
		for (const item of setA) {
			if (setB.has(item)) {
				intersection++;
			}
		}

		// Calculate union size
		const union = setA.size + setB.size - intersection;

		// Avoid division by zero
		if (union === 0) return 0;

		return intersection / union;
	}
}

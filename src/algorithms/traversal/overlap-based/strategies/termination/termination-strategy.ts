import type { FrontierState } from "../../frontier-state.js";

/**
 * Strategy for determining when overlap-based expansion should terminate.
 *
 * Called after each iteration to check if global termination conditions
 * have been satisfied based on overlap state.
 *
 * @template TFrontier - Type of frontier state (for type safety)
 */
export interface TerminationStrategy {
	/**
	 * Strategy identifier for naming SUT variants.
	 */
	readonly id: string;

	/**
	 * Check if expansion should terminate based on current state.
	 *
	 * @param allFrontiers - All frontiers in the expansion
	 * @param overlapEvents - All recorded overlap events so far
	 * @param iteration - Current iteration count
	 * @returns true if expansion should terminate
	 */
	shouldTerminate(
		allFrontiers: FrontierState[],
		overlapEvents: OverlapEvent[],
		iteration: number
	): boolean;
}

/**
 * Recorded overlap event during expansion.
 *
 * Tracks when two frontiers discovered each other's visited nodes.
 */
export interface OverlapEvent {
	/** Iteration when overlap occurred */
	readonly iteration: number;

	/** Index of first frontier involved in overlap */
	readonly frontierA: number;

	/** Index of second frontier involved in overlap */
	readonly frontierB: number;

	/** Node where frontiers met */
	readonly meetingNode: string;
}

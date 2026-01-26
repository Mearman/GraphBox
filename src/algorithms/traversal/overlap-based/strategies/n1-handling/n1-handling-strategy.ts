import type { FrontierState } from "../../frontier-state.js";

/**
 * Strategy for handling N=1 (single seed) scenario where overlap is impossible.
 *
 * When N=1, there are no other seeds to overlap with. This strategy provides
 * alternative termination criteria (e.g., coverage threshold).
 *
 * @template TFrontier - Type of frontier state (for type safety)
 */
export interface N1HandlingStrategy {
	/**
	 * Strategy identifier for naming SUT variants.
	 */
	readonly id: string;

	/**
	 * Check if single-seed expansion should terminate.
	 *
	 * @param frontier - The sole frontier's state
	 * @param totalNodes - Total nodes in graph (for coverage calculation, if available)
	 * @param iteration - Current iteration count
	 * @returns true if should terminate
	 */
	shouldTerminate(
		frontier: FrontierState,
		totalNodes?: number,
		iteration?: number
	): boolean;
}

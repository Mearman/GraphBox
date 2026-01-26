import { PriorityQueue } from "../priority-queue";

/**
 * State of a single frontier during expansion.
 *
 * This type is shared across the overlap-based expansion system
 * for use in strategy interfaces.
 *
 * @template T - Type of priority queue items (node IDs as strings)
 */
export interface FrontierState {
	/** Index of this frontier (corresponds to seed position) */
	index: number;

	/** Priority queue of nodes to expand */
	frontier: PriorityQueue<string>;

	/** Set of nodes visited by this frontier */
	visited: Set<string>;

	/** Parent pointers for path reconstruction */
	parents: Map<string, { parent: string; edge: string }>;
}

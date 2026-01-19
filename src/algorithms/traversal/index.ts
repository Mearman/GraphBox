/**
 * Traversal algorithms for graph exploration.
 *
 * Provides BFS, DFS, bidirectional BFS, and degree-prioritised expansion.
 */

// Priority calculation for thesis-aligned degree-prioritised expansion
export type { InvalidInputError, TraversalResult } from "./bfs";
export { bfs } from "./bfs";
export type { BidirectionalBFSOptions, BidirectionalBFSResult } from "./bidirectional-bfs";
export { BidirectionalBFS } from "./bidirectional-bfs";
export type { DegreePrioritisedExpansionResult, ExpansionStats } from "./degree-prioritised-expansion";
export { DegreePrioritisedExpansion } from "./degree-prioritised-expansion";
export type { DFSTraversalResult } from "./dfs";
export { dfs } from "./dfs";
export type { PriorityOptions } from "./priority-calculator";
export {
	calculatePriority,
	calculatePriorityFromNeighbors,
	createPriorityCalculator,
	DEFAULT_EPSILON,
	DEFAULT_NODE_WEIGHT,
	legacyCalculatePriority,
} from "./priority-calculator";
export { PriorityQueue } from "./priority-queue";

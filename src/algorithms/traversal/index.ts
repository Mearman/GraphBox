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
export { EntropyGuidedExpansion } from "./entropy-guided-expansion";
export { HeterogeneityAwareExpansion } from "./heterogeneity-aware-expansion";
export type { IntelligentDelayedTerminationConfig } from "./intelligent-delayed-termination";
export { IntelligentDelayedTermination } from "./intelligent-delayed-termination";
export type { MFASFConfig } from "./multi-frontier-adaptive-expansion";
export { MultiFrontierAdaptiveExpansion } from "./multi-frontier-adaptive-expansion";
export type { PathPreservingExpansionConfig } from "./path-preserving-expansion";
export { PathPreservingExpansion } from "./path-preserving-expansion";
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
export { RetrospectiveSalienceExpansion } from "./retrospective-salience-expansion";
export {
	computeNodeSalienceFromRankedPaths,
	computeNodeSalienceScores,
	SaliencePrioritisedExpansion,
} from "./salience-prioritised-expansion";

// Overlap-based expansion family (27 algorithm variants via strategy composition)
export type {
	BetweenGraphOutput,
	BetweenGraphStrategy,
	CoverageThresholdConfig,
	FrontierState,
	N1HandlingStrategy,
	OverlapBasedExpansionConfig,
	OverlapBasedExpansionResult,
	OverlapDetectionStrategy,
	OverlapEvent,
	OverlapMetadata,
	SaliencePreservingConfig,
	SphereIntersectionConfig,
	TerminationStrategy,
	ThresholdSharingConfig,
} from "./overlap-based";
export {
	// Termination Strategies
	CommonConvergenceStrategy,
	// N=1 Handling Strategies
	CoverageThresholdStrategy,
	FullPairwiseStrategy,
	// Between-Graph Strategies
	MinimalPathsStrategy,
	// Core
	OverlapBasedExpansion,
	// Overlap Detection Strategies
	PhysicalMeetingStrategy,
	SaliencePreservingStrategy,
	SphereIntersectionStrategy,
	ThresholdSharingStrategy,
	TransitiveConnectivityStrategy,
	TruncatedComponentStrategy,
} from "./overlap-based";
